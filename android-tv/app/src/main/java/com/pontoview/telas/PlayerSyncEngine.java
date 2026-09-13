package com.pontoview.telas;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.StatFs;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public final class PlayerSyncEngine {
    private static final String TAG = "PontoViewCore";
    private static final String SUPABASE_URL = "https://fpdojntvnhiszagczfqr.supabase.co";
    private static final String FUNCTIONS_URL = SUPABASE_URL + "/functions/v1";
    private static final String PUBLISHABLE_KEY = "sb_publishable_hd9GQaTeJ18o3pwMIZevJQ_EgVIOVOp";
    private static final long MAX_LIBRARY_BYTES = 6L * 1024L * 1024L * 1024L;
    private static final long SAFETY_FREE_BYTES = 256L * 1024L * 1024L;

    private final Context context;
    private final PlayerCoreStore store;
    private final SharedPreferences prefs;
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    private final AtomicBoolean syncing = new AtomicBoolean(false);

    private volatile String phase = "idle";
    private volatile String lastError = "";
    private volatile long lastSyncAt = 0L;
    private volatile int totalMedia = 0;
    private volatile int readyMedia = 0;
    private volatile String pendingRevision = "";

    public PlayerSyncEngine(Context context, PlayerCoreStore store) {
        this.context = context.getApplicationContext();
        this.store = store;
        this.prefs = context.getSharedPreferences("pontoview_player", Context.MODE_PRIVATE);
    }

    public void start() {
        executor.scheduleWithFixedDelay(this::syncSafely, 2, 30, TimeUnit.SECONDS);
    }

    public void stop() {
        executor.shutdownNow();
    }

    public void requestSync() {
        if (executor.isShutdown()) return;
        executor.execute(this::syncSafely);
    }

    public void saveCredentials(String screenId, String token) {
        if (empty(screenId) || empty(token)) return;
        prefs.edit()
                .putString("core_screen_id", screenId)
                .putString("core_device_token", token)
                .apply();
        requestSync();
    }

    public void clearCredentials() {
        prefs.edit()
                .remove("core_screen_id")
                .remove("core_device_token")
                .apply();
    }

    public String statusJson() {
        try {
            JSONObject json = new JSONObject();
            json.put("phase", phase);
            json.put("lastError", lastError);
            json.put("lastSyncAt", lastSyncAt);
            json.put("activeRevision", store.getActiveRevision());
            json.put("pendingRevision", pendingRevision.isEmpty() ? store.getPendingRevision() : pendingRevision);
            json.put("readyMedia", readyMedia);
            json.put("totalMedia", totalMedia);
            json.put("libraryBytes", store.libraryBytes());
            json.put("libraryLimitBytes", MAX_LIBRARY_BYTES);
            return json.toString();
        } catch (Exception ignored) {
            return "{}";
        }
    }

    private void syncSafely() {
        if (!syncing.compareAndSet(false, true)) return;

        String screenId = prefs.getString("core_screen_id", "");
        String token = prefs.getString("core_device_token", "");
        if (empty(screenId) || empty(token)) {
            phase = "waiting_pairing";
            syncing.set(false);
            return;
        }

        try {
            phase = "checking";
            lastError = "";

            JSONObject manifest = fetchManifest(screenId, token);
            String revision = PlayerCoreStore.manifestRevision(manifest);
            String activeRevision = store.getActiveRevision();

            if (revision.equals(activeRevision)) {
                phase = "ready";
                pendingRevision = "";
                totalMedia = countDriveMedia(manifest);
                readyMedia = totalMedia;
                lastSyncAt = System.currentTimeMillis();
                store.cleanup(MAX_LIBRARY_BYTES);
                return;
            }

            pendingRevision = revision;
            store.stagePending(revision, manifest.toString());

            JSONArray items = manifest.optJSONArray("items");
            totalMedia = countDriveMedia(manifest);
            readyMedia = 0;
            phase = totalMedia > 0 ? "downloading" : "activating";

            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject row = items.optJSONObject(i);
                    JSONObject media = row != null ? row.optJSONObject("media") : null;
                    if (media == null) continue;

                    String type = media.optString("type", "");
                    if (!"drive_video".equals(type) && !"drive_image".equals(type)) continue;

                    String mediaId = media.optString("id", "");
                    String mediaRevision = PlayerCoreStore.mediaRevision(media);
                    if (empty(mediaId)) throw new IllegalStateException("media_id_missing");

                    if (!store.hasMedia(mediaId, mediaRevision, type)) {
                        phase = "downloading";
                        downloadMedia(screenId, token, mediaId, mediaRevision, type);
                    }
                    readyMedia++;
                }
            }

            phase = "activating";
            store.activatePending(revision);
            store.cleanup(MAX_LIBRARY_BYTES);

            phase = "ready";
            pendingRevision = "";
            lastSyncAt = System.currentTimeMillis();
            lastError = "";
            Log.i(TAG, "Snapshot activated: " + revision);
        } catch (Exception error) {
            phase = store.getActiveManifest().isEmpty() ? "error_first_sync" : "error_using_previous";
            lastError = safeMessage(error);
            lastSyncAt = System.currentTimeMillis();
            Log.w(TAG, "Sync failed; active snapshot preserved", error);
        } finally {
            syncing.set(false);
        }
    }

    private JSONObject fetchManifest(String screenId, String token) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(
                SUPABASE_URL + "/rest/v1/rpc/get_player_manifest"
        ).openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("apikey", PUBLISHABLE_KEY);
        connection.setRequestProperty("Authorization", "Bearer " + PUBLISHABLE_KEY);
        connection.setRequestProperty("User-Agent", "PontoViewPlayerCore/3.0.0-beta4");

        byte[] body = new JSONObject()
                .put("p_screen_id", screenId)
                .put("p_token", token)
                .toString()
                .getBytes(StandardCharsets.UTF_8);

        try (java.io.OutputStream output = connection.getOutputStream()) {
            output.write(body);
        }

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            String message = readText(connection, true);
            connection.disconnect();
            throw new IllegalStateException("manifest_http_" + status + "_" + message);
        }

        String text = readText(connection, false);
        connection.disconnect();
        if (empty(text)) throw new IllegalStateException("manifest_empty");
        return new JSONObject(text);
    }

    private void downloadMedia(
            String screenId,
            String token,
            String mediaId,
            String revision,
            String type
    ) throws Exception {
        String streamUrl = requestDriveTicket(screenId, token, mediaId);
        if (empty(streamUrl)) throw new IllegalStateException("drive_ticket_empty");

        File destination = store.mediaFile(mediaId, revision, type);
        File tempDir = new File(context.getCacheDir(), "pv-core-pending");
        tempDir.mkdirs();
        File staged = File.createTempFile("pv-", ".part", tempDir);

        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(streamUrl).openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(120000);
            connection.setRequestProperty("User-Agent", "PontoViewPlayerCore/3.0.0-beta4");
            connection.connect();

            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new IllegalStateException("drive_http_" + status);
            }

            long declared = connection.getContentLengthLong();
            ensureFreeSpace(declared);

            long total = 0L;
            byte[] buffer = new byte[256 * 1024];
            try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
                 FileOutputStream output = new FileOutputStream(staged)) {
                int read;
                while ((read = input.read(buffer)) != -1) {
                    total += read;
                    ensureFreeSpace(Math.max(0L, declared - total));
                    output.write(buffer, 0, read);
                }
                output.getFD().sync();
            }

            if (total <= 0) throw new IllegalStateException("media_empty");
            if (declared > 0 && total < declared) throw new IllegalStateException("media_incomplete");

            if (!staged.renameTo(destination)) {
                copyFile(staged, destination);
            }
            if (!destination.exists() || destination.length() != total) {
                throw new IllegalStateException("media_commit_failed");
            }

            destination.setLastModified(System.currentTimeMillis());
            store.registerMedia(mediaId, revision, type, destination);
        } finally {
            if (connection != null) connection.disconnect();
            if (staged.exists()) staged.delete();
        }
    }

    private String requestDriveTicket(String screenId, String token, String mediaId) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(
                FUNCTIONS_URL + "/drive-media"
        ).openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("apikey", PUBLISHABLE_KEY);
        connection.setRequestProperty("Authorization", "Bearer " + PUBLISHABLE_KEY);
        connection.setRequestProperty("x-screen-id", screenId);
        connection.setRequestProperty("x-screen-token", token);
        connection.setRequestProperty("User-Agent", "PontoViewPlayerCore/3.0.0-beta4");

        byte[] body = new JSONObject()
                .put("mediaId", mediaId)
                .put("action", "ticket")
                .toString()
                .getBytes(StandardCharsets.UTF_8);
        try (java.io.OutputStream output = connection.getOutputStream()) {
            output.write(body);
        }

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            String message = readText(connection, true);
            connection.disconnect();
            throw new IllegalStateException("ticket_http_" + status + "_" + message);
        }

        String text = readText(connection, false);
        connection.disconnect();
        return new JSONObject(text).optString("streamUrl", "");
    }

    private int countDriveMedia(JSONObject manifest) {
        int count = 0;
        JSONArray items = manifest.optJSONArray("items");
        if (items == null) return 0;
        for (int i = 0; i < items.length(); i++) {
            JSONObject row = items.optJSONObject(i);
            JSONObject media = row != null ? row.optJSONObject("media") : null;
            if (media == null) continue;
            String type = media.optString("type", "");
            if ("drive_video".equals(type) || "drive_image".equals(type)) count++;
        }
        return count;
    }

    private void ensureFreeSpace(long incomingBytes) {
        StatFs stats = new StatFs(context.getFilesDir().getAbsolutePath());
        long free = stats.getAvailableBytes();
        long needed = Math.max(0L, incomingBytes) + SAFETY_FREE_BYTES;
        if (free < needed) {
            store.cleanup(Math.max(768L * 1024L * 1024L, store.libraryBytes() - needed));
            stats.restat(context.getFilesDir().getAbsolutePath());
            if (stats.getAvailableBytes() < needed) {
                throw new IllegalStateException("device_storage_full");
            }
        }
    }

    private String readText(HttpURLConnection connection, boolean error) throws Exception {
        java.io.InputStream stream = error ? connection.getErrorStream() : connection.getInputStream();
        if (stream == null) return "";
        StringBuilder text = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) text.append(line);
        }
        return text.toString();
    }

    private void copyFile(File source, File destination) throws Exception {
        try (java.io.FileInputStream input = new java.io.FileInputStream(source);
             FileOutputStream output = new FileOutputStream(destination)) {
            byte[] buffer = new byte[256 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            output.getFD().sync();
        }
    }

    private String safeMessage(Exception error) {
        String message = error.getMessage();
        if (message == null || message.trim().isEmpty()) return error.getClass().getSimpleName();
        return message.length() > 240 ? message.substring(0, 240) : message;
    }

    private boolean empty(String value) {
        return value == null || value.trim().isEmpty();
    }
}
