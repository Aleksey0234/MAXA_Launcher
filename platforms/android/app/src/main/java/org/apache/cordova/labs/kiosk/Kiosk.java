package org.cordova.plugin.labs.kiosk;

import android.Manifest;
import android.app.ActivityManager;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.provider.Settings;
import android.telephony.ServiceState;
import android.telephony.SignalStrength;
import android.telephony.TelephonyManager;
import android.view.WindowManager;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.List;

public class Kiosk extends CordovaPlugin {

    public static final String SET_KIOSK_ENABLED = "setKioskEnabled";
    public static final String SWITCH_LAUNCHER = "switchLauncher";
    public static final String IS_IN_KIOSK = "isInKiosk";
    public static final String IS_SET_AS_LAUNCHER = "isSetAsLauncher";
    public static final String GET_SYSTEM_STATE = "getSystemState";
    public static final String SET_BRIGHTNESS = "setBrightness";
    public static final String APPLY_SYSTEM_DEFAULTS = "applySystemDefaults";
    public static final String REQUEST_WRITE_SETTINGS = "requestWriteSettings";
    public static final String OPEN_WIFI_SETTINGS = "openWifiSettings";
    public static final String OPEN_BLUETOOTH_SETTINGS = "openBluetoothSettings";
    public static final String KILL_ALL = "killAll";
    public static final String SET_FLASHLIGHT = "setFlashlight";
    public static final String EXIT_KIOSK = "exitKiosk";
    public static final String OPEN_DEVELOPER_SETTINGS = "openDeveloperSettings";
    public static final String OPEN_ACCESSIBILITY_SETTINGS = "openAccessibilitySettings";
    public static final String OPEN_RUSTORE = "openRuStore";
    public static final String OPEN_KEYBOARD_SETTINGS = "openKeyboardSettings";
    public static final String OPEN_FILE_MANAGER = "openFileManager";
    public static final String GET_NOTIFICATIONS = "getNotifications";
    public static final String IS_NOTIFICATION_ACCESS_GRANTED = "isNotificationAccessGranted";
    public static final String OPEN_NOTIFICATION_ACCESS_SETTINGS = "openNotificationAccessSettings";

    private static final int REQUEST_CAMERA = 0x0F1A;

