# MAXA Launcher — полная инструкция и журнал работ

**Дата:** 02.11.2026  
**Устройство:** Redmi Note 10T (M2103K19Y, Android 13 / MIUI 14)  
**Пакет:** `com.MAXA_PHONE_LAUNCHER.launcher`  
**Главная activity:** `org.cordova.plugin.labs.kiosk.KioskActivity`  
**Текущий APK:** `D:\other\dev\MAXA_PHONE_LAUNCHER\1.apk`  
**Сборка Gradle:** `D:\other\dev\MAXA_PHONE_LAUNCHER\my-launcher-app\platforms\android\app\build\outputs\apk\debug\app-debug.apk`

---

## 1. Что это

Cordova-лаунчер для Android, заменяющий стандартный рабочий стол (ROLE_HOME).
Интерфейс — HTML/CSS/JS внутри WebView, системные функции — через нативный
Cordova-плагин `Kiosk` и accessibility-службу.

Основные файлы:

```
my-launcher-app/
  www/
    index.html          — разметка главного экрана, дока, шторки, экранов
    styles.css          — все стили
    app.js              — логика лаунчера
  config.xml            — настройки Cordova (Fullscreen, EdgeToEdge)
  platforms/android/
    app/src/main/AndroidManifest.xml
    app/src/main/java/org/apache/cordova/labs/kiosk/
      Kiosk.java                     — нативные методы (яркость, Wi-Fi, фонарик и т.д.)
      KioskActivity.java             — полноэкранный режим, скрытие системных баров
      KioskAccessibilityService.java — блокировка «Недавних» и шторки
    app/src/main/res/xml/accessibility_service_config.xml
    app/src/main/assets/www/...      — собранные www-файлы
```

---

## 2. Как собрать APK

Нужны JDK 17, Gradle 8.14.2 и Android SDK.

Пути, которые использовались на этом компьютере:

- JDK: `C:\Users\User\AppData\Local\Programs\Eclipse Adoptium\jdk-17.0.20.101-hotspot`
- Gradle: `C:\Users\User\AppData\Local\Temp\opencode\gradle\gradle-8.14.2`
- Android SDK: `C:\Users\User\AppData\Local\Android\Sdk`

PowerShell:

```powershell
$env:JAVA_HOME="C:\Users\User\AppData\Local\Programs\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
$env:ANDROID_HOME="C:\Users\User\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:PATH="$env:JAVA_HOME\bin;C:\Users\User\AppData\Local\Temp\opencode\gradle\gradle-8.14.2\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

cd D:\other\dev\MAXA_PHONE_LAUNCHER\my-launcher-app
cordova build android --debug
```

Если Gradle-обёртка попытается скачивать дистрибутив, можно указать локальный zip:

```powershell
$env:CORDOVA_ANDROID_GRADLE_DISTRIBUTION_URL="file:/C:/Users/User/AppData/Local/Temp/opencode/gradle/gradle-8.14.2-bin.zip"
```

После сборки скопировать свежий APK:

```powershell
Copy-Item "D:\other\dev\MAXA_PHONE_LAUNCHER\my-launcher-app\platforms\android\app\build\outputs\apk\debug\app-debug.apk" `
          "D:\other\dev\MAXA_PHONE_LAUNCHER\1.apk" -Force
```

---

## 3. Подключение телефона и установка

1. На телефоне включить **Для разработчиков → Отладка по USB**.
2. Подключить USB, разрешить отладку на телефоне.
3. Проверить:

```powershell
adb devices -l
```

Должно быть что-то вроде:

```
pn6hrsbm6d6lbahq  device product:camellian_ru model:M2103K19Y ...
```

Установка:

```powershell
adb install -r "D:\other\dev\MAXA_PHONE_LAUNCHER\1.apk"
```

Назначить лаунчером по умолчанию:

```powershell
adb shell cmd package set-home-activity --user 0 `
  com.MAXA_PHONE_LAUNCHER.launcher/org.cordova.plugin.labs.kiosk.KioskActivity

adb shell cmd role add-role-holder --user 0 `
  android.app.role.HOME com.MAXA_PHONE_LAUNCHER.launcher

adb shell am start -a android.intent.action.MAIN -c android.intent.category.HOME
```

Если MIUI покажет диалог «Выберите главное приложение» — выбрать
**MAXA Launcher** и включить **«Запомнить выбор»**.

Проверка, что лаунчер действительно домашний:

```powershell
adb shell cmd package resolve-activity --brief `
  -a android.intent.action.MAIN -c android.intent.category.HOME
```

