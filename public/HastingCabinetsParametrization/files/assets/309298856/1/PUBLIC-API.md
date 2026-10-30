# Публічний API

> Оригінальний `public-api.md` не знайдено: цей контракт **відновлено з коду, потребує підтвердження власником**. Тут розділено зручний `World`/handle і нижчорівневий `instance`; змішувати їхні payload не слід. [runtime/world.mjs:89](../runtime/world.mjs#L89), [runtime/instance.mjs:298](../runtime/instance.mjs#L298)

## Специфікація

`defineManipulable(spec)` повертає нормалізовану заморожену специфікацію; невідомі ключі та невалідні значення кидають `TypeError` з `code = SPATIAL_INVALID_SPEC` і `path`. Повторний виклик із уже нормалізованою специфікацією повертає її без змін. [spec/define.mjs:34](../spec/define.mjs#L34), [spec/define.mjs:249](../spec/define.mjs#L249)

| Ключ | Тип і значення за замовчуванням |
|---|---|
| `id` | Обов'язковий непорожній рядок. [spec/define.mjs:253](../spec/define.mjs#L253) |
| `frame` | `'xy'` за замовчуванням; також `'xz'`, `'zy'`, `{plane, origin?}`, `{originM,uAxis,vAxis,normal?}` або функція `(ctx) => frame`. `normal` для явних осей обчислюється векторним добутком, якщо пропущений. [spec/define.mjs:27](../spec/define.mjs#L27), [spec/define.mjs:50](../spec/define.mjs#L50) |
| `motion` | `{axes, boundsM, gridM, gridOriginM, dragHysteresisRatio}`; осі за замовчуванням `['u','v']`, межі/сітка порожні, початок сітки `{u:0,v:0}`, гістерезис `0.1`. `boundsM.u/v` — `{min,max}` у метрах, `gridM.u/v` — додатний крок у метрах. [spec/define.mjs:89](../spec/define.mjs#L89), [spec/define.mjs:24](../spec/define.mjs#L24) |
| `target` | `{entities?,pick?,pose?}`: функції від `ctx`; усі опційні. [spec/define.mjs:240](../spec/define.mjs#L240) |
| `snapping` | `null`/`false` вимикає канал. Інакше `{enabled=true, thresholds, features, rules}` з непорожніми `features` і `rules`. `features[name] = {select='self', extract, when?}`; `select` приймає `self`/`others`/`all`, selector або predicate. [spec/define.mjs:117](../spec/define.mjs#L117), [spec/define.mjs:183](../spec/define.mjs#L183), [spec/selectors.mjs:49](../spec/selectors.mjs#L49) |
| `snapping.thresholds` | Для `mouse`: engage/release/switchMargin/tieEpsilon = `8/14/2/0.5` CSS px; для `touch`: `12/22/2/0.5`. [spec/define.mjs:20](../spec/define.mjs#L20), [spec/define.mjs:107](../spec/define.mjs#L107) |
| `snapping.rules[]` | `{id, from, to, op, priority=0, when='none', epsilonM=1e-9, bundle?, onlyWhenFrozen?}`. `from`/`to` — роль або масив ролей; `op` — `align-u`, `align-v`, `coincide-uv`; `when` — `none`, `overlap-u`, `abut-u` або нормалізований `{kind,epsilonM}`; `bundle` має `family`, `compatible?`, `retainOverProjection?`. [spec/define.mjs:13](../spec/define.mjs#L13), [spec/define.mjs:145](../spec/define.mjs#L145) |
| `collision` | `null`/`false` вимикає канал. Інакше `{enabled=true, epsilonM=1e-6, source='bounds', against, volumes='bounds', roles?}`; `against` обов'язковий selector; `source`/`volumes` — `'bounds'` або resolver `(body,ctx) => profile|null`; `roles` — список або функція. [spec/define.mjs:26](../spec/define.mjs#L26), [spec/define.mjs:208](../spec/define.mjs#L208), [spec/define.mjs:214](../spec/define.mjs#L214) |

`ctx` містить `host`, `self`, `scene`, `world`, `objectId`, `instanceId` для World; `scene.bodies()` постачає тіла. [runtime/world.mjs:147](../runtime/world.mjs#L147), [runtime/world.mjs:105](../runtime/world.mjs#L105) Ролі фіч за замовчуванням мають вигляд `<group>.<key>`, де `key` видає extractor. [spec/extractors.mjs:4](../spec/extractors.mjs#L4), [spec/compile.mjs:99](../spec/compile.mjs#L99)

## World і handle

`createSpatialWorld({scene,measure,engine={},worldSpaceId='world',onError=null})` вимагає `scene.bodies()` та `measure.bounds()`. `world.register(spec,{body,host={},id?,canDrag?})` асинхронно створює handle; типовий ID — `${spec.id}:${body}`. `world.get(id)`, `list()`, `invalidate(reason?)`, `whenSettled()`, `destroy()` і `sceneRevision` доступні на World. [runtime/world.mjs:89](../runtime/world.mjs#L89), [runtime/world.mjs:141](../runtime/world.mjs#L141), [runtime/world.mjs:529](../runtime/world.mjs#L529)

Для PlayCanvas `getSpatialWorld(app, options)` кешує один World на `app`; `createPlayCanvasSpatialWorld(app, {scene,hitTest?,getCamera?,onError?,window?})` створює адаптований World. [playcanvas/world.mjs:39](../playcanvas/world.mjs#L39), [playcanvas/world.mjs:118](../playcanvas/world.mjs#L118)

| Handle | Поточний ефект |
|---|---|
| `getState()` | Копія `offsetM`, дозволених осей, bounds/grid, станів snap/collision і `dragging`. Для повного state використовуйте `handle.instance.getState()` / `getSpatialState()`. [runtime/world.mjs:425](../runtime/world.mjs#L425), [runtime/instance.mjs:88](../runtime/instance.mjs#L88) |
| `setOffset({u?,v?},{constraint='respect'}?)`, `moveBy({u?,v?},options?)` | Promise зі звітом руху; пропущені координати зберігаються/мають нульовий delta. `constraint:'bypass'` пропускає grid/bounds, але не змінює стандартну позу. [runtime/world.mjs:440](../runtime/world.mjs#L440), [runtime/instance-motion.mjs:168](../runtime/instance-motion.mjs#L168) |
| `reset(offsetM={u:0,v:0})` | Встановлює offset у режимі `bypass`. [runtime/world.mjs:451](../runtime/world.mjs#L451) |
| `setMotion({axes?,boundsM?,gridM?})` | Patch; `null` очищує bounds/grid. Застосовується через `configure()` і `refreshGeometry()`. [runtime/world.mjs:455](../runtime/world.mjs#L455) |
| `setSnapping(enabled)`, `setCollision(enabled)` | Перемикає канал, якщо він оголошений у spec, і refresh геометрії. [runtime/world.mjs:461](../runtime/world.mjs#L461) |
| `refreshMembership()`, `invalidate(reason?)`, `rebasePose(options?)` | Оновлення участі, геометрії або базової пози; World відкладає їх під час активного жесту. [runtime/world.mjs:313](../runtime/world.mjs#L313), [runtime/world.mjs:469](../runtime/world.mjs#L469) |
| `suspendPose()` | Синхронно знімає offset на час зміни layout; повертає `false` під час жесту. [runtime/world.mjs:489](../runtime/world.mjs#L489) |
| `whenSettled()` | Чекає прийняті команди та jobs. [runtime/world.mjs:501](../runtime/world.mjs#L501), [runtime/instance.mjs:284](../runtime/instance.mjs#L284) |
| `destroy({restoreStandard=false}?)` | Від'єднує input, звільняє lease/driver і слухачів; повторний виклик безпечний. [runtime/world.mjs:502](../runtime/world.mjs#L502) |
| `on(name,callback)`, `off(name,callback)` | Підписка на події handle. [runtime/world.mjs:499](../runtime/world.mjs#L499) |

Нижчорівневий `handle.instance` надає `beginGesture`, `updateGesture`, `endGesture`, `cancelGesture`, `configure`, `refreshGeometry`, `setOffsetM`, `moveByM` тощо; для коду споживача зазвичай достатньо фасаду handle й input-адаптера. [runtime/instance.mjs:298](../runtime/instance.mjs#L298), [runtime/world.mjs:417](../runtime/world.mjs#L417)

## Події та звіти

Handle публікує `change {source,offsetM,snap,collision,state}`, `collision {status,collision}` лише при зміні статусу, `snap` із core `snapchange`, `gesturestart`, `gestureend`, `gesturecancel`, `error {stage,error}`. `change` не тотожна `snap`: під час жесту можуть змінюватися пари без події `snap` (див. [KNOWN-ISSUES.md](KNOWN-ISSUES.md)). [runtime/world.mjs:94](../runtime/world.mjs#L94), [runtime/world.mjs:368](../runtime/world.mjs#L368), [runtime/world.mjs:386](../runtime/world.mjs#L386), [runtime/instance-geometry.mjs:112](../runtime/instance-geometry.mjs#L112)

Core instance публікує `motionapplied`, `spatialchange`, `snapchange`, `collisionchange`, `gesturestart/end/cancel`, `lifecyclechange`. Подія має `schemaVersion`, `event`, `instanceId`, `sequence`, опційні command/correlation/gesture ID, `reason`, `state`, інколи `report`. [core/contracts/constants.mjs:3](../core/contracts/constants.mjs#L3), [runtime/reports.mjs:191](../runtime/reports.mjs#L191)

Звіт `motionapplied` містить `source`, `reason`, `outcome`, `previousApplied`, `requested`, `planned`, `applied`, `actualDeltaM`, `corrections`, `snap`, `collision`, `diagnostics` і службові ID; applied pose містить `instanceId`, `bindingGeneration`, `poseRevision`, `offsetM`, `pivotWorldM`. [runtime/reports.mjs:39](../runtime/reports.mjs#L39), [runtime/reports.mjs:147](../runtime/reports.mjs#L147) `getState()` instance містить конфігурацію/binding/lifecycle/активний жест, а `getSpatialState()` — applied/lastMotion/snap/collision. [runtime/instance.mjs:88](../runtime/instance.mjs#L88)

Помилки core: `SPATIAL_INVALID_INPUT`, `SPATIAL_NOT_READY`, `SPATIAL_BUSY`, `SPATIAL_LEASE_CONFLICT`, `SPATIAL_STALE_BINDING`, `SPATIAL_STALE_FRAME`, `SPATIAL_STALE_POLICY`, `SPATIAL_STALE_GEOMETRY`, `SPATIAL_DEPENDENCY_CHANGED_AFTER_APPLY`, `SPATIAL_SUPERSEDED`, `SPATIAL_POSE_APPLY_FAILED`, `SPATIAL_DESTROYED`. Валідація spec окремо використовує `SPATIAL_INVALID_SPEC`. Фасад World приглушує частину очікуваних кодів у `error`-події, тож перевіряйте promise та state. [core/contracts/errors.mjs:1](../core/contracts/errors.mjs#L1), [spec/define.mjs:34](../spec/define.mjs#L34), [runtime/world.mjs:20](../runtime/world.mjs#L20), [runtime/world.mjs:99](../runtime/world.mjs#L99)
