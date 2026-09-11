package br.com.pontoview.player

import android.content.Context
import android.os.Build

object DeviceConfig {
    private const val PREFS = "pontoview_player"
    private const val KEY_AUTO_START = "auto_start"

    private fun storageContext(context: Context): Context =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            context.createDeviceProtectedStorageContext()
        } else {
            context
        }

    fun isAutoStartEnabled(context: Context): Boolean =
        storageContext(context)
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_AUTO_START, true)

    fun setAutoStartEnabled(context: Context, enabled: Boolean) {
        storageContext(context)
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_AUTO_START, enabled)
            .apply()
    }
}