Ожидаемый результат:

```
com.MAXA_PHONE_LAUNCHER.launcher/org.cordova.plugin.labs.kiosk.KioskActivity
```

---

## 4. Разрешения, которые уже выданы

На текущем телефоне были выданы:

| Разрешение | Зачем | Как проверить |
|---|---|---|
| `CAMERA` | аппаратный фонарик | `adb shell dumpsys package com.MAXA_PHONE_LAUNCHER.launcher \| findstr CAMERA` |
| `WRITE_SETTINGS` («Изменение системных настроек») | системная яркость, отключение автоповорота и автояркости | `adb shell dumpsys package ...` / экран спецдоступа |
| Accessibility-служба | блокировка «Недавних» и системной шторки | `adb shell settings get secure enabled_accessibility_services` |
| `KILL_BACKGROUND_PROCESSES` | кнопка «Закрыть все» | выдаётся автоматически |
| `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE` | статус Wi-Fi/сети | выдаются автоматически |

Проверка accessibility:

```powershell
adb shell settings get secure enabled_accessibility_services
```

Ожидается:

```
com.MAXA_PHONE_LAUNCHER.launcher/org.cordova.plugin.labs.kiosk.KioskAccessibilityService
```

Если служба отключилась (например, после оптимизации MIUI):

**Настройки → Специальные возможности → Скачанные приложения → MAXA Launcher → включить.**

Для яркости/поворота, если разрешение слетело:

**Настройки → Приложения → Специальный доступ → Изменение системных настроек → MAXA Launcher → разрешить.**

Приложение само открывает этот экран, если разрешения нет.

---

## 5. Что реализовано

### Главный экран

- Крупные часы и дата (реальное время).
- Пустое пространство, без сетки приложений.
- Учёт выреза/безопасной зоны, полноэкранный режим.
- Слева — маленькая круглая кнопка **«Закрыть все»** (46×46 px).
- Под часами — кнопки **Будильник** (`com.android.deskclock`) и **Vol**
  (`com.vol.app`).
- Внизу — док ровно из 5 приложений:
  - Телефон → `com.google.android.dialer`
  - MAX → `ru.oneme.app`
  - Браузер → `com.android.chrome`
  - Камера → `com.android.camera`
  - Дневник → `ru.mes.dnevnik.fgis`
- Под доком — собственная нижняя навигация: только **«Назад»** и **«Домой»**.
  Системная навигационная панель в лаунчере скрыта.

### Статус-панель

- Оператор/состояние SIM: реальное (`Нет SIM`, имя оператора, `Нет сети`).
- Тип сети (4G/5G/3G/2G) — только если сеть реально зарегистрирована.
- Шкала сигнала — реальный уровень; при отсутствии SIM/сети скрывается.
- Wi-Fi:
  - полная иконка — подключено;
  - приглушённая — Wi-Fi включён, но нет подключения;
  - погашенная — Wi-Fi выключен.
- Уведомления с красной точкой.
- Реальный процент батареи.

### Быстрые настройки

- Открываются свайпом от верхнего края.
- Закрываются свайпом вверх по шапке или тапом по затемнению.
- Wi-Fi и Bluetooth — открывают **реальные системные экраны** со сканированием
  и подключением устройств.
- Фонарик — реальный `CameraManager.setTorchMode` (нужно разрешение камеры).
- Экономия заряда — зафиксирована включённой, переключатель заблокирован.
- Кнопка «Настройки».
- Ползунок яркости меняет **системную яркость** (`Settings.System.SCREEN_BRIGHTNESS`).

### Настройки лаунчера

- Сети: Wi-Fi, Bluetooth, мобильная сеть (реальные данные о SIM/сети).
- Устройство: батарея, экономия заряда, звук и вибрация.
- Система: режим разработчика (PIN **0234**), о телефоне,
  системные разрешения.
- В режиме разработчика — отладочные переключатели и отключение режима.

### Системные ограничения

- При старте/возврате:
  - отключается автоповорот (`accelerometer_rotation=0`);
  - отключается автояркость (`screen_brightness_mode=0`).
- «Экономия заряда» в UI всегда включена, изменить нельзя.
- «Недавние» и системная шторка блокируются accessibility-службой:
  - «Недавние» → сразу возврат на главный экран;
  - шторка → закрывается кнопкой «Назад».

---

## 6. Известные ограничения

