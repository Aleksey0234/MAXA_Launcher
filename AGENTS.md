# AGENTS.md — автономная установка MAXA Launcher на другое устройство

Эта инструкция предназначена для ИИ-агента (Claude Code, Codex, OpenCode,
Cursor и т.п.), который скачал репозиторий и должен **сам** развернуть
лаунчер на подключённом Android-устройстве. Пользователь не должен вручную
выполнять команды: агент делает всё через `adb` и shell, а пользователя
просит только о физических действиях (подключить USB, нажать «Разрешить»,
подтвердить установку).

Проект проверен на **Redmi Note 10T (M2103K19Y, Android 13 / MIUI 14)**.
На других устройствах имена пакетов и ограничения прошивки могут отличаться.

---

## 0. Границы, согласие и безопасность

MAXA Launcher заменяет рабочий стол, ограничивает запуск приложений и
блокирует сайты. Это не «родительский контроль» в облаке и не вредоносное
ПО: приложение не собирает данные и не отправляет их на сервер.

**Перед началом агент обязан убедиться:**

1. Устройство принадлежит пользователю или владелец устройства дал явное
   согласие на установку и ограничения.
2. Пользователь понимает, что лаунчер ограничит телефон: часть приложений
   и сайтов будет недоступна.
3. Нельзя устанавливать лаунчер скрытно на чужой телефон, использовать для
   слежки или обхода согласия. Если устройство принадлежит ребёнку/ученику,
   согласие родителя или владельца обязательно.

Если пользователь просит «проучить» кого-то без его ведома — остановитесь
и уточните, кому принадлежит устройство и есть ли согласие.

---

## 1. Что должно получиться

После работы агента на устройстве:

- MAXA Launcher установлен и выбран домашним экраном.
- Работает нижний док: Телефон, MAX, Браузер, Камера, Дневник.
- Под часами работают кнопки Будильник, Vol и Смс.
- Включена accessibility-служба: блокируются «Недавние», шторка и сайты
  из списка.
- Выдан доступ к уведомлениям: на главном экране видна лента MAX, СМС
  и звонков; нажатие открывает нужное приложение.
- Системная яркость, фонарик, поворот и автояркость работают.
- Лишние приложения отключены, но телефон остаётся способен звонить,
  принимать SMS, работать с камерой, файлами и настройками.
- После перезагрузки лаунчер снова становится домашним экраном.
- Агент оставил отчёт: что изменено, что проверено, что осталось
  ограничением прошивки.

---

## 2. Быстрый старт для агента

Скопируйте агенту этот текст:

> Прочитай `AGENTS.md`, `README.md`, `docs/HANDOFF.md` и `docs/TODO_KIOSK.md`.
> Подключись к Android-устройству через ADB и автономно разверни MAXA Launcher:
> собери APK, установи, назначь домашним экраном, включи accessibility,
> настрой док и блокировку сайтов, отключи лишние приложения, проверь работу.
> Сам выполняй команды; пользователя спрашивай только про физические действия,
> согласие и выбор приложений/сайтов. Веди журнал в `docs/DEPLOY-<model>-<date>.md`.

---

## 3. Собери информацию об устройстве

Сначала определи параметры. Не меняй ничего, пока не сохранил исходное
состояние.

```powershell
adb devices -l
adb shell getprop ro.product.manufacturer
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell getprop ro.miui.ui.version.name
adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME
adb shell settings get secure enabled_accessibility_services
adb shell pm list packages -3
adb shell pm list packages -d
```

Сохрани в `docs/DEPLOY-<model>-<date>.md`:

- модель, Android, прошивка;
- исходный домашний экран (пакет/activity);
- исходный список accessibility-служб;
- список сторонних и отключённых пакетов;
- есть ли SIM, какие приложения нужны пользователю.

Проверь, что `adb devices` показывает `device`, а не `unauthorized`.
Если `unauthorized` — попроси пользователя нажать «Разрешить отладку» на
экране телефона.

---

## 4. Подготовь компьютер

Нужны:

- JDK 17;
- Android SDK (platform 36, build-tools 36.0.0);
- Node.js и npm;
- Cordova CLI (ставится через `npm install` в проекте);
- `adb` из Android SDK platform-tools.

Windows PowerShell:

```powershell
$env:JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-17..."
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:PATH="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
```

Linux/macOS:

