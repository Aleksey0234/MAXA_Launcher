# MAXA Launcher

Лаунчер для Android на Cordova: заменяет стандартный рабочий стол, скрывает
системные панели внутри лаунчера, запускает реальные приложения и блокирует
часть сайтов через accessibility-службу.

Проект собран и проверен на **Redmi Note 10T (M2103K19Y, Android 15 / MIUI)**.

## Возможности

- **Главный экран**: крупные часы, дата, пустое пространство, кнопка «Закрыть все»
  слева, кнопки **Будильник** и **Vol** под часами.
- **Нижний док**: Телефон, MAX, Браузер, Камера, Дневник.
  Приложения запускаются реально:
  - Телефон — `com.google.android.dialer`;
  - MAX — `ru.oneme.app`;
  - Браузер — `com.android.chrome`;
  - Камера — `com.android.camera`;
  - Дневник — `ru.mes.dnevnik.fgis`.
- **Нижняя навигация**: только «Назад» и «Домой»; системные бары в лаунчере скрыты.
- **Быстрые настройки**: свайп от верхнего края; Wi-Fi, Bluetooth, фонарик,
  экономия заряда (зафиксирована), настройки и системная яркость.
- **Системная яркость**: ползунок меняет `Settings.System.SCREEN_BRIGHTNESS`
  (требуется разрешение «Изменение системных настроек»).
- **Автоповорот и автояркость** отключаются при старте.
- **Фонарик**: реальный `CameraManager.setTorchMode`.
- **Настройки разработчика** (PIN `0234`):
  - «Установка через USB» → системные настройки разработчика;
  - «Служба доступности» → специальные возможности;
  - «Открыть RuStore» → `ru.vk.store`;
  - «Клавиатура RU/EN» → выбор клавиатуры;
  - «Мои файлы» → системный проводник.
- **Блокировка сайтов**: accessibility-служба проверяет адресную строку браузера
  и закрывает страницы из списка (`KioskAccessibilityService.BLOCKED_SITES`).
  Блокировка работает в Chrome и других браузерах, которые отдают URL
  в accessibility-дерево.
- **Очистка приложений**: круглая кнопка слева завершает фоновые процессы;
  при включённой службе дополнительно очищает карточки «Недавних».
- **Статус-панель**: реальный оператор/SIM, тип сети, уровень сигнала,
  состояние Wi-Fi, заряд батареи.
- **Блокировка «Недавних» и шторки**: accessibility-служба; верхняя шторка
  дополнительно может отключаться флагами SystemUI (см. ниже).

## Структура

```
config.xml                 — настройки Cordova
package.json               — зависимости Cordova
www/
  index.html               — разметка лаунчера
  styles.css               — стили
  app.js                   — логика, список сайтов, экран настроек
plugins/
  cordova-plugin-kiosk-launcher/  — нативный плагин Kiosk
platforms/android/
  app/src/main/AndroidManifest.xml
  app/src/main/java/org/apache/cordova/labs/kiosk/
    Kiosk.java                       — яркость, Wi-Fi, фонарик, файлы, RuStore
    KioskActivity.java               — полноэкранный режим
    KioskAccessibilityService.java   — блокировка сайтов/«Недавних»/шторки
    KioskDeviceAdminReceiver.java    — заготовка для device owner
  app/src/main/res/xml/
    accessibility_service_config.xml
    device_admin_receiver.xml
docs/
  HANDOFF.md                — полный журнал работ и инструкции
  TODO_KIOSK.md             — отложенный device owner / kiosk
```

## Сборка

Требования:

- JDK 17
- Gradle 8.14.2 (wrapper уже в `platforms/android`)
- Android SDK (platform 36, build-tools 36.0.0)
- Cordova CLI

PowerShell:

```powershell
$env:JAVA_HOME="C:\path\to\jdk-17"
$env:ANDROID_HOME="C:\Users\<user>\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:PATH="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

cd MAXA_Launcher
npm install
cordova build android --debug
```

Готовый APK:

```
platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

## Установка

```powershell
adb install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk
adb shell cmd package set-home-activity --user 0 `
  com.MAXA_PHONE_LAUNCHER.launcher/org.cordova.plugin.labs.kiosk.KioskActivity
adb shell cmd role add-role-holder --user 0 `
  android.app.role.HOME com.MAXA_PHONE_LAUNCHER.launcher
