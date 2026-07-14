# HQSnapshotService

Сервіс для створення високоякісних offscreen snapshots у PlayCanvas.

Основне призначення: отримати рендер поточної 3D-композиції для PDF quote, вебшопа, CRM, backend upload або будь-якого зовнішнього сервісу клієнта, де потрібне чисте зображення продукту в заданій якості.

## Де знаходиться

- Публічний entry point: `Scripts/app-configuration/services/snapshot/index.mjs`
- Renderer: `Scripts/app-configuration/services/snapshot/hq-snapshot-service.mjs`
- Memory policy: `Scripts/app-configuration/services/snapshot/snapshot-memory-policy.mjs`
- PlayCanvas script-wrapper: `Scripts/hqSnapshot.mjs`
- Optional ConfiguratorAPI adapter: `Scripts/app-configuration/bridge/adapters/camera.plugin.mjs`

Старий шлях `bridge/plugins/camera.plugin.mjs` залишений лише як deprecated
compatibility re-export. Новий код має імпортувати adapter з `bridge/adapters`.

## Публічний модуль

Імпортуйте renderer і policy тільки через `index.mjs`:

```javascript
import {
  HQSnapshotService,
  SNAPSHOT_DEVICE_PROFILE,
  createSnapshotMemoryPlan
} from './services/snapshot/index.mjs';
```

`index.mjs` експортує:

- `HQSnapshotService`;
- `DEFAULT_HQ_SNAPSHOT_CONFIG`;
- `DEFAULT_HQ_SNAPSHOT_PRESETS`;
- `SNAPSHOT_DEVICE_PROFILE`;
- `resolveSnapshotDeviceProfile()`;
- `getSnapshotMemoryPolicy()`;
- `createSnapshotMemoryPlan()`.

Bridge adapter навмисно не експортується з snapshot module. Завдяки цьому інший
PlayCanvas-проєкт може використовувати renderer і memory policy без
`ConfiguratorAPI`, `LoggerService` та camera bridge methods.

## Підключення в іншому PlayCanvas-проєкті

```javascript
import { HQSnapshotService } from './services/snapshot/index.mjs';

const snapshots = new HQSnapshotService(app, {
  cameraResolver: (currentApp) => currentApp.root.findByName('ProductCamera'),
  platformCapabilities: {
    ios: isIOS,
    mobile: isMobile
  },
  memoryPolicy: {
    maxOutputLongEdge: 4096,
    maxSuperSample: 1
  }
});

const result = await snapshots.capture('page');
```

`cameraResolver(app)` має повернути PlayCanvas entity з camera component. Якщо
resolver не заданий або не повернув камеру, renderer використовує fallback:

1. `app.cameraController.getCameraEntity()`;
2. entity з ім'ям `Camera`;
3. першу активну camera component у сцені.

`platformCapabilities` дозволяє проєкту самостійно визначити mobile/iOS profile,
а `memoryPolicy` — перевизначити ліміти профілю без змін renderer.

## Важливо

Цей сервіс не замінює старий snapshot API.

Старий canvas/tag based API залишається доступним:

```javascript
await ConfiguratorAPI.camera.takeSnapshot();
```

Новий HQ API живе паралельно:

```javascript
await ConfiguratorAPI.camera.captureHQSnapshot('page');
await ConfiguratorAPI.camera.hqSnapshot.capture('hero');
```

Для client-facing image download / perspective shots використовуйте download API. Він за замовчуванням бере current-view ракурс:

```javascript
await ConfiguratorAPI.camera.downloadHQSnapshot('page', 'perspective.jpg');
```

Якщо на camera entity вже підключений PlayCanvas script `hqSnapshot`, сервіс делегує виклик у нього. Якщо script не підключений, працює fallback через `HQSnapshotService`.

## Пресети

Дефолтні пресети:

| Назва | Розмір | Формат | Quality | CameraFrame | SSAO | Призначення |
|---|---:|---|---:|---|---|---|
| `hero` | `4096x4096` | `image/png` | `1.0` | так | так | Максимальна якість для великих PDF/hero image |
| `page` | `2048x2048` | `image/jpeg` | `0.9` | так | так | Основний PDF/quote render |
| `thumb` | `1024x1024` | `image/jpeg` | `0.85` | ні | ні | Швидкий preview/thumbnail |

