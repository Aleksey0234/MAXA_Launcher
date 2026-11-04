# MAXA Launcher: полное восстановление после отключения.
#
# Возвращает стандартный рабочий стол, включает пакеты, которые отключал
# disable-unused-apps.ps1, убирает accessibility/уведомления и флаги киоска.
#
# Использование:
#   .\scripts\restore-launcher.ps1
#   .\scripts\restore-launcher.ps1 -Uninstall
#   .\scripts\restore-launcher.ps1 -Serial pn6hrsbm6d6lbahq
#
# Важно: обычное Android-приложение не может включать чужие пакеты,
# поэтому эта часть выполняется с компьютера через ADB.

param(
    [string]$Serial = "",
    [string]$Adb = "adb",
    [string]$Package = "com.MAXA_PHONE_LAUNCHER.launcher",
    [string]$AccessibilityService = "com.MAXA_PHONE_LAUNCHER.launcher/org.cordova.plugin.labs.kiosk.KioskAccessibilityService",
    [string]$NotificationListener = "com.MAXA_PHONE_LAUNCHER.launcher/org.cordova.plugin.labs.kiosk.KioskNotificationListenerService",
    [string]$HomePackage = "com.miui.home",
    [string]$HomeActivity = "com.miui.home/.launcher.Launcher",
    [switch]$Uninstall
)

$adbArgs = @()
if ($Serial) { $adbArgs += @("-s", $Serial) }

function Run-Adb {
    $out = & $Adb @adbArgs @args 2>&1
    return [pscustomobject]@{ Code = $LASTEXITCODE; Text = (($out | Out-String).Trim()) }
}

Write-Host "== MAXA Launcher: restore ==" -ForegroundColor Cyan

$state = Run-Adb get-state
if ($state.Code -ne 0 -or $state.Text -ne "device") {
    throw "ADB device is not ready (state: '$($state.Text)'). Connect USB and allow debugging."
}

Write-Host "Device: $((Run-Adb shell getprop ro.product.model).Text)"
Write-Host "Android: $((Run-Adb shell getprop ro.build.version.release).Text)"

# 1. Включаем пакеты, которые отключал скрипт.
$source = Join-Path $PSScriptRoot "disable-unused-apps.ps1"
$packages = @()
if (Test-Path $source) {
    $packages = Select-String -Path $source -Pattern '^\s*"([a-zA-Z0-9_.]+)",?$' |
        ForEach-Object { $_.Matches[0].Groups[1].Value } |
        Sort-Object -Unique
}
Write-Host "Packages to re-enable: $($packages.Count)"
$failed = 0
foreach ($p in $packages) {
    $r = Run-Adb shell pm enable $p
    if ($r.Code -ne 0 -or $r.Text -notmatch "new state: enabled") {
        $failed++
    }
}
Write-Host "[ok] package restore requested, failures: $failed"

# 2. Убираем accessibility-службу, сохраняя чужие.
$cur = (Run-Adb shell settings get secure enabled_accessibility_services).Text
if ($cur -eq "null") { $cur = "" }
$new = (($cur -split ":") | Where-Object { $_ -and $_ -ne $AccessibilityService }) -join ":"
if ($new) {
    Run-Adb shell settings put secure enabled_accessibility_services $new | Out-Null
} else {
    Run-Adb shell settings put secure enabled_accessibility_services "" | Out-Null
    Run-Adb shell settings put secure accessibility_enabled 0 | Out-Null
}
Write-Host "[ok] accessibility service removed"

# 3. Убираем доступ к уведомлениям.
Run-Adb shell cmd notification disallow_listener $NotificationListener | Out-Null
$listeners = (Run-Adb shell settings get secure enabled_notification_listeners).Text
if ($listeners -and $listeners -ne "null") {
    $newListeners = (($listeners -split ":") | Where-Object { $_ -and $_ -ne $NotificationListener }) -join ":"
    Run-Adb shell settings put secure enabled_notification_listeners $newListeners | Out-Null
}
Write-Host "[ok] notification listener removed"

# 4. Снимаем флаги шторки/«Недавних».
Run-Adb shell cmd statusbar send-enable-flag statusbar-expansion recents | Out-Null

# 5. Возвращаем поворот и автояркость.
Run-Adb shell settings put system accelerometer_rotation 1 | Out-Null
Run-Adb shell settings put system screen_brightness_mode 1 | Out-Null
Write-Host "[ok] rotation/auto-brightness restored"

# 6. Возвращаем стандартный рабочий стол.
Run-Adb shell cmd package set-home-activity --user 0 $HomeActivity | Out-Null
Run-Adb shell cmd role add-role-holder --user 0 android.app.role.HOME $HomePackage | Out-Null
Run-Adb shell am start -a android.intent.action.MAIN -c android.intent.category.HOME | Out-Null
Write-Host "[ok] home switched to $HomePackage"

# 7. Опционально удаляем лаунчер.
if ($Uninstall) {
    $r = Run-Adb uninstall $Package
    if ($r.Code -eq 0) { Write-Host "[ok] launcher uninstalled" }
    else { Write-Warning "uninstall failed: $($r.Text)" }
} else {
    Write-Host "[i] launcher left installed; run with -Uninstall to remove it"
}

Write-Host ""
Write-Host "HOME:"
Write-Host (Run-Adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME).Text
Write-Host ""
Write-Host "Done." -ForegroundColor Green