```bash
export JAVA_HOME=/path/to/jdk-17
export ANDROID_HOME=$HOME/Android/Sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

Если Gradle не может скачать дистрибутив, укажи локальный zip:

```powershell
$env:CORDOVA_ANDROID_GRADLE_DISTRIBUTION_URL="file:/C:/path/to/gradle-8.14.2-bin.zip"
```

---

## 5. Собери APK

```powershell
cd my-launcher-app
npm install
npx cordova build android --debug
```

Готовый файл:

```
my-launcher-app/platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

Если сборка падает:

- проверь `java -version` — должна быть 17;
- проверь `sdkmanager --list` и наличие platform 36;
- удали `platforms/android/app/build` и повтори;
- не меняй `package.json` и `config.xml` без необходимости.

---

## 6. Установи APK

```powershell
adb install -r my-launcher-app/platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

Если ошибка `INSTALL_FAILED_USER_RESTRICTED` (MIUI):

1. Включи на телефоне «Для разработчиков».
2. Включи «Установка через USB» и «Отладка по USB (настройки безопасности)».
3. При необходимости войди в Mi-аккаунт — MIUI требует его для этих
   переключателей.
4. Повтори `adb install -r ...`.
5. Не отключай проверку безопасности глобально, если этого можно избежать.

После установки сразу проверь, что пакет появился:

```powershell
adb shell pm list packages | findstr MAXA
```

Имя пакета по умолчанию:

```
com.MAXA_PHONE_LAUNCHER.launcher
```

Activity:

```
org.cordova.plugin.labs.kiosk.KioskActivity
```

Если `config.xml` меняли, возьми актуальный `id` из `config.xml` и
`applicationId` из `platforms/android/app/build.gradle`.

---

## 7. Назначь домашним экраном

```powershell
$PKG="com.MAXA_PHONE_LAUNCHER.launcher"
$ACT="org.cordova.plugin.labs.kiosk.KioskActivity"

adb shell cmd package set-home-activity --user 0 "$PKG/$ACT"
adb shell cmd role add-role-holder --user 0 android.app.role.HOME $PKG
adb shell am start -a android.intent.action.MAIN -c android.intent.category.HOME
```

Проверка:

```powershell
adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME
```

В выводе должно быть `isDefault=true` и activity лаунчера.

Если `set-home-activity` не поддерживается прошивкой, открой экран HOME
и выбери MAXA Launcher, включив «Запомнить выбор».

---

## 8. Разрешения и accessibility

### 8.1. Камера (фонарик)

```powershell
adb shell pm grant $PKG android.permission.CAMERA
```

### 8.2. Изменение системных настроек (яркость, поворот)

```powershell
adb shell appops set $PKG android:write_settings allow
```

Если команда не сработала, открой в лаунчере экран, который запрашивает
разрешение, и разреши «Изменение системных настроек» вручную.

### 8.3. Accessibility-служба

Служба нужна для блокировки сайтов, «Недавних» и шторки.

Сначала прочитай текущий список, чтобы не отключить чужие службы:

```powershell
adb shell settings get secure enabled_accessibility_services
```

Добавь свою службу через двоеточие, сохранив существующие:

```powershell
$A11Y="$PKG/org.cordova.plugin.labs.kiosk.KioskAccessibilityService"
$cur=(adb shell settings get secure enabled_accessibility_services).Trim()
if ($cur -eq "null") { $cur="" }
if ($cur -notlike "*$A11Y*") {
  if ($cur) { $new="$cur`:$A11Y" } else { $new=$A11Y }
  adb shell settings put secure enabled_accessibility_services $new
}
adb shell settings put secure accessibility_enabled 1
```

**Важно для MIUI:** на некоторых прошивках `adb shell` не имеет
`WRITE_SECURE_SETTINGS`, и команды `settings put secure ...` падают с
`SecurityException`. В этом случае включи службу вручную по пути ниже.
То же касается `settings put system accelerometer_rotation` — лаунчер
применит поворот и автояркость сам при старте.

На Android 13+ для sideload-приложения может понадобиться
«Разрешить ограниченные настройки»:

**Настройки → Приложения → MAXA Launcher → меню (три точки) →
«Разрешить ограниченные настройки».**

Затем:

**Настройки → Специальные возможности → Скачанные приложения →
MAXA Launcher → включить.**

Проверка:

```powershell
adb shell settings get secure enabled_accessibility_services
adb shell dumpsys accessibility | findstr /i "MAXA KioskAccessibility"
```

### 8.4. Доступ к уведомлениям

Нужен для ленты MAX / СМС / телефона. Включение через ADB:

```powershell
adb shell cmd notification allow_listener `
  'com.MAXA_PHONE_LAUNCHER.launcher/org.cordova.plugin.labs.kiosk.KioskNotificationListenerService'
```

