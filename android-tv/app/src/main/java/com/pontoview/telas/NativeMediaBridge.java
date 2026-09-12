package com.pontoview.telas;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.SurfaceView;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;

import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.VideoSize;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.database.StandaloneDatabaseProvider;
import androidx.media3.datasource.DataSpec;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.cache.CacheDataSource;
import androidx.media3.datasource.cache.CacheWriter;
import androidx.media3.datasource.cache.ContentMetadata;
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor;
import androidx.media3.datasource.cache.SimpleCache;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.AspectRatioFrameLayout;

import org.json.JSONArray;
import org.videolan.libvlc.LibVLC;
import org.videolan.libvlc.interfaces.IVLCVout;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@UnstableApi
public class NativeMediaBridge {
    private static final String TAG = "PontoViewNative";
    private static final long VIDEO_CACHE_BYTES = 1792L * 1024L * 1024L;
    private static final long IMAGE_CACHE_BYTES = 256L * 1024L * 1024L;
    private static final long MAX_IMAGE_DOWNLOAD_BYTES = 80L * 1024L * 1024L;
    private static final String FUNCTIONS_URL = "https://fpdojntvnhiszagczfqr.supabase.co/functions/v1";
    private static final String PUBLISHABLE_KEY = "sb_publishable_hd9GQaTeJ18o3pwMIZevJQ_EgVIOVOp";

    private final Activity activity;
    private final WebView webView;
    private final FrameLayout nativeLayer;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final String sessionToken = UUID.randomUUID().toString();
    private final ExecutorService imageExecutor = Executors.newFixedThreadPool(2);
    private final ExecutorService preloadExecutor = Executors.newSingleThreadExecutor();
    private final Set<String> preloadingVideos = ConcurrentHashMap.newKeySet();
    private final Set<String> preloadingImages = ConcurrentHashMap.newKeySet();

    private final File imageCacheDir;
    private final File imageTempDir;
    private final File videoLibraryDir;
    private final File videoTempDir;
    private final SimpleCache videoCache;
    private final CacheDataSource.Factory cacheDataSourceFactory;

    private ExoPlayer player;
    private AspectRatioFrameLayout videoFrame;
    private SurfaceView surfaceView;
    private ImageView imageView;
    private LibVLC libVLC;
    private org.videolan.libvlc.MediaPlayer vlcPlayer;
    private final Handler videoWatchdog = new Handler(Looper.getMainLooper());
    private Runnable firstFrameTimeout;
    private boolean firstFrameRendered;
    private String activeVideoId;
    private String activeImageId;

