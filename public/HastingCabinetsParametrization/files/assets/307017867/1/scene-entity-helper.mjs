// scene-entity-helper.mjs
export class SceneEntityHelper {

    static MESH_STRATEGIES = [
        { key: 'render', getInstances: (ent) => ent.render?.meshInstances },
        { key: 'model', getInstances: (ent) => ent.model?.meshInstances }
    ];

    /**
     * Get mesh instances from entity using available strategies
     * @param {pc.Entity} entity - entity to get mesh instances from
     * @returns {Array} - array of mesh instances or empty array
     */
    static getMeshInstances(entity) {
        if (!entity) return [];

        for (const strategy of this.MESH_STRATEGIES) {
            const instances = strategy.getInstances(entity);
            if (instances && instances.length > 0) {
                return instances;
            }
        }

        return [];
    }

    /**
     * Recursively traverse the tree and collect entities by name.
     *
     * @param {pc.Entity} rootEntity - root entity (for example, this.context.entity)
     * @param {string[]} names - list of names/tags we are looking for
     * @returns {pc.Entity[]} - list of entities found
     */
    static collectByNames(rootEntity, names) {
        const result = [];
        const nameSet = new Set(names);

        const traverse = (entity) => {
            if (nameSet.has(entity.name)) {
                result.push(entity);
            }
            entity.children.forEach(traverse);
        };

        traverse(rootEntity);
        return result;
    }
    static collectByNamesIncludes(rootEntity, names) {
        const result = [];
        // const nameSet = new Set(names);

        const traverse = (entity) => {
            const nameMatch = names.some(name => entity.name.includes(name));
            if (nameMatch) {
                result.push(entity);
            }
            entity.children.forEach(traverse);
        }

        traverse(rootEntity);
        return result;
    }

    /**
      * Universal option: collect all entities for which predicate(entity) === true
      */
    static collectByPredicate(rootEntity, predicate) {
        const result = [];

        const traverse = (entity) => {
            if (predicate(entity)) {
                result.push(entity);
            }
            entity.children.forEach(traverse);
        };

        traverse(rootEntity);
        return result;
    }

    /**
     * Find single entity by exact name
     * @param {pc.Entity} rootEntity - root entity to search from
     * @param {string} name - exact name to find
     * @returns {pc.Entity|null} - found entity or null
     */
    static findByName(rootEntity, name) {
        if (rootEntity.name === name) {
            return rootEntity;
        }

        for (const child of rootEntity.children) {
            const found = this.findByName(child, name);
            if (found) return found;
        }

        return null;
    }

    /**
     * Рекурсивно обчислює AABB для entity та всіх дочірніх.
     * @param {pc.Entity} node
     * @param {string[]} [ignoreNodes] - Імена нод для ігнорування (includes match)
     * @returns {pc.BoundingBox|null}
     */
    static traverseAabb = (node, ignoreNodes = []) => {
        if (!node || !node.enabled) return null;

        // Ігноруємо ноди по імені
        if (ignoreNodes.length > 0 && ignoreNodes.some(name => node.name.includes(name))) {
            return null;
        }

        let total = null;

        // meshInstances цього вузла
        let meshInstances = [];
        if (node.render && node.render.meshInstances) meshInstances = node.render.meshInstances;
        else if (node.model && node.model.meshInstances) meshInstances = node.model.meshInstances;

        if (meshInstances && meshInstances.length) {
            for (const mi of meshInstances) {
                if (!mi?.aabb) continue;

                if (!total) {
                    total = new pc.BoundingBox();
                    total.copy(mi.aabb);
                } else {
                    total.add(mi.aabb);
                }
            }
        }

        // діти
        for (const child of node.children) {
            const childBox = this.traverseAabb(child, ignoreNodes);
            if (!childBox) continue;

            if (!total) {
                total = new pc.BoundingBox();
                total.copy(childBox);
            } else {
                total.add(childBox);
            }
        }

        return total;
    };

}
