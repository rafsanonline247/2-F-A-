package com.lekhok.secure.preview;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Lekhok Secure Preview — offline WebView shell around the finalized web UI.
 * No INTERNET permission: every request is served from APK assets over a
 * virtual https origin so that WebCrypto (secure context) stays available.
 *
 * Rendering fix (v0.5.0): the main document is loaded with
 * loadDataWithBaseURL(), which every WebView version renders as real HTML.
 * Subresources (js/fonts) are intercepted with a bare MIME type
 * ("text/html" style — never "type; charset=...") plus a separate encoding
 * parameter, matching Google's WebViewAssetLoader behaviour.
 */
public class MainActivity extends Activity {

    private static final String VIRTUAL_ORIGIN = "https://lekhok.local";
    private static final int FILE_CHOOSER_REQUEST = 1;

    private WebView webView;
    private ValueCallback<Uri[]> pendingFilePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().getDecorView().setBackgroundColor(Color.BLACK);

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setDefaultTextEncodingName("utf-8");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return serveAsset(request.getUrl());
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (pendingFilePathCallback != null) {
                    pendingFilePathCallback.onReceiveValue(null);
                }
                pendingFilePathCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                String[] accept = params.getAcceptTypes();
                intent.setType((accept != null && accept.length > 0 && accept[0] != null
                        && accept[0].length() > 0) ? accept[0] : "image/*");
                startActivityForResult(Intent.createChooser(intent, "Select file"), FILE_CHOOSER_REQUEST);
                return true;
            }
        });

        setContentView(webView);
        loadMainDocument();
    }

    /** Loads assets/index.html as data with the virtual https origin as base. */
    private void loadMainDocument() {
        String html;
        try (InputStream in = getAssets().open("index.html")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream(64 * 1024);
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
            }
            html = new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            // index.html is packaged with the APK; this branch is unreachable in practice.
            html = "<!doctype html><meta charset=\"utf-8\"><title>Lekhok Secure</title>"
                    + "<p style=\"color:#fff;background:#000;font-family:sans-serif;padding:24px\">"
                    + "App resources are missing from this build. Please reinstall.</p>";
        }
        // baseUrl = virtual https origin → WebCrypto (secure context) + localStorage persist,
        // and relative subresource URLs (js/, fonts/) hit shouldInterceptRequest below.
        webView.loadDataWithBaseURL(VIRTUAL_ORIGIN + "/", html, "text/html", "utf-8", null);
    }

    /** Maps every path of the virtual origin to APK assets; never touches a network. */
    private WebResourceResponse serveAsset(Uri url) {
        if (url == null || !"lekhok.local".equals(url.getHost())) {
            return null;
        }
        String path = url.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) {
            return null; // main document already loaded via loadDataWithBaseURL
        }
        String assetPath = path.substring(1);
        try {
            InputStream in = getAssets().open(assetPath);
            // Bare MIME type + separate encoding: parameters in the MIME string
            // make some WebView versions fall back to plain-text rendering.
            String mime = guessMime(assetPath);
            String encoding = mime.startsWith("text/") || mime.contains("javascript")
                    || mime.contains("json") || mime.contains("svg") ? "utf-8" : null;
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            WebResourceResponse res = new WebResourceResponse(mime, encoding, in);
            res.setResponseHeaders(headers);
            return res;
        } catch (IOException e) {
            return null;
        }
    }

    private static String guessMime(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".ttf")) return "font/ttf";
        if (p.endsWith(".otf")) return "font/otf";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST && pendingFilePathCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
            pendingFilePathCallback.onReceiveValue(result);
            pendingFilePathCallback = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
