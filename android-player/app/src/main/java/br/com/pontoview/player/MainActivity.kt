package br.com.pontoview.player

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView

class MainActivity : Activity() {

    companion object {
        private const val PLAYER_URL = "https://tv.pontoview.com.br/"
    }

    private lateinit var root: FrameLayout
    private lateinit var webView: WebView
    private lateinit var splash: View
    private lateinit var offline: View
    private lateinit var connectivityManager: ConnectivityManager
    private var pageLoaded = false
    private var networkCallbackRegistered = false

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            runOnUiThread {
                hideOffline()
                if (!pageLoaded) webView.loadUrl(PLAYER_URL)
            }
        }

        override fun onLost(network: Network) {
            runOnUiThread {
                if (!hasInternet()) showOffline()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enableImmersiveMode()

        connectivityManager = getSystemService(ConnectivityManager::class.java)
        root = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(7, 27, 51))
        }
        setContentView(root)

        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            isFocusable = true
            isFocusableInTouchMode = true
            keepScreenOn = true

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                loadWithOverviewMode = true
                useWideViewPort = true
                builtInZoomControls = false
                displayZoomControls = false
                setSupportZoom(false)
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                userAgentString = "$userAgentString PontoViewPlayer/${BuildConfig.VERSION_NAME} AndroidTV"
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                settings.safeBrowsingEnabled = true
            }

            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)

            addJavascriptInterface(PontoViewBridge(this@MainActivity), "PontoViewAndroid")
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    pageLoaded = true
                    splash.animate().alpha(0f).setDuration(350).withEndAction {
                        splash.visibility = View.GONE
                    }.start()
                    hideOffline()
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    if (request?.isForMainFrame == true) {
                        pageLoaded = false
                        showOffline()
                    }
                }

                override fun onReceivedSslError(
                    view: WebView?,
                    handler: SslErrorHandler?,
                    error: SslError?
                ) {
                    handler?.cancel()
                    pageLoaded = false
                    showOffline()
                }
            }
        }

        root.addView(
            webView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )

        splash = createSplashView()
        offline = createOfflineView()
        root.addView(splash)
        root.addView(offline)
        offline.visibility = View.GONE

        if (hasInternet()) webView.loadUrl(PLAYER_URL) else showOffline()
    }

    override fun onResume() {
        super.onResume()
        enableImmersiveMode()
        webView.onResume()
        webView.resumeTimers()

        if (!networkCallbackRegistered) {
            try {
                connectivityManager.registerDefaultNetworkCallback(networkCallback)
                networkCallbackRegistered = true
            } catch (_: Exception) {
            }
        }
    }

    override fun onPause() {
        if (networkCallbackRegistered) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback)
            } catch (_: Exception) {
            }
            networkCallbackRegistered = false
        }
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("PontoViewAndroid")
        webView.stopLoading()
        webView.destroy()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enableImmersiveMode()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_UP && event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView.canGoBack()) webView.goBack() else webView.reload()
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    private fun createSplashView(): View {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
            background = getDrawable(R.drawable.bg_splash)
        }

        val logo = ImageView(this).apply {
            setImageResource(R.drawable.pontoview_icon)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
        }
        container.addView(logo, LinearLayout.LayoutParams(dp(132), dp(132)))

        container.addView(TextView(this).apply {
            text = "PontoView"
            setTextColor(Color.WHITE)
            textSize = 34f
            gravity = Gravity.CENTER
            setPadding(0, dp(22), 0, 0)
        })

        container.addView(TextView(this).apply {
            text = getString(R.string.loading)
            setTextColor(Color.rgb(185, 199, 214))
            textSize = 18f
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, dp(20))
        })

        container.addView(ProgressBar(this))

        return container.apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
    }

    private fun createOfflineView(): View {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(64), dp(64), dp(64), dp(64))
            setBackgroundColor(Color.rgb(7, 27, 51))
        }

        val logo = ImageView(this).apply {
            setImageResource(R.drawable.pontoview_icon)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
        }
        container.addView(logo, LinearLayout.LayoutParams(dp(96), dp(96)))

        container.addView(TextView(this).apply {
            text = getString(R.string.offline_title)
            setTextColor(Color.WHITE)
            textSize = 28f
            gravity = Gravity.CENTER
            setPadding(0, dp(24), 0, dp(8))
        })

        container.addView(TextView(this).apply {
            text = getString(R.string.offline_message)
            setTextColor(Color.rgb(185, 199, 214))
            textSize = 17f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(28))
        })

        container.addView(Button(this).apply {
            text = getString(R.string.retry)
            isFocusable = true
            setOnClickListener {
                pageLoaded = false
                if (hasInternet()) {
                    splash.visibility = View.VISIBLE
                    splash.alpha = 1f
                    hideOffline()
                    webView.loadUrl(PLAYER_URL)
                }
            }
        })

        return container.apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
    }

    private fun showOffline() {
        offline.visibility = View.VISIBLE
        offline.bringToFront()
    }

    private fun hideOffline() {
        offline.visibility = View.GONE
    }

    private fun hasInternet(): Boolean {
        val active = connectivityManager.activeNetwork ?: return false
        val caps = connectivityManager.getNetworkCapabilities(active) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun enableImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.hide(
                android.view.WindowInsets.Type.statusBars() or
                    android.view.WindowInsets.Type.navigationBars()
            )
            window.insetsController?.systemBarsBehavior =
                android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()
}
