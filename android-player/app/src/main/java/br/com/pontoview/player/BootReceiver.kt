package br.com.pontoview.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val validAction = intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED

        if (!validAction || !DeviceConfig.isAutoStartEnabled(context)) return

        try {
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("started_from_boot", true)
            }
            context.startActivity(launchIntent)
        } catch (_: Exception) {
            // Android/fabricante pode bloquear abertura de Activity em background.
        }
    }
}
