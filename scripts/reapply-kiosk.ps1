# MAXA Launcher: повторно применить режим киоска после перезагрузки.
#
# Использование:
#   .\scripts\reapply-kiosk.ps1
#   .\scripts\reapply-kiosk.ps1 -Serial pn6hrsbm6d6lbahq
#   .\scripts\reapply-kiosk.ps1 -Adb "C:\Android\platform-tools\adb.exe"
#
# Скрипт не отключает приложения и не удаляет данные.

param(
    [string]$Serial = "",
    [string]$Adb = "adb",
    [string]$Package = "com.MAXA_PHONE_LAUNCHER.launcher",
    [string]$Activity = "org.cordova.plugin.labs.kiosk.KioskActivity",
    [string]$AccessibilityService = "com.MAXA_PHONE_LAUNCHER.launcher/org.cordova.plugin.labs.kiosk.KioskAccessibilityService"
)

$ErrorActionPreference = "Stop"

$adbArgs = @()
if ($Serial) { $adbArgs += @("-s", $Serial) }

function Invoke-Adb {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CmdArgs)
    & $Adb @adbArgs @CmdArgs
}

Write-Host "== MAXA Launcher: reapply kiosk ==" -ForegroundColor Cyan

$state = (Invoke-Adb get-state 2>$null | Out-String).Trim()
if ($state -ne "device") {
    throw "ADB device is not ready (state: '$state'). Connect USB and allow debugging."
}

Write-Host "Device: $((Invoke-Adb shell getprop ro.product.model | Out-String).Trim())"
Write-Host "Android: $((Invoke-Adb shell getprop ro.build.version.release | Out-String).Trim())"

# 1. Домашний экран
try {
    Invoke-Adb shell cmd package set-home-activity --user 0 "$Package/$Activity" | Out-Null
    Write-Host "[ok] home activity set"
} catch {
    Write-Warning "set-home-activity failed: $($_.Exception.Message)"
}

try {
    Invoke-Adb shell cmd role add-role-holder --user 0 android.app.role.HOME $Package | Out-Null
    Write-Host "[ok] HOME role holder"
} catch {
    Write-Warning "role add-role-holder failed (not critical)"
}

# 2. Accessibility-служба (добавляем, не удаляя чужие)
$current = (Invoke-Adb shell settings get secure enabled_accessibility_services 2>$null | Out-String).Trim()
if ($current -eq "null") { $current = "" }
if ($current -notlike "*$AccessibilityService*") {
    if ($current) {
        $newList = "$current`:$AccessibilityService"
    } else {
        $newList = $AccessibilityService
    }
    Invoke-Adb shell settings put secure enabled_accessibility_services $newList | Out-Null
    Write-Host "[ok] accessibility service added"
} else {
    Write-Host "[ok] accessibility service already enabled"
}
Invoke-Adb shell settings put secure accessibility_enabled 1 | Out-Null

# 3. SystemUI: скрыть шторку и «Недавние» (сбрасывается после reboot)
try {
    Invoke-Adb shell cmd statusbar send-disable-flag statusbar-expansion recents | Out-Null
    Write-Host "[ok] statusbar/recents flags applied"
} catch {
    Write-Warning "statusbar flags failed: $($_.Exception.Message)"
}

# 4. Поворот и автояркость
Invoke-Adb shell settings put system accelerometer_rotation 0 | Out-Null
Invoke-Adb shell settings put system screen_brightness_mode 0 | Out-Null
Write-Host "[ok] rotation/auto-brightness disabled"

# 5. Открыть домашний экран
Invoke-Adb shell am start -a android.intent.action.MAIN -c android.intent.category.HOME | Out-Null
Write-Host "[ok] HOME requested"

# 6. Итоговая проверка
$home = (Invoke-Adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | Out-String).Trim()
$access = (Invoke-Adb shell settings get secure enabled_accessibility_services | Out-String).Trim()
Write-Host ""
Write-Host "HOME:"
Write-Host $home
Write-Host "Accessibility:"
Write-Host $access
Write-Host ""
Write-Host "Done. If the shade still opens after a reboot, run this script again." -ForegroundColor Green
