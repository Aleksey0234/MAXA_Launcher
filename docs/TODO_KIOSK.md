# TODO: полная блокировка системной шторки

**Дата:** 02.11.2026  
**Статус:** отложено по решению пользователя. Сейчас оставляем быстрое закрытие через accessibility-службу.

## Текущее состояние

- В APK добавлена служба `KioskAccessibilityService` (`org.cordova.plugin.labs.kiosk.KioskAccessibilityService`).
- Она закрывает:
  - экран недавних приложений MIUI (`RecentsActivity`) → `GLOBAL_ACTION_HOME`;
  - системную шторку уведомлений / SystemUI → `GLOBAL_ACTION_BACK`.
- Настройки службы:
  - `notificationTimeout = 50`;
  - внутренний порог `THROTTLE_MS = 150`;
  - повторное закрытие шторки через 200 мс, если она всё ещё активна.
- Служба включена вручную:
  `Настройки → Специальные возможности → Скачанные приложения → MAXA Launcher`.
- Проверено: «Недавние» и шторка закрываются из лаунчера и из сторонних приложений.

## Проблема

Шторка всё равно успевает появиться на ~0.2–0.5 с (пользователь видит короткую вспышку).
Причина: SystemUI рисует шторку раньше, чем accessibility-служба получает событие и успевает отправить `BACK`.
Обычное приложение не может запретить SystemUI открывать шторку — только реагировать постфактум.

## Отложенный вопрос

Полностью убрать вспышку можно только через **device owner / kiosk-режим**:

1. Добавить в приложение `DeviceAdminReceiver`.
2. Назначить приложение device owner:
   `adb shell dpm set-device-owner com.MAXA_PHONE_LAUNCHER.launcher/.KioskDeviceAdminReceiver`
3. Вызвать `DevicePolicyManager.setStatusBarDisabled(admin, true)`.
4. При необходимости — `setLockTaskPackages` / lock task для запрета «Недавних».

**Риски / ограничения:**
- на устройстве уже есть profile owner `com.google.android.gms.supervision` (Family Link);
- установка device owner может потребовать удаления профиля/аккаунта или сброса устройства;
- возможны побочные эффекты для родительского контроля;
- если `dpm set-device-owner` не сработает — вернуть всё как было.

**Решение пользователя:** пока оставить текущее быстрое закрытие, к device owner вернуться позже.

## Попытка device owner (02.11.2026)

Пользователь согласился на kiosk/device owner. В приложение добавлены:

- `KioskDeviceAdminReceiver`;
- `res/xml/device_admin_receiver.xml`;
- политика в `KioskActivity.applyKioskPolicy()`:
  `setStatusBarDisabled`, `setLockTaskPackages`, `setLockTaskFeatures(HOME)`,
  `startLockTask()`;
- пункт «Выйти из режима киоска» в настройках.

Команда:

```powershell
adb shell dpm set-device-owner `
  com.MAXA_PHONE_LAUNCHER.launcher/org.cordova.plugin.labs.kiosk.KioskDeviceAdminReceiver
```

Результат на MIUI:

```
SecurityException: Calling identity is not authorized
  at DevicePolicyManagerService.setActiveAdmin(...)
```

Даже после включения «Отладка по USB (настройки безопасности)»:

- `adb shell settings put secure ...` → `WRITE_SECURE_SETTINGS` denied;
- `dpm set-active-admin` → `Calling identity is not authorized`.

Вывод: MIUI блокирует device owner/защищённые настройки через ADB.
Полный kiosk без root/прошивки/вендорного provisioning на этом телефоне
невозможен. Профиль Family Link (profile owner) также присутствует.

## Текущий fallback

- Верхняя шторка и «Недавние» отключаются флагами SystemUI:

```powershell
adb shell cmd statusbar send-disable-flag statusbar-expansion recents
```

Флаги in-memory: после перезагрузки могут сброситься, команду нужно повторить.

- В лаунчере системные бары скрыты полноэкранным режимом.
- В сторонних приложениях нижняя навигационная панель остаётся — убрать её
  без device owner нельзя.
- Accessibility-служба (после переустановки её нужно включать заново)
  закрывает «Недавние» и шторку, если флаги SystemUI не действуют.


## Как вернуться к задаче

1. Проверить, можно ли назначить device owner на текущем устройстве.
2. Если да — реализовать `DeviceAdminReceiver` + `setStatusBarDisabled(true)`.
3. Если нет — оставить accessibility-службу и быстрое закрытие.

## Важно

Служба должна оставаться включённой. Если MIUI отключит её после оптимизации/перезагрузки — включить снова:
`Настройки → Специальные возможности → Скачанные приложения → MAXA Launcher`.
