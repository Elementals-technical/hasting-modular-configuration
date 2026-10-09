# Tricot: відкриті питання після часткової runtime-інтеграції

Уже інтегровано: реальні типи Tricot-sink-cabinet / Tricot-side-cabinet, сантиметри, режими 1D / 2D / 1DWID, 20 точних matte lacquer assets для CabinetColor і HandleGrooveColor, з експорту v44 — Cabinet Pattern (`CabinetPattern`), з Render Admin — власний material configurator 12. Рецепти, дефолти, 592/593 і погоджені правила панелей повторно запитувати не потрібно.

## Від 3D/PlayCanvas-розробника

1. **Wood Veneer:** точні material assets або підтверджені aliases для Noce Canaletto 933, Rovere Oro 932, Rovere Termocotto 931. У локальному staging-експорті afd76fa6 цих матеріалів немає; підміна іншою деревиною не допускається.
2. **Cabinet Pattern — отримано в експорті v44 і прив'язано, повторно не запитувати.** Ключ `CabinetPattern` на обох продуктах Tricot, значення Cannette / Gessatto / Loden / Twill / Satin (Gessato у сцені пишеться `Gessatto`), target — окремий модуль, readback через getConfig. Сцена не перевіряє матеріал, а її дефолт Satin не замінює погоджений Cannette. Візуальне приймання — в issue 8.
3. **Side Panels:** ключі/значення встановлення та видалення лівої/правої панелі; фактична активація кожного боку в readback. Чи повертає сцена фінальну ширину стільниці вже з +1/+2 см? CabinetColor фарбує панель, але не визначає спосіб її активації. Правила Accessories, успадкування та SKU з CAB-суфіксом уже погоджені.
4. **Countertop / basins — підключено як у Class/Mako (2026-10-09).** sinkType шле LB/VA/LV на ті самі authored sub-products, що й Class (LB440 → Top_HPLPrisma тощо), CountertopColor і Thickness — на всю композицію, CountertopStyle лише записується. Від 3D-розробника лишається: у Tricot-sink-cabinet в експорті v44 немає RuleChangeSinkType і RuleSinkMountPosition, тож раковина ставиться при додаванні модуля, але не міняється після, і не підлаштовується під товсту стільницю; у сцені немає матеріалів Solid Surface, HPL і Porcelain (як і для Class).

Для кожної прив'язки: робочий addProduct / setConfig, результат getConfig та порядок/reset операцій, якщо потрібні. Статичний список ID екземплярів не потрібен: addProduct повертає ID для подальших змін/видалення.

## Від API / pricing-власника

5. **Swatches/metadata — отримано: configurator 12 (`modular-config-phase-2-materials-(tricot)`), повторно не запитувати.** Його палітри збігаються зі списками профілю: 23 кольори кабінету, 20 пазу, 71 стільниці (група vessel на 40 кольорів профілем поки не використовується). Профіль лишає свої списки як allowlist і бере з 12 hex, SKU та картинки; manifest і `sourceRefs.configuratorId` вказують 12.
6. **GB pricing:** підтвердити countertop/basin SKU mappings, thickness tokens, quantities та приклади цін. 593 уже підключено як таблицю сумісності, але це не повний ціновий контракт. Кабінетні SKU та CAB-суфікс панелі повторного погодження не потребують.

## Уже обіцяний файл

7. PNG для Tricot 79 2DW 1_70 користувач надасть пізніше. Решта 41 PNG збережена; рецепт пресета не видалено.

## З нашого боку

Додати решту прив'язок після отримання контрактів, перевірити обидва flows у справжній сцені (geometry, drawers, materials/pattern, panels, basins, summary, save/undo/redo). Staged знімається після закриття необхідних залежностей. Unit/adapter-тести не означають візуальне приймання або повну готовність.