1. **Шторка может мелькнуть на 0.2–0.5 секунды.**
   SystemUI успевает показать её раньше, чем accessibility-служба получает
   событие. Полностью убрать вспышку можно только через device owner
   (см. `TODO_KIOSK.md`). Пользователь решил отложить это.

2. **Экономия заряда** — это состояние интерфейса. Обычное приложение
   не может включить системный режим энергосбережения без системных прав.
   Переключатель зафиксирован включённым.

3. **Wi-Fi/Bluetooth** — открываются системные экраны. Программно включать
   Wi-Fi/Bluetooth на Android 13 обычному приложению нельзя, поэтому
   используются реальные системные настройки со сканированием и подключением.

4. **Сторонние приложения** — когда открыто чужое приложение, его системная
   навигационная панель управляется Android, а не лаунчером. Собственная
   нижняя панель «Назад/Домой» действует внутри лаунчера.

5. **Текущая SIM** — система сообщает `SIM_STATE_ABSENT` (SIM не установлена),
   поэтому статус показывает «Нет SIM». Если вставить SIM, оператор и сеть
   подтянутся; для типа сети/уровня сигнала может потребоваться разрешение
   «Телефон» (`READ_PHONE_STATE`).

---

## 7. Как проверить вручную

1. Главный экран: часы, дата, пустое поле, док из 5 приложений, нижняя
   навигация «Назад/Домой», слева круглая кнопка очистки.
2. Нажать каждое приложение в доке:
   - Телефон → Google Dialer;
   - MAX → MAX (`ru.oneme.app`);
   - Браузер → Chrome;
   - Камера → системная камера;
   - Дневник → `ru.mes.dnevnik.fgis`.
   Отдельно проверить кнопки под часами: Будильник → `com.android.deskclock`,
   Vol → `com.vol.app`.
3. Нажать круглую кнопку очистки:
   - должно быть мгновенное завершение фоновых приложений;
   - экран «Недавних» не должен открываться.
4. Свайп от верхнего края — быстрые настройки.
5. Потянуть ползунок яркости — яркость экрана должна меняться системно.
6. Нажать Wi-Fi — открывается системный экран Wi-Fi; подключиться к сети.
7. Нажать Bluetooth — открывается системный экран Bluetooth; найти/подключить устройство.
8. Нажать фонарик — должен включиться светодиод; повторное нажатие — выключить.
9. Нажать «Недавние» (жест/кнопка) из любого приложения — должен произойти
   возврат на главный экран.
10. Потянуть системную шторку — она должна закрыться (возможна короткая вспышка).
11. Проверить статус-панель: «Нет SIM», отсутствие 4G, Wi-Fi-иконка,
    реальный процент батареи.
12. Настройки → Мобильная сеть — реальные «Нет SIM» / «Нет сети», без фейковых
    «Отличный» и «12,4 ГБ».
13. Настройки → Режим разработчика → PIN `0234` → экран «Для разработчиков».

---

## 8. Диагностика

Логи accessibility:

```powershell
adb logcat -s KioskA11y:D
```

Проверка службы:

```powershell
adb shell dumpsys accessibility | findstr /i "MAXA KioskAccessibility"
```

Проверка фонарика:

```powershell
adb shell dumpsys media.camera | findstr /i torch
```

Проверка системных настроек:

```powershell
adb shell settings get system accelerometer_rotation
adb shell settings get system screen_brightness_mode
adb shell settings get system screen_brightness
```

Проверка текущего foreground-приложения:

```powershell
adb shell dumpsys activity activities | findstr ResumedActivity
```

Проверка, что лаунчер домашний:

```powershell
adb shell cmd package resolve-activity --brief `
  -a android.intent.action.MAIN -c android.intent.category.HOME