Переглянути пресети з консолі:

```javascript
ConfiguratorAPI.camera.getHQSnapshotPresets();
```

Або:

```javascript
ConfiguratorAPI.camera.hqSnapshot.getPresets();
```

## Bridge API

### captureHQSnapshot(presetOrOptions)

Створює високоякісний snapshot і повертає результат з `Blob` та lazy `dataUrl`.

```javascript
const shot = await ConfiguratorAPI.camera.captureHQSnapshot('page');
```

Через namespace:

```javascript
const shot = await ConfiguratorAPI.camera.hqSnapshot.capture('hero');
```

**Повертає:**

```javascript
{
  blob: Blob,
  width: number,
  height: number,
  format: string,
  quality: number,
  source: 'service',
  memoryGuard: object,
  dataUrl: string
}
```

`dataUrl` генерується тільки при першому читанні:

```javascript
const preview = shot.dataUrl;
```

Для вебшопа або backend upload краще використовувати `shot.blob`, бо він не роздуває пам'ять як base64.

### downloadHQSnapshot(presetOrOptions, filename)

Створює current-view HQ snapshot і одразу завантажує файл у браузері.

Це основний API для client-facing `Image Download`: він зберігає поточний кут користувача, як старий `takeSnapshot()`, але використовує новий HQ render pipeline.

```javascript
await ConfiguratorAPI.camera.downloadHQSnapshot('page', 'perspective.jpg');
```

Якщо потрібен fixed product render, передайте `mode: 'framed'` або використайте `downloadFramedHQSnapshot()`.

**Повертає:** `Promise<boolean>`

### captureCurrentViewHQSnapshot(presetOrOptions)

Створює HQ snapshot з поточного ракурсу користувача. Це заміна старої поведінки `takeSnapshot()` для perspective image export, але з покращеною роздільністю.

```javascript
const shot = await ConfiguratorAPI.camera.captureCurrentViewHQSnapshot('page');
```

Або через namespace:

```javascript
const shot = await ConfiguratorAPI.camera.hqSnapshot.captureCurrentView('page');
```

У цьому режимі сервіс:

- бере поточні `position/rotation` камери;
- не застосовує fixed `azimuth/elevation`;
- за замовчуванням зберігає aspect ratio поточного canvas;
- захоплює видимі 3D dimension lines, якщо вони вже увімкнені в сцені.

### downloadCurrentViewHQSnapshot(presetOrOptions, filename)

Явний alias для current-view download.

```javascript
await ConfiguratorAPI.camera.downloadCurrentViewHQSnapshot('page', 'perspective.jpg');
```

Через namespace:

```javascript
await ConfiguratorAPI.camera.hqSnapshot.downloadCurrentView('page', 'perspective.jpg');
```

### downloadFramedHQSnapshot(presetOrOptions, filename)

Створює fixed-angle product render і одразу завантажує файл. Використовуйте це для технічних/quote exports, коли не треба повторювати поточний кут користувача.

```javascript
await ConfiguratorAPI.camera.downloadFramedHQSnapshot('hero', 'render.png');
```

Або:

```javascript
await ConfiguratorAPI.camera.downloadHQSnapshot({
  preset: 'hero',
  mode: 'framed'
}, 'render.png');
```

### getHQSnapshotPresets()

Повертає копію доступних пресетів.

```javascript
const presets = ConfiguratorAPI.camera.getHQSnapshotPresets();
```

## Приклади з консолі

### Швидко зробити PDF render

```javascript
const shot = await ConfiguratorAPI.camera.captureHQSnapshot('page');
console.log(shot.width, shot.height, shot.format, shot.blob.size);
```

### Показати preview на сторінці

```javascript
const shot = await ConfiguratorAPI.camera.captureHQSnapshot('thumb');

const img = new Image();
img.src = shot.dataUrl;
img.style.cssText = 'position:fixed;right:20px;top:20px;width:320px;z-index:99999;border:1px solid #ccc;background:#fff';
document.body.appendChild(img);
```

