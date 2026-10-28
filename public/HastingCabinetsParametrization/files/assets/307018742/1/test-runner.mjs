/**
 * Мінімальний test runner для PlayCanvas browser environment.
 * Використовує ConfiguratorAPI та pc.app для перевірок.
 *
 * Використання:
 *   await window.__runTests();           // всі
 *   await window.__runTests('SidePanel'); // конкретний suite
 */
export class TestRunner {
    constructor() {
        this._suites = new Map();
        this._results = [];
    }

    /**
     * Зареєструвати тест suite
     * @param {string} name
     * @param {Function} fn - async (ctx: TestContext) => void
     */
    suite(name, fn) {
        this._suites.set(name, fn);
    }

    /**
     * Запустити тести
     * @param {string} [suiteName] — конкретний suite або всі
     * @returns {Array} результати
     */
    async run(suiteName) {
        this._results = [];

        const suites = suiteName
            ? [[suiteName, this._suites.get(suiteName)]]
            : [...this._suites.entries()];

        for (const [name, suiteFn] of suites) {
            if (!suiteFn) {
                console.warn(`Suite "${name}" not found`);
                continue;
            }
            console.group(`📋 Suite: ${name}`);
            const ctx = new TestContext(name);
            try {
                await suiteFn(ctx);
            } catch (e) {
                console.error(`Suite "${name}" crashed:`, e);
            }
            this._results.push(...ctx.results);
            console.groupEnd();
        }

        this._printSummary();
        return this._results;
    }

    /**
     * Список зареєстрованих suites
     */
    list() {
        return [...this._suites.keys()];
    }

    _printSummary() {
        const passed = this._results.filter(r => r.status === 'pass').length;
        const failed = this._results.filter(r => r.status === 'fail').length;
        const total = this._results.length;

        console.log(`\n${'='.repeat(50)}`);

        if (failed === 0) {
            console.log(`%c✅ All ${total} tests passed`, 'color: green; font-weight: bold;');
        } else {
            console.log(`%c❌ ${failed}/${total} tests failed`, 'color: red; font-weight: bold;');
            console.group('Failed tests:');
            this._results
                .filter(r => r.status === 'fail')
                .forEach(r => console.error(`  ${r.suite} > ${r.name}: ${r.error}`));
            console.groupEnd();
        }
    }
}

class TestContext {
    constructor(suiteName) {
        this.suiteName = suiteName;
        this.results = [];
    }

    /**
     * Визначити тест
     * @param {string} name — назва тесту
     * @param {Function} fn — async (assert: Assertions) => void
     */
    async it(name, fn) {
        try {
            await fn(new Assertions());
            this.results.push({ suite: this.suiteName, name, status: 'pass' });
            console.log(`  ✅ ${name}`);
        } catch (e) {
            this.results.push({ suite: this.suiteName, name, status: 'fail', error: e.message });
            console.error(`  ❌ ${name}: ${e.message}`);
        }
    }

    /**
     * Reset сцени перед тестом
     */
    async reset() {
        // Скидаємо глобальний стан addons (щоб persistence не впливала на наступний тест)
        const cm = pc.app?.compositionManager;
        if (cm?.addonManager) {
            cm.addonManager.resetAll();
            cm.towelBarAddon?.resetColor();
        }

        if (window.ConfiguratorAPI?.removeAllProduct) {
            window.ConfiguratorAPI.removeAllProduct();
        }
        // Чекаємо достатньо для composition rules (async, waitForFrames(2))
        await TestContext.wait(500);
    }

    /**
     * Чекати N мс
     * @param {number} ms
     */
    static wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

/**
 * Assertions для перевірки PlayCanvas стану
 */
class Assertions {
    // ====== Базові ======

