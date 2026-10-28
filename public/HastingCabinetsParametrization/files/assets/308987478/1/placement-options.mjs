import { canonicalKey, cloneData, isFiniteVec3, isRecord } from './cabinet-contracts.mjs';
import { operationError } from '../composition/operations/composition-operation-coordinator.mjs';

const choiceOf = input => ({ definitionId: input.definitionId, selection: input.selection });
let nextRegistry = 0;

/** An option is an instance-local reference to an exact choice, measured plan and stamp.
 * enumerate must use prospective geometry; this module never invents positions/rules.
 */
export function createPlacementOptions({ readDependencies, enumerate }) {
    const records = new Map(), prefix = `placement-${++nextRegistry}`;
    let sequence = 0;
    return Object.freeze({
        async list(request, context) {
            const choice = cloneData(choiceOf(request)), dependencies = cloneData(readDependencies());
            const descriptors = await enumerate(cloneData(request), {
                ...context, choice: cloneData(choice), dependencies: cloneData(dependencies)
            });
            if (canonicalKey(readDependencies()) !== canonicalKey(dependencies)) throw operationError('STALE_DEPENDENCIES');
            if (!Array.isArray(descriptors)) throw operationError('INVALID_PLACEMENT_OPTIONS');
            // Validate the whole batch before publishing any references.
            const batch = descriptors.map(raw => {
                const descriptor = cloneData(raw);
                if (!isRecord(descriptor) || !['seed', 'left', 'right', 'remote-anchor'].includes(descriptor.kind) ||
                    !['standard', 'remote'].includes(descriptor.mode) ||
                    !['available', 'conditional', 'unavailable', 'unsupported'].includes(descriptor.availability) ||
                    typeof descriptor.frameId !== 'string' || !descriptor.frameId || !isFiniteVec3(descriptor.positionM) ||
                    ![descriptor.anchorCabinetId, descriptor.surfaceId].every(v => v === null || typeof v === 'string') ||
                    !Array.isArray(descriptor.reasons) || descriptor.impact?.requiresAcknowledgement !== false ||
                    descriptor.impact?.token !== null) throw operationError('INVALID_PLACEMENT_OPTIONS');
                const { plan = null, ...view } = descriptor;
                const option = { ...view, id: `${prefix}-${++sequence}`, dependencies: cloneData(dependencies) };
                return { option, plan, choice, dependencies };
            });
            for (const record of batch) records.set(record.option.id, record);
            return batch.map(record => cloneData(record.option));
        },
        resolve(optionId, choice) {
            const record = records.get(optionId);
            if (!record) throw operationError('UNKNOWN_OPTION');
            if (canonicalKey(choiceOf(choice)) !== canonicalKey(record.choice)) throw operationError('OPTION_CHOICE_MISMATCH');
            if (canonicalKey(readDependencies()) !== canonicalKey(record.dependencies)) throw operationError('STALE_OPTION');
            return cloneData(record);
        },
        clear() { records.clear(); }
    });
}
