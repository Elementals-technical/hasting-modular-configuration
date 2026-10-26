# React UI — робочий контекст

## Початок роботи

1. Прочитай [карту портфеля](../../PROJECT-MAP.md) і [карту Modular](../PROJECT-MAP.md).
2. Локальні точки входу: [README.md](README.md), [docs/INDEX.md](docs/INDEX.md). Для колекцій — [docs/products/README.md](docs/products/README.md); для parent iframe — [parent integration](docs/parent-configurator-integration.md).
3. Для міжрепозиторного потоку використовуй [дослідження екосистеми](docs/ecosystem-map.md) як датований snapshot і перевіряй поточні файли, потрібні задачі.

## Межі контексту

- Тут підтримуються UI, collection packages, state, команди до 3D та комерційний результат. Canonical 3D source розташований в окремому `../hasting-modular-playcanvas-flow-git/src/` checkout.
- Export у `public/` і контрольний v69 у сусідній папці мають окрему ідентичність; зміна source не доводить оновлення завантаженого export.
- Продуктові факти перевіряй у [data repo](../../data-modular-configuration/AGENTS.md); mapping або обмеження PlayCanvas не переноситься на інші конфігуратори автоматично.
- Зберігай деталі реалізації в локальних docs і підтримуй `docs/INDEX.md`, розрізняючи Maintained і Records. Верхні карти містять відповідальність і посилання.
- В окремому clone/worktree відносні верхні посилання можуть бути відсутні. Використай відомий зі сесії portfolio path; без нього продовжуй локальну роботу й познач відсутній міжпроєктний контекст, якщо він потрібен для рішення.