    equal(actual, expected, msg = '') {
        if (actual !== expected) {
            throw new Error(`${msg} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    }

    notEqual(actual, unexpected, msg = '') {
        if (actual === unexpected) {
            throw new Error(`${msg} Expected NOT ${JSON.stringify(unexpected)}`);
        }
    }

    notNull(value, msg = '') {
        if (value === null || value === undefined) {
            throw new Error(`${msg} Expected non-null, got ${value}`);
        }
    }

    isNull(value, msg = '') {
        if (value !== null && value !== undefined) {
            throw new Error(`${msg} Expected null, got ${value}`);
        }
    }

    isTrue(value, msg = '') {
        if (value !== true) {
            throw new Error(`${msg} Expected true, got ${value}`);
        }
    }

    isFalse(value, msg = '') {
        if (value !== false) {
            throw new Error(`${msg} Expected false, got ${value}`);
        }
    }

    closeTo(actual, expected, delta = 0.01, msg = '') {
        if (Math.abs(actual - expected) > delta) {
            throw new Error(`${msg} Expected ~${expected} (±${delta}), got ${actual}`);
        }
    }

    greaterThan(actual, expected, msg = '') {
        if (actual <= expected) {
            throw new Error(`${msg} Expected > ${expected}, got ${actual}`);
        }
    }

    lessThan(actual, expected, msg = '') {
        if (actual >= expected) {
            throw new Error(`${msg} Expected < ${expected}, got ${actual}`);
        }
    }

    // ====== Entity ======

    entityExists(name) {
        const entity = pc.app.root.findByName(name);
        if (!entity) throw new Error(`Entity "${name}" not found on scene`);
        return entity;
    }

    entityNotExists(name) {
        const entity = pc.app.root.findByName(name);
        if (entity) throw new Error(`Entity "${name}" should not exist but found`);
    }

    entityEnabled(name) {
        const entity = this.entityExists(name);
        if (!entity.enabled) throw new Error(`Entity "${name}" exists but disabled`);
        return entity;
    }

    /**
     * Порахувати entities що містять підрядок в імені
     */
    entityCount(nameIncludes, expected) {
        const all = pc.app.root.find(e => e.name.includes(nameIncludes));
        if (all.length !== expected) {
            throw new Error(
                `Expected ${expected} entities containing "${nameIncludes}", ` +
                `found ${all.length}: [${all.map(e => e.name).join(', ')}]`
            );
        }
        return all;
    }

    /**
     * Знайти першу entity за includes
     */
    findEntity(nameIncludes) {
        const entities = pc.app.root.find(e => e.name.includes(nameIncludes));
        if (entities.length === 0) throw new Error(`No entity containing "${nameIncludes}"`);
        return entities[0];
    }

    // ====== Position ======

    entityPositionX(name, expected, delta = 0.02) {
        const entity = this.entityExists(name);
        this.closeTo(entity.getPosition().x, expected, delta, `${name} pos.x:`);
    }

    entityPositionY(name, expected, delta = 0.02) {
        const entity = this.entityExists(name);
        this.closeTo(entity.getPosition().y, expected, delta, `${name} pos.y:`);
    }

    entityPositionZ(name, expected, delta = 0.02) {
        const entity = this.entityExists(name);
        this.closeTo(entity.getPosition().z, expected, delta, `${name} pos.z:`);
    }

    entityLeftOf(nameA, nameB) {
        const posA = this.entityExists(nameA).getPosition().x;
        const posB = this.entityExists(nameB).getPosition().x;
        if (posA >= posB) {
            throw new Error(`"${nameA}" (x=${posA.toFixed(3)}) should be left of "${nameB}" (x=${posB.toFixed(3)})`);
        }
    }

    entityRightOf(nameA, nameB) {
        const posA = this.entityExists(nameA).getPosition().x;
        const posB = this.entityExists(nameB).getPosition().x;
        if (posA <= posB) {
            throw new Error(`"${nameA}" (x=${posA.toFixed(3)}) should be right of "${nameB}" (x=${posB.toFixed(3)})`);
        }
    }

    // ====== Rotation ======

    entityRotationY(name, expected, delta = 1) {
        const entity = this.entityExists(name);
        const euler = entity.getLocalEulerAngles();
        this.closeTo(euler.y, expected, delta, `${name} rot.y:`);
    }

    // ====== Composition Store ======

    productInStore(productId) {
        const config = window.ConfiguratorAPI.getConfig(productId);
        if (!config) throw new Error(`Product "${productId}" not in store`);
        return config;
    }

    productNotInStore(productId) {
        const config = window.ConfiguratorAPI.getConfig(productId);
        if (config) throw new Error(`Product "${productId}" should not be in store`);
    }

    productConfigEqual(productId, key, expected) {
        const config = this.productInStore(productId);
        const actual = config[key];
        if (actual !== expected) {
            throw new Error(`${productId}.${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    }
}

// Export для використання в test files
export { TestContext, Assertions };
