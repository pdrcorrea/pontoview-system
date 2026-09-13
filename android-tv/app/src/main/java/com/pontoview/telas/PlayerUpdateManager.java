package com.pontoview.telas;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public final class PlayerUpdateManager {
    private static final String TAG = "PontoViewUpdate";
    private static final String UPDATE_MANIFEST_URL =
            "https://github.com/pdrcorrea/pontoview-system/releases/download/android-updates/update-manifest.json";
    private static final long PERIODIC_CHECK_HOURS = 6L;

    private final Activity activity;
    private final SharedPreferences prefs;
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();

    private volatile String state = "idle";
    private volatile String lastError = "";
    private volatile long lastCheckAt = 0L;
    private volatile String availableVersion = "";
    private volatile long availableVersionCode = 0L;
    private volatile String downloadedVersion = "";
    private volatile File downloadedApk = null;
    private volatile boolean pendingUserAction = false;

    public PlayerUpdateManager(Activity activity) {
        this.activity = activity;
        this.prefs = activity.getSharedPreferences("pontoview_player", Context.MODE_PRIVATE);
    }

    public void start() {
        executor.scheduleWithFixedDelay(() -> checkForUpdate(false), 45, PERIODIC_CHECK_HOURS, TimeUnit.HOURS);
    }

    public void stop() {
        executor.shutdownNow();
    }

    public void setPolicy(boolean autoUpdate, String channel, long requestRevision) {
        String normalized = "beta".equalsIgnoreCase(channel) ? "beta" : "stable";
        long previousRequest = prefs.getLong("update_request_revision", 0L);

        prefs.edit()
                .putBoolean("auto_update", autoUpdate)
                .putString("update_channel", normalized)
                .putLong("update_request_revision", requestRevision)
                .apply();

        if (requestRevision > previousRequest) {
            checkForUpdate(true);
        }
    }

    public void checkNow() {
        checkForUpdate(true);
    }

    public String statusJson() {
        try {
            JSONObject json = new JSONObject();
            json.put("state", state);
            json.put("installedVersion", BuildConfig.VERSION_NAME);
            json.put("installedVersionCode", BuildConfig.VERSION_CODE);
            json.put("channel", currentChannel());
            json.put("autoUpdate", prefs.getBoolean("auto_update", true));
            json.put("lastCheckAt", lastCheckAt);
            json.put("lastError", lastError);
            json.put("availableVersion", availableVersion);
            json.put("availableVersionCode", availableVersionCode);
            json.put("downloadedVersion", downloadedVersion);
            json.put("pendingUserAction", pendingUserAction);
            json.put("canRequestPackageInstalls", canRequestPackageInstalls());
            return json.toString();
        } catch (Exception ignored) {
            return "{}";
        }
    }

    public void installDownloaded() {
        executor.execute(() -> {
            try {
                if (downloadedApk == null || !downloadedApk.exists()) {
                    state = "idle";
                    return;
                }
                installApk(downloadedApk);
            } catch (Exception error) {
                state = "error";
                lastError = safeMessage(error);
                Log.e(TAG, "Install failed", error);
            }
        });
    }

    private void checkForUpdate(boolean forced) {
        if (executor.isShutdown()) return;
        executor.execute(() -> {
            try {
                state = "checking";
                lastError = "";
                pendingUserAction = false;
                lastCheckAt = System.currentTimeMillis();

                JSONObject manifest = fetchJson(UPDATE_MANIFEST_URL);
                JSONObject channel = manifest.optJSONObject(currentChannel());
                if (channel == null) {
                    state = "up_to_date";
                    return;
                }

                long versionCode = channel.optLong("versionCode", 0L);
                String versionName = channel.optString("versionName", "");
                String apkUrl = channel.optString("url", "");
                String sha256 = channel.optString("sha256", "");
                boolean required = channel.optBoolean("required", false);

                availableVersionCode = versionCode;
                availableVersion = versionName;

                if (versionCode <= BuildConfig.VERSION_CODE || apkUrl.isEmpty() || sha256.isEmpty()) {
                    state = "up_to_date";
                    return;
                }

                state = "available";
                boolean autoUpdate = prefs.getBoolean("auto_update", true);
                if (!forced && !required && !autoUpdate) return;

                File apk = downloadAndVerify(apkUrl, sha256, versionCode, versionName);
                downloadedApk = apk;
                downloadedVersion = versionName;
                state = "downloaded";

                if (required || autoUpdate || forced) {
                    installApk(apk);
                }
            } catch (Exception error) {
                if (String.valueOf(error.getMessage()).contains("404")) {
                    state = "up_to_date";
                    lastError = "";
                } else {
                    state = "error";
                    lastError = safeMessage(error);
                    Log.w(TAG, "Update check failed", error);
                }
            }
        });
    }

    private File downloadAndVerify(String apkUrl, String expectedSha, long versionCode, String versionName) throws Exception {
        state = "downloading";

        File dir = new File(activity.getFilesDir(), "updates");
        dir.mkdirs();
        File temp = new File(dir, "PontoView-Telas-" + versionCode + ".part");
        File ready = new File(dir, "PontoView-Telas-" + versionCode + ".apk");

        if (ready.exists() && expectedSha.equalsIgnoreCase(sha256(ready))) {
            verifyPackageIdentity(ready);
            return ready;
        }

        HttpURLConnection connection = (HttpURLConnection) new URL(apkUrl).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(120000);
        connection.setRequestProperty("User-Agent", "PontoViewUpdate/" + BuildConfig.VERSION_NAME);
        connection.connect();

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            connection.disconnect();
            throw new IllegalStateException("update_http_" + status);
        }

        try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
             FileOutputStream output = new FileOutputStream(temp)) {
            byte[] buffer = new byte[256 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            output.getFD().sync();
        } finally {
            connection.disconnect();
        }

        String actual = sha256(temp);
        if (!expectedSha.equalsIgnoreCase(actual)) {
            temp.delete();
            throw new SecurityException("update_checksum_mismatch");
        }

        if (!temp.renameTo(ready)) {
            copyFile(temp, ready);
            temp.delete();
        }

        verifyPackageIdentity(ready);
        cleanupOldUpdates(dir, ready);
        return ready;
    }

    private void verifyPackageIdentity(File apk) throws Exception {
        PackageManager pm = activity.getPackageManager();
        PackageInfo archive;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            archive = pm.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNING_CERTIFICATES);
        } else {
            archive = pm.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNATURES);
        }

        if (archive == null || !activity.getPackageName().equals(archive.packageName)) {
            throw new SecurityException("update_package_mismatch");
        }

        if (BuildConfig.DEBUG) return;

        PackageInfo installed;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            installed = pm.getPackageInfo(activity.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
        } else {
            installed = pm.getPackageInfo(activity.getPackageName(), PackageManager.GET_SIGNATURES);
        }

        Signature[] incoming = signatures(archive);
        Signature[] current = signatures(installed);
        if (incoming.length == 0 || current.length == 0) throw new SecurityException("update_signature_missing");

        String incomingDigest = signatureDigest(incoming[0]);
        String currentDigest = signatureDigest(current[0]);
        if (!incomingDigest.equalsIgnoreCase(currentDigest)) {
            throw new SecurityException("update_signature_mismatch");
        }
    }

    private Signature[] signatures(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && info.signingInfo != null) {
            return info.signingInfo.getApkContentsSigners();
        }
        return info.signatures != null ? info.signatures : new Signature[0];
    }

    private String signatureDigest(Signature signature) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(signature.toByteArray());
        StringBuilder result = new StringBuilder();
        for (byte b : hash) result.append(String.format("%02x", b));
        return result.toString();
    }

    private void installApk(File apk) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !canRequestPackageInstalls()) {
            pendingUserAction = true;
            state = "permission_required";
            activity.runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            });
            return;
        }

        state = "installing";

        PackageInstaller installer = activity.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params =
                new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(activity.getPackageName());

        int sessionId = installer.createSession(params);
        PackageInstaller.Session session = installer.openSession(sessionId);

        try (FileInputStream input = new FileInputStream(apk);
             java.io.OutputStream output = session.openWrite("pontoview-update", 0, apk.length())) {
            byte[] buffer = new byte[256 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            session.fsync(output);
        }

        Intent resultIntent = new Intent(activity, UpdateInstallReceiver.class);
        resultIntent.setAction("com.pontoview.telas.UPDATE_RESULT");
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                activity,
                sessionId,
                resultIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );

        session.commit(pendingIntent.getIntentSender());
        session.close();
    }

    private boolean canRequestPackageInstalls() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || activity.getPackageManager().canRequestPackageInstalls();
    }

    private JSONObject fetchJson(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Cache-Control", "no-cache");
        connection.setRequestProperty("User-Agent", "PontoViewUpdate/" + BuildConfig.VERSION_NAME);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            connection.disconnect();
            throw new IllegalStateException("manifest_http_" + status);
        }

        StringBuilder body = new StringBuilder();
        try (java.io.BufferedReader reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(connection.getInputStream(), java.nio.charset.StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
        } finally {
            connection.disconnect();
        }

        return new JSONObject(body.toString());
    }

    private String currentChannel() {
        String value = prefs.getString("update_channel", "");
        if ("stable".equals(value) || "beta".equals(value)) return value;
        return BuildConfig.VERSION_NAME.contains("beta") ? "beta" : "stable";
    }

    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[256 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
        }

        StringBuilder result = new StringBuilder();
        for (byte b : digest.digest()) result.append(String.format("%02x", b));
        return result.toString();
    }

    private void cleanupOldUpdates(File dir, File keep) {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File file : files) {
            if (!file.equals(keep)) file.delete();
        }
    }

    private void copyFile(File source, File destination) throws Exception {
        try (FileInputStream input = new FileInputStream(source);
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
        return message.length() > 180 ? message.substring(0, 180) : message;
    }
}
