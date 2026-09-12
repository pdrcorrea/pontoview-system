package com.pontoview.telas;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://tv.pontoview.com.br/";
    private WebView webView;
    private FrameLayout root;
    private FrameLayout nativeLayer;
    private NativeMediaBridge nativeBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        applyImmersiveMode();
        buildPlayer();
    }

    private void buildPlayer() {
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);

        nativeLayer = new FrameLayout(this);
        nativeLayer.setBackgroundColor(Color.TRANSPARENT);
        nativeLayer.setClipChildren(true);
        nativeLayer.setClipToPadding(true);

        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));
        root.addView(nativeLayer, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadsImagesAutomatically(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " PontoViewTV/2.0.0-beta3");

        nativeBridge = new NativeMediaBridge(this, webView, nativeLayer);
        webView.addJavascriptInterface(nativeBridge, "PontoViewNative");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                return !isTrustedTopLevelUrl(request.getUrl());
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (isTrustedTopLevelUrl(Uri.parse(url))) {
                    view.postDelayed(() -> injectNativeRuntime(), 150);
                }
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                if (isTrustedTopLevelUrl(Uri.parse(url))) injectNativeRuntime();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (isTrustedTopLevelUrl(Uri.parse(url))) {
                    injectNativeRuntime();
                    view.postDelayed(() -> injectNativeRuntime(), 500);
                    view.postDelayed(() -> injectNativeRuntime(), 1500);
                }
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                restartActivity();
                return true;
            }
        });

        webView.loadUrl(HOME_URL);
    }

    private boolean isTrustedTopLevelUrl(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) return false;
        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase();
        return host.equals("pontoview.com.br") || host.endsWith(".pontoview.com.br");
    }

    private void injectNativeRuntime() {
        if (webView == null || nativeBridge == null) return;
        String script =
                "(function(){" +
                "window.__PV_NATIVE_SESSION=" + JSONObject.quote(nativeBridge.getSessionToken()) + ";" +
                "window.__PV_NATIVE_APP_VERSION='2.0.0-beta3';" +
                "window.dispatchEvent(new CustomEvent('pontoview-native-ready',{detail:{version:'2.0.0-beta3'}}));" +
                "})();";
        webView.evaluateJavascript(script, null);
    }

    private void applyImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    private void restartActivity() {
        try {
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(intent);
            finish();
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersiveMode();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        if (webView != null) webView.reload();
    }

    @Override
    protected void onDestroy() {
        if (nativeBridge != null) nativeBridge.release();
        if (webView != null) {
            webView.removeJavascriptInterface("PontoViewNative");
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
