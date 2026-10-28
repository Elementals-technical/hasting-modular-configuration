/**
 * Universal builder for configurations of the following type:
 * {
 *   breakpoints: [...],
 *   values: {
 *     MeshA: { 25: payload, 35: payload, ... },
 *     MeshB: { ... }
 *   }
 * }
 *
 * Payload can be anything:
 *  - { x: -0.35 } for stretch
 *  - { y: 0.02 } for move
 *  - { visible: true } or ‘Enable’ for visibility
 */
export class MeshRuleConfigBuilder {
    constructor(initialMeshes = []) {
        this._breakpoints = [];
        this._valuesByMesh = {};      // { meshName: { bp: payload } }
        this._pendingMeshes = [...initialMeshes]; // mesh-и, для яких наступний .values()
    }

    /**
     * Статичний конструктор:
     *  MeshRuleConfigBuilder.meshes([...])
     * Для зворотної сумісності з існуючим кодом.
     */
    static meshes(meshNames) {
        return new MeshRuleConfigBuilder(meshNames);
    }

    /**
     * Альтернативний вхід без стартових mesh-ів:
     *  MeshRuleConfigBuilder.create()
     */
    static create() {
        return new MeshRuleConfigBuilder();
    }

    /**
     * Задати спільні breakpoints для всіх mesh-ів.
     */
    breakpoints(list) {
        this._breakpoints = Array.isArray(list) ? [...list] : [];
        return this;
    }

    /**
     * Задати групу mesh-ів, для яких наступний виклик .values(...)
     * застосує один і той самий набір values.
     *
     * Приклад:
     *  .meshes(['CabinetUniBody', 'CabinetBackWall'])
     *  .values({ 25:{x:-0.35}, 35:{x:-0.25}, ... })
     */
    meshes(meshNames) {
        this._pendingMeshes = [...meshNames];
        return this;
    }

    /**
     * Задати один mesh для наступного .values(...)
     *
     * Приклад:
     *  .mesh('TopDrawer_Point')
     *  .values({ 56:{y:0}, 53:{y:0}, 50:{y:-0.03} })
     */
    mesh(meshName) {
        this._pendingMeshes = [meshName];
        return this;
    }

    /**
     * Призначити набір значень (по breakpoints) для поточної групи mesh-ів.
     *
     * valuesByBreakpoint:
     *  {
     *    56: { y: 0 },
     *    53: { y: -0.015 },
     *    50: { y: -0.03 },
     *  }
     *
     * ЦЕЙ МЕТОД:
     *  - клонить values для КОЖНОГО mesh окремо, щоб уникнути спільних посилань;
     *  - очищає _pendingMeshes після застосування.
     */
    values(valuesByBreakpoint) {
        if (!this._pendingMeshes || this._pendingMeshes.length === 0) {
            throw new Error(
                "MeshRuleConfigBuilder.values() called without meshes()/mesh(). " +
                "Спочатку виклич .meshes([...]) або .mesh(name)."
            );
        }

        this._pendingMeshes.forEach((meshName) => {
            this._valuesByMesh[meshName] =
                MeshRuleConfigBuilder._cloneValues(valuesByBreakpoint);
        });

        this._pendingMeshes = [];
        return this;
    }

    /**
     * Фінальний обʼєкт:
     * {
     *   breakpoints: [...],
     *   values: {
     *     MeshA: { 56: payload, 53: payload, ... },
     *     MeshB: { ... }
     *   }
     * }
     */
    build() {
        return {
            breakpoints: [...this._breakpoints],
            values: this._valuesByMesh,
        };
    }

    /**
     * Клонування мапи { breakpoint: payload }:
     *  - якщо payload обʼєкт → shallow copy
     *  - якщо примітив → копіюємо як є
     */
    static _cloneValues(values) {
        const out = {};
        Object.keys(values).forEach((key) => {
            const v = values[key];
            out[key] = v && typeof v === "object" ? { ...v } : v;
        });
        return out;
    }
}