Если ADB не может включить, открой в лаунчере карточку «Разрешить» или
системные настройки:

**Настройки → Приложения → Специальный доступ → Доступ к уведомлениям →
MAXA Launcher.**

Проверка:

```powershell
adb shell settings get secure enabled_notification_listeners
adb shell dumpsys notification | findstr /i "Allowed notification listeners"
adb logcat -s KioskNotif:D
```

В логе должно быть `Listener connected`. Служба фильтрует только
`ru.oneme.app` (MAX), SMS-пакеты и телефонию; данные не покидают телефон.

---

## 9. Настрой приложения лаунчера

### 9.1. Док и кнопки

Разметка — `my-launcher-app/www/index.html`.
Логика запуска приложений — `my-launcher-app/www/app.js`, объект `NATIVE_APPS`
(около строки 514).

По умолчанию:

- Телефон → `com.google.android.dialer`;
- MAX → `ru.oneme.app`;
- Браузер → `com.android.chrome`;
- Камера → `com.android.camera`;
- Дневник → `ru.mes.dnevnik.fgis`;
- Будильник → `com.android.deskclock`;
- Vol → `com.vol.app`;
- Смс → `com.google.android.apps.messaging` (fallback `com.android.mms`,
  `com.android.messaging`, `android.intent.action.SENDTO` с `sms:`).

На новом устройстве узнай реальные пакеты:

```powershell
adb shell pm list packages | findstr /i "dialer phone camera chrome clock deskclock"
adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER
```

Если пакета нет, замени его в `NATIVE_APPS` и пересобери APK.
Не оставляй в доке приложение, которого нет на устройстве.

### 9.2. Список блокируемых сайтов

Файл:

```
my-launcher-app/platforms/android/app/src/main/java/org/apache/cordova/labs/kiosk/KioskAccessibilityService.java
```

Массив `BLOCKED_SITES`. Добавляй домены и пути:

```java
"vk.com",
"vk.ru",
"crazygames.com",
"yandex.ru/games",
"tiktok.com",
"roblox.com"
```

После изменения пересобери APK и установи заново.

Важно: это блокировка на уровне accessibility (адресная строка браузера),
а не VPN/DNS. Она работает в Chrome и браузерах, которые отдают URL
в accessibility-дерево. Приложения, не показывающие URL, могут не
блокироваться.

---

## 10. Отключение лишних приложений

**Не запускай `scripts/disable-unused-apps.ps1` вслепую на другом устройстве.**
Скрипт содержит список пакетов с Redmi Note 10T; на другом телефоне имена
и набор приложений другие.

Правильный порядок:

1. Сохрани списки:

```powershell
adb shell pm list packages -e > docs/enabled-before.txt
adb shell pm list packages -d > docs/disabled-before.txt
```

2. Найди неиспользуемые сторонние приложения:

```powershell
adb shell pm list packages -3
```

3. Проверь название пакета, прежде чем отключать:

```powershell
adb shell pm path <package>
adb pull <path> temp.apk
aapt2 dump badging temp.apk | findstr application-label
```

4. Отключай только после проверки:

```powershell
adb shell pm disable-user --user 0 <package>
```

5. После каждой партии проверяй, что телефон звонит, открывает камеру,
   настройки и файлы.

**Никогда не отключай:**

- сам лаунчер и его activity;
- `com.android.systemui`, `com.android.settings`;
- `com.miui.cleaner`, `com.miui.guardprovider` — на MIUI без них
  `adb install` падает с `INSTALL_FAILED_USER_RESTRICTED`;
- `com.android.phone`, `com.android.server.telecom`,
  `com.android.providers.telephony`;
- `com.android.permissioncontroller`, `com.google.android.packageinstaller`;
- `com.google.android.webview`;
- `com.google.android.gms`, `com.google.android.gsf`;
- `com.android.bluetooth`, Wi-Fi и сетевые модули;
- `com.android.providers.media`, `com.miui.gallery` (если нужны фото);
- клавиатуру, которой пользуется владелец;
- приложения, которые нужны для звонков, SMS, камеры, будильника,
  файлов и магазина приложений.

Если сомневаешься — не отключай. Лучше оставить лишнее приложение, чем
получить неработающий телефон.

---

## 11. Режим киоска и перезагрузка

### 11.1. Что делает текущая сборка

- Accessibility-служба блокирует «Недавние» и шторку, закрывая их при
  появлении.
