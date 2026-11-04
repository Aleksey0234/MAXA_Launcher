package org.cordova.plugin.labs.kiosk;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Kiosk-помощник: не даёт открыть экран недавних приложений и шторку
 * уведомлений. Работает без root и без device owner.
 */
public class KioskAccessibilityService extends AccessibilityService {

    private static final String TAG = "KioskA11y";
    private static final long THROTTLE_MS = 150L;
    private static final long BLOCK_THROTTLE_MS = 1200L;

    private static final Pattern URL_PATTERN = Pattern.compile(
            "^(?:https?://)?[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(?:[/?#][^\\s]*)?",
            Pattern.CASE_INSENSITIVE);

    private static final String[] BLOCKED_SITES = {
            "crazygames.com",
            "poki.com",
            "y9freegames.com",
            "friv.com",
            "playhop.com",
            "papergames.io/zh",
            "ludohaus.com",
            "yikm.net",
            "oldswf.com",
            "kbhgames.com",
            "gamh5.com",
            "instantgames.top",
            "games.aistarted.com",
            "360playzone.com",
            "allwebgames.com",
            "fuun.fun",
            "4399.com",
            "7k7k.com",
            "game.haiyong.site",
            "yandex.ru/games",
            "yandex.com/games",
            "vkvideo.ru",
            "rutube.ru",
            "tiktok.com",
            "tiktokv.com",
            "vk.com",
            "vk.ru",
            "vk.me",
            "vk.cc",
            "roblox.com",
            "minecraft.net",
            "supercell.com/en/games/brawlstars",
            "standoff2.com",
            "pubgmobile.com",
            "genshin.hoyoverse.com",
            "capcut.com",
            "likee.video",
            "risovayka.yandex.ru",
            "twitch.tv"
    };

    private static final Site[] SITES = parseSites();

    private static final String[] BROWSER_PACKAGES = {
            "com.android.chrome",
            "com.yandex.browser",
            "com.miui.browser",
            "com.android.browser",
            "org.mozilla.firefox",
            "com.opera.browser",
            "com.opera.mini.native",
            "com.microsoft.emmx",
            "com.sec.android.app.sbrowser"
    };

    private static volatile KioskAccessibilityService instance;

    private long lastActionAt = 0L;
    private long lastBlockAt = 0L;
    private volatile boolean clearingRecents = false;
    private final Handler handler = new Handler(Looper.getMainLooper());

    // Невидимая полоса поверх строки состояния: не даёт потянуть шторку
    // в других приложениях. В лаунчере она снимается, чтобы работали
    // собственные быстрые настройки.
    private WindowManager windowManager;
    private View topGuard;
    private boolean topGuardAdded = false;

    public static boolean requestClearAll() {
        KioskAccessibilityService service = instance;
        if (service == null) {
            return false;
        }
        service.handler.post(new Runnable() {
            @Override
            public void run() {
                service.startClearAll();
            }
        });
        return true;
    }

