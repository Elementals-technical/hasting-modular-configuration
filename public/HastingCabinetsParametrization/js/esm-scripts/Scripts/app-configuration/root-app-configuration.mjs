import { Script } from '../../../playcanvas-stable.min.mjs';

function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
// Test runner (доступний через __runTests() в консолі браузера)
// import './tests/index.mjs';
/**
 * The {@link https://api.playcanvas.com/classes/Engine.Script.html | Script} class is
 * the base class for all PlayCanvas scripts. Learn more about writing scripts in the
 * {@link https://developer.playcanvas.com/user-manual/scripting/ | scripting guide}.
 */ class RootAppConfiguration extends Script {
    /**
     * Called when the script is about to run for the first time.
     */ initialize() {}
    /**
     * Called for enabled (running state) scripts on each tick.
     *
     * @param {number} dt - The delta time in seconds since the last frame.
     */ update(dt) {}
}
_define_property(RootAppConfiguration, "scriptName", 'rootAppConfiguration');

export { RootAppConfiguration };
