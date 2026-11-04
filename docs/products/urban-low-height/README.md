# Urban Low Height — специфікація колекції

Ревізія **2026-11-03** (імпорт з Google Docs 2026-11-01). `collectionId=urban-low-height` · SKU URLH / CT-UR (полиці UROS) · конфігуратор 4 · таблиці 589 (стільниця), 580 (тумби) · пакет `public/collections/urban-low-height/`. Статуси фактів — [`../_shared/status-legend.md`](../_shared/status-legend.md). Це рівень 3 за старшинством: при конфлікті з `docs/ai/hastings/*.csv` виграє цей документ, розбіжність записується в `conflicts-and-decisions.md`.

## Що таке Urban Low Height

- Модульна тумба з низьких однострічкових шаф: Sink Base, Side Cabinet і Open Shelf; лише один ящик (1 Drawer), висота 25–38 см, глибина 46 або 50 см
- Висоту визначає ручка: Upper Groove — 38 / 28 см, Push to open — 35 / 25 см. Усі шафи композиції мають одну висоту, одну глибину й одну ручку
- Найбагатша колекція за стільницею і Drag & Drop: шафи можна ставити у два яруси, стільницю — зсувати, піднімати разом із раковиною (Sink Base тоді стає Side Cabinet), змінювати їй довжину; шафи поза основною стільницею отримують кавер (Lower)
- Стільниця, раковини, vessel, бокові панелі й рушник взяті з Urban Standard Height і цінуються за його граматикою; клієнт пише для ULH "Same as Urban Standard Height"

## Ключові числа

59 моделей Prebuilt (6 Multi-Level) · 664 SKU у клієнта · кольори: корпус 232, паз (Provisional), стільниця 61, vessel (Provisional), рушник 5 · fluting 4 + None · товщини 6 · раковини 27 інтегрованих + None + 5 vessel · два яруси, Drag & Drop тумб і стільниці, offset / remote за товщиною · довжина за матеріалом (270 / 290 / 340 см). Сценарії: 5 кроків (Color → Countertop & Basin з вкладками Upper / Lower → Accessories).

## Яке питання → який файл

| Питання | Файл | § |
|---|---|---|
| Типи тумб, ширини, стилі ящиків, ручка, чого немає | [`products.md`](products.md) | 2 |
| Кроки Prebuilt / Create your own, блоки, меню | [`steps.md`](steps.md) | 3 |
| Кольори, товщини, цінові групи матеріалів | [`materials.md`](materials.md) | 4 |
| Раковини: інтегровані, vessel, поведінка | [`basins.md`](basins.md) | 5 |
| Аксесуари: що є, що не в збірці | [`accessories.md`](accessories.md) | 6 |
| Правила 1–55 і заборонені комбінації | [`rules.md`](rules.md) | 7 |
| Формула ціни, шаблони SKU, що змінює ціну | [`pricing.md`](pricing.md) | 8 |
| Як пакет підключено в код, контракт сцени, тести, відомі межі | [`integration.md`](integration.md) | — |

Посилання виду §4.3 усередині файлів — номер розділу специфікації; файл визначається за першою цифрою в таблиці вище.

## Відкриті питання до клієнта (UNKNOWN — clarify)

Solid-Surface ↔ Mineralmarmo / Ocritech (§4.3) · матеріали й дефолт кавера Lower (§4.3) · Porcelain ⅜" чи ½" (§4.4) · панелі на Multi-Level (§6.1) · Grain direction / Inner LED (§6.3) · кронштейни ghost brackets (§8.1). Повний список — пошуком `UNKNOWN` по теці.

## Пов'язане

Skill: `.agents/skills/hastings-ulh/` · спільний пайплайн: [`../README.md`](../README.md) · правила клієнта з джерелами: `docs/ai/hastings/domain-index.md` → `R-ULH-*` (спільні Urban — `R-URBAN-*`) · назви кольорів: [`../_shared/palettes.md`](../_shared/palettes.md).