    private CallbackContext flashlightCallback;
    private boolean flashlightPending = false;

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) {
        try {
            if (IS_IN_KIOSK.equals(action)) {
                callbackContext.success(Boolean.toString(KioskActivity.kioskModeEnabled));
                return true;

            } else if (IS_SET_AS_LAUNCHER.equals(action)) {
                String myPackage = cordova.getActivity().getApplicationContext().getPackageName();
                callbackContext.success(Boolean.toString(myPackage.equals(findLauncherPackageName())));
                return true;

            } else if (SET_KIOSK_ENABLED.equals(action)) {
                KioskActivity.kioskModeEnabled = args.getBoolean(0);
                callbackContext.success();
                return true;

            } else if (SWITCH_LAUNCHER.equals(action)) {
                KioskActivity.kioskModeEnabled = false;
                Intent intent = new Intent(Intent.ACTION_MAIN);
                intent.addCategory(Intent.CATEGORY_HOME);
                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

                Intent chooser = Intent.createChooser(intent, "Select destination...");
                if (intent.resolveActivity(cordova.getActivity().getPackageManager()) != null) {
                    cordova.getActivity().startActivity(chooser);
                }
                callbackContext.success();
                return true;

            } else if (GET_SYSTEM_STATE.equals(action)) {
                callbackContext.success(getSystemState());
                return true;

            } else if (SET_BRIGHTNESS.equals(action)) {
                setBrightness(args.getInt(0), callbackContext);
                return true;

            } else if (APPLY_SYSTEM_DEFAULTS.equals(action)) {
                applySystemDefaults(callbackContext);
                return true;

            } else if (REQUEST_WRITE_SETTINGS.equals(action)) {
                openWriteSettingsPermission();
                callbackContext.success();
                return true;

            } else if (OPEN_WIFI_SETTINGS.equals(action)) {
                openSystemScreen(Settings.ACTION_WIFI_SETTINGS);
                callbackContext.success();
                return true;

            } else if (OPEN_BLUETOOTH_SETTINGS.equals(action)) {
                openSystemScreen(Settings.ACTION_BLUETOOTH_SETTINGS);
                callbackContext.success();
                return true;

            } else if (KILL_ALL.equals(action)) {
                killAll(callbackContext);
                return true;

            } else if (SET_FLASHLIGHT.equals(action)) {
                setFlashlight(args.getBoolean(0), callbackContext);
                return true;

            } else if (EXIT_KIOSK.equals(action)) {
                exitKiosk(callbackContext);
                return true;

            } else if (OPEN_DEVELOPER_SETTINGS.equals(action)) {
                openSystemScreen(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS);
                callbackContext.success();
                return true;

            } else if (OPEN_ACCESSIBILITY_SETTINGS.equals(action)) {
                openSystemScreen(Settings.ACTION_ACCESSIBILITY_SETTINGS);
                callbackContext.success();
                return true;

            } else if (OPEN_RUSTORE.equals(action)) {
                openRuStore(callbackContext);
                return true;

            } else if (OPEN_KEYBOARD_SETTINGS.equals(action)) {
                openSystemScreen(Settings.ACTION_INPUT_METHOD_SETTINGS);
                callbackContext.success();
                return true;

            } else if (OPEN_FILE_MANAGER.equals(action)) {
                openFileManager(callbackContext);
                return true;

            } else if (GET_NOTIFICATIONS.equals(action)) {
                callbackContext.success(KioskNotificationListenerService.snapshotJson());
                return true;

            } else if (IS_NOTIFICATION_ACCESS_GRANTED.equals(action)) {
                callbackContext.success(Boolean.toString(isNotificationAccessGranted()));
                return true;

            } else if (OPEN_NOTIFICATION_ACCESS_SETTINGS.equals(action)) {
                openNotificationAccessSettings();
                callbackContext.success();
                return true;
            }

            callbackContext.error("Invalid action");
            return false;
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
            return false;
        }
    }

    private Context context() {
        return cordova.getActivity().getApplicationContext();
    }

    private JSONObject getSystemState() {
        JSONObject state = new JSONObject();
        try {
            Context ctx = context();
            WifiManager wifiManager = (WifiManager) ctx.getApplicationContext()
                    .getSystemService(Context.WIFI_SERVICE);
            boolean wifiEnabled = wifiManager != null && wifiManager.isWifiEnabled();
            int btOn = Settings.Global.getInt(ctx.getContentResolver(), "bluetooth_on", 0);
            int brightness = Settings.System.getInt(ctx.getContentResolver(),
                    Settings.System.SCREEN_BRIGHTNESS, 128);
            boolean canWrite = Settings.System.canWrite(ctx);

            state.put("wifi", wifiEnabled);
            state.put("bluetooth", btOn != 0);
            state.put("brightness", Math.max(10, Math.min(100, Math.round(brightness * 100f / 255f))));
            state.put("canWrite", canWrite);

            String enabled = Settings.Secure.getString(ctx.getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            state.put("accessibility", enabled != null && enabled.contains(ctx.getPackageName()));

            // Реальное состояние сети.
            boolean wifiConnected = false;
            boolean cellularConnected = false;
            ConnectivityManager cm = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                Network active = cm.getActiveNetwork();
                NetworkCapabilities caps = active == null ? null : cm.getNetworkCapabilities(active);
                if (caps != null) {
                    wifiConnected = caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI);
                    cellularConnected = caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR);
                }
            }

            String carrier = "";
            String networkType = "";
            int signalLevel = 0;
            boolean registered = false;
            int simState = TelephonyManager.SIM_STATE_UNKNOWN;

            TelephonyManager tm = (TelephonyManager) ctx.getSystemService(Context.TELEPHONY_SERVICE);
            if (tm != null) {
                try {
                    simState = tm.getSimState();
                } catch (Exception ignored) {
                }
                try {
                    carrier = tm.getNetworkOperatorName();
                } catch (Exception ignored) {
                }
                if (carrier == null || carrier.trim().isEmpty()) {
                    try {
                        carrier = tm.getSimOperatorName();
                    } catch (Exception ignored) {
                    }
                }
                if (carrier == null || carrier.trim().isEmpty()) {
                    carrier = simState == TelephonyManager.SIM_STATE_ABSENT ? "Нет SIM" : "Нет сети";
                }
                try {
                    ServiceState ss = tm.getServiceState();
                    registered = ss != null && ss.getState() == ServiceState.STATE_IN_SERVICE;
                } catch (Exception ignored) {
                }
                try {
                    networkType = networkTypeLabel(tm.getDataNetworkType());
                } catch (Exception ignored) {
                }
                try {
                    SignalStrength signal = tm.getSignalStrength();
                    if (signal != null) {
                        signalLevel = Math.max(0, Math.min(4, signal.getLevel()));
                    }
                } catch (Exception ignored) {
                }
            }

            state.put("wifiConnected", wifiConnected);
            state.put("cellularConnected", cellularConnected);
            state.put("carrier", carrier);
            state.put("networkType", networkType);
            state.put("signalLevel", signalLevel);
            state.put("registered", registered);
            state.put("simState", simState);
        } catch (Exception e) {
            // Return what we have.
        }
        return state;
    }

    private String networkTypeLabel(int type) {
        switch (type) {
            case TelephonyManager.NETWORK_TYPE_NR:
                return "5G";
            case TelephonyManager.NETWORK_TYPE_LTE:
                return "4G";
            case TelephonyManager.NETWORK_TYPE_HSPAP:
            case TelephonyManager.NETWORK_TYPE_HSDPA:
            case TelephonyManager.NETWORK_TYPE_HSUPA:
            case TelephonyManager.NETWORK_TYPE_UMTS:
            case TelephonyManager.NETWORK_TYPE_EVDO_0:
            case TelephonyManager.NETWORK_TYPE_EVDO_A:
            case TelephonyManager.NETWORK_TYPE_EVDO_B:
                return "3G";
            case TelephonyManager.NETWORK_TYPE_EDGE:
            case TelephonyManager.NETWORK_TYPE_GPRS:
            case TelephonyManager.NETWORK_TYPE_GSM:
            case TelephonyManager.NETWORK_TYPE_CDMA:
            case TelephonyManager.NETWORK_TYPE_1xRTT:
                return "2G";
            default:
                return "";
        }
    }

    private void setBrightness(int percent, CallbackContext callbackContext) {
        Context ctx = context();
        if (!Settings.System.canWrite(ctx)) {
            callbackContext.error("WRITE_SETTINGS_NOT_GRANTED");
            return;
        }
        final int value = Math.max(1, Math.min(255, Math.round(percent * 255f / 100f)));
        Settings.System.putInt(ctx.getContentResolver(),
                Settings.System.SCREEN_BRIGHTNESS_MODE,
                Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL);
        boolean ok = Settings.System.putInt(ctx.getContentResolver(),
                Settings.System.SCREEN_BRIGHTNESS, value);

        cordova.getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                WindowManager.LayoutParams lp = cordova.getActivity().getWindow().getAttributes();
                lp.screenBrightness = Math.max(0.01f, value / 255f);
                cordova.getActivity().getWindow().setAttributes(lp);
            }
        });

        if (ok) {
            callbackContext.success(percent);
        } else {
            callbackContext.error("BRIGHTNESS_FAILED");
        }
    }

    private void applySystemDefaults(CallbackContext callbackContext) {
        Context ctx = context();
        if (!Settings.System.canWrite(ctx)) {
            callbackContext.error("WRITE_SETTINGS_NOT_GRANTED");
            return;
        }
        Settings.System.putInt(ctx.getContentResolver(),
                Settings.System.ACCELEROMETER_ROTATION, 0);
        Settings.System.putInt(ctx.getContentResolver(),
                Settings.System.SCREEN_BRIGHTNESS_MODE,
                Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL);
        callbackContext.success();
    }

    private void openWriteSettingsPermission() {
        Intent intent = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS);
        intent.setData(Uri.parse("package:" + context().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context().startActivity(intent);
    }

    private void openSystemScreen(String action) {
        Intent intent = new Intent(action);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context().startActivity(intent);
    }

    private void killAll(CallbackContext callbackContext) {
        try {
            Context ctx = context();
            String self = ctx.getPackageName();
            PackageManager pm = ctx.getPackageManager();
            ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
            List<ApplicationInfo> apps = pm.getInstalledApplications(0);
            for (ApplicationInfo app : apps) {
                if (app.packageName.equals(self)) {
                    continue;
                }
                if (pm.getLaunchIntentForPackage(app.packageName) == null) {
                    continue;
                }
                am.killBackgroundProcesses(app.packageName);
            }
            // Дополнительно очищаем карточки в «Недавних» через accessibility.
            KioskAccessibilityService.requestClearAll();
            callbackContext.success();
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private void setFlashlight(boolean enabled, CallbackContext callbackContext) {
        if (!cordova.hasPermission(Manifest.permission.CAMERA)) {
            flashlightCallback = callbackContext;
            flashlightPending = enabled;
            cordova.requestPermission(this, REQUEST_CAMERA, Manifest.permission.CAMERA);
            return;
        }
        applyFlashlight(enabled, callbackContext);
    }

    private void applyFlashlight(boolean enabled, CallbackContext callbackContext) {
        try {
            CameraManager cameraManager = (CameraManager) context().getSystemService(Context.CAMERA_SERVICE);
            String[] ids = cameraManager.getCameraIdList();
            for (String id : ids) {
                CameraCharacteristics characteristics = cameraManager.getCameraCharacteristics(id);
                Boolean available = characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (Boolean.TRUE.equals(available)) {
                    cameraManager.setTorchMode(id, enabled);
                    callbackContext.success(enabled ? "on" : "off");
                    return;
                }
            }
            callbackContext.error("NO_FLASHLIGHT");
        } catch (Exception e) {
            callbackContext.error("FLASHLIGHT_ERROR: " + e.getMessage());
        }
    }

    @Override
    public void onRequestPermissionResult(int requestCode, String[] permissions, int[] grantResults)
            throws JSONException {
        if (requestCode == REQUEST_CAMERA) {
            boolean granted = grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            CallbackContext callback = flashlightCallback;
            boolean enabled = flashlightPending;
            flashlightCallback = null;
            if (granted) {
                applyFlashlight(enabled, callback);
            } else if (callback != null) {
                callback.error("CAMERA_PERMISSION_DENIED");
            }
        }
    }

    private void exitKiosk(CallbackContext callbackContext) {
        try {
            DevicePolicyManager dpm = (DevicePolicyManager) context()
                    .getSystemService(Context.DEVICE_POLICY_SERVICE);
            ComponentName admin = new ComponentName(context(), KioskDeviceAdminReceiver.class);
            if (dpm != null && dpm.isDeviceOwnerApp(context().getPackageName())) {
                dpm.setStatusBarDisabled(admin, false);
                dpm.clearDeviceOwnerApp(context().getPackageName());
            }
            try {
                cordova.getActivity().stopLockTask();
            } catch (Exception ignored) {
            }
            callbackContext.success();
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private void openFileManager(CallbackContext callbackContext) {
        try {
            PackageManager pm = context().getPackageManager();
            Intent intent = pm.getLaunchIntentForPackage("com.mi.android.globalFileexplorer");
            if (intent == null) {
                intent = pm.getLaunchIntentForPackage("com.android.documentsui");
            }
            if (intent == null) {
                intent = new Intent(Intent.ACTION_VIEW);
                intent.setData(Uri.parse("content://com.android.externalstorage.documents/root/primary"));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context().startActivity(intent);
            callbackContext.success();
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private void openRuStore(CallbackContext callbackContext) {
        try {
            PackageManager pm = context().getPackageManager();
            Intent intent = pm.getLaunchIntentForPackage("ru.vk.store");
            if (intent == null) {
                callbackContext.error("RUSTORE_NOT_INSTALLED");
                return;
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context().startActivity(intent);
            callbackContext.success();
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private boolean isNotificationAccessGranted() {
        try {
            Context ctx = context();
            String flat = Settings.Secure.getString(
                    ctx.getContentResolver(), "enabled_notification_listeners");
            if (flat == null || flat.isEmpty()) {
                return false;
            }
            ComponentName component = new ComponentName(ctx, KioskNotificationListenerService.class);
            return flat.contains(component.flattenToString());
        } catch (Exception e) {
            return false;
        }
    }

    private void openNotificationAccessSettings() {
        Context ctx = context();
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
        ComponentName component = new ComponentName(ctx, KioskNotificationListenerService.class);
        intent.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                component.flattenToString());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(intent);
        } catch (Exception e) {
            Intent fallback = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(fallback);
        }
    }

    private String findLauncherPackageName() {
        final Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_HOME);
        final ResolveInfo res = this.cordova.getActivity().getPackageManager().resolveActivity(intent, 0);
        return res != null && res.activityInfo != null ? res.activityInfo.packageName : "";
    }

}
