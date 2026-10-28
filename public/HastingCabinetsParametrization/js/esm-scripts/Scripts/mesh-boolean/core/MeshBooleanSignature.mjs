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
class MeshBooleanSignature {
    static isCurrent(meshBoolean) {
        if (!meshBoolean?._lastBooleanSignature) return false;
        return MeshBooleanSignature.create(meshBoolean) === meshBoolean._lastBooleanSignature;
    }
    static markCurrent(meshBoolean) {
        meshBoolean._lastBooleanSignature = MeshBooleanSignature.create(meshBoolean);
    }
    static create(meshBoolean) {
        const targetMI = MeshBooleanSignature._getFirstMeshInstance(meshBoolean.entity);
        const sourceMesh = meshBoolean._sourceMesh || targetMI?.mesh;
        const cutters = meshBoolean._cutters || [];
        return [
            `enabled:${meshBoolean.booleanEnabled !== false}`,
            `operation:${meshBoolean._operation}`,
            `source:${MeshBooleanSignature._getObjectId(sourceMesh, 'mesh')}`,
            `target:${MeshBooleanSignature._getObjectId(meshBoolean.entity, 'entity')}`,
            `targetTransform:${MeshBooleanSignature._getEntityTransform(meshBoolean.entity)}`,
            `targetStretch:${MeshBooleanSignature._getSmartStretch(meshBoolean.entity)}`,
            `cutters:${cutters.map((cutter, index)=>MeshBooleanSignature._getCutter(cutter, index)).join(';')}`
        ].join('|');
    }
    static _getCutter(cutter, index) {
        if (!cutter) return `${index}:null`;
        const cutterMI = MeshBooleanSignature._getFirstMeshInstance(cutter);
        const parentEnabled = !cutter.parent || cutter.parent.enabled;
        return [
            index,
            MeshBooleanSignature._getObjectId(cutter, 'entity'),
            parentEnabled ? 'parent:on' : 'parent:off',
            MeshBooleanSignature._getObjectId(cutterMI?.mesh, 'mesh'),
            MeshBooleanSignature._getEntityTransform(cutter),
            MeshBooleanSignature._getSmartStretch(cutter)
        ].join(':');
    }
    static _getFirstMeshInstance(entity) {
        if (entity?.render?.meshInstances?.length > 0) return entity.render.meshInstances[0];
        if (entity?.model?.meshInstances?.length > 0) return entity.model.meshInstances[0];
        return null;
    }
    static _getEntityTransform(entity) {
        const transform = entity?.getWorldTransform?.();
        const data = transform?.data;
        if (!data) return 'no-transform';
        return Array.from(data, (value)=>MeshBooleanSignature._formatNumber(value)).join(',');
    }
    static _getSmartStretch(entity) {
        const smartStretch = entity?.script?.smartStretch;
        if (!smartStretch) return 'no-smart-stretch';
        return [
            MeshBooleanSignature._getVec3(smartStretch.stretchAmount),
            MeshBooleanSignature._getVec3(smartStretch.margin)
        ].join('/');
    }
    static _getVec3(value) {
        if (!value) return '0,0,0';
        return [
            MeshBooleanSignature._formatNumber(value.x),
            MeshBooleanSignature._formatNumber(value.y),
            MeshBooleanSignature._formatNumber(value.z)
        ].join(',');
    }
    static _getObjectId(object, type) {
        if (!object) return 'missing';
        if (object.id !== undefined && object.id !== null) return String(object.id);
        if (typeof object.getGuid === 'function') return object.getGuid();
        let id = MeshBooleanSignature._ids.get(object);
        if (!id) {
            id = `${type}:${MeshBooleanSignature._idCounter++}`;
            MeshBooleanSignature._ids.set(object, id);
        }
        return id;
    }
    static _formatNumber(value) {
        return Number.isFinite(value) ? value.toFixed(6) : '0.000000';
    }
}
_define_property(MeshBooleanSignature, "_idCounter", 1);
_define_property(MeshBooleanSignature, "_ids", new WeakMap());

export { MeshBooleanSignature };
