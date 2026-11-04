package org.cordova.plugin.labs.kiosk;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Слушает только уведомления MAX, SMS и телефона. Данные хранятся
 * в памяти и никуда не отправляются.
 */
public class KioskNotificationListenerService extends NotificationListenerService {

    private static final String TAG = "KioskNotif";
    private static final int MAX_ITEMS = 20;

    private static final Map<String, JSONObject> ITEMS = new LinkedHashMap<>();
    private static volatile boolean connected = false;
    private static volatile boolean disabled = false;

    private static final String[] WANTED_PACKAGES = {
            "ru.oneme.app",
            "com.google.android.apps.messaging",
            "com.android.mms",
            "com.android.messaging",
            "com.samsung.android.messaging",
            "com.oneplus.mms",
            "com.coloros.mms",
            "com.google.android.dialer",
            "com.android.phone",
            "com.android.server.telecom",
            "com.android.incallui"
    };

    public static boolean isConnected() {
        return connected;
    }

    public static void requestDisable() {
        disabled = true;
        synchronized (ITEMS) {
            ITEMS.clear();
        }
        Log.d(TAG, "Notification feed disabled by launcher");
    }

    public static void requestEnable() {
        disabled = false;
    }

    public static String snapshotJson() {
        if (disabled) {
            return "[]";
        }
        JSONArray result = new JSONArray();
        List<JSONObject> values;
        synchronized (ITEMS) {
            values = new ArrayList<>(ITEMS.values());
        }
        Collections.sort(values, new Comparator<JSONObject>() {
            @Override
            public int compare(JSONObject left, JSONObject right) {
                return Long.compare(right.optLong("time"), left.optLong("time"));
            }
        });
        for (int i = 0; i < values.size() && i < MAX_ITEMS; i++) {
            result.put(values.get(i));
        }
        return result.toString();
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        connected = true;
        Log.d(TAG, "Listener connected");
        refreshActive();
    }

    @Override
    public void onListenerDisconnected() {
        connected = false;
        synchronized (ITEMS) {
            ITEMS.clear();
        }
        Log.d(TAG, "Listener disconnected");
        super.onListenerDisconnected();
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        add(sbn);
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        if (sbn == null) {
            return;
        }
        synchronized (ITEMS) {
            ITEMS.remove(sbn.getKey());
        }
    }

    private void refreshActive() {
        StatusBarNotification[] active;
        try {
            active = getActiveNotifications();
        } catch (Exception e) {
            Log.d(TAG, "getActiveNotifications failed: " + e.getMessage());
            return;
        }
        synchronized (ITEMS) {
            ITEMS.clear();
        }
        if (active == null) {
            return;
        }
        for (StatusBarNotification sbn : active) {
            add(sbn);
        }
    }

    private static void add(StatusBarNotification sbn) {
        if (disabled || sbn == null) {
            return;
        }
        String pkg = sbn.getPackageName();
        if (!isWantedPackage(pkg)) {
            return;
        }
        Notification notification = sbn.getNotification();
        if (notification == null) {
            return;
        }
        if ((notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) {
            return;
        }
        String category = notification.category == null ? "" : notification.category;
        if (sbn.isOngoing() && !Notification.CATEGORY_CALL.equals(category)) {
            return;
        }

        Bundle extras = notification.extras;
        if (extras == null) {
            return;
        }
        String title = text(extras.getCharSequence(Notification.EXTRA_TITLE));
        String body = text(extras.getCharSequence(Notification.EXTRA_TEXT));
        if (body.isEmpty()) {
            body = text(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        }
        if (body.isEmpty()) {
            body = text(extras.getCharSequence(Notification.EXTRA_SUB_TEXT));
        }
        if (body.isEmpty()) {
            body = text(extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT));
        }
        if (title.isEmpty() && body.isEmpty()) {
            return;
        }

        try {
            JSONObject item = new JSONObject();
            item.put("key", sbn.getKey());
            item.put("package", pkg);
            item.put("appKey", appKey(pkg));
            item.put("app", appLabel(pkg));
            item.put("title", title);
            item.put("text", body);
            item.put("time", sbn.getPostTime());
            item.put("ongoing", sbn.isOngoing());
            item.put("category", category);
            synchronized (ITEMS) {
                ITEMS.put(sbn.getKey(), item);
            }
        } catch (JSONException e) {
            Log.d(TAG, "build notification failed: " + e.getMessage());
        }
    }

    private static boolean isWantedPackage(String pkg) {
        if (pkg == null || pkg.isEmpty()) {
            return false;
        }
        for (String wanted : WANTED_PACKAGES) {
            if (wanted.equals(pkg)) {
                return true;
            }
        }
        return false;
    }

    private static String appKey(String pkg) {
        if ("ru.oneme.app".equals(pkg)) {
            return "max";
        }
        if (pkg.contains("messaging") || pkg.endsWith(".mms") || pkg.contains(".sms")) {
            return "sms";
        }
        return "phone";
    }

    private static String appLabel(String pkg) {
        String key = appKey(pkg);
        if ("max".equals(key)) {
            return "MAX";
        }
        if ("sms".equals(key)) {
            return "СМС";
        }
        return "Телефон";
    }

    private static String text(CharSequence value) {
        return value == null ? "" : value.toString().trim();
    }
}
