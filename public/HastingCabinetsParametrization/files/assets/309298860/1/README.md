# spatial-manipulation V2: путівник

Цей індекс стосується модуля в `Scripts/app-configuration/domain/spatial-manipulation/`: вхід без рушія експортує `defineManipulable`, `createSpatialWorld` і чисті алгоритми; PlayCanvas має окремий вхід. [index.mjs:1](../index.mjs#L1), [playcanvas/index.mjs:1](../playcanvas/index.mjs#L1)

> `public-api.md`, `data-model.md`, ADR-0001 і ADR-0005 у доступному робочому дереві та Git-історії не знайдені. Наведені нижче контракти **відновлено з коду, потребує підтвердження власником**. [runtime/instance.mjs:284](../runtime/instance.mjs#L284), [playcanvas/projection.mjs:2](../playcanvas/projection.mjs#L2)

| Файл | Що читати |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Шари, один рух курсора, ревізії й FIFO. |
| [PUBLIC-API.md](PUBLIC-API.md) | Специфікація, World, handle, instance, події та помилки. |
| [ENGINE-ADAPTER.md](ENGINE-ADAPTER.md) | Контракт `scene`, вимірювання, драйвера пози й вводу. |
| [GLOSSARY.md](GLOSSARY.md) | Значення термінів та одиниць. |
| [RULINGS.md](RULINGS.md) | Індекс кодів R/F/AC/T/P/ADR із доказами й тестами. |
| [EXTENDING.md](EXTENDING.md) | Точні місця змін для нових можливостей. |
| [KNOWN-ISSUES.md](KNOWN-ISSUES.md) | Відомі обмеження, несподівана поведінка й відтворення. |

Рекомендований маршрут: `ARCHITECTURE` → `PUBLIC-API` → `ENGINE-ADAPTER` → `GLOSSARY`; перед зміною коду прочитайте `RULINGS`, `EXTENDING` і `KNOWN-ISSUES`. Вхідні файли та межа рушія визначені експортами. [index.mjs:5](../index.mjs#L5), [playcanvas/index.mjs:8](../playcanvas/index.mjs#L8)

## Швидкий старт без PlayCanvas

Із каталогу `Scripts/app-configuration/domain/`:

```bash
node --test spatial-manipulation/tests/
node spatial-manipulation/examples/row-modules.mjs
node spatial-manipulation/examples/free-field.mjs
node spatial-manipulation/examples/corners-joints.mjs
node spatial-manipulation/examples/inclined-side.mjs
```

На Node 22 шлях до каталогу тестів працює через [tests/index.js:1](../tests/index.js#L1); набір використовує `node:test` і справжній World через [tests/adapters/demo-engine.mjs:1](../tests/adapters/demo-engine.mjs#L1). Кожен приклад запускає World, жест і друкує `offsetM`, активні snap-правила, стан колізії та корекції. [examples/shared.mjs:4](../examples/shared.mjs#L4)

Мінімальна програма в Node:

```js
import { defineManipulable } from './spatial-manipulation/index.mjs';
import { rectangle, createDemoEngine } from './spatial-manipulation/tests/adapters/demo-engine.mjs';

const demo = createDemoEngine({ bodies: [rectangle('moving')] });
const handle = await demo.world.register(defineManipulable({ id: 'demo' }), { body: 'moving' });
await handle.setOffset({ u: 0.25 });
console.log(handle.getState().offsetM);
await demo.world.destroy();
```

Форма `register` і `setOffset` відповідає [runtime/world.mjs:141](../runtime/world.mjs#L141) та [runtime/world.mjs:441](../runtime/world.mjs#L441); 2D-адаптер створює World і драйвер пози в [tests/adapters/demo-engine.mjs:49](../tests/adapters/demo-engine.mjs#L49).
