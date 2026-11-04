# Urban Freestanding — специфікація колекції

Ревізія **2026-11-03** (імпорт з Google Docs 2026-11-01). `collectionId=urban-freestanding` · SKU URFS / CT-UR (полиці UROS, UROSS) · конфігуратор 11 · таблиці 591 (стільниця), 590 (тумби) · пакет `public/collections/urban-freestanding/`. Статуси фактів — [`../_shared/status-legend.md`](../_shared/status-legend.md). Це рівень 3 за старшинством: при конфлікті з `docs/ai/hastings/*.csv` виграє цей документ, розбіжність записується в `conflicts-and-decisions.md`.

## Що таке Urban Freestanding

- Підлогова тумба на цоколі 3 см; логіка тумб "як в Urban Standard Height" (USH), окремого документа логіки для UF у клієнта немає — лише розділ "Urban Freestanding Logic – comparison" у документі USH
- П'ять типів: Sink Base, Side Cabinet, Open Shelf, Open Side Shelf і нова коротка підлогова тумба з одним ящиком (Floor-Mount Short Cabinet)
- Висота тумби залежить від ручки (UG / CG 91 см, PTO 88 см; цоколь включено); стільниця лише тонка (0.5")
- Тумби стоять в один ряд (лінійна композиція, без drag-and-drop); коротка тумба стоїть з краю, нижче за решту, і має свою нижню стільницю ("short floor cabinet wrinkle")

## Ключові числа

54 моделі Prebuilt · 466 SKU у клієнта (коротка тумба й панелі без ціни) · кольори: корпус 232 (+3 зайві), паз 252, стільниця 60 видимих, vessel 9 робочих, рушник 5 · fluting 4 + None · товщина 1 (0.5") · раковини 13 інтегрованих + 4 vessel · довжина за матеріалом (270 / 290 см). Сценарії: 6 кроків (Color → Countertop & Basin → Accessories → Faucet Details).

## Яке питання → який файл

| Питання | Файл | § |
|---|---|---|
| Типи тумб, ширини, стилі ящиків, ручка, чого немає | [`products.md`](products.md) | 2 |
| Кроки Prebuilt / Create your own, блоки, меню | [`steps.md`](steps.md) | 3 |
| Кольори, товщини, цінові групи матеріалів | [`materials.md`](materials.md) | 4 |
| Раковини: інтегровані, vessel, поведінка | [`basins.md`](basins.md) | 5 |
| Аксесуари: що є, що не в збірці | [`accessories.md`](accessories.md) | 6 |
| Правила 1–26 і заборонені комбінації | [`rules.md`](rules.md) | 7 |
| Формула ціни, шаблони SKU, що змінює ціну | [`pricing.md`](pricing.md) | 8 |

Посилання виду §4.3 усередині файлів — номер розділу специфікації; файл визначається за першою цифрою в таблиці вище.

Окремої сторінки інтеграції в код для Urban Freestanding ще немає: файли пакета — `public/collections/urban-freestanding/`, спільний пайплайн — [`../README.md`](../README.md).

## Відкриті питання до клієнта (UNKNOWN — clarify)

коротка тумба Floor-Mount: розміри, SKU, ціна (§2.1, §8.1) · ціна панелей 34.6H / 35.8H (§6.1) · цоколь при змішаних глибинах (§2.5) · vessel на Fenix (§5.2) · глибина нижньої стільниці (§7.3). Повний список — пошуком `UNKNOWN` по теці.

## Пов'язане

Skill: `.agents/skills/hastings-ufs/` · спільний пайплайн: [`../README.md`](../README.md) · правила клієнта з джерелами: `docs/ai/hastings/domain-index.md` → `R-UFS-*` (спільні Urban — `R-URBAN-*`) · назви кольорів: [`../_shared/palettes.md`](../_shared/palettes.md).
