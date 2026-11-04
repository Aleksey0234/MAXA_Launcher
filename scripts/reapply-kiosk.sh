#!/usr/bin/env bash
# MAXA Launcher: reapply kiosk mode after reboot (Linux/macOS).
#
# Usage:
#   ./scripts/reapply-kiosk.sh
#   SERIAL=pn6hrsbm6d6lbahq ./scripts/reapply-kiosk.sh
#   ADB=/path/to/adb ./scripts/reapply-kiosk.sh
#
# Does not disable apps or delete data.
# On MIUI some "settings put" calls are denied to adb shell; the launcher
# applies rotation/auto-brightness itself on the next start.

set -euo pipefail

ADB="${ADB:-adb}"
SERIAL="${SERIAL:-}"
PKG="${PKG:-com.MAXA_PHONE_LAUNCHER.launcher}"
ACT="${ACT:-org.cordova.plugin.labs.kiosk.KioskActivity}"
A11Y="${A11Y:-com.MAXA_PHONE_LAUNCHER.launcher/org.cordova.plugin.labs.kiosk.KioskAccessibilityService}"
LISTENER="${LISTENER:-com.MAXA_PHONE_LAUNCHER.launcher/org.cordova.plugin.labs.kiosk.KioskNotificationListenerService}"

adb_args=()
if [[ -n "$SERIAL" ]]; then
  adb_args+=("-s" "$SERIAL")
fi

run_adb() {
  "$ADB" "${adb_args[@]}" "$@"
}

echo "== MAXA Launcher: reapply kiosk =="

state="$(run_adb get-state 2>/dev/null | tr -d '\r' || true)"
if [[ "$state" != "device" ]]; then
  echo "ADB device is not ready (state: '$state'). Connect USB and allow debugging." >&2
  exit 1
fi

echo "Device: $(run_adb shell getprop ro.product.model | tr -d '\r')"
echo "Android: $(run_adb shell getprop ro.build.version.release | tr -d '\r')"

# 1. Home activity
if run_adb shell cmd package set-home-activity --user 0 "$PKG/$ACT" >/dev/null 2>&1; then
  echo "[ok] home activity set"
else
  echo "[warn] set-home-activity failed"
fi

if run_adb shell cmd role add-role-holder --user 0 android.app.role.HOME "$PKG" >/dev/null 2>&1; then
  echo "[ok] HOME role holder"
else
  echo "[warn] role add-role-holder failed (not critical)"
fi

# 2. Accessibility service (append, do not remove others)
current="$(run_adb shell settings get secure enabled_accessibility_services 2>/dev/null | tr -d '\r' || true)"
current="${current%$'\n'}"
if [[ "$current" == "null" ]]; then
  current=""
fi
if [[ "$current" != *"$A11Y"* ]]; then
  if [[ -n "$current" ]]; then
    new_list="$current:$A11Y"
  else
    new_list="$A11Y"
  fi
  if run_adb shell settings put secure enabled_accessibility_services "$new_list" >/dev/null 2>&1; then
    echo "[ok] accessibility service added"
  else
    echo "[warn] cannot enable accessibility via ADB on this ROM; enable manually in Settings -> Accessibility"
  fi
else
  echo "[ok] accessibility service already enabled"
fi

enabled="$(run_adb shell settings get secure accessibility_enabled 2>/dev/null | tr -d '\r' || true)"
if [[ "$enabled" == "1" ]]; then
  echo "[ok] accessibility_enabled=1"
elif run_adb shell settings put secure accessibility_enabled 1 >/dev/null 2>&1; then
  echo "[ok] accessibility_enabled=1"
else
  echo "[warn] accessibility_enabled not changed via ADB (ROM restriction)"
fi

# 2b. Notification access (MAX / SMS / phone)
listeners="$(run_adb shell settings get secure enabled_notification_listeners 2>/dev/null | tr -d '\r' || true)"
if [[ "$listeners" != *"$LISTENER"* ]]; then
  if run_adb shell cmd notification allow_listener "$LISTENER" >/dev/null 2>&1; then
    echo "[ok] notification listener enabled"
  else
    echo "[warn] notification listener not enabled"
  fi
else
  echo "[ok] notification listener already enabled"
fi

# 3. SystemUI flags (reset after reboot)
if run_adb shell cmd statusbar send-disable-flag statusbar-expansion recents >/dev/null 2>&1; then
  echo "[ok] statusbar/recents flags applied"
else
  echo "[warn] statusbar flags failed"
fi

# 4. Rotation / auto-brightness
rot="$(run_adb shell settings get system accelerometer_rotation 2>/dev/null | tr -d '\r' || true)"
if [[ "$rot" == "0" ]]; then
  echo "[ok] auto-rotate already disabled"
elif run_adb shell settings put system accelerometer_rotation 0 >/dev/null 2>&1; then
  echo "[ok] auto-rotate disabled"
else
  echo "[warn] auto-rotate not changed via ADB; the launcher will apply it on start"
fi

bright="$(run_adb shell settings get system screen_brightness_mode 2>/dev/null | tr -d '\r' || true)"
if [[ "$bright" == "0" ]]; then
  echo "[ok] auto-brightness already disabled"
elif run_adb shell settings put system screen_brightness_mode 0 >/dev/null 2>&1; then
  echo "[ok] auto-brightness disabled"
else
  echo "[warn] auto-brightness not changed via ADB; the launcher will apply it on start"
fi

# 5. Open home
if run_adb shell am start -a android.intent.action.MAIN -c android.intent.category.HOME >/dev/null 2>&1; then
  echo "[ok] HOME requested"
else
  echo "[warn] HOME start failed"
fi

echo
echo "HOME:"
run_adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tr -d '\r'
echo "Accessibility:"
run_adb shell settings get secure enabled_accessibility_services | tr -d '\r'
echo
echo "Done. If the shade still opens after a reboot, run this script again."
