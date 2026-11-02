package org.jmrezayi2.Applist;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.util.Base64;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.List;

public class Applist extends CordovaPlugin {
    public static final String ACTION_GET_LIST = "getList";

    @Override
    public boolean execute(String action, JSONArray args, final CallbackContext callbackContext) throws JSONException {
        if (ACTION_GET_LIST.equals(action)) {
            cordova.getThreadPool().execute(new Runnable() {
                @Override
                public void run() {
                    try {
                        callbackContext.success(getApps());
                    } catch (Exception e) {
                        callbackContext.error(e.getMessage());
                    }
                }
            });
            return true;
        }
        callbackContext.error("Invalid action");
        return false;
    }

    private JSONArray getApps() throws Exception {
        PackageManager pm = cordova.getActivity().getPackageManager();
        List<ApplicationInfo> packages = pm.getInstalledApplications(PackageManager.GET_META_DATA);
        String self = cordova.getActivity().getPackageName();
        JSONArray appList = new JSONArray();

        for (ApplicationInfo packageInfo : packages) {
            if (self.equals(packageInfo.packageName)) {
                continue;
            }
            Intent launchIntent = pm.getLaunchIntentForPackage(packageInfo.packageName);
            if (launchIntent == null) {
                continue;
            }

            JSONObject info = new JSONObject();
            info.put("packageName", packageInfo.packageName);
            info.put("name", packageInfo.loadLabel(pm).toString());
            try {
                Drawable icon = pm.getApplicationIcon(packageInfo);
                info.put("icon", drawableToDataUri(icon));
            } catch (Exception ignored) {
            }
            appList.put(info);
        }
        return appList;
    }

    private String drawableToDataUri(Drawable drawable) {
        int size = 128;
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        drawable.setBounds(0, 0, size, size);
        drawable.draw(canvas);
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, bos);
        return "data:image/png;base64," + Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
    }
}