```

Если после переустановки слетели разрешения — выдать заново через экраны
«Специальные возможности» и «Изменение системных настроек», как в разделе 4.

---

## 9. Важно про исходники

Cordova при сборке копирует JS-плагины из нескольких мест. Чтобы изменения
не потерялись, синхронизированы:

- `my-launcher-app/plugins/cordova-plugin-kiosk-launcher/www/kiosk.js`
- `my-launcher-app/node_modules/cordova-plugin-kiosk-launcher/www/kiosk.js`
- `my-launcher-app/platforms/android/platform_www/plugins/.../kiosk.js`
- `my-launcher-app/platforms/android/app/src/main/assets/www/plugins/.../kiosk.js`

Нативные файлы:

- `Kiosk.java`, `KioskActivity.java`, `KioskAccessibilityService.java`
  лежат в `platforms/android/app/src/main/java/org/apache/cordova/labs/kiosk/`.
- Копии `Kiosk.java` и `KioskActivity.java` также лежат в
  `plugins/cordova-plugin-kiosk-launcher/src/android/` и `node_modules/.../src/android/`.
- `KioskAccessibilityService.java` и `accessibility_service_config.xml` —
  платформенные файлы; при полной пересборке платформы их нужно добавить заново.

Если пересобирать платформу с нуля, нужно повторно:
- объявить accessibility-службу в `AndroidManifest.xml`;
- добавить `res/xml/accessibility_service_config.xml`;
- добавить `KioskAccessibilityService.java`;
- добавить разрешения `CAMERA`, `WRITE_SETTINGS`, `KILL_BACKGROUND_PROCESSES`,
  `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`;
- добавить `Fullscreen`, `FullscreenNotImmersive`, `AndroidEdgeToEdge` в `config.xml`;
- добавить сервис и права в манифест.

---

## 10. Отложенная задача

`TODO_KIOSK.md` — полная блокировка шторки через device owner
(`setStatusBarDisabled`). Пока оставлено быстрое закрытие через accessibility.

### Обновление 02.11.2026

Попытка назначить приложение device owner на MIUI завершилась ошибкой:

```
SecurityException: Calling identity is not authorized
```

Даже после включения «Отладка по USB (настройки безопасности)» ADB не получает
`WRITE_SECURE_SETTINGS`. Полный kiosk (удаление обеих системных панелей во всех
приложениях) на этой прошивке без root/вендорного provisioning невозможен.

Текущий fallback:

```powershell
adb shell cmd statusbar send-disable-flag statusbar-expansion recents
```

Отключает раскрытие шторки и «Недавние» на уровне SystemUI. Флаги могут
сброситься после перезагрузки — команду нужно повторить. Нижняя системная
навигация в сторонних приложениях остаётся; в лаунчере она скрыта.

### Подтверждение пользователя (02.11.2026)

Пользователь подтвердил: «Шторки пропали, работает как надо».
Фактическое состояние на момент проверки: device owner не назначен,
lock task выключен, accessibility-служба выключена; панели скрыты
флагами SystemUI. После перезагрузки, вероятно, потребуется повторить
команду `send-disable-flag statusbar-expansion recents`.

## 11. Доработки 02.11.2026 (вечер)

- Из настроек убраны пункты: «Системные разрешения», «Выйти из режима киоска»,
  «Экономия заряда», «Батарея».
- В нижний док добавлен пункт «Дневник» (6-й значок).
- Под часами добавлена кнопка **Vol** (`com.vol.app`).
- Будильник перенесён из дока на главный экран перед Vol.
- В экран «Для разработчиков» добавлены реальные пункты:
  - «Установка через USB» → системные «Для разработчиков»;
  - «Служба доступности» → системные «Специальные возможности»;
  - «Открыть RuStore» → `ru.vk.store`;
  - «Клавиатура RU/EN» → список доступных клавиатур (Gboard / Яндекс.Клавиатура);
  - «Мои файлы» → проводник `com.mi.android.globalFileexplorer`.
- Китайская клавиатура **Emoji&Font Keyboard** (`com.facemoji.lite.xiaomi`,
  Baidu/Simeji) отключена через `pm disable-user`; текущая клавиатура —
  **Gboard** (`com.google.android.inputmethod.latin`).
- Добавлена блокировка сайтов в accessibility-службе:
  - список доменов/путей в `KioskAccessibilityService.BLOCKED_SITES`;
  - проверка URL в Chrome и других браузерах;
  - при совпадении — `GLOBAL_ACTION_BACK` и тост «Сайт заблокирован»;
  - служба должна быть включена.
- Блокировка проверена: `vk.com` (в т.ч. редирект `m.vk.ru`),
  `crazygames.com`, `yandex.ru/games`, `tiktok.com`, `roblox.com`,
  `twitch.tv`, `4399.com`, `poki.com` — все блокируются.
  Для этого добавлены `vk.ru`, `vk.me`, `vk.cc`, `yandex.com/games`,
  `tiktokv.com` и исправлен разбор строки адреса Chrome с суффиксом
  «Подключение не защищено».
- Чтобы блокировка не закрывала клавиатуру при вводе текста, URL теперь
  ищется только в верхней панели браузера; при открытой клавиатуре
  (IME) проверка блокировки пропускается.

**Проблемы:**
- `Vol.apk` не устанавливается через ADB:
  `INSTALL_FAILED_USER_RESTRICTED: Install canceled by user`.
  APK скопирован на телефон: `/sdcard/Download/Vol.apk` — можно установить
  вручную через проводник. Либо включить в «Для разработчиков» пункт
  «Установка через USB» и установить через ADB.
- Файл `default app/moya-shkola-dnevnik.apk` на самом деле содержит
  **RuStore** (`ru.vk.store`), а не школьный дневник. RuStore уже установлен.
  Для пункта «Дневник» нужен правильный APK или точное имя пакета.

---

## 12. Отключение неиспользуемых приложений (02.11.2026)

Цель — снизить фоновую нагрузку, уведомления и сетевую активность.
Все приложения отключены для пользователя 0 командой:

```powershell
adb shell pm disable-user --user 0 <package>
```

Итого отключено **126** пакетов. Включёнными оставлены только системные
компоненты, нужные для связи, камеры, файлов, настроек и самого лаунчера.

**Исключения:** `com.miui.cleaner` и `com.miui.guardprovider` нельзя
отключать на MIUI — от них зависит установщик APK. Если их отключить,
`adb install` падает с `INSTALL_FAILED_USER_RESTRICTED: Install canceled
by user`. На этом устройстве они возвращены в включённое состояние.

### Что отключено

- **Игры и развлечения:** `com.mobile.legends`, `com.tencent.igxiaomi`,
  `com.igg.android.lordsmobile`, `com.nebula.rotaterings`,
  `com.puzzlegames.puzzlebrickslegend`, `com.kms.free`, `com.zroute.global`,
  `com.netflix.mediaclient`, `com.zhiliaoapp.musically`,
  `com.google.android.youtube`, `com.google.android.apps.youtube.music`,
  `com.google.android.videos`, `ru.ivi.client`, `com.vk.vkvideo`,
  `com.google.android.apps.photos`, `com.google.ar.core`.
- **Соцсети/мессенджеры:** `com.facebook.katana`, `com.facebook.system`,
  `com.facebook.services`, `com.facebook.appmanager`, `com.yandex.zen`,
  `com.yandex.browser`, `ru.yandex.searchplugin`,
  `com.yandex.preinstallsatellite`, `com.yandex.zenkitpartnerconfig`,
  `com.mi.global.bbs`, `com.xiaomi.barrage`.
- **Магазины и реклама:** `com.android.vending` (Google Play — установка
  теперь через RuStore), `com.xiaomi.market`/`com.xiaomi.mipicks`,
  `com.miui.msa.global`, `com.miui.analytics`, `com.miui.miservice`,
  `com.miui.bugreport`, `com.google.android.feedback`,
  `com.google.android.adservices.api`, `com.google.mainline.adservices`,
  `com.google.android.ondevicepersonalization.services`,
  `com.google.mainline.telemetry`, `com.mi.global.shop`,
  `com.xiaomi.payment`, `org.mipay.android.manager`,
  `com.tencent.soter.soterserver`.
- **Медиа/утилиты MIUI:** `com.miui.videoplayer`, `com.miui.player`,
  `com.miui.fm`, `com.miui.fmservice`, `com.miui.compass`, `com.miui.notes`,
  `com.miui.calculator`, `com.miui.weather2`, `com.xiaomi.scanner`,
  `com.miui.screenrecorder`, `com.miui.soundrecorder`, `com.miui.qr`,
  `com.miui.extraphoto`, `com.miui.mediaeditor`, `com.xiaomi.cameratools`,
  `com.miui.touchassistant`, `com.miui.yellowpage`,
  `com.mi.globalminusscreen`, `com.mi.globalbrowser`, `com.miui.mishare.connectivity`,
  `com.miui.phrase`, `com.miui.backup`,
  `com.milink.service`, `com.xiaomi.midrop`, `com.xiaomi.calendar`,
  `com.xiaomi.scanner`.
- **Google-сервисы, не нужные лаунчеру:** `com.google.android.gm`,
  `com.google.android.apps.maps`, `com.google.android.apps.wellbeing`,
  `com.google.android.apps.safetyhub`, `com.google.android.apps.restore`,
  `com.google.android.apps.turbo`, `com.google.android.apps.docs`,
  `com.google.android.apps.tachyon`, `com.google.android.apps.kids.familylinkhelper`,
  `com.google.android.setupwizard`, `com.google.android.onetimeinitializer`,
  `com.google.android.partnersetup`, `com.google.android.syncadapters.calendar`,
  `com.google.android.tts`, `com.google.android.marvin.talkback`,
  `com.google.android.nearby.halfsheet`, `com.google.android.as`,
  `com.google.android.as.oss`, `com.google.android.gms.location.history`,
  `com.google.android.printservice.recommendation`,
  `com.android.hotwordenrollment.okgoogle`,
  `com.android.hotwordenrollment.xgoogle`.
- **Печать, тесты, логи, служебное:** `com.android.printspooler`,
  `com.android.bips`, `com.android.dreams.basic`, `com.android.egg`,
  `com.android.traceur`, `com.android.bookmarkprovider`,
  `com.android.providers.partnerbookmarks`, `com.android.cts.ctsshim`,
  `com.android.cts.priv.ctsshim`, `com.android.bluetoothmidiservice`,
  `com.mi.AutoTest`, `com.huaqin.factory`, `com.goodix.gftest`,
  `com.fingerprints.sensortesttool`, `com.debug.loggerui`,
  `com.bsp.catchlog`, `com.mediatek.engineermode`,
  `com.mediatek.mdmlsample`, `com.mediatek.callrecorder`,
  `com.mediatek.voicecommand`, `com.mediatek.voiceunlock`.
- **Прочее:** `com.xiaomi.mircs`, `com.xiaomi.xmsf`,
  `com.xiaomi.xmsfkeeper`, `com.xiaomi.simactivate.service`,
  `com.xiaomi.glgm`, `com.miui.cloudservice`, `com.miui.cloudbackup`,
  `com.miui.micloudsync`, `com.miui.misound`, `com.miuix.editor`,
  `com.maxim.internal` (такси Maxim RU), `com.micredit.in`,
  `cn.wps.xiaomi.abroad.lite`, `com.duokan.phone.remotecontroller`.

### Что оставлено включённым и почему

- Лаунчер и его приложения: `com.MAXA_PHONE_LAUNCHER.launcher`,
  `com.android.chrome`, `com.google.android.dialer`, `com.android.camera`,
  `com.android.deskclock`, `com.mi.android.globalFileexplorer`,
  `com.android.settings`, `ru.vk.store`, `ru.mes.dnevnik.fgis`,
  `com.vol.app`, `ru.oneme.app`.
- Ввод: `com.google.android.inputmethod.latin` (Gboard),
  `com.miui.miinput` (системный запасной ввод).
- Связь: `com.android.phone`, `com.android.server.telecom`,
  `com.android.providers.telephony`, `com.android.mms.service`,
  `com.google.android.apps.messaging` (SMS/MMS на случай установки SIM),
  `com.android.stk`, `com.mediatek.ims`, `com.mediatek.telephony`.
- Система MIUI: `com.miui.securitycenter`, `com.miui.securitycore`,
  `com.lbe.security.miui`, `com.miui.powerkeeper`, `com.miui.daemon`,
  `com.miui.notification`, `com.miui.screenshot`, `com.miui.gallery`,
  `com.miui.miwallpaper`, `com.miui.home` (защищён от отключения:
  «Cannot disable miui core packages»), `com.xiaomi.misettings`.
- Google: `com.google.android.gms`, `com.google.android.gsf`,
  `com.google.android.webview`, `com.google.android.permissioncontroller`,
  `com.google.android.providers.media.module`, `com.android.vending`
  **отключён** — для установки использовать RuStore.
- Биометрия/безопасность: `com.miui.face`, `org.ifaa.aidl.manager`,
  `com.fido.asm`, `com.trustonic.teeservice`.
- `com.google.android.gms.supervision` защищён от отключения
  («Cannot disable a protected package»), работает как часть GMS.

### Результат

- Число включённых пакетов: **236**, отключённых: **126**.
- Свободно памяти после перезагрузки: около **1,45–1,5 ГБ**
  из 3,69 ГБ (`MemAvailable`), с учётом кэша.
- Проверено после перезагрузки: домашний экран запускается, accessibility
  включена, блокировка `vk.com` работает, все приложения дока и настройки
  открываются (`dialer`, Chrome, Camera, Clock, Files, Settings, RuStore,
  Vol, Diary, MAX).
- `com.maxim.internal` (maxim RU) отключён как неиспользуемый; при
  необходимости включается обратно.

### Как вернуть приложение

```powershell
adb shell pm enable com.android.vending
adb shell pm enable com.miui.calculator
adb shell pm enable com.maxim.internal
```

Список всех отключённых:

```powershell
adb shell pm list packages -d
```

APK лаунчера после отключения приложений не менялся — переустановка не
требуется.

---

## 13. Блокировка шторки после перезагрузки (02.11.2026)

Проблема: `adb shell cmd statusbar send-disable-flag statusbar-expansion recents`
не сохраняется после перезагрузки. На MIUI без device owner/root применить
эту команду из приложения нельзя: нужен `android.permission.STATUS_BAR`,
которого у обычного лаунчера нет (`SecurityException`).

Решение в текущей сборке:

- `KioskAccessibilityService` при старте и при смене активного приложения
  добавляет невидимую touch-полосу `TYPE_ACCESSIBILITY_OVERLAY` высотой
  со строку состояния.
- Полоса работает **всегда**, в том числе на главном экране: после
  перезагрузки MIUI больше не даёт вытянуть шторку или правый центр
  управления.
- В лаунчере полоса тоже остаётся. Зона свайпа для быстрых настроек в
  `www/app.js` увеличена с 60 до 110 CSS px: свайп нужно начинать чуть
  ниже строки состояния (полоса занимает ~37 CSS px). Заголовок панели
  находится ниже полосы, поэтому закрытие свайпом по `.qs-head` работает.
- Служба accessibility запускается автоматически после перезагрузки,
  поэтому полоса поднимается без ПК и без ADB.
- Флаги `send-disable-flag` остаются дополнительной защитой; их можно
  вернуть скриптом `scripts/reapply-kiosk.ps1`.

Проверка overlay:

- После перезапуска службы: `Top guard added, height=103`.
- В `dumpsys window` окно `com.MAXA_PHONE_LAUNCHER.launcher` с
  `ty=2032` (`TYPE_ACCESSIBILITY_OVERLAY`), `fillx103`, `NOT_FOCUSABLE`,
  `NOT_TOUCH_MODAL` присутствует и на главном экране, и в Chrome.
- `Top guard removed` теперь появляется только при отключении службы.
- Физический свайп проверить через ADB нельзя: MIUI не даёт shell
  `INJECT_EVENTS` (`SecurityException`). Нужно проверить пальцем: в Chrome
  и на главном экране шторка/правый центр не должны вытягиваться, а
  быстрые настройки лаунчера должны открываться свайпом чуть ниже
  строки состояния.

Ограничения overlay:

- Он закрывает только верхнюю полосу статус-бара, а не всю шторку;
  системные жесты из других зон могут работать.
- Если прошивка не разрешает `TYPE_ACCESSIBILITY_OVERLAY`, в логе будет
  `Top guard add failed`; тогда остаётся только device owner/root.

### Зависшая подсказка датчика приближения

Во время проверки на экране висело системное окно MIUI
`ScreenOnProximitySensorGuide` (type 2018, owner `android`), которое
блокировало ввод. Оно появилось из-за закрытого датчика приближения при
включении экрана и не исчезло само. Лечится без перезагрузки:

```powershell
adb shell am force-stop com.android.systemui
```

SystemUI перезапускается, подсказка исчезает, лаунчер снова получает
фокус. После этого нужно заново применить флаги шторки:
`scripts/reapply-kiosk.ps1`.

Глобальная настройка `enable_screen_on_proximity_sensor` существует, но
MIUI не даёт adb shell писать в `Settings.Global`
(`WRITE_SECURE_SETTINGS`). Выдать разрешение приложению через
`pm grant ... WRITE_SECURE_SETTINGS` тоже нельзя: shell не имеет
`GRANT_RUNTIME_PERMISSIONS`. Без root/device owner отключить датчик
программно нельзя. Если подсказка повторяется — проверить зону датчика
(защитное стекло, чехол, загрязнение), перезагрузить телефон или
перезапустить SystemUI.

Файл: `platforms/android/app/src/main/java/org/apache/cordova/labs/kiosk/KioskAccessibilityService.java`
(методы `updateTopGuard`, `addTopGuard`, `removeTopGuard`).

---

## 14. Кнопка СМС и уведомления (04.11.2026)

### Кнопка СМС

На главный экран добавлена кнопка **Смс** (`data-app="sms"`).
Пакеты в `www/app.js` → `NATIVE_APPS.sms`:

- `com.google.android.apps.messaging`;
- `com.android.mms`;
- `com.android.messaging`;
- fallback `android.intent.action.SENDTO` с `sms:`.

Проверено: кнопка открывает Google Messages
(`com.google.android.apps.messaging`).

### Уведомления

Добавлен `KioskNotificationListenerService`:

- файл:
  `platforms/android/app/src/main/java/org/cordova/plugin/labs/kiosk/KioskNotificationListenerService.java`;
- это **top-level** класс, не вложенный: Android не смог привязать
  вложенный `Kiosk$KioskNotificationListenerService`
  (`service not found`);
- манифест:
  `org.cordova.plugin.labs.kiosk.KioskNotificationListenerService`,
  permission `BIND_NOTIFICATION_LISTENER_SERVICE`, exported=true;
- фильтр пакетов:
  - MAX — `ru.oneme.app`;
  - СМС — `com.google.android.apps.messaging`, `com.android.mms`,
    `com.android.messaging`, Samsung/OPPO/OnePlus SMS;
  - телефон — `com.android.phone`, `com.google.android.dialer`,
    `com.android.server.telecom`, `com.android.incallui`;
- групповые summary пропускаются, чтобы не дублировать;
- данные хранятся только в памяти, никуда не отправляются.

Включение доступа:

```powershell
adb shell cmd notification allow_listener `
  'com.MAXA_PHONE_LAUNCHER.launcher/org.cordova.plugin.labs.kiosk.KioskNotificationListenerService'
```

