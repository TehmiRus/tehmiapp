# Проверка Android-переноса — 06.11.2026

Исходник: TehmiRus/Filter-, коммит 47ea2388f24556409192d5054de28a8911c5a9f3.

- Исходная Python-программа: `python3 -m unittest -v`, 29 тестов, PASS.
- `node tests/engine.test.cjs`: 1161 независимый fixture от Python;
  численные значения, булевы проверки геометрии и ошибки ввода совпадают.
  Дополнительно: отчёты, активные поля, недопустимый ввод, переполнение
  точного целого диапазона для числа рукавов.
- Playwright + Chromium: пять панелей, БНТУ, скрытие неактивных полей,
  ошибки ввода, устаревание результатов, localStorage, навигация,
  bridge экспорта TXT и скачивание TXT с UTF-8 BOM, ширины 320/390/768 px.
- Gradle Wrapper 8.9 + AGP 8.7.3 + JDK Temurin 21.0.9 + Android SDK 35:
  `./gradlew --no-daemon --max-workers=2 :app:assembleDebug :app:lintDebug`, PASS.
- Android Lint: 0 ошибок, 1 предупреждение SetJavaScriptEnabled.
  JS необходим локальному калькулятору. Применены локальный origin,
  перехват всех запросов, CSP и запрет навигации/file/content доступа;
  INTERNET permission отсутствует. Предупреждение не подавлено.
- `apksigner verify --verbose`: APK signature v2 verified.
- `aapt dump badging`: com.tehmi.aspiration, Android API 24+, target 35,
  версия 1.0, launchable activity и icon присутствуют, permissions отсутствуют.
- XML ресурсов разобраны, `git diff --check` без ошибок.

Ограничения проверки: физический Android-телефон и эмулятор не использовались.
Системный файловый диалог Android и интеграция конкретной версии WebView
требуют проверки на устройстве. JavaScript-интерфейс проверен в Chromium;
сборка и подпись APK проверены отдельно. APK отладочный, не магазинный релиз.
Инженерная применимость моделей к производству отдельно не подтверждена.

Ни публикация среды, ни push в GitHub не выполнялись.
