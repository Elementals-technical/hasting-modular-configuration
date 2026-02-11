# SidePanelsService

Сервіс для управління бічними панелями (Side Panels) в 3D конфігураторі.

## Константи

### COUNTERTOP_OFFSET_VALUE

Значення зміщення стільниці при наявності side panel: `0.5 / 100` метрів (0.005м або 0.5см).

Використовується в `calculateCountertopOffset()` для розрахунку offset стільниці.

## Призначення

Відповідає за всю логіку пов'язану з side panels:
- Встановлення типів панелей для конкретних шаф
- Автоматичне визначення сторони (ліва/права) за позицією шафи
- Створення, оновлення та видалення панелей
- Синхронізацію параметрів панелей з шафами
- Розрахунок offset для стільниці

## API

### setSidePanelType(type, cabinetId)

Встановлює тип side panel для конкретної шафи. Автоматично визначає чи це ліва/права панель залежно від позиції шафи.

**Параметри:**
- `type` - Тип панелі: `'None'`, `'UpperG'`, `'CenterG'`, `'DoubleG'`, `'NoG'`
- `cabinetId` - ID шафи (повинна бути крайньою - лівою або правою)

**Повертає:** `Promise<boolean>` - успішність операції

**Приклади:**
```javascript
// Встановити панель для крайньої лівої шафи
await sidePanelsService.setSidePanelType('UpperG', 'Cabinet_1');

// Встановити панель для крайньої правої шафи  
await sidePanelsService.setSidePanelType('CenterG', 'Cabinet_5');

// Видалити панель
await sidePanelsService.setSidePanelType('None', 'Cabinet_1');
```

### ensureSidePanelsExist(composition)

Перевіряє чи існують side panels, якщо ні - створює їх при наявності хоча б однієї шафи. Використовує збережені глобальні типи панелей.

**Параметри:**
- `composition` - Активна композиція (CompositionStore)

**Повертає:** `Promise<void>`

### createSidePanel(productType, panelType, composition, referenceCabinetId)

Створює side panel з синхронізацією параметрів (глибина, висота, колір) з референтною шафою.

**Параметри:**
- `productType` - `'SidePanel_Left'` або `'SidePanel_Right'`
- `panelType` - Тип варіанту панелі (`'UpperG'`, `'CenterG'` тощо)
- `composition` - Композиція
- `referenceCabinetId` - (опціонально) ID шафи для отримання параметрів

**Повертає:** `Promise<void>`

### removeSidePanels(composition)

Видаляє всі side panels з композиції.

**Параметри:**
- `composition` - Композиція

**Повертає:** `void`

### calculateCountertopOffset(listSidePanel)

Розраховує зміщення стільниці по осі X в залежності від наявності side panels.

**Параметри:**
- `listSidePanel` - Масив конфігурацій side panels

**Повертає:** `number` - зміщення в метрах

**Константа:** Використовує `SidePanelsService.COUNTERTOP_OFFSET_VALUE = 0.5/100` метрів

**Логіка:**
- Якщо тільки ліва панель: `-COUNTERTOP_OFFSET_VALUE` (зміщення вліво)
- Якщо тільки права панель: `+COUNTERTOP_OFFSET_VALUE` (зміщення вправо)  
- Якщо обидві або жодної: `0` (без зміщення)

### syncPanelWithCabinet(panelId, cabinetConfig)

Синхронізує параметри панелі з конфігурацією шафи.

**Параметри:**
- `panelId` - ID панелі
- `cabinetConfig` - Конфігурація шафи

**Повертає:** `Promise<void>`

### getGlobalSidePanelTypes()

Отримує збережені глобальні типи side panels.

**Повертає:** `{ left: string, right: string }`

### setGlobalSidePanelTypes(leftType, rightType)

Встановлює глобальні типи side panels (для відновлення стану).

**Параметри:**
- `leftType` - Тип лівої панелі
- `rightType` - Тип правої панелі

## Інтеграція

Сервіс інтегрується в CompositionManager:

```javascript
import { SidePanelsService } from '../../services/side-panels/index.mjs';

// В initialize()
this.sidePanelsService = new SidePanelsService(this.app, this);
```

### Інтеграція з RuleCountertopWidth

RuleCountertopWidth використовує SidePanelsService для розрахунку offset стільниці:

```javascript
// В RuleCountertopWidth.applyFn()
const offsetX = compositionManager.sidePanelsService.calculateCountertopOffset(listSidePanel);
SceneTransformHelper.setLocalPosition(countertop, { x: calcResult.targetX + offsetX });
```

Константа `COUNTERTOP_OFFSET_VALUE` зберігається в SidePanelsService для централізації налаштувань.

## Використання через Bridge API

```javascript
// Встановлення панелі через bridge
window.ConfiguratorAPI.setSidePanelType('UpperG', 'Cabinet_1');

// Отримання крайніх шаф (через CompositionManager)
const edges = window.ConfiguratorAPI.getEdgeCabinets();
```

**Примітка:** `getEdgeCabinets()` знаходиться в CompositionManager, оскільки стосується логіки кабінетів, а не side panels.

## Архітектура

```
CompositionManager
    ↓ делегує
SidePanelsService
    ↓ використовує
ProductFactory, ProductRegistry_V2, LoggerService
```

Сервіс інкапсулює всю логіку side panels, забираючи ~250 рядків коду з CompositionManager, покращуючи модульність та тестованість системи.
