import { SPATIAL_MANIPULATION_EVENT } from '../core/contracts/constants.mjs';
import { throwSpatialInvalidInput } from '../core/contracts/errors.mjs';
import { deepFreeze } from '../core/contracts/immutable.mjs';

const EVENT_NAMES = new Set(Object.values(SPATIAL_MANIPULATION_EVENT));
const copyPlainData = (value)=>{
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(copyPlainData);
    }
    const copy = {};
    for (const key of Object.keys(value)){
        copy[key] = copyPlainData(value[key]);
    }
    return copy;
};
const assertEventName = (event)=>{
    if (!EVENT_NAMES.has(event)) {
        throwSpatialInvalidInput('event');
    }
};
const createSpatialEventBusV1 = ()=>{
    const listeners = new Map([
        ...EVENT_NAMES
    ].map((event)=>[
            event,
            new Set()
        ]));
    const on = (event, callback)=>{
        assertEventName(event);
        if (typeof callback !== 'function') {
            throwSpatialInvalidInput('callback');
        }
        listeners.get(event).add(callback);
        return ()=>off(event, callback);
    };
    const off = (event, callback)=>{
        assertEventName(event);
        if (callback === undefined) {
            listeners.get(event).clear();
            return;
        }
        if (typeof callback !== 'function') {
            throwSpatialInvalidInput('callback');
        }
        listeners.get(event).delete(callback);
    };
    const publish = (event)=>{
        assertEventName(event?.event);
        const frozenEvent = deepFreeze(copyPlainData(event));
        for (const callback of [
            ...listeners.get(frozenEvent.event)
        ]){
            try {
                callback(frozenEvent);
            } catch  {
            // Listener failures are isolated by contract; adapters may log separately.
            }
        }
        return frozenEvent;
    };
    const clear = ()=>{
        for (const set of listeners.values()){
            set.clear();
        }
    };
    return Object.freeze({
        on,
        off,
        publish,
        clear
    });
};

export { createSpatialEventBusV1 };
