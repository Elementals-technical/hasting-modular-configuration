/**
 * Applies the logical countertop assembly's manual X/Y offset in world space.
 *
 * The resolver supplies top-level transform targets, so a descendant is never
 * translated when one of its ancestors already owns the same movement. Sinks
 * remain in their cabinet hierarchy; this adapter never reparents entities.
 */

const ZERO_OFFSET_M = Object.freeze({ x: 0, y: 0 });

const isFinitePoint2 = value => Boolean(
    value && Number.isFinite(value.x) && Number.isFinite(value.y)
);

const isAlive = entity => Boolean(entity && entity.parent != null);

const readWorldPosition = entity => {
    const position = entity?.getPosition?.();
    if (!position) return null;
    return {
        x: Number(position.x),
        y: Number(position.y),
        z: Number(position.z)
    };
};

const setWorldPosition = (entity, position) => {
    if (!isAlive(entity) || !position) return false;
    entity.setPosition(position.x, position.y, position.z);
    return true;
};

const resolveStateOffsetM = stateM => {
    const base = stateM?.basePositionM;
    const effective = stateM?.positionM;
    if (!base || !effective) return ZERO_OFFSET_M;

    const offset = {
        x: Number(effective.x) - Number(base.x),
        y: Number(effective.y) - Number(base.y)
    };
    return isFinitePoint2(offset) ? offset : ZERO_OFFSET_M;
};

export class CountertopAssemblyAdapter {
    constructor(binding = null) {
        this._binding = null;
        this._baseWorldPositions = new Map();
        this._appliedOffsetM = { ...ZERO_OFFSET_M };
        this._destroyed = false;
        if (binding) this.rebase(binding);
    }

    get binding() {
        return this._binding;
    }

    get appliedOffsetM() {
        return Object.freeze({ ...this._appliedOffsetM });
    }

    /**
     * Remove the previous manual world delta, accept newly resolved members,
     * then capture their latest standard transforms.
     *
     * countertopBasePositionM preserves the existing composition rule's local
     * X anchor. Y/Z are read after removing the old manual world delta so a
     * repeated aggregation cannot turn that delta into the next standard base.
     */
    rebase(binding, options = {}) {
        if (this._destroyed) return null;

        this._removeAppliedOffset();
        this._binding = binding || null;

        const countertopRoot = binding?.countertop?.root || null;
        const requestedBase = options.countertopBasePositionM || null;
        if (isAlive(countertopRoot) && Number.isFinite(requestedBase?.x)) {
            const local = countertopRoot.getLocalPosition?.();
            if (local) {
                countertopRoot.setLocalPosition(
                    Number(requestedBase.x),
                    Number(local.y),
                    Number(local.z)
                );
            }
        }

        countertopRoot?.syncHierarchy?.();
        this._captureBaseWorldPositions();

        const localBase = countertopRoot?.getLocalPosition?.();
        return localBase ? Object.freeze({
            x: Number(localBase.x),
            y: Number(localBase.y),
            z: Number(localBase.z)
        }) : null;
    }

    /** Apply one absolute X/Y delta from the captured standard transforms. */
    applyStateM(stateM) {
        if (this._destroyed || !this._binding) {
            return Object.freeze({ status: 'cancelled', reason: 'assembly-unbound' });
        }

        const offsetM = resolveStateOffsetM(stateM);
        let movedTargets = 0;

        for (const target of this._binding.transformTargets || []) {
            const entity = target?.entity;
            const base = this._baseWorldPositions.get(entity);
            if (!isAlive(entity) || !base) continue;

            if (setWorldPosition(entity, {
                x: base.x + offsetM.x,
                y: base.y + offsetM.y,
                // Z is intentionally fixed at the standard binding value.
                z: base.z
            })) {
                movedTargets++;
            }
        }

        this._binding.countertop?.root?.syncHierarchy?.();
        this._appliedOffsetM = { ...offsetM };
        return Object.freeze({
            status: 'success',
            reason: 'assembly-position-applied',
            movedTargets,
            offsetM: Object.freeze({ ...offsetM })
        });
    }

    restoreStandard() {
        if (this._destroyed) return;
        this._removeAppliedOffset();
        this._captureBaseWorldPositions();
    }

    destroy(options = {}) {
        if (this._destroyed) return;
        if (options.restoreStandard !== false) this._removeAppliedOffset();
        this._destroyed = true;
        this._binding = null;
        this._baseWorldPositions.clear();
    }

    _captureBaseWorldPositions() {
        this._baseWorldPositions.clear();
        for (const target of this._binding?.transformTargets || []) {
            const entity = target?.entity;
            const position = readWorldPosition(entity);
            if (isAlive(entity) && position) {
                this._baseWorldPositions.set(entity, position);
            }
        }
    }

    _removeAppliedOffset() {
        const offsetM = this._appliedOffsetM;
        if (!isFinitePoint2(offsetM) || (offsetM.x === 0 && offsetM.y === 0)) {
            this._appliedOffsetM = { ...ZERO_OFFSET_M };
            return;
        }

        // Use the previous resolver-selected top-level targets. Newly created
        // sinks/cutters are not adjusted here; they are captured as standard
        // members during the following rebase.
        for (const target of this._binding?.transformTargets || []) {
            const entity = target?.entity;
            const current = readWorldPosition(entity);
            if (!isAlive(entity) || !current) continue;
            setWorldPosition(entity, {
                x: current.x - offsetM.x,
                y: current.y - offsetM.y,
                z: current.z
            });
        }

        this._binding?.countertop?.root?.syncHierarchy?.();
        this._appliedOffsetM = { ...ZERO_OFFSET_M };
    }
}

export function createCountertopAssemblyAdapter(binding = null) {
    return new CountertopAssemblyAdapter(binding);
}