Проверка:

```powershell
adb shell dumpsys notification | findstr /i "Allowed notification listeners"
adb logcat -s KioskNotif:D
```

В логе должно быть `Listener connected`.

UI:

- лента под кнопками Будильник/Vol/Смс;
- показывает до 8 последних уведомлений, обновление раз в 2,5 с;
- нажатие на уведомление открывает соответствующий пакет;
- красная точка на колокольчике скрывается, когда уведомлений нет;
- если доступ не выдан, показывается карточка «Разрешить» с переходом
  в системные настройки.

Проверено на реальных СМС: в ленте появились «БАБУЛА» и «Max»,
нажатие на уведомление открыло Google Messages.

### Важно для установки

На MIUI нельзя отключать `com.miui.cleaner` и `com.miui.guardprovider`:
без них `adb install` падает с
`INSTALL_FAILED_USER_RESTRICTED: Install canceled by user`.
Перед установкой проверьте:

```powershell
adb shell pm enable com.miui.cleaner
adb shell pm enable com.miui.guardprovider
```

Также `kiosk.js` должен быть обёрнут в
`cordova.define("cordova-plugin-kiosk-launcher.kiosk", ...)`, иначе
WebView пишет `require is not defined` и `window.Kiosk` не создаётся.

---

## 15. Отключение лаунчера (04.11.2026)

