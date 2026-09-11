package br.com.pontoview.player

import android.content.Context

object DeviceConfig {
    private const val PREFS = "pontoview_player"
    private const val KEY_AUTO_START = "auto_start"

    fun isAutoStartEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_AUTO_START, false)

    fun setAutoStartEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_AUTO_START, enabled)
            .apply()
    }
}