- Поверх строки состояния добавляется **невидимая touch-полоса**
  (`TYPE_ACCESSIBILITY_OVERLAY`). Она работает **всегда**, в том числе
  в лаунчере, и съедает касания в зоне статус-бара, поэтому шторку и
  правый центр управления MIUI нельзя потянуть. Быстрые настройки
  лаунчера открываются свайпом чуть ниже полосы (зона захвата в `app.js`
  увеличена до 110 CSS px). Полоса поднимается автоматически при старте
  accessibility-службы, то есть **после перезагрузки тоже**.
- Команда ниже дополнительно убирает шторку и «Недавние» на уровне
  SystemUI:

```powershell
adb shell cmd statusbar send-disable-flag statusbar-expansion recents
```

- Поворот и автояркость отключаются настройками системы.

### 11.2. Что сбрасывается после перезагрузки

`send-disable-flag` **не сохраняется после перезагрузки** — это флаг
SystemUI, а не настройка. На MIUI без device owner/root его нельзя
применить автоматически из обычного приложения: команда требует
разрешения `STATUS_BAR`, которого у лаунчера нет.

Но это уже не критично: невидимая полоса из accessibility-службы
поднимается сама и блокирует вытягивание шторки в других приложениях.
Флаги SystemUI — дополнительная защита; после перезагрузки их можно
вернуть скриптом.

Что делать агенту:

1. Убедиться, что accessibility-служба включена — от неё зависит полоса.
2. После перезагрузки при желании запустить:

```powershell
.\scripts\reapply-kiosk.ps1
```

3. Если на конкретной прошивке overlay не работает, остаётся только
   **device owner** или **root**. На MIUI `dpm set-device-owner`
   блокируется (`Calling identity is not authorized`), см.
   `docs/TODO_KIOSK.md`. В этом случае честно скажи пользователю, что
   шторка после перезагрузки может открываться до запуска скрипта.

### 11.3. Скрипт повторного применения

В репозитории есть `scripts/reapply-kiosk.ps1` (Windows) и
`scripts/reapply-kiosk.sh` (Linux/macOS). Он:

- проверяет устройство;
- назначает лаунчер домашним;
- добавляет accessibility-службу, не удаляя чужие;
- применяет флаги шторки/«Недавних»;
- проверяет автоповорот и автояркость (на MIUI adb shell может не иметь
  прав на их запись — тогда значения применит сам лаунчер при старте);
- запускает домашний экран.

Запускай его после каждой перезагрузки или при подозрении, что режим слетел.

---

## 12. Проверка

Выполни все пункты и запиши результаты в отчёт.

1. **Домашний экран:**

```powershell
adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME
```

Должно быть `isDefault=true` и activity лаунчера.

2. **Accessibility:**

```powershell
adb shell settings get secure enabled_accessibility_services
adb shell settings get secure accessibility_enabled
```

Служба в списке, `accessibility_enabled=1`.

3. **Приложения дока:** открой каждое через `adb shell monkey -p <pkg> -c android.intent.category.LAUNCHER 1`
   и проверь `dumpsys window | findstr mCurrentFocus`. После каждого —
   `adb shell input keyevent KEYCODE_HOME`.

3a. **Смс и уведомления:** нажми кнопку **Смс** — должен открыться
   `com.google.android.apps.messaging`. Проверь доступ к уведомлениям
   (раздел 8.4) и лог `KioskNotif:D` — там `Listener connected`.
   Отправь себе SMS или сообщение в MAX: в ленте на главном экране
   появится уведомление с зелёным/фиолетовым/оранжевым бейджем.
   Нажатие на элемент ленты открывает соответствующий пакет.

4. **Блокировка сайта:** открой `https://vk.com/` в Chrome и проверь лог:

```powershell
adb logcat -c
adb shell am start -a android.intent.action.VIEW -d "https://vk.com/" -p com.android.chrome
adb logcat -d -s KioskA11y:D
```

Должно быть `Blocked site: vk.com`.

5. **Шторка и «Недавние»:** открой любое приложение (Chrome) и попробуй
   вытянуть шторку или правый центр управления MIUI свайпом от самого
   верха. Они не должны открываться — срабатывает невидимая полоса
   accessibility. Затем вернись на главный экран и проверь, что быстрые
   настройки лаунчера открываются свайпом **чуть ниже строки состояния**
   (примерно на 40–110 CSS px от верха). «Недавние» должны возвращать на
   главный экран (возможна короткая вспышка).

6. **Яркость/поворот:** проверь, что ползунок меняет системную яркость,
   автоповорот и автояркость выключены:

```powershell
adb shell settings get system accelerometer_rotation
adb shell settings get system screen_brightness_mode
```

Оба должны быть `0`.

