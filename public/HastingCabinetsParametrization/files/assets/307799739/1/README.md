# Countertop service

Цей модуль виносить логіку стільниці в окремий доменний шар. Сервіс не рухає PlayCanvas entities напряму. Він зберігає стан стільниці, приймає команди від API або input adapter, а фізичні зміни сцени виконують adapters.

Основний потік:

```text
Composition rules
  -> CountertopCompositionAdapter
  -> CountertopService state
  -> AssemblyAdapter / GeometryAdapter / InputAdapter / OutlineAdapter
  -> PlayCanvas entities, SmartStretch, MeshBoolean
```

## Архітектурний патерн

Модуль побудований за схемою `policy -> service -> adapters`.

- `countertop-policy.mjs`, `countertop-layout-policy.mjs`, `countertop-validation.mjs` - чиста доменна логіка. Вона рахує позицію, довжину, attachment/validation state і не читає PlayCanvas scene.
- `countertop-state.mjs` - immutable snapshot стану в метрах. Він є єдиною формою правди для service.
- `countertop-service.mjs` - керує state transitions, events, async settle/cancel flow і restore. Він не знає, як саме пересунути mesh.
- `adapters/*` - перетворюють доменний state у PlayCanvas дії: рух entities, SmartStretch, MeshBoolean, outline, dimensions, mouse/touch input.
- `index.mjs` - public exports для інших runtime модулів.

Цей поділ важливий, бо помилки в математиці можна тестувати окремо від renderer/input, а scene-specific код не протікає в API.

## State

`createCountertopStateM()` створює стан стільниці у метрах (`M`):

```js
{
  layoutMode,        // "standard" або "drag"
  interactionState,  // "idle", "selected", "editing", "dragging"
  basePositionM,     // стандартна позиція від composition rules
  offsetM,           // ручне зміщення від basePositionM
  positionM,         // basePositionM + offsetM у drag mode
  baseLengthM,       // автоматична довжина від тумб
  customLengthM,     // ручна довжина, якщо задана
  sizeM,             // фактичний розмір
  thicknessM,
  validation
}
```

Назовні, через `ConfiguratorAPI.countertop`, основний snapshot і `setSize()` зберігають inch-facing контракт. Movement-команди `setOffset()`, `setMovementBounds()`, `setMovementGrid()`, `moveBy()` і `resetPosition()` приймають сантиметри без поля `unit`; конвертація cm -> m виконується тільки в bridge plugin. Внутрішній runtime використовує метри, бо PlayCanvas scene працює в метрах.

## Layout modes

Є два режими layout:

- `standard` - стільниця прив'язана до автоматичного layout тумб. Позиція дорівнює `basePositionM`, довжина дорівнює `baseLengthM`.
- `drag` - користувач може редагувати стільницю. Позиція дорівнює `basePositionM + offsetM`, довжина може бути `customLengthM`.

Attachment state рахується з offset:

- `attached` - offset майже нульовий або режим `standard`.
- `detached` - у `drag` mode є ручне зміщення.

## Service lifecycle

`CountertopService` створюється тільки коли `CountertopCompositionAdapter` має готовий layout binding: активну composition, product id стільниці, root entity, `TopSolid` mesh, base position і base length.

Основні команди:

```js
setLayoutMode("drag")
setOffsetM({ x, y })
setMovementGridM({ x, y })
resetPosition()
setLengthM(lengthM)
setSelected(true)
setEditing(true)
beginMove()
updateMoveM(offsetM)
endMove()
cancelMove()
validate()
whenSettled()
restoreStateM(intentM)
```

Service змінює state і викликає injected callbacks з composition adapter:

```js
applyCountertopStateM(stateM, metadata)
whenCountertopSettled()
validateCountertopStateM(stateM, metadata)
cancelCountertopWork(metadata)
```

Так service лишається доменним власником state, а PlayCanvas mutation лишається в adapters.

## Drag flow

Переміщення починається не одразу на `mousedown`, а після screen threshold у `CountertopInputAdapter`.

```text
mousedown/touchstart на countertop
  -> reserve gesture ownership
mousemove/touchmove більше threshold
  -> service.beginMove()
  -> interactionState = "dragging"
кожен move
  -> screen point projected to world XY plane
  -> offsetM updated
  -> service.updateMoveM(offsetM)
mouseup/touchend
  -> service.endMove()
  -> interactionState повертається в "editing" або "selected"
```

`Alt` під час mouse drag блокує `Y` offset, тому рух іде тільки по `X`. Перемикання Alt rebases anchor, щоб не було стрибка позиції.

Gesture ownership знаходиться в `services/input/gesture-ownership.mjs`. Воно дозволяє countertop drag заблокувати camera orbit і selection на час активного жесту.

## Composition binding

`CountertopCompositionAdapter` є містком між старими composition rules і новим countertop service.

Він робить такі кроки:

- приймає standard layout з `RuleCountertopWidth`;
- через `resolveCountertopAssembly()` знаходить countertop root, `TopSolid`, sinks і cutters;
- створює `CountertopService`;
- підключає `AssemblyAdapter`, `GeometryAdapter`, `InputAdapter`, `OutlineAdapter`, `EditOverlay`, `DimensionAdapter`;
- синхронізує selection tool із service state;
- чекає завершення geometry/boolean робіт через `whenSettled()`.

Якщо active composition або countertop identity змінюється, adapter робить reset і створює нове binding покоління. Старі async операції відкидаються через revision/generation checks.

## Assembly movement

`CountertopAssemblyAdapter` застосовує ручний offset у world space.

Він спочатку запам'ятовує standard world positions для top-level transform targets, а потім застосовує absolute offset:

```js
entity.setPosition(
  base.x + offsetM.x,
  base.y + offsetM.y,
  base.z
);
```

`Z` не рухається. Ручне переміщення працює тільки в `X/Y`.

Resolver спеціально вибирає top-level transform targets, щоб не рухати одночасно parent і child з тим самим offset. Це захищає від подвійного зміщення sink/cutter.

## Length and boolean geometry

`CountertopGeometryAdapter` відповідає за довжину стільниці.

Зміна довжини проходить так:

```text
effectiveLengthM
  -> stretchXM = effectiveLengthM - intrinsicLengthM
  -> smartStretch.stretchAmount.x = stretchXM
  -> smartStretch.updateGeometry()
  -> meshBoolean.requestBoolean()
  -> whenSettled()
```

Довжина не змінюється scale-ом root entity. Вона йде через `SmartStretch`, після чого `MeshBoolean` перебудовує cutouts.

`RuleCountertopBooleanCutouts` знаходить `BoolB_*` cutters у тумбах/мийках і передає їх у composition adapter. Для `Vessel` sink використовується template `Vessel_BoolCut`, з якого створюються стабільні clones:

```text
Vessel_BoolCut_Clone_0
Vessel_BoolCut_Clone_1
```

Ці clones перевикористовуються між aggregation retries, щоб не накопичувати зайві helper entities.

## Outline and selection

`CountertopOutlineAdapter` перетворює countertop state у semantic outline state для `SelectTool`:

```text
validation invalid -> red outline
editing/dragging valid -> green outline
selected -> yellow outline
idle -> no semantic override
```

Outline adapter не створює renderer. Він тільки викликає public API selection tool:

```js
selectTool.setEntitySemanticState(target, semanticState)
selectTool.clearEntitySemanticState(target)
```

Це зберігає один ownership boundary: selection/outline renderer лишається власністю `SelectTool`.

## Public API

Bridge plugin `bridge/plugins/countertop.plugin.mjs` відкриває same-runtime API:

```js
ConfiguratorAPI.countertop.getState()
ConfiguratorAPI.countertop.setLayoutMode("drag")
ConfiguratorAPI.countertop.setOffset({ x, y })
ConfiguratorAPI.countertop.setSize({ length, unit: "inch" })
ConfiguratorAPI.countertop.setMovementBounds({
  x: { min: -30, max: 30 },
  y: { min: -10, max: 20 }
})
ConfiguratorAPI.countertop.setMovementGrid({ x: 2, y: 2 })
ConfiguratorAPI.countertop.moveBy({ x: -2.54, y: 0 })
ConfiguratorAPI.countertop.resetPosition()
ConfiguratorAPI.countertop.setEditing(true)
ConfiguratorAPI.countertop.validate()
ConfiguratorAPI.countertop.whenSettled()
ConfiguratorAPI.countertop.restoreState(state)
ConfiguratorAPI.countertop.on("change", callback)
ConfiguratorAPI.countertop.on("action", callback)
```

Legacy size/restore boundary приймає inches, перевіряє payload shape і повертає sanitized snapshot. Movement API є centimeter-only: усі числа в payload трактуються як centimeters, поле `unit` не підтримується, а конвертація cm -> m виконується тільки в bridge plugin. Відсутня вісь у bounds означає unbounded axis; якщо вісь передана, `min` і `max` обов'язкові, finite і `min <= max`. Відсутня вісь у grid означає unsnapped axis; порожній grid `{}` вимикає snapping.

`canMove` у public snapshot має directional shape:

```js
{
  left: true,
  right: false,
  up: true,
  down: true
}
```

Це derived UI-поле. Full restore payload може містити `canMove`, але restore не відновлює його і застосовує тільки versioned intent: `layoutMode`, `offset` і `customLength`.

PlayCanvas entities, service internals і mutable objects не виходять за межу bridge.

## Commit boundaries

Countertop feature краще комітити окремими частинами:

- selection/outline foundation;
- countertop domain service and policies;
- composition adapters and input movement;
- geometry/boolean integration;
- bridge API integration;
- generated exports або PlayCanvas sync output, якщо вони потрібні.

Перед синхронізацією в PlayCanvas треба перевіряти runtime scripts:

```bash
node "$CODEX_HOME/skills/playcanvas-configurator/scripts/check-runtime-scripts.mjs" src
```
