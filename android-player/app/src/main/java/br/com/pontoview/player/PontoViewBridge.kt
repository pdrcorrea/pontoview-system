package br.com.pontoview.player

import android.content.Context
import android.os.Build
import android.webkit.JavascriptInterface

class PontoViewBridge(private val context: Context) {

    @JavascriptInterface
    fun getAppVersion(): String = BuildConfig.VERSION_NAME

    @JavascriptInterface
    fun getDeviceModel(): String = "${Build.MANUFACTURER} ${Build.MODEL}".trim()

    @JavascriptInterface
    fun getAndroidVersion(): String = Build.VERSION.RELEASE ?: "desconhecida"

    @JavascriptInterface
    fun isAutoStartEnabled(): Boolean = DeviceConfig.isAutoStartEnabled(context)

    @JavascriptInterface
    fun setAutoStartEnabled(enabled: Boolean) {
        DeviceConfig.setAutoStartEnabled(context, enabled)
    }
}