7. **Перезагрузка:** `adb reboot`, дождись `sys.boot_completed=1`,
   проверь, что лаунчер снова HOME и accessibility-служба включена.
   Открой Chrome и проверь, что шторка не вытягивается (overlay).
   При необходимости запусти `scripts/reapply-kiosk.ps1`, чтобы вернуть
   флаги SystemUI.

8. **Клавиатура:** проверь, что активна нужная клавиатура:

```powershell
adb shell settings get secure default_input_method
```

9. **Нет ли ошибок:** `adb logcat -d | findstr /i "FATAL EXCEPTION"`.

---

## 13. Откат

Перед изменениями сохрани исходный домашний экран и список пакетов.

Вернуть отключённые приложения:

```powershell
adb shell pm enable <package>
```

Вернуть домашний экран:

```powershell
adb shell cmd package set-home-activity --user 0 <ORIGINAL_HOME>
adb shell cmd role add-role-holder --user 0 android.app.role.HOME <ORIGINAL_PACKAGE>
```

Убрать accessibility-службу (оставив чужие):

```powershell
adb shell settings put secure enabled_accessibility_services <ORIGINAL_LIST>
```

Удалить лаунчер:

```powershell
adb uninstall com.MAXA_PHONE_LAUNCHER.launcher
```

Если назначали device owner:

```powershell
adb shell dpm remove-active-admin com.MAXA_PHONE_LAUNCHER.launcher/.KioskDeviceAdminReceiver
```

---

## 14. Частые проблемы

| Симптом | Что делать |
|---|---|
| `adb devices` пусто | Проверить USB-кабель, режим «Передача файлов», включить отладку |
| `unauthorized` | Нажать «Разрешить отладку» на телефоне |
| `INSTALL_FAILED_USER_RESTRICTED` | MIUI: «Установка через USB» + «Отладка по USB (настройки безопасности)» |
| Accessibility не включается | Android 13+: «Разрешить ограниченные настройки» |
| Лаунчер не стал HOME | `cmd package set-home-activity`, выбрать «Запомнить выбор» |
| После перезагрузки нет шторки-блокировки | Запустить `scripts/reapply-kiosk.ps1`; это ограничение MIUI |
| Сайт не блокируется | Проверить accessibility, URL в адресной строке, добавить домен в `BLOCKED_SITES` |
| Клавиатура закрывается при вводе | Проверить, что в `KioskAccessibilityService` есть проверка IME и поиск URL только в верхней панели |
| Пропали звонки/SMS | Включить обратно `com.android.phone`, `com.android.server.telecom`, `com.google.android.apps.messaging` |
| Телефон не загружается | Загрузиться в safe mode / recovery, `pm enable` критичных пакетов через ADB |
| Висит `ScreenOnProximitySensorGuide`, экран не реагирует | `adb shell am force-stop com.android.systemui`, затем `scripts/reapply-kiosk.ps1` |
| `input swipe`/`keyevent` падает с `INJECT_EVENTS` | Это ограничение MIUI; физические действия выполняет пользователь, либо используйте `am start` и логи |

---

## 15. Правила для агента

1. **Делай, а не рассказывай.** Сам выполняй команды через shell/ADB.
2. **Сначала сохрани исходное состояние.** Домашний экран, список
   accessibility-служб, список пакетов.
3. **Меняй по одному шагу и проверяй.** Не отключай 100 пакетов одной
   командой без проверки.
4. **Не используй список пакетов с Redmi вслепую.** Адаптируй под
   конкретное устройство.
5. **Не отключай критичные компоненты.** Сомневаешься — оставь.
6. **Не обещай невозможного.** На MIUI без device owner/root шторка после
   перезагрузки полностью не блокируется; accessibility закрывает её
   с короткой вспышкой.
7. **Спрашивай только то, что нельзя сделать самому:** согласие,
   физическое подключение, нажатие «Разрешить», выбор приложений и сайтов.
8. **Веди отчёт** в `docs/DEPLOY-<model>-<date>.md`: команды, изменения,
   проверки, ограничения.
9. **Оставь путь отката.** Пользователь должен знать, как вернуть
   приложения и домашний экран.
10. **Уважай владельца устройства.** Никакой скрытой установки и слежки.

---

## 16. Что прочитать дальше

- `README.md` — возможности, сборка, установка, разрешения.
- `docs/HANDOFF.md` — полный журнал работ и диагностика.
- `docs/TODO_KIOSK.md` — device owner, lock task и ограничения MIUI.
- `scripts/reapply-kiosk.ps1` / `.sh` — повторное применение режима.
- `scripts/disable-unused-apps.ps1` — пример списка отключённых пакетов
  (не запускать вслепую).