    public NativeMediaBridge(Activity activity, WebView webView, FrameLayout nativeLayer) {
        this.activity = activity;
        this.webView = webView;
        this.nativeLayer = nativeLayer;

        imageCacheDir = new File(activity.getFilesDir(), "pv-image-library");
        imageTempDir = new File(activity.getCacheDir(), "pv-image-temp");
        videoLibraryDir = new File(activity.getFilesDir(), "pv-video-library-files");
        videoTempDir = new File(activity.getCacheDir(), "pv-video-temp");
        imageCacheDir.mkdirs();
        imageTempDir.mkdirs();
        videoLibraryDir.mkdirs();
        videoTempDir.mkdirs();

        StandaloneDatabaseProvider databaseProvider = new StandaloneDatabaseProvider(activity);
        videoCache = new SimpleCache(
                new File(activity.getFilesDir(), "pv-video-library"),
                new LeastRecentlyUsedCacheEvictor(VIDEO_CACHE_BYTES),
                databaseProvider
        );

        DefaultHttpDataSource.Factory upstream = new DefaultHttpDataSource.Factory()
                .setUserAgent("PontoViewTV/2.0.0-beta8")
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(60000)
                .setAllowCrossProtocolRedirects(true);

        cacheDataSourceFactory = new CacheDataSource.Factory()
                .setCache(videoCache)
                .setUpstreamDataSourceFactory(upstream)
                .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR);
    }

    public String getSessionToken() {
        return sessionToken;
    }

    @JavascriptInterface
    public String getVersion() {
        return "2.0.0-beta8";
    }

    @JavascriptInterface
    public void setAutoStart(String session, boolean enabled) {
        if (!validSession(session)) return;
        SharedPreferences prefs = activity.getSharedPreferences("pontoview_player", Context.MODE_PRIVATE);
        prefs.edit().putBoolean("auto_start", enabled).apply();
    }


    @JavascriptInterface
    public void syncManifest(String session, String screenId, String token, String manifestJson) {
        if (!validSession(session) || empty(screenId) || empty(token) || empty(manifestJson)) return;
        preloadExecutor.execute(() -> {
            try {
                JSONObject manifest = new JSONObject(manifestJson);
                JSONObject settings = manifest.optJSONObject("settings");
                if (settings != null) {
                    activity.getSharedPreferences("pontoview_player", Context.MODE_PRIVATE).edit()
                            .putBoolean("auto_start", settings.optBoolean("auto_start", true)).apply();
                }
                JSONArray items = manifest.optJSONArray("items");
                if (items == null) return;
                for (int i = 0; i < items.length(); i++) {
                    JSONObject row = items.optJSONObject(i);
                    JSONObject media = row != null ? row.optJSONObject("media") : null;
                    if (media == null) continue;
                    String mediaId = media.optString("id", "");
                    String type = media.optString("type", "");
                    if (empty(mediaId) || (!"drive_video".equals(type) && !"drive_image".equals(type))) continue;
                    String checksum = media.optString("driveChecksum", "latest");
                    if (empty(checksum) || "null".equalsIgnoreCase(checksum)) checksum = "latest";
                    String cacheKey = screenId + ":" + mediaId + ":" + checksum;
                    if ("drive_video".equals(type) && hasCachedVideo(session, cacheKey)) continue;
                    if ("drive_image".equals(type) && hasCachedImage(session, cacheKey)) continue;
                    String streamUrl = requestDriveTicket(screenId, token, mediaId);
                    if (empty(streamUrl)) continue;
                    if ("drive_video".equals(type)) cacheVideoFully(streamUrl, cacheKey);
                    else ensureOptimizedImage(streamUrl, cacheKey, Math.max(1280, Math.max(webView.getWidth(), webView.getHeight())));
                }
            } catch (Exception e) {
                Log.w(TAG, "Manifest sync failed", e);
            }
        });
    }

    private String requestDriveTicket(String screenId, String token, String mediaId) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(FUNCTIONS_URL + "/drive-media").openConnection();
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("Content-Type", "application/json");
        c.setRequestProperty("apikey", PUBLISHABLE_KEY);
        c.setRequestProperty("x-screen-id", screenId);
        c.setRequestProperty("x-screen-token", token);
        c.setRequestProperty("User-Agent", "PontoViewTV/2.0.0-beta8");
        byte[] body = new JSONObject().put("mediaId", mediaId).put("action", "ticket")
                .toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        try (java.io.OutputStream out = c.getOutputStream()) { out.write(body); }
        int status = c.getResponseCode();
        if (status < 200 || status >= 300) {
            c.disconnect();
            throw new IllegalStateException("ticket_http_" + status);
        }
        StringBuilder txt = new StringBuilder();
        try (java.io.BufferedReader r = new java.io.BufferedReader(
                new java.io.InputStreamReader(c.getInputStream(), java.nio.charset.StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) txt.append(line);
        } finally {
            c.disconnect();
        }
        return new JSONObject(txt.toString()).optString("streamUrl", "");
    }

    private void cacheVideoFully(String streamUrl, String cacheKey) throws Exception {
        File destination = videoFile(cacheKey);
        if (destination.exists() && destination.length() > 0) {
            destination.setLastModified(System.currentTimeMillis());
            return;
        }

        Object lock = ("video:" + cacheKey).intern();
        synchronized (lock) {
            if (destination.exists() && destination.length() > 0) {
                destination.setLastModified(System.currentTimeMillis());
                return;
            }

            File staged = File.createTempFile("pv-video-", ".part", videoTempDir);
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(streamUrl).openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(120000);
                connection.setRequestProperty("User-Agent", "PontoViewTV/2.0.0-beta8");
                connection.connect();

                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) throw new IllegalStateException("video_http_" + status);

                long declared = connection.getContentLengthLong();
                if (declared > VIDEO_CACHE_BYTES) throw new IllegalStateException("video_too_large");

                long total = 0;
                byte[] buffer = new byte[256 * 1024];
                try (InputStream input = new BufferedInputStream(connection.getInputStream());
                     FileOutputStream output = new FileOutputStream(staged)) {
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        total += read;
                        if (total > VIDEO_CACHE_BYTES) throw new IllegalStateException("video_too_large");
                        output.write(buffer, 0, read);
                    }
                    output.getFD().sync();
                }

                if (total <= 0) throw new IllegalStateException("video_empty");

                trimVideoLibrary(Math.max(0L, total));
                if (!staged.renameTo(destination)) copyFile(staged, destination);
                if (destination.length() != total) throw new IllegalStateException("video_copy_incomplete");
                destination.setLastModified(System.currentTimeMillis());
                trimVideoLibrary(0L);
            } finally {
                if (connection != null) connection.disconnect();
                staged.delete();
            }
        }
    }

    @JavascriptInterface
    public boolean hasCachedVideo(String session, String cacheKey) {
        if (!validSession(session) || empty(cacheKey)) return false;
        File file = videoFile(cacheKey);
        if (file.exists() && file.length() > 0) {
            file.setLastModified(System.currentTimeMillis());
            return true;
        }
        return false;
    }

    @JavascriptInterface
    public boolean hasCachedImage(String session, String cacheKey) {
        if (!validSession(session) || empty(cacheKey)) return false;
        File file = optimizedImageFile(cacheKey);
        if (file.exists() && file.length() > 0) {
            file.setLastModified(System.currentTimeMillis());
            return true;
        }
        return false;
    }

    @JavascriptInterface
    public String getCacheStatus(String session) {
        if (!validSession(session)) return "{}";
        try {
            JSONObject json = new JSONObject();
            json.put("version", getVersion());
            json.put("videoBytes", directoryBytes(videoLibraryDir));
            json.put("videoLimitBytes", VIDEO_CACHE_BYTES);
            json.put("imageBytes", directoryBytes(imageCacheDir));
            json.put("imageLimitBytes", IMAGE_CACHE_BYTES);
            return json.toString();
        } catch (Exception ignored) {
            return "{}";
        }
    }

    @JavascriptInterface
    public void preloadVideo(String session, String streamUrl, String cacheKey) {
        if (!validSession(session) || !validHttpsUrl(streamUrl) || empty(cacheKey)) return;
        if (hasCachedVideo(session, cacheKey) || !preloadingVideos.add(cacheKey)) return;
        preloadExecutor.execute(() -> {
            try {
                cacheVideoFully(streamUrl, cacheKey);
            } catch (Exception error) {
                Log.w(TAG, "Video preload failed", error);
            } finally {
                preloadingVideos.remove(cacheKey);
            }
        });
    }

    @JavascriptInterface
    public void preloadImage(String session, String streamUrl, String cacheKey) {
        if (!validSession(session) || !validHttpsUrl(streamUrl) || empty(cacheKey)) return;
        if (hasCachedImage(session, cacheKey) || !preloadingImages.add(cacheKey)) return;
        imageExecutor.execute(() -> {
            try {
                int target = Math.max(webView.getWidth(), webView.getHeight());
                ensureOptimizedImage(streamUrl, cacheKey, Math.max(1280, target));
            } catch (Exception error) {
                Log.w(TAG, "Image preload failed", error);
            } finally {
                preloadingImages.remove(cacheKey);
            }
        });
    }


    @JavascriptInterface
    public void playVideo(
            String session, String streamUrl, String cacheKey, String playbackId,
            double x, double y, double width, double height, double rotation,
            double viewportWidth, double viewportHeight, boolean muted, double volume
    ) {
        if (!validSession(session) || empty(cacheKey) || empty(playbackId)) return;

        Runnable startLocal = () -> {
            File localFile = videoFile(cacheKey);
            if (!localFile.exists() || localFile.length() <= 0) {
                sendError(playbackId, "native_video_file_missing");
                return;
            }
            localFile.setLastModified(System.currentTimeMillis());
            startMedia3(localFile, playbackId, x, y, width, height, rotation, viewportWidth, viewportHeight, muted, volume);
        };

        if (hasCachedVideo(session, cacheKey)) {
            startLocal.run();
            return;
        }

        if (!validHttpsUrl(streamUrl)) {
            sendError(playbackId, "native_video_download_url_missing");
            return;
        }

        preloadExecutor.execute(() -> {
            try {
                sendDiagnostics(playbackId, "downloading_full_file", 0, 0);
                cacheVideoFully(streamUrl, cacheKey);
                startLocal.run();
            } catch (Exception e) {
                Log.w(TAG, "Full video download failed", e);
                sendError(playbackId, "native_video_full_download_failed");
            }
        });
    }

    private void startMedia3(
            File localFile,
            String playbackId,
            double x, double y, double width, double height, double rotation,
            double viewportWidth, double viewportHeight,
            boolean muted, double volume
    ) {
        main.post(() -> {
            stopVideoInternal();
            stopImageInternal();

            activeVideoId = playbackId;
            firstFrameRendered = false;

            videoFrame = new AspectRatioFrameLayout(activity);
            videoFrame.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
            videoFrame.setBackgroundColor(Color.BLACK);

            surfaceView = new SurfaceView(activity);
            surfaceView.setBackgroundColor(Color.BLACK);
            videoFrame.addView(surfaceView, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
            ));
            nativeLayer.addView(videoFrame);
            applyBounds(videoFrame, x, y, width, height, rotation, viewportWidth, viewportHeight);
            nativeLayer.setVisibility(View.VISIBLE);

            DefaultDataSource.Factory localDataSource = new DefaultDataSource.Factory(activity);
            DefaultRenderersFactory renderersFactory = new DefaultRenderersFactory(activity)
                    .setEnableDecoderFallback(true);

            player = new ExoPlayer.Builder(activity, renderersFactory)
                    .setMediaSourceFactory(new DefaultMediaSourceFactory(localDataSource))
                    .build();
            player.setVideoSurfaceView(surfaceView);
            player.setVolume(muted ? 0f : clampVolume(volume));
            player.addListener(new Player.Listener() {
                @Override
                public void onPlaybackStateChanged(int state) {
                    if (!playbackId.equals(activeVideoId)) return;
                    if (state == Player.STATE_READY) {
                        sendDiagnostics(playbackId, "media3_ready", 0, 0);
                    } else if (state == Player.STATE_ENDED) {
                        sendEnded(playbackId);
                    }
                }

                @Override
                public void onRenderedFirstFrame() {
                    if (!playbackId.equals(activeVideoId)) return;
                    firstFrameRendered = true;
                    if (firstFrameTimeout != null) videoWatchdog.removeCallbacks(firstFrameTimeout);
                    sendDiagnostics(playbackId, "media3_first_frame", 0, 0);
                }

                @Override
                public void onPlayerError(PlaybackException error) {
                    if (!playbackId.equals(activeVideoId)) return;
                    sendDiagnostics(playbackId, "media3_error_" + error.errorCode, 0, 0);
                    startVlcFallback(localFile, playbackId, x, y, width, height, rotation,
                            viewportWidth, viewportHeight, muted, volume, "media3_error_" + error.errorCode);
                }

                @Override
                public void onVideoSizeChanged(VideoSize size) {
                    if (!playbackId.equals(activeVideoId)) return;
                    if (size.height > 0 && videoFrame != null) {
                        videoFrame.setAspectRatio((size.width * size.pixelWidthHeightRatio) / size.height);
                    }
                    sendDiagnostics(playbackId, "media3_video_size", size.width, size.height);
                }
            });

            MediaItem item = new MediaItem.Builder().setUri(Uri.fromFile(localFile)).build();
            player.setMediaItem(item);
            player.prepare();
            player.play();

            firstFrameTimeout = () -> {
                if (!playbackId.equals(activeVideoId) || firstFrameRendered) return;
                sendDiagnostics(playbackId, "media3_no_first_frame", 0, 0);
                startVlcFallback(localFile, playbackId, x, y, width, height, rotation,
                        viewportWidth, viewportHeight, muted, volume, "media3_no_first_frame");
            };
            videoWatchdog.postDelayed(firstFrameTimeout, 8000);
        });
    }

    private void startVlcFallback(
            File localFile,
            String playbackId,
            double x, double y, double width, double height, double rotation,
            double viewportWidth, double viewportHeight,
            boolean muted, double volume,
            String reason
    ) {
        main.post(() -> {
            if (!playbackId.equals(activeVideoId)) return;

            if (firstFrameTimeout != null) videoWatchdog.removeCallbacks(firstFrameTimeout);

            if (player != null) {
                try {
                    if (surfaceView != null) player.clearVideoSurfaceView(surfaceView);
                    player.stop();
                    player.release();
                } catch (Exception ignored) {}
                player = null;
            }
            if (videoFrame != null) nativeLayer.removeView(videoFrame);

            videoFrame = new AspectRatioFrameLayout(activity);
            videoFrame.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
            videoFrame.setBackgroundColor(Color.BLACK);
            surfaceView = new SurfaceView(activity);
            surfaceView.setBackgroundColor(Color.BLACK);
            videoFrame.addView(surfaceView, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
            ));
            nativeLayer.addView(videoFrame);
            applyBounds(videoFrame, x, y, width, height, rotation, viewportWidth, viewportHeight);
            nativeLayer.setVisibility(View.VISIBLE);

            try {
                if (libVLC == null) {
                    java.util.ArrayList<String> options = new java.util.ArrayList<>();
                    options.add("--no-drop-late-frames");
                    options.add("--no-skip-frames");
                    options.add("--avcodec-hw=any");
                    libVLC = new LibVLC(activity, options);
                }

                if (vlcPlayer != null) {
                    try { vlcPlayer.stop(); } catch (Exception ignored) {}
                    try { vlcPlayer.release(); } catch (Exception ignored) {}
                }

                vlcPlayer = new org.videolan.libvlc.MediaPlayer(libVLC);
                IVLCVout vout = vlcPlayer.getVLCVout();
                vout.setVideoView(surfaceView);
                vout.attachViews();

                vlcPlayer.setEventListener(event -> {
                    if (!playbackId.equals(activeVideoId)) return;
                    if (event.type == org.videolan.libvlc.MediaPlayer.Event.Playing) {
                        sendDiagnostics(playbackId, "vlc_playing_" + reason, 0, 0);
                    } else if (event.type == org.videolan.libvlc.MediaPlayer.Event.EndReached) {
                        sendEnded(playbackId);
                    } else if (event.type == org.videolan.libvlc.MediaPlayer.Event.EncounteredError) {
                        sendError(playbackId, "vlc_decode_failed");
                    } else if (event.type == org.videolan.libvlc.MediaPlayer.Event.Vout) {
                        sendDiagnostics(playbackId, "vlc_video_output", 0, 0);
                    }
                });

                org.videolan.libvlc.Media media = new org.videolan.libvlc.Media(libVLC, Uri.fromFile(localFile));
                media.setHWDecoderEnabled(true, false);
                vlcPlayer.setMedia(media);
                media.release();
                vlcPlayer.setVolume(muted ? 0 : Math.max(0, Math.min(100, (int) Math.round(volume * 100d))));
                vlcPlayer.play();
                sendDiagnostics(playbackId, "vlc_start_" + reason, 0, 0);
            } catch (Exception error) {
                Log.e(TAG, "VLC fallback failed", error);
                sendError(playbackId, "vlc_start_failed");
            }
        });
    }

    @JavascriptInterface
    public void showImage(
            String session,
            String streamUrl,
            String cacheKey,
            String playbackId,
            double x,
            double y,
            double width,
            double height,
            double rotation,
            double viewportWidth,
            double viewportHeight
    ) {
        if (!validSession(session) || empty(cacheKey) || empty(playbackId)) return;
        boolean cached = hasCachedImage(session, cacheKey);
        if (!cached && !validHttpsUrl(streamUrl)) {
            sendError(playbackId, "native_image_not_cached");
            return;
        }

        main.post(() -> {
            stopVideoInternal();
            stopImageInternal();

            activeImageId = playbackId;
            imageView = new ImageView(activity);
            imageView.setBackgroundColor(Color.BLACK);
            imageView.setScaleType(ImageView.ScaleType.FIT_CENTER);
            nativeLayer.addView(imageView);
            applyBounds(imageView, x, y, width, height, rotation, viewportWidth, viewportHeight);
            nativeLayer.setVisibility(View.VISIBLE);
        });

        imageExecutor.execute(() -> {
            try {
                File optimized = cached
                        ? optimizedImageFile(cacheKey)
                        : ensureOptimizedImage(streamUrl, cacheKey, Math.max(1280, Math.max(webView.getWidth(), webView.getHeight())));
                Bitmap bitmap = BitmapFactory.decodeFile(optimized.getAbsolutePath());
                if (bitmap == null) throw new IllegalStateException("optimized_image_decode_failed");
                optimized.setLastModified(System.currentTimeMillis());
                main.post(() -> {
                    if (!playbackId.equals(activeImageId) || imageView == null) {
                        bitmap.recycle();
                        return;
                    }
                    imageView.setImageBitmap(bitmap);
                    sendDiagnostics(playbackId, "image_ready", bitmap.getWidth(), bitmap.getHeight());
                });
            } catch (Exception error) {
                Log.w(TAG, "Image display failed", error);
                sendError(playbackId, "native_image_error");
            }
        });
    }

    @JavascriptInterface
    public void updateBounds(
            String session,
            String playbackId,
            double x,
            double y,
            double width,
            double height,
            double rotation,
            double viewportWidth,
            double viewportHeight
    ) {
        if (!validSession(session) || empty(playbackId)) return;
        main.post(() -> {
            if (playbackId.equals(activeVideoId) && videoFrame != null) {
                applyBounds(videoFrame, x, y, width, height, rotation, viewportWidth, viewportHeight);
            }
            if (playbackId.equals(activeImageId) && imageView != null) {
                applyBounds(imageView, x, y, width, height, rotation, viewportWidth, viewportHeight);
            }
        });
    }

    @JavascriptInterface
    public void stopVideo(String session, String playbackId) {
        if (!validSession(session) || !playbackId.equals(activeVideoId)) return;
        main.post(this::stopVideoInternal);
    }

    @JavascriptInterface
    public void stopImage(String session, String playbackId) {
        if (!validSession(session) || !playbackId.equals(activeImageId)) return;
        main.post(this::stopImageInternal);
    }

    private File ensureOptimizedImage(String streamUrl, String cacheKey, int targetMax) throws Exception {
        File optimized = optimizedImageFile(cacheKey);
        if (optimized.exists() && optimized.length() > 0) {
            optimized.setLastModified(System.currentTimeMillis());
            return optimized;
        }

        Object lock = ("img:" + cacheKey).intern();
        synchronized (lock) {
            if (optimized.exists() && optimized.length() > 0) return optimized;

            File raw = File.createTempFile("pv-", ".raw", imageTempDir);
            File staged = File.createTempFile("pv-", ".img", imageTempDir);
            try {
                download(streamUrl, raw);
                BitmapFactory.Options bounds = new BitmapFactory.Options();
                bounds.inJustDecodeBounds = true;
                BitmapFactory.decodeFile(raw.getAbsolutePath(), bounds);
                if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new IllegalStateException("invalid_image");

                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inSampleSize = calculateInSampleSize(bounds.outWidth, bounds.outHeight, targetMax, targetMax);
                options.inPreferredConfig = Bitmap.Config.ARGB_8888;
                Bitmap decoded = BitmapFactory.decodeFile(raw.getAbsolutePath(), options);
                if (decoded == null) throw new IllegalStateException("image_decode_failed");

                Bitmap output = scaleDown(decoded, targetMax);
                if (output != decoded) decoded.recycle();

                try (FileOutputStream out = new FileOutputStream(staged)) {
                    Bitmap.CompressFormat format;
                    int quality;
                    if (output.hasAlpha()) {
                        format = Bitmap.CompressFormat.PNG;
                        quality = 100;
                    } else if (Build.VERSION.SDK_INT >= 30) {
                        format = Bitmap.CompressFormat.WEBP_LOSSY;
                        quality = 88;
                    } else {
                        format = Bitmap.CompressFormat.WEBP;
                        quality = 88;
                    }
                    if (!output.compress(format, quality, out)) throw new IllegalStateException("image_compress_failed");
                } finally {
                    output.recycle();
                }

                if (!staged.renameTo(optimized)) {
                    copyFile(staged, optimized);
                }
                optimized.setLastModified(System.currentTimeMillis());
                trimImageCache();
                return optimized;
            } finally {
                raw.delete();
                staged.delete();
            }
        }
    }

    private void download(String streamUrl, File target) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(streamUrl).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(60000);
        connection.setRequestProperty("User-Agent", "PontoViewTV/2.0.0-beta8");
        connection.connect();

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) throw new IllegalStateException("http_" + status);
        long declared = connection.getContentLengthLong();
        if (declared > MAX_IMAGE_DOWNLOAD_BYTES) throw new IllegalStateException("image_too_large");

        long total = 0;
        byte[] buffer = new byte[128 * 1024];
        try (InputStream input = new BufferedInputStream(connection.getInputStream());
             FileOutputStream output = new FileOutputStream(target)) {
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > MAX_IMAGE_DOWNLOAD_BYTES) throw new IllegalStateException("image_too_large");
                output.write(buffer, 0, read);
            }
        } finally {
            connection.disconnect();
        }
    }

    private int calculateInSampleSize(int width, int height, int requestedWidth, int requestedHeight) {
        int sample = 1;
        while ((width / (sample * 2)) >= requestedWidth && (height / (sample * 2)) >= requestedHeight) {
            sample *= 2;
        }
        return Math.max(1, sample);
    }

    private Bitmap scaleDown(Bitmap source, int targetMax) {
        int width = source.getWidth();
        int height = source.getHeight();
        int largest = Math.max(width, height);
        if (largest <= targetMax) return source;
        float scale = (float) targetMax / largest;
        int outWidth = Math.max(1, Math.round(width * scale));
        int outHeight = Math.max(1, Math.round(height * scale));
        return Bitmap.createScaledBitmap(source, outWidth, outHeight, true);
    }

    private void applyBounds(
            View view,
            double x,
            double y,
            double width,
            double height,
            double rotation,
            double viewportWidth,
            double viewportHeight
    ) {
        if (view == null) return;
        double vw = viewportWidth > 0 ? viewportWidth : webView.getWidth();
        double vh = viewportHeight > 0 ? viewportHeight : webView.getHeight();
        double sx = webView.getWidth() > 0 ? webView.getWidth() / vw : 1d;
        double sy = webView.getHeight() > 0 ? webView.getHeight() / vh : 1d;

        double px = x * sx;
        double py = y * sy;
        double pw = Math.max(1d, width * sx);
        double ph = Math.max(1d, height * sy);

        int snapped = ((int) Math.round(rotation / 90d) * 90) % 360;
        if (snapped < 0) snapped += 360;
        boolean quarterTurn = snapped == 90 || snapped == 270;
        double layoutWidth = quarterTurn ? ph : pw;
        double layoutHeight = quarterTurn ? pw : ph;
        double left = px + pw / 2d - layoutWidth / 2d;
        double top = py + ph / 2d - layoutHeight / 2d;

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                Math.max(1, (int) Math.round(layoutWidth)),
                Math.max(1, (int) Math.round(layoutHeight))
        );
        params.leftMargin = (int) Math.round(left);
        params.topMargin = (int) Math.round(top);
        view.setLayoutParams(params);
        view.setPivotX((float) layoutWidth / 2f);
        view.setPivotY((float) layoutHeight / 2f);
        view.setRotation(snapped);
        view.bringToFront();
    }

    private void stopVideoInternal() {
        activeVideoId = null;
        if (firstFrameTimeout != null) {
            videoWatchdog.removeCallbacks(firstFrameTimeout);
            firstFrameTimeout = null;
        }

        if (player != null) {
            try {
                if (surfaceView != null) player.clearVideoSurfaceView(surfaceView);
                player.stop();
                player.release();
            } catch (Exception ignored) {}
        }
        player = null;

        if (vlcPlayer != null) {
            try { vlcPlayer.stop(); } catch (Exception ignored) {}
            try { vlcPlayer.getVLCVout().detachViews(); } catch (Exception ignored) {}
            try { vlcPlayer.release(); } catch (Exception ignored) {}
            vlcPlayer = null;
        }

        surfaceView = null;
        if (videoFrame != null) nativeLayer.removeView(videoFrame);
        videoFrame = null;
        updateNativeLayerVisibility();
    }

    private void stopImageInternal() {
        activeImageId = null;
        if (imageView != null) {
            imageView.setImageDrawable(null);
            nativeLayer.removeView(imageView);
        }
        imageView = null;
        updateNativeLayerVisibility();
    }

    private void updateNativeLayerVisibility() {
        if (videoFrame == null && imageView == null) nativeLayer.setVisibility(View.GONE);
    }

    private void sendEnded(String playbackId) {
        evaluate("window.__pvNativeOnEnded&&window.__pvNativeOnEnded(" + JSONObject.quote(playbackId) + ");");
    }

    private void sendError(String playbackId, String detail) {
        evaluate("window.__pvNativeOnError&&window.__pvNativeOnError(" + JSONObject.quote(playbackId) + "," + JSONObject.quote(detail) + ");");
    }

    private void sendDiagnostics(String playbackId, String state, int width, int height) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("state", state);
            payload.put("width", width);
            payload.put("height", height);
            payload.put("videoCacheBytes", directoryBytes(videoLibraryDir));
            payload.put("imageCacheBytes", directoryBytes(imageCacheDir));
            evaluate("window.__pvNativeOnDiagnostics&&window.__pvNativeOnDiagnostics("
                    + JSONObject.quote(playbackId) + "," + JSONObject.quote(payload.toString()) + ");");
        } catch (Exception ignored) {
        }
    }

    private void evaluate(String script) {
        main.post(() -> {
            if (webView != null) webView.evaluateJavascript(script, null);
        });
    }

    private File videoFile(String cacheKey) {
        return new File(videoLibraryDir, sha256(cacheKey) + ".media");
    }

    private void trimVideoLibrary(long incomingBytes) {
        File[] files = videoLibraryDir.listFiles();
        if (files == null) return;
        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        long total = 0;
        for (File file : files) total += file.length();
        long target = Math.max(0L, VIDEO_CACHE_BYTES - incomingBytes);
        for (File file : files) {
            if (total <= target) break;
            long length = file.length();
            if (file.delete()) total -= length;
        }
    }

    private File optimizedImageFile(String cacheKey) {
        return new File(imageCacheDir, sha256(cacheKey) + ".img");
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte b : bytes) builder.append(String.format("%02x", b));
            return builder.toString();
        } catch (Exception ignored) {
            return Integer.toHexString(value.hashCode());
        }
    }

    private void trimImageCache() {
        File[] files = imageCacheDir.listFiles();
        if (files == null) return;
        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        long total = 0;
        for (File file : files) total += file.length();
        for (File file : files) {
            if (total <= IMAGE_CACHE_BYTES) break;
            long length = file.length();
            if (file.delete()) total -= length;
        }
    }

    private long directoryBytes(File directory) {
        File[] files = directory.listFiles();
        if (files == null) return 0;
        long total = 0;
        for (File file : files) total += file.length();
        return total;
    }

    private void copyFile(File source, File destination) throws Exception {
        try (InputStream input = new java.io.FileInputStream(source);
             FileOutputStream output = new FileOutputStream(destination)) {
            byte[] buffer = new byte[128 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
        }
    }

    private boolean validSession(String session) {
        return session != null && sessionToken.equals(session);
    }

    private boolean validHttpsUrl(String value) {
        if (empty(value)) return false;
        try {
            Uri uri = Uri.parse(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean empty(String value) {
        return value == null || value.trim().isEmpty();
    }

    private float clampVolume(double volume) {
        return (float) Math.max(0d, Math.min(1d, volume));
    }

    public void release() {
        main.post(() -> {
            stopVideoInternal();
            stopImageInternal();
        });
        preloadExecutor.shutdownNow();
        imageExecutor.shutdownNow();
        try {
            videoCache.release();
        } catch (Exception ignored) {
        }
        try {
            if (libVLC != null) libVLC.release();
        } catch (Exception ignored) {
        }
        libVLC = null;
    }
}
