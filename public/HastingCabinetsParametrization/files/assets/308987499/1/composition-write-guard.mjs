import { operationError } from './composition-operation-coordinator.mjs';

/** Opt-in only. Legacy linear writers cannot safely operate on independent cabinet poses,
 * even while idle. Publication/rollback authority is private, phase-scoped and never a DTO.
 */
export function createCompositionWriteGuard({ collectionId, coordinator }) {
    if (typeof collectionId !== 'string' || !collectionId.trim() || !coordinator?.scope?.compositionId ||
        !['assertWritable', 'assertCanSave', 'assertTransactionContext'].every(key => typeof coordinator[key] === 'function')) {
        throw operationError('INVALID_WRITE_GUARD');
    }
    return Object.freeze({
        compositionId: coordinator.scope.compositionId,
        assertWrite(context) {
            if (context !== undefined) return coordinator.assertTransactionContext(context);
            coordinator.assertWritable();
            throw operationError(collectionId === 'ULH' ? 'ULH_LEGACY_WRITE_UNSUPPORTED' : 'CABINET_LEGACY_WRITE_UNSUPPORTED');
        },
        assertCanSave(context) {
            if (context !== undefined) return coordinator.assertTransactionContext(context, { write: false });
            return coordinator.assertCanSave();
        }
    });
}
