import { measureEntityBoundsM } from '../../spatial-manipulation/playcanvas/scene-measure.mjs';

const ROOM_ROOT_NAME = 'Room1_Point';
const ROOM_FLOOR_NAME = 'Floor_R1';
const FLOOR_COLLIDER_ID = 'Floor_R1';
/** Room drop per collection id, metres (negative = room goes down). Runtime ids and UI ids. */ const ROOM_OFFSETS_BY_COLLECTION_M = Object.freeze({
    ULH: -0.6,
    'urban-low-height': -0.6,
    mako: -0.28
});
/** The floor collider reaches this far below the floor top and sideways: anything under the floor collides. */ const FLOOR_COLLIDER_DEPTH_M = 100;
const FLOOR_COLLIDER_HALF_SPAN_M = 1000;
const finite = (value)=>typeof value === 'number' && Number.isFinite(value);
const authoredY = new WeakMap();
const roomOffsetForCollection = (collectionId)=>ROOM_OFFSETS_BY_COLLECTION_M[collectionId] ?? 0;
/** Moves the room root to its authored local Y + offsetM. Returns false when the scene has no room. */ function applyRoomOffset(app, offsetM) {
    const root = app?.root?.findByName?.(ROOM_ROOT_NAME);
    if (!root || !finite(offsetM)) return false;
    const local = root.getLocalPosition();
    if (!authoredY.has(root)) authoredY.set(root, local.y);
    root.setLocalPosition(local.x, authoredY.get(root) + offsetM, local.z);
    return true;
}
const resetRoomOffset = (app)=>applyRoomOffset(app, 0);
/**
 * The floor as a collision body: everything below the floor top. Null when the scene has no
 * measurable floor (then no floor collision is reported).
 */ function measureFloorColliderBox(app) {
    try {
        const floor = app?.root?.findByName?.(ROOM_FLOOR_NAME);
        if (!floor || floor.enabled === false) return null;
        const measured = measureEntityBoundsM(floor);
        const topY = measured?.maxM?.y;
        if (!finite(topY)) return null;
        const span = FLOOR_COLLIDER_HALF_SPAN_M;
        return Object.freeze({
            minM: Object.freeze({
                x: -span,
                y: topY - FLOOR_COLLIDER_DEPTH_M,
                z: -span
            }),
            maxM: Object.freeze({
                x: span,
                y: topY,
                z: span
            })
        });
    } catch  {
        return null;
    }
}
/**
 * Who decides the room height. The UI (ConfiguratorAPI.room.setCollection) wins once it has spoken;
 * until then the modular runtime's active collection (first ULH-* cabinet) is used.
 */ const controllers = new WeakMap();
function roomController(app) {
    if (!app) return null;
    let state = controllers.get(app);
    if (!state) controllers.set(app, state = {
        external: undefined,
        runtime: null
    });
    const effective = ()=>state.external !== undefined ? state.external : state.runtime;
    const sync = ()=>applyRoomOffset(app, roomOffsetForCollection(effective()));
    return Object.freeze({
        /** UI: the open collection id ('urban-low-height', 'class', …) or null for none. */ setCollection (collectionId) {
            if (collectionId !== null && typeof collectionId !== 'string') throw new TypeError('collectionId must be a string or null');
            state.external = collectionId;
            sync();
            return this.getState();
        },
        /** UI: hand the decision back to the scene content (the modular runtime). */ clearCollection () {
            state.external = undefined;
            sync();
            return this.getState();
        },
        /** Modular runtime: the collection that owns the composition (null when released). */ setRuntimeCollection (collectionId) {
            state.runtime = collectionId ?? null;
            sync();
        },
        getState () {
            const root = app.root?.findByName?.(ROOM_ROOT_NAME);
            return Object.freeze({
                collectionId: effective() ?? null,
                source: state.external !== undefined ? 'external' : state.runtime ? 'runtime' : 'none',
                offsetM: roomOffsetForCollection(effective()),
                roomLocalY: root ? root.getLocalPosition().y : null
            });
        }
    });
}

export { FLOOR_COLLIDER_ID, ROOM_FLOOR_NAME, ROOM_OFFSETS_BY_COLLECTION_M, ROOM_ROOT_NAME, applyRoomOffset, measureFloorColliderBox, resetRoomOffset, roomController, roomOffsetForCollection };
