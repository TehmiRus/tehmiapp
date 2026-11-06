package com.tehmi.aspiration;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Offline packaged UI. No Internet/storage permissions and no remote content. */
public class MainActivity extends Activity {
    private WebView web;
    private String pendingReport;
    private static final int SAVE_REPORT = 1;
    private static final String ORIGIN = "https://app.tehmi.local/";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) pendingReport = state.getString("pendingReport");
        web = new WebView(this);
        web.setBackgroundColor(0xfff2f5f9);
        web.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Reports(), "AndroidReports");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true; // Navigation stays inside the packaged application.
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String name = uri.getPath();
                if ("https".equals(uri.getScheme()) && "app.tehmi.local".equals(uri.getHost()) && name != null && name.matches("/[a-zA-Z0-9._-]+")) {
                    name = name.substring(1);
                    String mime = name.endsWith(".js") ? "application/javascript" : name.endsWith(".css") ? "text/css" : "text/html";
                    try { return new WebResourceResponse(mime, "UTF-8", getAssets().open(name)); }
                    catch (IOException ignored) { /* Return a local 404 below. */ }
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
            }
        });
        setContentView(web);
        web.loadUrl(ORIGIN + "index.html");
    }
    public final class Reports {
        @JavascriptInterface public void save(String title, String text) {
            if (text == null || text.length() > 200000) return;
            runOnUiThread(() -> {
                if (pendingReport != null) return;
                pendingReport = text;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("text/plain");
                intent.putExtra(Intent.EXTRA_TITLE, "ТехМИ_" + title.replaceAll("[^\\p{L}\\p{N}_-]", "_") + ".txt");
                try { startActivityForResult(intent, SAVE_REPORT); }
                catch (android.content.ActivityNotFoundException e) {
                    pendingReport = null;
                    Toast.makeText(MainActivity.this, "Нет приложения для сохранения документов", Toast.LENGTH_LONG).show();
                }
            });
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != SAVE_REPORT) return;
        String report = pendingReport;
        pendingReport = null;
        if (result != RESULT_OK || data == null || data.getData() == null || report == null) return;
        try (OutputStream stream = getContentResolver().openOutputStream(data.getData(), "wt")) {
            if (stream == null) throw new IOException("Нет доступа к файлу");
            stream.write(('\ufeff' + report).getBytes(StandardCharsets.UTF_8));
            Toast.makeText(this, "Отчёт сохранён", Toast.LENGTH_SHORT).show();
        } catch (IOException e) { Toast.makeText(this, "Не удалось сохранить отчёт", Toast.LENGTH_LONG).show(); }
    }
    @Override protected void onDestroy() {
        if (web != null) { web.removeJavascriptInterface("AndroidReports"); web.destroy(); }
        super.onDestroy();
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        state.putString("pendingReport", pendingReport);
    }
}
