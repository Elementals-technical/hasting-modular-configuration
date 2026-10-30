# Архітектура

> Архітектурний намір ADR-0001/0005 **відновлено з коду, потребує підтвердження власником**: вихідний текст ADR не знайдено. Докази поточного розділення й бар'єра: [index.mjs:1](../index.mjs#L1), [playcanvas/index.mjs:1](../playcanvas/index.mjs#L1), [runtime/instance.mjs:284](../runtime/instance.mjs#L284).

## Межа відповідальності

Модуль описує рух у двох координатах `u/v`, сітку, межі, семантичне притягання й спостереження колізій; `defineManipulable` приймає frame, motion, snapping і collision. [spec/define.mjs:249](../spec/define.mjs#L249), [core/motion/planner.mjs:274](../core/motion/planner.mjs#L274), [core/collision/observation.mjs:97](../core/collision/observation.mjs#L97)

Поточний контракт не реалізує блокування руху колізією: валідатор приймає лише `observe`, а рух застосовується до обчислення вердикту. [core/contracts/validators.mjs:233](../core/contracts/validators.mjs#L233), [runtime/instance-motion.mjs:203](../runtime/instance-motion.mjs#L203) Поза зберігає лише `offsetM {u,v}` і `pivotWorldM`, драйвер PlayCanvas змінює позицію, а не орієнтацію. [runtime/reports.mjs:39](../runtime/reports.mjs#L39), [playcanvas/entity-group-pose.mjs:24](../playcanvas/entity-group-pose.mjs#L24) Контурний рух `rail`, блокування й поворот підтверджені власником як майбутні задачі; їхній контракт поки ⚠ припущення.

## Шари та напрям імпортів

`core/` містить контракти, motion, snapping і collision; його алгоритми працюють із plain-data DTO. [core/motion/planner.mjs:1](../core/motion/planner.mjs#L1), [core/snapping/resolver.mjs:1](../core/snapping/resolver.mjs#L1), [core/collision/aabb.mjs:1](../core/collision/aabb.mjs#L1) `spec/` перевіряє конфігурацію і збирає геометрію із scene/measure. [spec/define.mjs:249](../spec/define.mjs#L249), [spec/compile.mjs:99](../spec/compile.mjs#L99) `runtime/` володіє World, instance, FIFO та jobs. [runtime/world.mjs:89](../runtime/world.mjs#L89), [runtime/instance.mjs:45](../runtime/instance.mjs#L45) `playcanvas/` створює необов'язкові адаптери й імпортує World. [playcanvas/world.mjs:18](../playcanvas/world.mjs#L18) `index.mjs` не імпортує `playcanvas/`, тоді як `playcanvas/index.mjs` публікує адаптер. [index.mjs:5](../index.mjs#L5), [playcanvas/index.mjs:8](../playcanvas/index.mjs#L8)

```text
host scene / pointer
    │
    ├── playcanvas/input.mjs → projection.sample() → frame UV + CSS-px basis
    │                                  │
    └── runtime/world.mjs ────────────┼── instance.updateGesture()
                                       │       │
                                       │       ├── resolveGestureAxes() (Alt)
                                       │       ├── GeometryPort.readSnapSnapshot()
                                       │       ├── resolveSnapV1() + latch
                                       │       └── createMotionPlanV1()
                                       │              axis-freeze → semantic-snap → grid → bounds
                                       │                     │
                                       │                PosePort.apply() → driver.write()
                                       │                     │
                                       └─────────────── collision snapshot → AABB verdict
                                                             │
                                               motionapplied → handle change/collision/guides
```

Це саме порядок у реалізації: router формує `requestedOffsetM` і викликає `updateGesture`; instance читає snap, викликає planner, застосовує pose й читає колізію, після чого публікує `motionapplied`; World переводить її у `change`. [playcanvas/input.mjs:299](../playcanvas/input.mjs#L299), [runtime/instance-gesture.mjs:281](../runtime/instance-gesture.mjs#L281), [runtime/instance-motion.mjs:168](../runtime/instance-motion.mjs#L168), [runtime/instance-motion.mjs:301](../runtime/instance-motion.mjs#L301), [runtime/world.mjs:386](../runtime/world.mjs#L386)

`axis-freeze → semantic-snap → grid → bounds` заданий послідовними блоками planner; корекція додається до звіту лише тоді, коли змінила координату. [core/motion/planner.mjs:257](../core/motion/planner.mjs#L257), [core/motion/planner.mjs:279](../core/motion/planner.mjs#L279), [core/motion/planner.mjs:282](../core/motion/planner.mjs#L282), [core/motion/planner.mjs:298](../core/motion/planner.mjs#L298), [core/motion/planner.mjs:314](../core/motion/planner.mjs#L314) Семантично притягнута вісь не округлюється сіткою під час drag. [core/motion/planner.mjs:300](../core/motion/planner.mjs#L300), [core/motion/grid.mjs:166](../core/motion/grid.mjs#L166)

## Ревізії та захист від застарілих результатів

| Маркер | Хто змінює | Для чого перевіряється |
|---|---|---|
| `bindingGeneration` | World встановлює `1` при реєстрації; новий binding має більшу generation. | Поза й геометрія не можуть перейти між прив'язками. [runtime/world.mjs:213](../runtime/world.mjs#L213), [runtime/lifecycle.mjs:207](../runtime/lifecycle.mjs#L207), [runtime/pose-driver.mjs:46](../runtime/pose-driver.mjs#L46) |
| `policyRevision` | Instance піднімає після patch frame/motion/snap profile/thresholds/collision profile. | Жест з іншою політикою стає stale; jobs superseded. [runtime/lifecycle.mjs:103](../runtime/lifecycle.mjs#L103), [runtime/instance-geometry.mjs:271](../runtime/instance-geometry.mjs#L271), [runtime/gesture.mjs:166](../runtime/gesture.mjs#L166) |
| `poseRevision` | PosePort піднімає тільки при фактичній зміні offset. | Plan і read мають збігатися з актуальною позою. [runtime/pose-driver.mjs:75](../runtime/pose-driver.mjs#L75), [runtime/pose-driver.mjs:93](../runtime/pose-driver.mjs#L93), [runtime/instance-support.mjs:265](../runtime/instance-support.mjs#L265) |
| `frameRevision` | World при створенні ставить `0`; повна заміна frame відбувається через config patch instance. | Жест/снап відхиляють старий frame. [runtime/world.mjs:157](../runtime/world.mjs#L157), [runtime/lifecycle.mjs:135](../runtime/lifecycle.mjs#L135), [runtime/gesture.mjs:173](../runtime/gesture.mjs#L173), [core/snapping/resolver.mjs:151](../core/snapping/resolver.mjs#L151) |
| `sourceGeometryRevision`, `targetSceneRevision` | World піднімає їх при `invalidate`; `sceneRevision` також піднімає `world.invalidate`. | Не приймати стару геометрію і скинути кеш вимірювань. [runtime/world.mjs:321](../runtime/world.mjs#L321), [runtime/world.mjs:536](../runtime/world.mjs#L536), [runtime/instance-geometry.mjs:461](../runtime/instance-geometry.mjs#L461) |
| `membershipRevision`, `queryRevision` | `refreshMembership` піднімає обидві. | Оновити участь тіл і ідентичність snap-запиту/latch. [runtime/world.mjs:345](../runtime/world.mjs#L345), [core/snapping/latch.mjs:44](../core/snapping/latch.mjs#L44), [core/snapping/resolver.mjs:348](../core/snapping/resolver.mjs#L348) |
| `projectionRevision` | Проєкція змінює після зміни camera/clip/rect/canvas fingerprint. | Router перебазовує anchor без pose write. [playcanvas/projection.mjs:131](../playcanvas/projection.mjs#L131), [playcanvas/projection.mjs:184](../playcanvas/projection.mjs#L184), [playcanvas/input.mjs:348](../playcanvas/input.mjs#L348) |

`frameRevision` має приходити від хоста в повному frame patch; у World handle немає `setFrame`. Це обмеження поточного фасаду, а політика нового frame позначена ⚠ припущення до узгодження з власником. [runtime/world.mjs:417](../runtime/world.mjs#L417), [runtime/lifecycle.mjs:22](../runtime/lifecycle.mjs#L22)

## Сліди legacy parity

Адаптер явно згадує попередній `countertop-drag` як власника вводу, `_handleServiceChange` як прецедент для публікації змін, `projectScreenToWorldXY` для ray/plane проєкції та `_getAxisBasis` для screen-space осей. Це локальні коментарі сумісності, а не достатнє джерело для відновлення повного legacy-контракту. [playcanvas/input.mjs:10](../playcanvas/input.mjs#L10), [playcanvas/input.mjs:24](../playcanvas/input.mjs#L24), [playcanvas/projection.mjs:17](../playcanvas/projection.mjs#L17), [playcanvas/projection.mjs:300](../playcanvas/projection.mjs#L300)

## Жест і відкладені дії

Instance виконує прийняті команди через FIFO; `whenSettled()` чекає watermark прийнятих команд і дочірні jobs. [runtime/queue.mjs:18](../runtime/queue.mjs#L18), [runtime/instance.mjs:284](../runtime/instance.mjs#L284), [runtime/jobs.mjs:66](../runtime/jobs.mjs#L66) World відкладає `invalidate`, `refreshMembership` і `rebasePose` під активним жестом; повторна дія одного виду замінює попередню, а `invalidate` при завершенні має пріоритет над rebase/membership. [runtime/world.mjs:313](../runtime/world.mjs#L313), [runtime/world.mjs:352](../runtime/world.mjs#L352), [runtime/world.mjs:357](../runtime/world.mjs#L357) Core відхиляє refresh/invalidate захопленої геометрії під жестом, тому відкладання запобігає порушенню зафіксованого scope. [runtime/instance-geometry.mjs:364](../runtime/instance-geometry.mjs#L364), [runtime/instance-geometry.mjs:537](../runtime/instance-geometry.mjs#L537)
