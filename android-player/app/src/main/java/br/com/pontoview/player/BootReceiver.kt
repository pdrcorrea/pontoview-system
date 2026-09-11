package br.com.pontoview.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "PontoViewBoot"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val validAction =
            intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED

        if (!validAction || !DeviceConfig.isAutoStartEnabled(context)) return

        launchPlayer(context)

        val pending = goAsync()
        Thread {
            try {
                Thread.sleep(3500)
                launchPlayer(context)
            } catch (error: Exception) {
                Log.w(TAG, "Delayed autostart attempt failed", error)
            } finally {
                pending.finish()
            }
        }.start()
    }

    private fun launchPlayer(context: Context) {
        try {
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                )
                putExtra("started_from_boot", true)
            }
            context.startActivity(launchIntent)
            Log.i(TAG, "PontoView Player launch requested after boot")
        } catch (error: Exception) {
            Log.w(TAG, "Android blocked PontoView Player autostart", error)
        }
    }
}
