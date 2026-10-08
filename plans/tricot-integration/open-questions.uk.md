# Tricot: відкриті питання після часткової runtime-інтеграції

Уже інтегровано: реальні типи Tricot-sink-cabinet / Tricot-side-cabinet, сантиметри, режими 1D / 2D / 1DWID, 20 точних matte lacquer assets для CabinetColor і HandleGrooveColor, а з експорту v44 — Cabinet Pattern (`CabinetPattern`). Рецепти, дефолти, 592/593 і погоджені правила панелей повторно запитувати не потрібно.

## Від 3D/PlayCanvas-розробника

1. **Wood Veneer:** точні material assets або підтверджені aliases для Noce Canaletto 933, Rovere Oro 932, Rovere Termocotto 931. У локальному staging-експорті afd76fa6 цих матеріалів немає; підміна іншою деревиною не допускається.
2. **Cabinet Pattern — отримано в експорті v44 і прив'язано, повторно не запитувати.** Ключ `CabinetPattern` на обох продуктах Tricot, значення Cannette / Gessatto / Loden / Twill / Satin (Gessato у сцені пишеться `Gessatto`), target — окремий модуль, readback через getConfig. Сцена не перевіряє матеріал, а її дефолт Satin не замінює погоджений Cannette. Візуальне приймання — в issue 8.
3. **Side Panels:** ключі/значення встановлення та видалення лівої/правої панелі; фактична активація кожного боку в readback. Чи повертає сцена фінальну ширину стільниці вже з +1/+2 см? CabinetColor фарбує панель, але не визначає спосіб її активації. Правила Accessories, успадкування та SKU з CAB-суфіксом уже погоджені.
4. **Countertop / basins:** ключі, targets, units і значення кольору/товщини/integrated-vessel/десяти basin-моделей. Як змінити або видалити раковину після створення тумби, адресувати дві раковини й прочитати результат? Top_HPLPrisma не вважаємо підтвердженим відповідником LB440. README каже sink subproducts disabled, а актуальний esm.mjs уже реєструє sink mount/subproduct — потрібна перевірка фактичної поведінки.

Для кожної прив'язки: робочий addProduct / setConfig, результат getConfig та порядок/reset операцій, якщо потрібні. Статичний список ID екземплярів не потрібен: addProduct повертає ID для подальших змін/видалення.

## Від API / pricing-власника

5. **Swatches/metadata:** точні ресурси погоджених палітр. Якщо використовується remote configurator catalog — підтверджений ID. Не копіюємо ID Mako/Urban для обходу readiness gate.
6. **GB pricing:** підтвердити countertop/basin SKU mappings, thickness tokens, quantities та приклади цін. 593 уже підключено як таблицю сумісності, але це не повний ціновий контракт. Кабінетні SKU та CAB-суфікс панелі повторного погодження не потребують.

## Уже обіцяний файл

7. PNG для Tricot 79 2DW 1_70 користувач надасть пізніше. Решта 41 PNG збережена; рецепт пресета не видалено.

## З нашого боку

Додати решту прив'язок після отримання контрактів, перевірити обидва flows у справжній сцені (geometry, drawers, materials/pattern, panels, basins, summary, save/undo/redo). Staged знімається після закриття необхідних залежностей. Unit/adapter-тести не означають візуальне приймання або повну готовність.