### Завантажити current-view 4K PNG

```javascript
await ConfiguratorAPI.camera.downloadHQSnapshot({
  out: 4096,
  format: 'image/png',
  bg: '#ffffff'
}, 'hastings-render.png');
```

### Завантажити fixed-angle 4K PNG

```javascript
await ConfiguratorAPI.camera.downloadFramedHQSnapshot({
  preset: 'hero',
  out: 4096,
  format: 'image/png',
  bg: '#ffffff'
}, 'hastings-render.png');
```

### Завантажити поточний perspective shot

```javascript
await ConfiguratorAPI.camera.downloadCurrentViewHQSnapshot({
  preset: 'page',
  out: 2048,
  format: 'image/jpeg',
  quality: 0.92
}, 'current-perspective.jpg');
```

### Зберегти поточний ракурс із dimensions

```javascript
ConfiguratorAPI.showDimensions({
  box: {
    nodes: ['Cabinet_1'],
    width: '120 cm',
    height: '53 cm',
    depth: '46 cm'
  }
});

const shot = await ConfiguratorAPI.camera.captureCurrentViewHQSnapshot('page');
```

### Upload у вебшоп/backend

```javascript
const shot = await ConfiguratorAPI.camera.captureHQSnapshot('page');

const form = new FormData();
form.append('file', shot.blob, 'configuration.jpg');

await fetch('/api/render-upload', {
  method: 'POST',
  body: form
});
```

### Отримати base64 для PDF SDK

```javascript
const shot = await ConfiguratorAPI.camera.captureHQSnapshot({
  preset: 'page',
  format: 'image/jpeg',
  quality: 0.92
});

const base64Image = shot.dataUrl;
```

## Опції

`captureHQSnapshot()` приймає або назву пресета, або object override.

```javascript
await ConfiguratorAPI.camera.captureHQSnapshot('page');
```

```javascript
await ConfiguratorAPI.camera.captureHQSnapshot({
  preset: 'page',
  out: 2048,
  width: 2048,
  height: 2048,
  format: 'image/jpeg',
  quality: 0.9,
  bg: '#ffffff',
  azimuth: 35,
  elevation: 25,
  margin: 1.12,
  cameraFrame: true,
  ssao: true,
  ssaoSamples: 32,
  bloom: 0,
  mode: 'current',
  preserveCanvasAspect: true,
  superSample: 0,
  ss: null,
  aabbExclude: ['Floor', 'Room']
});
```

| Опція | Тип | Default | Опис |
|---|---|---:|---|
| `preset` | `string` | `page` | Базовий пресет, поверх якого накладаються override-опції |
| `out` | `number` | `2048` | Квадратний фінальний розмір, якщо `width/height` не задані |
| `width` | `number` | `out` | Фінальна ширина |
| `height` | `number` | `out` | Фінальна висота |
| `format` | `string` | `image/png` | `image/png`, `image/jpeg`, `image/webp` |
| `quality` | `number` | `0.92` | Якість для JPEG/WebP, діапазон `0..1` |
| `bg` | `string|null` | `#ffffff` для JPEG | Колір фону перед encode |
| `azimuth` | `number` | `35` | Горизонтальний кут камери в градусах |
| `elevation` | `number` | `25` | Вертикальний кут камери в градусах |
| `margin` | `number` | `1.12` | Відступ навколо AABB продукту |
| `cameraFrame` | `boolean` | залежить від пресета | Увімкнути `pc.CameraFrame`, якщо доступний |
| `ssao` | `boolean` | залежить від пресета | Увімкнути SSAO через CameraFrame |
| `ssaoSamples` | `number` | `32` | Кількість samples для SSAO |
| `bloom` | `number` | `0` | Bloom intensity |
| `mode` / `view` / `cameraMode` | `string` | `framed` | `framed` = fixed product render, `current` = поточний ракурс користувача |
| `preserveCanvasAspect` | `boolean` | `true` для `current` | Зберігає aspect ratio поточного canvas, якщо не задані одночасно `width` і `height` |
| `superSample` | `number` | `0` | `0` означає auto |
| `ss` | `number|null` | auto | Явний supersampling multiplier |
| `aabbExclude` | `string[]` | `[]` | Імена entity, які не входять у framing AABB |