adb shell am start -a android.intent.action.MAIN -c android.intent.category.HOME
```

Если MIUI покажет выбор домашнего приложения — выбрать **MAXA Launcher**
и включить «Запомнить выбор».

> **Установка на другое устройство агентом:** см. [`AGENTS.md`](AGENTS.md).
> Там пошаговая автономная инструкция для ИИ-агента: сборка, установка,
> разрешения, accessibility, настройка дока и блокировок, отключение лишних
> приложений, проверка и откат.

## Разрешения

- **CAMERA** — для фонарика. Выдаётся диалогом при первом включении.
- **WRITE_SETTINGS** («Изменение системных настроек») — системная яркость,
  отключение автоповорота и автояркости.
- **Accessibility-служба** — блокировка сайтов, «Недавних» и шторки:
  `Настройки → Специальные возможности → Скачанные приложения → MAXA Launcher`.
- **KILL_BACKGROUND_PROCESSES** — кнопка очистки.

После переустановки APK accessibility-службу обычно нужно включить заново.

## Отключение лишних приложений

На тестовом устройстве отключено 128 неиспользуемых пакетов (игры, соцсети,
Google Play, YouTube, Maps, Gmail, реклама MIUI, сервисы MI Cloud и т.п.).
Скрипт для повторения:

```powershell
.\scripts\disable-unused-apps.ps1
```

Вернуть всё обратно:

```powershell
.\scripts\disable-unused-apps.ps1 -Restore
```

Подробный список и что оставлено включённым — в `docs/HANDOFF.md`, раздел 12.
Установка приложений после отключения Google Play — через RuStore (`ru.vk.store`).

## Блокировка сайтов

Список находится в
`platforms/android/app/src/main/java/org/apache/cordova/labs/kiosk/KioskAccessibilityService.java`
в массиве `BLOCKED_SITES`. Поддерживаются домены и пути:

```java
"crazygames.com",
"yandex.ru/games",
"supercell.com/en/games/brawlstars"
```

Служба смотрит адресную строку браузера (верхняя панель) и не реагирует
на текст внутри страницы, чтобы не закрывать клавиатуру при вводе.
При открытой клавиатуре блокировка временно не срабатывает.

## Ограничения

- **Device owner / полный kiosk**: MIUI блокирует `dpm set-device-owner`
  (`Calling identity is not authorized`), поэтому полностью убрать системную
  навигацию во всех приложениях без root/прошивки нельзя. Подробности —
  `docs/TODO_KIOSK.md`.
- Верхняя шторка и «Недавние» могут отключаться флагами SystemUI:
  ```powershell
  adb shell cmd statusbar send-disable-flag statusbar-expansion recents
  ```
  Флаги **сбрасываются после перезагрузки**. Чтобы применить их снова,
  запустите `scripts/reapply-kiosk.ps1` (Windows) или
  `scripts/reapply-kiosk.sh` (Linux/macOS). Полностью автоматически без
  device owner/root это невозможно — см. `AGENTS.md`, раздел 11.
- В сторонних приложениях системная навигационная панель управляется Android,
  а не лаунчером.
- Экономия заряда в интерфейсе зафиксирована включённой; системный режим
  энергосбережения обычному приложению недоступен.
- Блокировка сайтов работает на уровне accessibility (адресная строка), а не
  через VPN/DNS; приложения, не отдающие URL, могут не блокироваться.

## Документация

- `AGENTS.md` — автономная инструкция для ИИ-агента по установке на новое
  устройство: от сборки до проверки и отката.
- `docs/HANDOFF.md` — полный журнал: сборка, установка, разрешения, проверки,
  диагностика.
- `docs/TODO_KIOSK.md` — отложенный device owner и ограничения MIUI.
- `scripts/reapply-kiosk.ps1` / `.sh` — повторно применить режим киоска
  после перезагрузки.
- `scripts/disable-unused-apps.ps1` — пример отключения лишних пакетов
  (список с Redmi Note 10T, не запускать вслепую).

## Лицензия

Apache-2.0 (Cordova-проект).