В «Для разработчиков» (PIN `0234`) добавлен пункт
**«Отключить лаунчер»**.

Что делает:

- показывает подтверждение;
- возвращает автоповорот и автояркость в системное состояние (`1`);
- снимает невидимую touch-полосу и вызывает `disableSelf()` у
  accessibility-службы;
- перестаёт отдавать уведомления в ленту;
- сбрасывает `KioskActivity.kioskModeEnabled`;
- пытается очистить preferred HOME и открывает системный выбор
  «Выберите главное приложение» (MAXA Launcher / Рабочий стол MIUI);
- закрывает activity лаунчера (`finishAndRemoveTask`).

Проверено: после нажатия лаунчер закрывается, accessibility-служба
становится `null`, открывается выбор рабочего стола, после выбора
MIUI Home возвращается стандартный экран.

### Ограничение

Обычное Android-приложение **не может включать чужие пакеты**:
`PackageManager.setApplicationEnabledSetting` требует
`CHANGE_COMPONENT_ENABLED_STATE` (signature permission). Поэтому
пункт отключает лаунчер и киоск, но 126 ранее отключённых приложений
возвращаются скриптом с компьютера:

```powershell
.\scripts\restore-launcher.ps1
```

Скрипт:

- включает пакеты из `disable-unused-apps.ps1`;
- убирает accessibility-службу и доступ к уведомлениям;
- снимает флаги шторки/«Недавних»;
- возвращает автоповорот и автояркость;
- назначает `com.miui.home/.launcher.Launcher` домашним;
- по флагу `-Uninstall` удаляет лаунчер.

Это ограничение Android/MIUI, а не ошибка кода.



