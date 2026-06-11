# HQSnapshotService

Сервіс для створення високоякісних offscreen snapshots у PlayCanvas.

Основне призначення: отримати рендер поточної 3D-композиції для PDF quote, вебшопа, CRM, backend upload або будь-якого зовнішнього сервісу клієнта, де потрібне чисте зображення продукту в заданій якості.

## Де знаходиться

- Сервіс: `Scripts/app-configuration/services/snapshot/hq-snapshot-service.mjs`
- PlayCanvas script-wrapper: `Scripts/hqSnapshot.mjs`
- Bridge API: `ConfiguratorAPI.camera.*` у `Scripts/app-configuration/bridge/plugins/camera.plugin.mjs`

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
  dataUrl: string
}
```

`dataUrl` генерується тільки при першому читанні:

```javascript
const preview = shot.dataUrl;
```

Для вебшопа або backend upload краще використовувати `shot.blob`, бо він не роздуває пам'ять як base64.

### downloadHQSnapshot(presetOrOptions, filename)

Створює snapshot і одразу завантажує файл у браузері.

```javascript
await ConfiguratorAPI.camera.downloadHQSnapshot('hero', 'render.png');
```

**Повертає:** `Promise<boolean>`

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

### Завантажити 4K PNG

```javascript
await ConfiguratorAPI.camera.downloadHQSnapshot({
  out: 4096,
  format: 'image/png',
  bg: '#ffffff'
}, 'hastings-render.png');
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
6. Сервіс рахує AABB тільки по enabled render/model components.
7. Камера фреймиться по `azimuth/elevation/margin`.
8. Сцена рендериться offscreen у supersampled resolution.
9. Пікселі читаються через texture readback, перевертаються по Y і downscale-яться у фінальний canvas.
10. Результат повертається як `Blob` плюс lazy `dataUrl`.

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
| `ConfiguratorAPI.camera.captureHQSnapshot()` | PDF, quote, вебшоп, backend upload, фінальний клієнтський render |
| `ConfiguratorAPI.camera.downloadHQSnapshot()` | Ручна перевірка або експорт файлу з консолі |

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
