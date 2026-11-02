# MAXA Launcher: повторно применить режим киоска после перезагрузки.
#
# Использование:
#   .\scripts\reapply-kiosk.ps1
#   .\scripts\reapply-kiosk.ps1 -Serial pn6hrsbm6d6lbahq
#   .\scripts\reapply-kiosk.ps1 -Adb "C:\Android\platform-tools\adb.exe"
#
# Скрипт не отключает приложения и не удаляет данные.
# На MIUI часть settings put может быть запрещена для adb shell — лаунчер
# применит яркость/поворот сам при следующем запуске.

param(
    [string]$Serial = "",
    [string]$Adb = "adb",
    [string]$Package = "com.MAXA_PHONE_LAUNCHER.launcher",
    [string]$Activity = "org.cordova.plugin.labs.kiosk.KioskActivity",
    [string]$AccessibilityService = "com.MAXA_PHONE_LAUNCHER.launcher/org.cordova.plugin.labs.kiosk.KioskAccessibilityService"
)

# Не ставим ErrorActionPreference=Stop: adb пишет предупреждения в stderr,
# а мы обрабатываем код возврата сами.
$adbArgs = @()
if ($Serial) { $adbArgs += @("-s", $Serial) }

function Run-Adb {
    # $args captures all arguments, including -a / -c.
    $out = & $Adb @adbArgs @args 2>&1
    $code = $LASTEXITCODE
    return [pscustomobject]@{
        Code = $code
        Text = (($out | Out-String).Trim())
    }
}

Write-Host "== MAXA Launcher: reapply kiosk ==" -ForegroundColor Cyan

$state = Run-Adb get-state
if ($state.Code -ne 0 -or $state.Text -ne "device") {
    throw "ADB device is not ready (state: '$($state.Text)'). Connect USB and allow debugging."
}

$model = (Run-Adb shell getprop ro.product.model).Text
$android = (Run-Adb shell getprop ro.build.version.release).Text
Write-Host "Device: $model"
Write-Host "Android: $android"

# 1. Домашний экран
$r = Run-Adb shell cmd package set-home-activity --user 0 "$Package/$Activity"
if ($r.Code -eq 0) { Write-Host "[ok] home activity set" }
else { Write-Warning "set-home-activity failed: $($r.Text)" }

$r = Run-Adb shell cmd role add-role-holder --user 0 android.app.role.HOME $Package
if ($r.Code -eq 0) { Write-Host "[ok] HOME role holder" }
else { Write-Warning "role add-role-holder failed (not critical)" }

# 2. Accessibility-служба (добавляем, не удаляя чужие)
$current = (Run-Adb shell settings get secure enabled_accessibility_services).Text
if ($current -eq "null") { $current = "" }
if ($current -notlike "*$AccessibilityService*") {
    if ($current) {
        $newList = "$current`:$AccessibilityService"
    } else {
        $newList = $AccessibilityService
    }
    $r = Run-Adb shell settings put secure enabled_accessibility_services $newList
    if ($r.Code -eq 0) {
        Write-Host "[ok] accessibility service added"
    } else {
        Write-Warning "Cannot enable accessibility via ADB on this ROM. Enable manually: Settings -> Accessibility -> Downloaded apps -> MAXA Launcher."
    }
} else {
    Write-Host "[ok] accessibility service already enabled"
}

$enabled = (Run-Adb shell settings get secure accessibility_enabled).Text
if ($enabled -eq "1") {
    Write-Host "[ok] accessibility_enabled=1"
} else {
    $r = Run-Adb shell settings put secure accessibility_enabled 1
    if ($r.Code -eq 0) {
        Write-Host "[ok] accessibility_enabled=1"
    } else {
        Write-Warning "accessibility_enabled not changed via ADB (ROM restriction)."
    }
}

# 3. SystemUI: скрыть шторку и «Недавние» (сбрасывается после reboot)
$r = Run-Adb shell cmd statusbar send-disable-flag statusbar-expansion recents
if ($r.Code -eq 0) { Write-Host "[ok] statusbar/recents flags applied" }
else { Write-Warning "statusbar flags failed: $($r.Text)" }

# 4. Поворот и автояркость.
# На MIUI adb shell может не иметь WRITE_SETTINGS — тогда это сделает
# сам лаунчер при следующем старте.
$rot = (Run-Adb shell settings get system accelerometer_rotation).Text
if ($rot -eq "0") {
    Write-Host "[ok] auto-rotate already disabled"
} else {
    $r = Run-Adb shell settings put system accelerometer_rotation 0
    if ($r.Code -eq 0) { Write-Host "[ok] auto-rotate disabled" }
    else { Write-Warning "auto-rotate not changed via ADB; the launcher will apply it on start." }
}

$bright = (Run-Adb shell settings get system screen_brightness_mode).Text
if ($bright -eq "0") {
    Write-Host "[ok] auto-brightness already disabled"
} else {
    $r = Run-Adb shell settings put system screen_brightness_mode 0
    if ($r.Code -eq 0) { Write-Host "[ok] auto-brightness disabled" }
    else { Write-Warning "auto-brightness not changed via ADB; the launcher will apply it on start." }
}

# 5. Открыть домашний экран
$r = Run-Adb shell am start -a android.intent.action.MAIN -c android.intent.category.HOME
if ($r.Code -eq 0) { Write-Host "[ok] HOME requested" }
else { Write-Warning "HOME start failed: $($r.Text)" }

# 6. Итоговая проверка
$homeLine = (Run-Adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME).Text
$access = (Run-Adb shell settings get secure enabled_accessibility_services).Text
Write-Host ""
Write-Host "HOME:"
Write-Host $homeLine
Write-Host "Accessibility:"
Write-Host $access
Write-Host ""
Write-Host "Done. If the shade still opens after a reboot, run this script again." -ForegroundColor Green