    public static void requestDisableSelf() {
        final KioskAccessibilityService service = instance;
        if (service == null) {
            return;
        }
        service.handler.post(new Runnable() {
            @Override
            public void run() {
                service.removeTopGuard();
                service.disableSelf();
                Log.d(TAG, "Accessibility service disabled by launcher");
            }
        });
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        // После загрузки лаунчер обычно уже на экране — снимаем полосу,
        // чтобы не мешать его быстрым настройкам.
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                updateTopGuard();
            }
        }, 800L);
    }

    @Override
    public boolean onUnbind(Intent intent) {
        instance = null;
        removeTopGuard();
        return super.onUnbind(intent);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || clearingRecents) {
            return;
        }

        final int type = event.getEventType();
        if (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                && type != AccessibilityEvent.TYPE_WINDOWS_CHANGED
                && type != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            return;
        }

        final String pkg = event.getPackageName() == null ? "" : event.getPackageName().toString();
        final String cls = event.getClassName() == null ? "" : event.getClassName().toString();

        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                || type == AccessibilityEvent.TYPE_WINDOWS_CHANGED) {
            updateTopGuard();
        }

        if (System.currentTimeMillis() - lastActionAt < THROTTLE_MS) {
            return;
        }

        if (isBrowserPackage(pkg) && checkBlockedUrl()) {
            return;
        }

        // Экран недавних приложений MIUI.
        if (pkg.equals("com.miui.home") && cls.contains("RecentsActivity")) {
            Log.d(TAG, "Recents detected, going home");
            performGlobalAction(GLOBAL_ACTION_HOME);
            lastActionAt = System.currentTimeMillis();
            return;
        }

        // AOSP/другие оболочки.
        if (cls.contains("RecentsActivity") || cls.contains("Recents")) {
            Log.d(TAG, "Recents detected (" + pkg + "/" + cls + "), going home");
            performGlobalAction(GLOBAL_ACTION_HOME);
            lastActionAt = System.currentTimeMillis();
            return;
        }

        // Шторка уведомлений / панель статуса SystemUI.
        if (pkg.equals("com.android.systemui") && isShadeClass(cls)) {
            Log.d(TAG, "Notification shade detected (" + cls + "), closing");
            closeShadeNow();
            return;
        }

        closeSystemUiOverlayIfNeeded();
    }

    private boolean isShadeClass(String cls) {
        if (cls == null) {
            return false;
        }
        String c = cls.toLowerCase();
        return c.contains("notificationshade")
                || c.contains("notificationpanel")
                || c.contains("notificationstack")
                || c.contains("shade")
                || c.contains("statusbar");
    }

    /**
     * Если активным окном стало системное окно SystemUI (раскрытая шторка),
     * закрываем его кнопкой "Назад".
     */
    private void closeSystemUiOverlayIfNeeded() {
        AccessibilityNodeInfo activeRoot = getRootInActiveWindow();
        if (activeRoot != null) {
            try {
                CharSequence pkg = activeRoot.getPackageName();
                if (pkg != null && "com.android.systemui".contentEquals(pkg)) {
                    Log.d(TAG, "Active SystemUI root, closing");
                    closeShadeNow();
                    return;
                }
            } finally {
                activeRoot.recycle();
            }
        }

        List<AccessibilityWindowInfo> windows = getWindows();
        if (windows == null) {
            return;
        }
        for (AccessibilityWindowInfo window : windows) {
            if (window == null) {
                continue;
            }
            if (!window.isActive() || window.getType() != AccessibilityWindowInfo.TYPE_SYSTEM) {
                continue;
            }
            AccessibilityNodeInfo root = window.getRoot();
            try {
                if (root != null && root.getPackageName() != null
                        && "com.android.systemui".contentEquals(root.getPackageName())) {
                    Log.d(TAG, "Active SystemUI window, closing");
                    closeShadeNow();
                }
            } finally {
                if (root != null) {
                    root.recycle();
                }
            }
            return;
        }
    }

    private void closeShadeNow() {
        performGlobalAction(GLOBAL_ACTION_BACK);
        lastActionAt = System.currentTimeMillis();
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (isSystemShadeActive()) {
                    Log.d(TAG, "Shade still open, closing again");
                    performGlobalAction(GLOBAL_ACTION_BACK);
                    lastActionAt = System.currentTimeMillis();
                }
            }
        }, 200L);
    }

    private boolean isSystemShadeActive() {
        List<AccessibilityWindowInfo> windows = getWindows();
        if (windows == null) {
            return false;
        }
        for (AccessibilityWindowInfo window : windows) {
            if (window == null || !window.isActive()
                    || window.getType() != AccessibilityWindowInfo.TYPE_SYSTEM) {
                continue;
            }
            AccessibilityNodeInfo root = window.getRoot();
            try {
                return root != null && root.getPackageName() != null
                        && "com.android.systemui".contentEquals(root.getPackageName());
            } finally {
                if (root != null) {
                    root.recycle();
                }
            }
        }
        return false;
    }

    private static final class Site {
        final String host;
        final String path;

        Site(String host, String path) {
            this.host = host;
            this.path = path;
        }
    }

    private static Site[] parseSites() {
        List<Site> result = new ArrayList<>();
        for (String raw : BLOCKED_SITES) {
            if (raw == null) {
                continue;
            }
            String entry = raw.trim().toLowerCase();
            if (entry.isEmpty()) {
                continue;
            }
            int slash = entry.indexOf('/');
            String host;
            String path;
            if (slash > 0) {
                host = normalizeHost(entry.substring(0, slash));
                path = entry.substring(slash);
                while (path.endsWith("/")) {
                    path = path.substring(0, path.length() - 1);
                }
            } else {
                host = normalizeHost(entry);
                path = "";
            }
            if (!host.isEmpty()) {
                result.add(new Site(host, path));
            }
        }
        return result.toArray(new Site[0]);
    }

    private static String normalizeHost(String host) {
        if (host == null) {
            return "";
        }
        String h = host.trim().toLowerCase();
        if (h.startsWith("www.")) {
            h = h.substring(4);
        }
        if (h.endsWith(".")) {
            h = h.substring(0, h.length() - 1);
        }
        return h;
    }

    private boolean isBrowserPackage(String pkg) {
        for (String browser : BROWSER_PACKAGES) {
            if (browser.equals(pkg)) {
                return true;
            }
        }
        return false;
    }

    private boolean checkBlockedUrl() {
        long now = System.currentTimeMillis();
        if (now - lastBlockAt < BLOCK_THROTTLE_MS || isImeVisible()) {
            return false;
        }
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            return false;
        }
        try {
            String url = findUrl(root, 0);
            if (url != null && isBlockedUrl(url)) {
                lastBlockAt = now;
                Log.d(TAG, "Blocked site: " + url);
                performGlobalAction(GLOBAL_ACTION_BACK);
                Toast.makeText(this, "Сайт заблокирован", Toast.LENGTH_SHORT).show();
                lastActionAt = now;
                return true;
            }
        } catch (Exception e) {
            Log.d(TAG, "checkBlockedUrl error: " + e.getMessage());
        } finally {
            root.recycle();
        }
        return false;
    }

    private String findUrl(AccessibilityNodeInfo node, int depth) {
        if (node == null || depth > 35) {
            return null;
        }
        Rect bounds = new Rect();
        node.getBoundsInScreen(bounds);
        // Строку адреса ищем только в верхней панели браузера, чтобы не
        // реагировать на текст/ссылки внутри страницы и не закрывать клавиатуру.
        if (bounds.top >= 0 && bounds.top < 250) {
            CharSequence text = node.getText();
            if (text != null) {
                String candidate = text.toString().trim();
                if (candidate.length() >= 4 && candidate.length() < 300) {
                    Matcher matcher = URL_PATTERN.matcher(candidate);
                    if (matcher.find()) {
                        return matcher.group(0);
                    }
                }
            }
            CharSequence description = node.getContentDescription();
            if (description != null) {
                String candidate = description.toString().trim();
                if (candidate.length() >= 4 && candidate.length() < 300) {
                    Matcher matcher = URL_PATTERN.matcher(candidate);
                    if (matcher.find()) {
                        return matcher.group(0);
                    }
                }
            }
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child == null) {
                continue;
            }
            String found = findUrl(child, depth + 1);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    private boolean isImeVisible() {
        List<AccessibilityWindowInfo> windows = getWindows();
        if (windows == null) {
            return false;
        }
        for (AccessibilityWindowInfo window : windows) {
            if (window != null
                    && window.getType() == AccessibilityWindowInfo.TYPE_INPUT_METHOD) {
                return true;
            }
        }
        return false;
    }

    private boolean isBlockedUrl(String url) {
        String candidate = url;
        if (!candidate.contains("://")) {
            candidate = "https://" + candidate;
        }
        Uri uri;
        try {
            uri = Uri.parse(candidate);
        } catch (Exception e) {
            return false;
        }
        String host = uri.getHost();
        if (host == null) {
            return false;
        }
        host = normalizeHost(host);
        String path = uri.getPath() == null ? "" : uri.getPath();

        for (Site site : SITES) {
            if (host.equals(site.host) || host.endsWith("." + site.host)) {
                if (site.path.isEmpty()) {
                    return true;
                }
                if (path.equals(site.path) || path.startsWith(site.path + "/")) {
                    return true;
                }
            }
        }
        return false;
    }

    private void startClearAll() {
        clearingRecents = true;
        Log.d(TAG, "Clear all requested");
        performGlobalAction(GLOBAL_ACTION_RECENTS);
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                clickClearAll();
            }
        }, 650L);
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                performGlobalAction(GLOBAL_ACTION_HOME);
                clearingRecents = false;
            }
        }, 1500L);
    }

    private void clickClearAll() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            Log.d(TAG, "Clear all: no root");
            return;
        }
        try {
            AccessibilityNodeInfo target = findClearAll(root);
            if (target != null) {
                // На MIUI кнопка очистки в «Недавних» реагирует на двойной клик.
                target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                try {
                    Thread.sleep(120L);
                } catch (InterruptedException ignored) {
                }
                target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                Log.d(TAG, "Clear all clicked");
            } else {
                Log.d(TAG, "Clear all button not found");
            }
        } finally {
            root.recycle();
        }
    }

    private AccessibilityNodeInfo findClearAll(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo strong = findClearAllNode(node, true);
        if (strong != null) {
            return strong;
        }
        return findClearAllNode(node, false);
    }

    private AccessibilityNodeInfo findClearAllNode(AccessibilityNodeInfo node, boolean strong) {
        if (node == null) {
            return null;
        }
        String text = node.getText() == null ? "" : node.getText().toString();
        String desc = node.getContentDescription() == null ? "" : node.getContentDescription().toString();
        String viewId = node.getViewIdResourceName() == null ? "" : node.getViewIdResourceName();
        String s = (text + " " + desc + " " + viewId).toLowerCase();

        boolean isTaskCard = s.contains("откреплено")
                || s.contains("pinned")
                || viewId.contains("task_view");
        boolean match;
        if (strong) {
            match = s.contains("clearanim")
                    || s.contains("озу")
                    || s.contains("дважды")
                    || s.contains("double tap")
                    || s.contains("clear all")
                    || s.contains("clean all")
                    || s.contains("закрыть все")
                    || s.contains("удалить все")
                    || s.contains("全部清除");
        } else {
            match = !isTaskCard && (s.contains("clear all")
                    || s.contains("clean all")
                    || s.contains("очист")
                    || s.contains("закрыть все")
                    || s.contains("удалить все")
                    || s.contains("清理"));
        }

        if (match) {
            if (node.isClickable()) {
                return node;
            }
            AccessibilityNodeInfo parent = node.getParent();
            if (parent != null && parent.isClickable()) {
                return parent;
            }
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child == null) {
                continue;
            }
            AccessibilityNodeInfo found = findClearAllNode(child, strong);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    private void updateTopGuard() {
        // Полоса нужна всегда, в том числе на главном экране: иначе после
        // перезагрузки MIUI снова разрешает вытянуть шторку/центр управления.
        // Быстрые настройки лаунчера открываются свайпом чуть ниже неё.
        addTopGuard();
    }

    private void addTopGuard() {
        if (topGuardAdded || windowManager == null) {
            return;
        }
        topGuard = new View(this) {
            @Override
            public boolean onTouchEvent(MotionEvent event) {
                // Съедаем касания в зоне строки состояния: шторка не тянется.
                return true;
            }
        };
        topGuard.setBackgroundColor(Color.TRANSPARENT);

        int height = getStatusBarHeight();
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                height,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = 0;
        params.y = 0;
        try {
            windowManager.addView(topGuard, params);
            topGuardAdded = true;
            Log.d(TAG, "Top guard added, height=" + height);
        } catch (Exception e) {
            topGuard = null;
            Log.d(TAG, "Top guard add failed: " + e.getMessage());
        }
    }

    private void removeTopGuard() {
        if (!topGuardAdded || topGuard == null || windowManager == null) {
            topGuardAdded = false;
            topGuard = null;
            return;
        }
        try {
            windowManager.removeView(topGuard);
            Log.d(TAG, "Top guard removed");
        } catch (Exception ignored) {
        }
        topGuard = null;
        topGuardAdded = false;
    }

    private int getStatusBarHeight() {
        int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (id > 0) {
            return getResources().getDimensionPixelSize(id);
        }
        return (int) (24 * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onInterrupt() {
        // nothing
    }
}
