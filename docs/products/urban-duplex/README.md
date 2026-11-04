# Urban Duplex — специфікація колекції

Ревізія **2026-11-03** (джерела 2026-10-28, імпорт з Google Docs 2026-11-01; уточнено глибину Multi-level за локальним v99). `collectionId=urban-duplex` · SKU URDPX / CT-UR (гібриди URSTD, URLH; полиці UROS, UROSS) · конфігуратор 13 · таблиці 595 (стільниця), 594 (тумби) · пакет `public/collections/urban-duplex/`. Статуси фактів — [`../_shared/status-legend.md`](../_shared/status-legend.md). Це рівень 3 за старшинством: при конфлікті з `docs/ai/hastings/*.csv` виграє цей документ, розбіжність записується в `conflicts-and-decisions.md`.

## Що таке Urban Duplex

- Поєднання Urban Standard Height і Urban Low Height ("Urban Duplex is a combination of Urban Standard Height + Urban Low Height"): стандартні тумби 56 / 53 см і низькі 38 / 28 см. Окремого документа логіки немає — лише розділ "Urban Duplex Logic – comparison" у документі USH; правила стільниці й раковин — "same as Urban Standard Height"
- Фасад двопанельний: Base Panel + Lateral Panel (вертикальна панель-ручка з одного боку тумби, L або R); колір кожної панелі вибирається окремо; ручка лише Upper Groove, fluting немає
- Висоту тумби задає стиль ящиків: 2DW — 56, 1DW і 1DWID — 53, 1DW Slim — 38 або 28
- Частина моделей гібридні: Side Cabinet з Urban Standard Height (URSTD) або Urban Low Height (URLH) — без Lateral Panel, з повною ручкою; п'ять моделей Multi-level (тумби 28 см у двох рівнях)

## Ключові числа

71 модель Prebuilt (28 гібридних, 5 Multi-level) · 356 SKU у клієнта, ціни для 222 · кольори: Base Panel 232, Lateral Panel 232, стільниця 61 (60 видимих), vessel 9, рушник 5 · товщини 5 · раковини 13 інтегрованих + 5 vessel · довжина за матеріалом (270 / 290 см). Сценарії: 6 кроків (Color → Countertop & Basin → Accessories → Faucet Details).

## Яке питання → який файл

| Питання | Файл | § |
|---|---|---|
| Типи тумб, ширини, стилі ящиків, ручка, чого немає | [`products.md`](products.md) | 2 |
| Кроки Prebuilt / Create your own, блоки, меню | [`steps.md`](steps.md) | 3 |
| Кольори, товщини, цінові групи матеріалів | [`materials.md`](materials.md) | 4 |
| Раковини: інтегровані, vessel, поведінка | [`basins.md`](basins.md) | 5 |
| Аксесуари: що є, що не в збірці | [`accessories.md`](accessories.md) | 6 |
| Правила 1–25 і заборонені комбінації | [`rules.md`](rules.md) | 7 |
| Формула ціни, шаблони SKU, що змінює ціну | [`pricing.md`](pricing.md) | 8 |
| Як пакет підключено в код, контракт сцени, тести, відомі межі | [`integration.md`](integration.md) | — |

Посилання виду §4.3 усередині файлів — номер розділу специфікації; файл визначається за першою цифрою в таблиці вище.

## Відкриті питання до клієнта (UNKNOWN — clarify)

змішування висот 56H і 28H (§7.1) · номінальна / фізична глибина Multi-level: 50 / 50.5 см ([HO-011](../../ai/qa/handoffs/HO-011-urban-duplex-nominal-depth-geometry.md), §2.4) · Open Side Shelf 38 см (§7.1) · vessel на Fenix (§5.2) · токен пазу HNDL / HDL (§8.1) · модель 89" 2-Drawer (§3.1). Повний список — пошуком `UNKNOWN` по теці.

## Пов'язане

Skill: `.agents/skills/hastings-ud/` · спільний пайплайн: [`../README.md`](../README.md) · правила клієнта з джерелами: `docs/ai/hastings/domain-index.md` → `R-UD-*` (спільні Urban — `R-URBAN-*`) · назви кольорів: [`../_shared/palettes.md`](../_shared/palettes.md).
