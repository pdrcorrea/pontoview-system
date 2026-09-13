package com.pontoview.telas;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;

public final class PlayerCoreStore extends SQLiteOpenHelper {
    private static final String DB_NAME = "pontoview_player_core.db";
    private static final int DB_VERSION = 1;
    private final File mediaDir;

    public PlayerCoreStore(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
        mediaDir = new File(context.getFilesDir(), "pv-core-media");
        mediaDir.mkdirs();
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("create table if not exists snapshots (" +
                "revision text primary key," +
                "manifest_json text not null," +
                "status text not null," +
                "created_at integer not null," +
                "activated_at integer)");
        db.execSQL("create index if not exists snapshots_status_idx on snapshots(status)");

        db.execSQL("create table if not exists media_cache (" +
                "media_id text not null," +
                "revision text not null," +
                "media_type text not null," +
                "local_path text not null," +
                "bytes integer not null default 0," +
                "last_used_at integer not null," +
                "primary key(media_id, revision))");
        db.execSQL("create index if not exists media_cache_last_used_idx on media_cache(last_used_at)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
    }

    public synchronized String getActiveManifest() {
        try (Cursor cursor = getReadableDatabase().rawQuery(
                "select manifest_json from snapshots where status='active' order by activated_at desc limit 1",
                null)) {
            return cursor.moveToFirst() ? cursor.getString(0) : "";
        }
    }

    public synchronized String getActiveRevision() {
        try (Cursor cursor = getReadableDatabase().rawQuery(
                "select revision from snapshots where status='active' order by activated_at desc limit 1",
                null)) {
            return cursor.moveToFirst() ? cursor.getString(0) : "";
        }
    }

    public synchronized String getPendingRevision() {
        try (Cursor cursor = getReadableDatabase().rawQuery(
                "select revision from snapshots where status='pending' order by created_at desc limit 1",
                null)) {
            return cursor.moveToFirst() ? cursor.getString(0) : "";
        }
    }

    public synchronized void stagePending(String revision, String manifestJson) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.execSQL("delete from snapshots where status='pending' and revision<>?", new Object[]{revision});
            ContentValues values = new ContentValues();
            values.put("revision", revision);
            values.put("manifest_json", manifestJson);
            values.put("status", "pending");
            values.put("created_at", System.currentTimeMillis());
            db.insertWithOnConflict("snapshots", null, values, SQLiteDatabase.CONFLICT_REPLACE);
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    public synchronized void activatePending(String revision) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            ContentValues old = new ContentValues();
            old.put("status", "archived");
            db.update("snapshots", old, "status='active'", null);

            ContentValues active = new ContentValues();
            active.put("status", "active");
            active.put("activated_at", System.currentTimeMillis());
            db.update("snapshots", active, "revision=? and status='pending'", new String[]{revision});

            db.execSQL("delete from snapshots where status='archived' and revision not in (" +
                    "select revision from snapshots where status='archived' order by activated_at desc limit 2)");
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    public synchronized boolean hasMedia(String mediaId, String revision, String type) {
        File file = mediaFile(mediaId, revision, type);
        if (!file.exists() || file.length() <= 0) return false;
        file.setLastModified(System.currentTimeMillis());

        ContentValues values = new ContentValues();
        values.put("last_used_at", System.currentTimeMillis());
        getWritableDatabase().update(
                "media_cache",
                values,
                "media_id=? and revision=?",
                new String[]{mediaId, revision}
        );
        return true;
    }

    public synchronized void registerMedia(String mediaId, String revision, String type, File file) {
        ContentValues values = new ContentValues();
        values.put("media_id", mediaId);
        values.put("revision", revision);
        values.put("media_type", type);
        values.put("local_path", file.getAbsolutePath());
        values.put("bytes", file.length());
        values.put("last_used_at", System.currentTimeMillis());
        getWritableDatabase().insertWithOnConflict(
                "media_cache",
                null,
                values,
                SQLiteDatabase.CONFLICT_REPLACE
        );
    }

    public File mediaFile(String mediaId, String revision, String type) {
        String extension = "drive_video".equals(type) ? ".mp4" : ".img";
        return new File(mediaDir, sha256(mediaId + ":" + revision) + extension);
    }

    public String localUrl(String mediaId, String revision, String type) {
        File file = mediaFile(mediaId, revision, type);
        if (!file.exists() || file.length() <= 0) return "";
        file.setLastModified(System.currentTimeMillis());
        return "https://local.pontoview.invalid/core/" + file.getName();
    }

    public File resolveCoreFile(Uri uri) {
        if (uri == null || !"local.pontoview.invalid".equalsIgnoreCase(uri.getHost())) return null;
        String path = uri.getPath();
        if (path == null || !path.startsWith("/core/")) return null;
        String name = path.substring("/core/".length());
        if (!name.matches("^[a-f0-9]{64}\\.(mp4|img)$")) return null;
        File file = new File(mediaDir, name);
        return file.exists() && file.length() > 0 ? file : null;
    }

    public long libraryBytes() {
        File[] files = mediaDir.listFiles();
        if (files == null) return 0L;
        long total = 0L;
        for (File file : files) total += file.length();
        return total;
    }

    public synchronized void cleanup(long limitBytes) {
        File[] files = mediaDir.listFiles();
        if (files == null) return;

        Set<String> protectedNames = new HashSet<>();
        collectProtectedFiles(getActiveManifest(), protectedNames);
        String pending = "";
        try (Cursor cursor = getReadableDatabase().rawQuery(
                "select manifest_json from snapshots where status='pending' order by created_at desc limit 1",
                null)) {
            if (cursor.moveToFirst()) pending = cursor.getString(0);
        }
        collectProtectedFiles(pending, protectedNames);

        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        long total = 0L;
        for (File file : files) total += file.length();

        for (File file : files) {
            if (total <= limitBytes) break;
            if (protectedNames.contains(file.getName())) continue;
            long size = file.length();
            if (file.delete()) {
                total -= size;
                getWritableDatabase().delete("media_cache", "local_path=?", new String[]{file.getAbsolutePath()});
            }
        }
    }

    private void collectProtectedFiles(String manifestJson, Set<String> target) {
        if (manifestJson == null || manifestJson.isEmpty()) return;
        try {
            JSONObject manifest = new JSONObject(manifestJson);
            JSONArray items = manifest.optJSONArray("items");
            if (items == null) return;
            for (int i = 0; i < items.length(); i++) {
                JSONObject row = items.optJSONObject(i);
                JSONObject media = row != null ? row.optJSONObject("media") : null;
                if (media == null) continue;
                String type = media.optString("type", "");
                if (!"drive_video".equals(type) && !"drive_image".equals(type)) continue;
                String mediaId = media.optString("id", "");
                String revision = mediaRevision(media);
                target.add(mediaFile(mediaId, revision, type).getName());
            }
        } catch (Exception ignored) {
        }
    }

    public static String mediaRevision(JSONObject media) {
        String revision = media.optString("driveChecksum", "");
        if (revision.isEmpty() || "null".equalsIgnoreCase(revision)) {
            revision = media.optString("driveModifiedTime", "");
        }
        if (revision.isEmpty() || "null".equalsIgnoreCase(revision)) revision = "latest";
        return revision;
    }

    public static String manifestRevision(JSONObject manifest) {
        try {
            JSONObject copy = new JSONObject(manifest.toString());
            copy.remove("syncedAt");
            return sha256(copy.toString());
        } catch (Exception error) {
            return sha256(manifest.toString());
        }
    }

    public static String sha256(String value) {
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
}
