# Tricot — специфікація колекції

Ревізія **2026-11-03** (імпорт з Google Docs 2026-11-01). `collectionId=tricot` · SKU TRIC / CT-GB · конфігуратор 12 · таблиці 593 (стільниця), 592 (тумби) · пакет `public/collections/tricot/`. Статуси фактів — [`../_shared/status-legend.md`](../_shared/status-legend.md). Це рівень 3 за старшинством: при конфлікті з `docs/ai/hastings/*.csv` виграє цей документ, розбіжність записується в `conflicts-and-decisions.md`.

У джерелі розділ «Що таке Tricot» був порожній — короткий опис нижче зібрано з §2–§7 і потребує вашого підтвердження.

## Що таке Tricot

- Модульна тумба з Sink Base і Side Cabinet впритул в один ряд під однією стільницею; до 220 см, не більше 2 Sink Base.
- Одна висота 40 см і одна глибина 52 см; стилі ящиків 1DW / 2DW / 1DWID (2DW не змішується з іншими).
- Ручка завжди паз (Upper Groove), вибирається лише його колір; п'ять патернів фасадів, прив'язаних до матеріалу: Loden — лише лак, Cannette / Twill / Gessato / Satin — лише шпон.
- Бокові панелі No groove на відкритих торцях; стільниці тонкі й товсті (3.1" / 4" / 4.7" з кронштейнами); раковина інтегрована або vessel (Iris / Frame / Plaza).

## Ключові числа

42 моделі Prebuilt · 136 SKU у клієнта (60 SB, 75 SC, 1 SP) · кольори: корпус 23 (20 лак + 3 шпон), паз 20, стільниця 71, vessel 40 · патерни 5 · товщини 5 · раковини 10 інтегрованих + 3 vessel · довжина ≤ 220 см з урахуванням панелей. Сценарії: 5 кроків (Cabinet Finishes → Accessories → Countertop & Basin).

## Яке питання → який файл

| Питання | Файл | § |
|---|---|---|
| Типи тумб, ширини, стилі ящиків, ручка, чого немає | [`products.md`](products.md) | 2 |
| Кроки Prebuilt / Create your own, блоки, меню | [`steps.md`](steps.md) | 3 |
| Кольори, товщини, цінові групи матеріалів | [`materials.md`](materials.md) | 4 |
| Раковини: інтегровані, vessel, поведінка | [`basins.md`](basins.md) | 5 |
| Аксесуари: що є, що не в збірці | [`accessories.md`](accessories.md) | 6 |
| Правила 1–22 і заборонені комбінації | [`rules.md`](rules.md) | 7 |
| Формула ціни, шаблони SKU, що змінює ціну | [`pricing.md`](pricing.md) | 8 |

Посилання виду §4.3 усередині файлів — номер розділу специфікації; файл визначається за першою цифрою в таблиці вище.

Окремої сторінки інтеграції в код для Tricot ще немає: файли пакета — `public/collections/tricot/`, спільний пайплайн — [`../README.md`](../README.md).

## Відкриті питання до клієнта (UNKNOWN — clarify)

актуальність зв'язку код → 3D-модель раковин (§5.1, §5.2) · формат ширин у SKU (§8.1) · групування Solid Surface (§4.4). Повний список — пошуком `UNKNOWN` по теці. Поведінку shared/selected Cabinet Pattern описано в [§7.2](rules.md); повне візуальне приймання обох flows відстежується в [issue 8](../../../plans/tricot-integration/08-real-scene-acceptance.issue.md).

## Пов'язане

Skill: `.agents/skills/hastings-tricot/` · спільний пайплайн: [`../README.md`](../README.md) · правила клієнта з джерелами: `docs/ai/hastings/domain-index.md` → `R-TRICOT-*` (спільні Urban — `R-URBAN-*`) · назви кольорів: [`../_shared/palettes.md`](../_shared/palettes.md).
