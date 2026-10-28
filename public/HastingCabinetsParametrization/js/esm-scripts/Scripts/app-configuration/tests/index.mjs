import { TestRunner } from './test-runner.mjs';
import { registerCabinetTests } from './suites/cabinet.test.mjs';
import { registerSidePanelTests } from './suites/side-panel.test.mjs';
import { registerTowelBarTests } from './suites/towel-bar.test.mjs';
import { registerDividerTests } from './suites/divider.test.mjs';
import { registerSideShelfDebugTests } from './suites/side-shelf-debug.test.mjs';
import { registerDrawerIndicatorTests } from './suites/drawer-indicator.test.mjs';
import { registerDimensionsTests } from './suites/dimensions.test.mjs';
import { registerHandleGrooveTests } from './suites/handle-groove.test.mjs';

/**
 * Test Runner для PlayCanvas Configurator.
 *
 * Запуск з консолі браузера:
 *   await __runTests();              // всі тести
 *   await __runTests('Cabinet');      // тільки Cabinet
 *   await __runTests('SidePanel');    // тільки SidePanel
 *   await __runTests('TowelBar');    // тільки TowelBar
 *   await __runTests('Divider');     // тільки Divider
 *   __testRunner.list();             // список suites
 */ const runner = new TestRunner();
// Реєструємо test suites
registerCabinetTests(runner);
registerSidePanelTests(runner);
registerTowelBarTests(runner);
registerDividerTests(runner);
registerSideShelfDebugTests(runner);
registerDrawerIndicatorTests(runner);
registerDimensionsTests(runner);
registerHandleGrooveTests(runner);
// Expose to browser console
window.__runTests = (suite)=>runner.run(suite);
window.__testRunner = runner;
console.log('%c[TestRunner] Ready. Use __runTests() to run tests.', 'color: #00AAFF; font-weight: bold;');
console.log(`  Suites: ${runner.list().join(', ')}`);
