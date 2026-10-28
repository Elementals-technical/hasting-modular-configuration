import { Vec3 } from '../../../../playcanvas-stable.min.mjs';
import { AutoPlacementService } from '../services/autoPlacement/auto-placement-service.mjs';
import { DividerDebugLogger } from '../services/drawer-divider/diagnostics/DividerDebugLogger.mjs';

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
class PositionBuilder {
    static create(entities, indicesMap = {}) {
        return new PositionBuilder(entities, indicesMap);
    }
    static sortEntitiesByIndex(entities, indicesMap) {
        return entities.sort((a, b)=>{
            const indexA = indicesMap[a.name] ?? 0;
            const indexB = indicesMap[b.name] ?? 0;
            return indexA - indexB;
        });
    }
    setAxis(value) {
        this._axis = value;
        this._placementService.setAxis(value);
        return this;
    }
    setGap(value) {
        this._gap = Number(value) || 0;
        this._placementService.setGap(this._gap);
        return this;
    }
    /**
   * Встановити ноди для ігнорування в AABB розрахунку
   * @param {string[]} nodeNames
   * @returns {PositionBuilder} this
   */ setIgnoreNodes(nodeNames) {
        this._placementService.setIgnoreNodes(nodeNames);
        return this;
    }
    addEntity(entity, beforeEntityName, side) {
        if (!beforeEntityName) {
            this._items.push(entity);
            return;
        }
        const index = this._items.findIndex((item)=>item.name === beforeEntityName);
        if (index === -1) {
            this._items.push(entity);
        } else {
            const insertIndex = side === "left" ? index : index + 1;
            this._items.splice(insertIndex, 0, entity);
        }
        return this;
    }
    removeEntity(entityName) {
        this._items = this._items.filter((item)=>item.name !== entityName);
        if (this._indicesMap[entityName] === 0) {
            this._isAnchorChanged = true;
        }
        delete this._indicesMap[entityName];
        return this;
    }
    swapEntities(entityNameA, entityNameB) {
        const indexValueA = this._indicesMap[entityNameA];
        const indexValueB = this._indicesMap[entityNameB];
        if (indexValueA === 0 || indexValueB === 0) {
            this._isAnchorChanged = true;
        }
        if (indexValueA !== undefined && indexValueB !== undefined) {
            this._indicesMap[entityNameA] = indexValueB;
            this._indicesMap[entityNameB] = indexValueA;
        }
        this._items = PositionBuilder.sortEntitiesByIndex(this._items, this._indicesMap);
        return this;
    }
    build() {
        const traceId = DividerDebugLogger.nextTraceId('cabinet-layout-builder');
        DividerDebugLogger.log('CabinetLayout.PositionBuilder.buildStart', 'Building cabinet layout positions', {
            traceId,
            axis: this._axis,
            gap: this._gap,
            itemCount: this._items.length,
            ignoredNodePatterns: this._placementService._ignoreNodes || [],
            items: this._items.map((entity, arrayIndex)=>({
                    arrayIndex,
                    name: entity?.name,
                    orderIndex: this._indicesMap[entity?.name],
                    position: this._summarizeVec3(entity?.getPosition?.())
                }))
        });
        if (this._items.length === 0) return [];
        if (this._items.length === 1) {
            const singleEntity = this._items[0];
            DividerDebugLogger.log('CabinetLayout.PositionBuilder.singleItem', 'Single cabinet layout result', {
                traceId,
                entity: singleEntity?.name,
                position: {
                    x: 0,
                    y: 0,
                    z: 0
                }
            });
            return [
                {
                    entity: singleEntity,
                    position: new Vec3(0, 0, 0),
                    index: 0,
                    isChanged: true
                }
            ];
        }
        this._ensureAnchorExists();
        const anchorArrayIndex = this._items.findIndex((e)=>this._indicesMap[e.name] === 0);
        const anchorEntity = this._items[anchorArrayIndex];
        anchorEntity.setPosition(0, 0, 0);
        DividerDebugLogger.log('CabinetLayout.PositionBuilder.anchorSelected', 'Anchor cabinet selected for layout', {
            traceId,
            anchorArrayIndex,
            anchorEntity: anchorEntity?.name,
            indicesMap: {
                ...this._indicesMap
            }
        });
        const result = [];
        result.push({
            entity: anchorEntity,
            position: anchorEntity.getPosition().clone(),
            index: 0,
            isChanged: this._isAnchorChanged
        });
        for(let i = anchorArrayIndex + 1; i < this._items.length; i++){
            const prevEntity = this._items[i - 1];
            const currentOrgEntity = this._items[i];
            const currentEntity = currentOrgEntity.clone();
            this._items[i] = currentEntity;
            const newPos = this._placementService.getPosition(prevEntity, currentEntity, "right", this._gap);
            currentEntity.setPosition(newPos);
            const relativeIndex = i - anchorArrayIndex;
            result.push(this._createResultEntry(currentOrgEntity, newPos, relativeIndex));
        }
        for(let i = anchorArrayIndex - 1; i >= 0; i--){
            const nextEntity = this._items[i + 1];
            const currentOrgEntity = this._items[i];
            const currentEntity = currentOrgEntity.clone();
            this._items[i] = currentEntity;
            const newPos = this._placementService.getPosition(nextEntity, currentEntity, "left", this._gap);
            currentEntity.setPosition(newPos);
            const relativeIndex = i - anchorArrayIndex;
            result.push(this._createResultEntry(currentOrgEntity, newPos, relativeIndex));
        }
        DividerDebugLogger.log('CabinetLayout.PositionBuilder.buildDone', 'Cabinet layout positions built', {
            traceId,
            results: result.map(({ entity, position, index, isChanged })=>({
                    entity: entity?.name,
                    index,
                    isChanged,
                    position: this._summarizeVec3(position)
                }))
        });
        return result;
    }
    _ensureAnchorExists() {
        const hasZero = this._items.some((e)=>this._indicesMap[e.name] === 0);
        if (hasZero) return;
        const currentIndices = this._items.map((e)=>this._indicesMap[e.name]);
        const negativeIndices = currentIndices.filter((i)=>i < 0);
        let shiftAmount = 0;
        if (negativeIndices.length > 0) {
            const maxNegative = Math.max(...negativeIndices);
            shiftAmount = -maxNegative;
        } else {
            const minPositive = Math.min(...currentIndices);
            shiftAmount = -minPositive;
        }
        this._items.forEach((e)=>{
            const currentIdx = this._indicesMap[e.name] ?? 0;
            this._indicesMap[e.name] = currentIdx + shiftAmount;
        });
        return;
    }
    _createResultEntry(entity, newPos, index) {
        const currentPos = entity.getPosition();
        const dist = currentPos.distance(newPos);
        const isChanged = dist > 0.0001;
        return {
            entity: entity,
            position: newPos,
            index: index,
            isChanged: isChanged
        };
    }
    _summarizeVec3(vec) {
        if (!vec) return null;
        return {
            x: DividerDebugLogger._round(vec.x),
            y: DividerDebugLogger._round(vec.y),
            z: DividerDebugLogger._round(vec.z)
        };
    }
    constructor(entities, indicesMap = {}){
        _define_property(this, "_items", []);
        _define_property(this, "_indicesMap", {});
        _define_property(this, "_axis", "x");
        _define_property(this, "_gap", 0);
        _define_property(this, "_placementService", void 0);
        _define_property(this, "_isAnchorChanged", false);
        this._indicesMap = indicesMap;
        this._items = PositionBuilder.sortEntitiesByIndex(entities, indicesMap);
        this._indicesMap = indicesMap;
        this._placementService = new AutoPlacementService();
    }
}

export { PositionBuilder };
