#!/usr/bin/env bash
# MAXA Launcher: reapply kiosk mode after reboot (Linux/macOS).
#
# Usage:
#   ./scripts/reapply-kiosk.sh
#   SERIAL=pn6hrsbm6d6lbahq ./scripts/reapply-kiosk.sh
#   ADB=/path/to/adb ./scripts/reapply-kiosk.sh

set -euo pipefail

ADB="${ADB:-adb}"
SERIAL="${SERIAL:-}"
PKG="${PKG:-com.MAXA_PHONE_LAUNCHER.launcher}"
ACT="${ACT:-org.cordova.plugin.labs.kiosk.KioskActivity}"
A11Y="${A11Y:-com.MAXA_PHONE_LAUNCHER.launcher/org.cordova.plugin.labs.kiosk.KioskAccessibilityService}"

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
  run_adb shell settings put secure enabled_accessibility_services "$new_list" >/dev/null
  echo "[ok] accessibility service added"
else
  echo "[ok] accessibility service already enabled"
fi
run_adb shell settings put secure accessibility_enabled 1 >/dev/null

# 3. SystemUI flags (reset after reboot)
if run_adb shell cmd statusbar send-disable-flag statusbar-expansion recents >/dev/null 2>&1; then
  echo "[ok] statusbar/recents flags applied"
else
  echo "[warn] statusbar flags failed"
fi

# 4. Rotation / auto-brightness
run_adb shell settings put system accelerometer_rotation 0 >/dev/null
run_adb shell settings put system screen_brightness_mode 0 >/dev/null
echo "[ok] rotation/auto-brightness disabled"

# 5. Open home
run_adb shell am start -a android.intent.action.MAIN -c android.intent.category.HOME >/dev/null
echo "[ok] HOME requested"

echo
echo "HOME:"
run_adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tr -d '\r'
echo "Accessibility:"
run_adb shell settings get secure enabled_accessibility_services | tr -d '\r'
echo
echo "Done. If the shade still opens after a reboot, run this script again."