## Як працює рендер

1. Сервіс знаходить camera entity:
   - через `app.cameraController.getCameraEntity()`,
   - або entity з ім'ям `Camera`,
   - або першу активну camera component.
2. Якщо на камері є `entity.script.hqSnapshot.capture()`, виклик делегується в цей script.
3. Якщо script немає, сервіс створює clone камери.
4. На clone вимикаються scripts, щоб orbit camera не перезаписувала позицію.
5. Створюється `RenderTarget` з `samples: 1`.
6. У `framed` mode сервіс рахує AABB тільки по enabled render/model components.
7. У `framed` mode камера фреймиться по `azimuth/elevation/margin`.
8. У `current` mode сервіс копіює поточну позицію/поворот камери й не змінює ракурс користувача.
9. Сцена рендериться offscreen у supersampled resolution.
10. Пікселі читаються через texture readback, перевертаються по Y і downscale-яться у фінальний canvas.
11. Результат повертається як `Blob` плюс lazy `dataUrl`.

## Інваріанти

Не змінювати без перевірки в PlayCanvas:

- `RenderTarget.samples` має бути `1`, бо MSAA може ламати readback.
- На clone камери scripts вимикаються, інакше orbit camera може перезаписати fit-позицію.
- AABB рахується тільки з enabled entity/components, щоб вимкнені варіанти не роздували framing.
- Для JPEG бажано задавати `bg`, бо JPEG не має alpha channel.

## PlayCanvas script-wrapper

Файл `Scripts/hqSnapshot.mjs` можна підключити як script на camera entity.

Після цього пресети й базові параметри будуть редагуватися в PlayCanvas Inspector:

- `presets`
- `azimuth`
- `elevation`
- `margin`
- `sharpness`
- `superSample`
- `aabbExclude`

Виклик напряму зі script component:

```javascript
const camera = pc.app.root.findByName('Camera');
const shot = await camera.script.hqSnapshot.capture('hero');
```

Bridge API автоматично використає цей script, якщо він є:

```javascript
const shot = await ConfiguratorAPI.camera.captureHQSnapshot('hero');
```

## Коли використовувати який snapshot

| API | Коли використовувати |
|---|---|
| `ConfiguratorAPI.camera.takeSnapshot()` | Швидкий screenshot поточного canvas, debug, lightweight preview |
| `ConfiguratorAPI.camera.captureHQSnapshot()` | PDF, quote, fixed product render із контрольованим ракурсом |
| `ConfiguratorAPI.camera.downloadHQSnapshot()` | Client-facing Image Download з поточного кута користувача |
| `ConfiguratorAPI.camera.captureCurrentViewHQSnapshot()` | Perspective shots з поточного кута користувача |
| `ConfiguratorAPI.camera.downloadCurrentViewHQSnapshot()` | Явний alias для current-view image download |
| `ConfiguratorAPI.camera.downloadFramedHQSnapshot()` | Fixed product render download |

## Типові проблеми

### `ConfiguratorAPI` ще не існує

Дочекайтеся bridge:

```javascript
await new Promise((resolve) => {
  const timer = setInterval(() => {
    if (window.ConfiguratorAPI?.camera?.hqSnapshot) {
      clearInterval(timer);
      resolve();
    }
  }, 50);
});
```

### Помилка `camera entity is not available`

Перевірити, чи є активна камера:

```javascript
pc.app.root.findComponents('camera').map((c) => c.entity.name);
```

### Зображення обрізане або занадто далеко

Змінити `margin`, `azimuth`, `elevation`:

```javascript
await ConfiguratorAPI.camera.captureHQSnapshot({
  preset: 'page',
  margin: 1.25,
  azimuth: 40,
  elevation: 20
});
```

### У framing потрапляє підлога/кімната/helper

Додати entity names у `aabbExclude`:

```javascript
await ConfiguratorAPI.camera.captureHQSnapshot({
  preset: 'page',
  aabbExclude: ['Floor', 'Room', 'GridHelper']
});
```
