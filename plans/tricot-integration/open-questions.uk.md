# Tricot: відкриті питання й приймання

Status: актуалізовано 2026-11-03. Отримані inputs і поточні межі інтеграції — у [handoff.md](handoff.md). [Архів попереднього переліку](../../docs/records/plans/2026-11-03-tricot-integration-status.md) зберігає початкові формулювання та результати старих експортів. Нумерацію питань збережено для посилань; закриті пункти не є запитами на повторну поставку.

## Отримано / повторно не запитувати

- **1. Wood Veneer — отримано.** Noce Canaletto 933, Rovere Oro 932, Rovere Termocotto 931 є в експорті під точними назвами й прив’язані з 2026-10-15 (`runtime-bindings.json`, CabinetColor). Старий блокер експорту afd76fa6 закрито; підміна іншою деревиною не допускається.
- **2. Cabinet Pattern — отримано і прив’язано з v44.** `CabinetPattern` на обох продуктах Tricot має Cannette / Gessatto / Loden / Twill / Satin; semantic Gessato перекладається в `Gessatto`. Зберігання — на окремий модуль, readback — getConfig. Поточний погоджений default — Satin, як у profile/presets; старе очікування Cannette архівоване. Сумісність із матеріалом контролює profile. Shared/selected/Apply to all поведінка — [rule 11](../../docs/products/tricot/rules.md); повне візуальне приймання лишається в [issue 8](08-real-scene-acceptance.issue.md).
- **5. Swatches/metadata — отримано.** Configurator 12 (`modular-config-phase-2-materials-(tricot)`) дає 23 кольори корпусу, 20 пазу, 71 стільниці та 40 лаків VesselColor. Profile зберігає allowlists і бере з 12 hex, SKU та картинки; manifest і `sourceRefs.configuratorId` вказують 12.
- **8. Картка model 33 — закрито 2026-10-28.** Tricot 79 2DW 1_70 опубліковано з SB100 → SC40 → SC60 і карткою реального фронтального ракурсу. У каталозі 42 моделі / 93 модулі; 41 оригінальний PNG збережено, старий 404 є історією джерела. Повторний PNG не потрібен.

Також отримано типи Tricot-sink-cabinet / Tricot-side-cabinet, сантиметри, режими 1D / 2D / 1DWID, погоджені правила панелей, tables 592/593 і поточні defaults Rovere Oro 932 / Satin / Agata 407 MT / BIANCO KOS 250 / integrated VA024.

## Від 3D/PlayCanvas-розробника: лишається приймання

- **3. Side Panels.** Frontend-підключення лише NoG через Accessories / SidePanelLeft / SidePanelRight, ціна активних сторін і +1 см стільниці на сторону отримані. Перевірити актуальний експорт: Tricot-панель висотою 40 см, її support/активацію/видалення й side readback. Підміна панелями USH 50/53/56 була спостереженням v44; у цьому оновленні документації v100 не перевірявся, тому це незакрита acceptance-перевірка, а не повторне твердження про поточний дефект.
- **4. Countertop / basins.** Прив’язки LB/VA/LV та Vessel, CountertopColor/Thickness і ціноутворення VES-стільниця GB / HCUT / vessel table 542 підключені. Залишається перевірити поточні basin switching/mounting, товсті стільниці й матеріали Solid Surface / HPL / Porcelain; продукт має підтвердити vessel-палітри. Відсутність RuleChangeSinkType / RuleSinkMountPosition і незмінний Top_HPLPrisma були спостереженнями v53 від 2026-10-15; вони збережені в архіві й потребують актуального ретесту, а не припущення про v100.

Для кожної прив’язки потрібні робочі addProduct / setConfig, результат getConfig та порядок/reset операцій за потреби. Статичний список ID екземплярів не потрібний: addProduct повертає ID для подальших змін і видалення.

## Від API / pricing-власника

- **6. Vessel у таблиці 593:** у ній немає колонок `min_vsl_cm` і `depths_cm_vessel`, які в ULH (таблиця 589) обмежують vessel Sink Base від 80 см. Потрібні підтверджені мінімальні ширина/глибина або відповідь продукту, що обмеження немає. Відсутність колонок сама по собі не підтверджує доступність кожної ширини в поточному UI.
- **7. GB pricing:** підтвердити countertop/basin SKU mappings, thickness tokens, quantities та приклади цін. 593 уже підключено як таблицю сумісності, але це не повний ціновий контракт. Кабінетні SKU та CAB-суфікс панелі повторного погодження не потребують.

## З нашого боку

Додати решту прив’язок після отримання контрактів і пройти [issue 8](08-real-scene-acceptance.issue.md) в обох flows: geometry, drawers, materials/patterns, panels, basins, Summary, save/undo/redo. Наявність карток, деревини чи unit/adapter-тестів не закриває повне приймання або всі необхідні залежності.
