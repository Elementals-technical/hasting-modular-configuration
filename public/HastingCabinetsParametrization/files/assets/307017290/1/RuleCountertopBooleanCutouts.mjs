import { LoggerService } from "../../../services/logger/logger-service.mjs";
import { SceneTransformHelper } from "../../../helpers/scene-transform-helper.mjs";
import { BaseCompositionRule } from "./base-composition-rule.mjs";
import { ProductRegistry_V2 } from "../../product/registry/product-registry-v2.mjs";
import { isTandemCountertopProduct, resolveBasinTopProduct } from '../../countertop/countertop-role.mjs';
import { selectCountertopSupportGroup } from '../../countertop/countertop-support-resolver.mjs';
import { COUNTERTOP_SINK_TYPE_KEY } from '../../countertop/countertop-hosted-sink.mjs';
import {
    HOSTED_VESSEL_CUTTER_CLONE_NAME,
    isVesselSinkId,
    resolveCountertopAssembly
} from '../../countertop/spatial/countertop-assembly-resolver.mjs';

/**
 * Правило Boolean операцій на стільниці.
 *
 * Знаходить всі Boolean елементи (BoolB_*) в продуктах,
 * призначає їх як cutters і виконує Boolean операції.
 */
export class RuleCountertopBooleanCutouts extends BaseCompositionRule {
    constructor() {
        super({
            name: 'CountertopBooleanCutouts',
            watchCompositions: ['cabinets'],
            watchParams: ['Width', 'Depth', 'Height', 'ShowUndertop', 'sinkType', "Thickness", 'SpatialOffsetM', 'SupportGroupId', COUNTERTOP_SINK_TYPE_KEY]
        });
    }

    /**
     * Агрегує дані про продукти з умивальниками
     */
    aggregateFn(compositions) {
        const allProducts = [];

        Object.values(compositions).forEach(comp => {
            const products = comp.getAllProducts();
            allProducts.push(...Object.values(products));
        });

        const productsWithSinks = allProducts.filter(p => p.sinkType);

        return {
            totalProducts: allProducts.length,
            totalWidth: allProducts.reduce((sum, p) => sum + (p.Width || 0), 0),
            maxDepth: Math.max(...allProducts.map(p => p.Depth || 0), 0),
            productsWithSinks: productsWithSinks,
            sinkTypes: productsWithSinks.map(p => ({
                type: p.sinkType,
                width: p.Width,
                depth: p.Depth
            })),
            needsUpdate: true,
            compositions: compositions
        };
    }

    /**
     * Виконує Boolean операції на стільниці (основній і tandem-стільницях).
     */
    async applyFn(result, context) {
        const basinResult = await this.applyBasinTop(result, context);
        await this.cutTandemTops(context);
        return basinResult;
    }

    /**
     * Tandem tops (countertop/tandem/tandem-countertops.mjs): each is cut by the sinks of its own row's cabinets
     * (its SupportGroupId), with the same cutter discovery as the basin top, through the tandem top writer.
     */
    async cutTandemTops(context) {
        const { shared } = context;
        const writer = context.app.compositionManager?.tandemCountertopWriter;
        if (!writer) return;
        const products = shared?.composition?.getAllProducts?.() ?? shared?.allProducts ?? {};
        const countertops = shared?.entities?.countertops || [];
        const operations = [];
        for (const [productId, snapshot] of Object.entries(products)) {
            if (!isTandemCountertopProduct(snapshot)) continue;
            const countertop = countertops.find(entity => entity?.name === productId) ?? null;
            const mesh = countertop?.findByName?.('TopSolid') ?? null;
            if (!countertop || !mesh) continue;
            const entities = selectCountertopSupportGroup(shared?.entities?.cabinets || [], products, productId);
            entities.forEach(entity => entity.syncHierarchy());
            countertop.syncHierarchy();
            const discover = () => {
                const sinks = this._resolveSinks(products, countertop, entities, productId);
                return [...this._findSinkCutters(sinks), ...this._syncVesselCutouts(sinks, countertop, null)];
            };
            let cutters = this._validateBooleanElements(discover());
            const found = this._findSinkCutters(this._resolveSinks(products, countertop, entities, productId)).length;
            if (cutters.length < found) {
                // Just cloned cutters have no mesh yet: one frame, as for the basin top.
                await SceneTransformHelper.waitForFrames(1);
                cutters = this._validateBooleanElements([...this._findSinkCutters(this._resolveSinks(products, countertop, entities, productId)),
                    ...this._collectVesselCutterMeshes(countertop)]);
            }
            operations.push(writer.cut({ productId, root: countertop, mesh, cutters }));
        }
        await Promise.allSettled(operations);
    }

    /** The basin top's Boolean operations. */
    async applyBasinTop(result, context) {
        const { shared } = context;
        const compositionAdapter = context.app.compositionManager?.countertopCompositionAdapter;

        // Countertops з shared context
        const countertops = shared?.entities?.countertops || [];
        if (countertops.length === 0) return;

        const products = shared?.composition?.getAllProducts?.() ?? shared?.allProducts ?? {};
        const basinResolution = resolveBasinTopProduct(products);
        const countertop = basinResolution.status === 'found'
            ? countertops.find(entity => entity?.name === basinResolution.productId) ?? null
            : null;
        if (!countertop) return;

        const countTopMesh = countertop.findByName("TopSolid");
        if (!countTopMesh) return;

        // Перевіряємо наявність meshBoolean script
        if (!countTopMesh.script || !countTopMesh.script.meshBoolean) {
            LoggerService.error(this, '❌ [CountertopBoolean] meshBoolean script not found on countertop');
            return;
        }

        // Синхронізуємо world transforms (handlers виконуються послідовно, попередні вже завершені)
        const entities = context.app.compositionManager?.preserveCabinetPositions
            ? selectCountertopSupportGroup(shared?.entities?.cabinets || [], products, countertop.name)
            : shared?.entities?.cabinets || [];
        entities.forEach(e => e.syncHierarchy());
        countertop.syncHierarchy();

        // Sinks come from the resolver (the single sink-host discovery): cabinet sinks, then the
        // countertop-hosted one (lifted top, HR-CT-02). Each cuts with the BoolB_* under its anchor;
        // vessel sinks also get a stable countertop clone, reused across aggregation retries.
        const sinks = this._resolveSinks(products, countertop, entities);
        let booleanElements = this._findSinkCutters(sinks);
        booleanElements.push(...this._syncVesselCutouts(sinks, countertop, compositionAdapter));

        LoggerService.log(this, '🔍 [CountertopBoolean] Found boolean elements:', {
            totalProducts: entities.length,
            booleanCount: booleanElements.length
        });

        if (booleanElements.length === 0) {
            const emptyResult = await this._updateResolvedCutters(
                compositionAdapter,
                countTopMesh,
                shared,
                [],
                'countertop-cutters-cleared'
            );
            LoggerService.warn(this, '⚠️ [CountertopBoolean] No boolean elements (BoolB_*) found');
            return emptyResult;
        }

        // Валідуємо Boolean елементи
        let validCutters = this._validateBooleanElements(booleanElements);

        // Smart retry: якщо є BoolB_* без meshInstances (щойно склоновані) — чекаємо 1 frame
        const unreadyCount = booleanElements.length - validCutters.length;
        if (unreadyCount > 0) {
            LoggerService.log(this, `⏳ [CountertopBoolean] ${unreadyCount} cutters not ready, waiting 1 frame...`);
            await SceneTransformHelper.waitForFrames(1);
            entities.forEach(e => e.syncHierarchy());
            countertop.syncHierarchy();
            booleanElements = this._findSinkCutters(this._resolveSinks(products, countertop, entities));
            // Do not recreate or lose Vessel clones during retry discovery.
            booleanElements.push(...this._collectVesselCutterMeshes(countertop));
            validCutters = this._validateBooleanElements(booleanElements);
        }

        if (validCutters.length === 0) {
            LoggerService.error(this, '❌ [CountertopBoolean] No valid cutters after validation');
            return this._updateResolvedCutters(
                compositionAdapter,
                countTopMesh,
                shared,
                [],
                'countertop-cutters-unready'
            );
        }

        // Assign resolver-owned cutters before the already scheduled resize
        // settles. Relative cutter changes use the same requestBoolean path;
        // rigid X/Y assembly movement never calls this aggregation rule.
        try {
            LoggerService.log(this, '🔧 [CountertopBoolean] Assigned cutters to meshBoolean:', {
                cuttersCount: validCutters.length,
                cutterNames: validCutters.map(c => c.name)
            });

            const booleanResult = await this._updateResolvedCutters(
                compositionAdapter,
                countTopMesh,
                shared,
                validCutters,
                'countertop-relative-cutters-changed'
            );

            LoggerService.log(
                this,
                `✅ [CountertopBoolean] Boolean operations settled`,
                {
                    booleanElementsCount: validCutters.length,
                    processedSinks: result.sinkTypes.length,
                    status: booleanResult?.status || 'unknown'
                }
            );
            return booleanResult;
        } catch (error) {
            LoggerService.error(this, '❌ [CountertopBoolean] Error performing boolean operations:', error);
            return {
                status: 'error',
                code: error?.code || 'COUNTERTOP_BOOLEAN_FAILED',
                reason: error?.message || String(error)
            };
        }
    }

    /**
     * The resolver's `sinks` for the basin top and the given (support-group-filtered) cabinets.
     * @private
     */
    _resolveSinks(products, countertop, cabinetEntities, countertopId = null) {
        const registry = ProductRegistry_V2.instance;
        return resolveCountertopAssembly({
            composition: { getAllProducts: () => products },
            countertopId,
            entities: { countertops: countertop ? [countertop] : [], cabinets: cabinetEntities },
            getSinkAnchorName: (productType, entityName) =>
                registry.getSinkAnchorName(productType) || registry.getSinkAnchorName(entityName)
        }).sinks;
    }

    /**
     * BoolB_* cutters of every sink, in `sinks` order.
     * A cabinet can own unrelated BoolB_* helpers (Class_Top_Drawer_BoolB, for example): only
     * cutters under the sink anchor belong to the countertop CSG.
     * @private
     */
    _findSinkCutters(sinks) {
        return sinks.flatMap(sink => this._findBooleanElementsUnder(sink.anchor));
    }

    /**
     * BoolB_* cutters under one sink anchor (a cabinet's sink mount or the countertop's Countertop_SinkPoint).
     * @private
     */
    _findBooleanElementsUnder(sinkAnchor) {
        const booleanElements = [];
        if (!sinkAnchor) return booleanElements;

        // MeshBoolean disables every cutter after a cut (a hidden helper), so a disabled BoolB_*
        // is still this sink's cutter: skipping it made any later run (e.g. a countertop Drag &
        // Drop, SpatialOffsetM) clear the basin hole. Only a disabled container (an inactive sink
        // variant) is skipped - the executor's own convention (cutter.parent.enabled).
        const findRecursive = (node) => {
            if (!node) return;
            if (node.name.includes('BoolB_')) {
                booleanElements.push(node);
                return;
            }
            if (node.enabled === false) return;
            node.children.forEach(child => findRecursive(child));
        };

        sinkAnchor.children.forEach(child => findRecursive(child));

        return booleanElements;
    }

    /**
     * Валідує Boolean елементи перед використанням.
     * Фільтрує destroyed entities та entities без render mesh.
     * @private
     */
    _validateBooleanElements(booleanElements) {
        const valid = booleanElements.filter(e => {
            // Фільтруємо destroyed entities (parent === undefined після destroy)
            if (!e.parent) {
                LoggerService.log(this, `⏭️ [CountertopBoolean] Skipping destroyed entity: ${e.name}`);
                return false;
            }
            // Перевіряємо наявність render mesh
            const mi = e.render?.meshInstances || e.model?.meshInstances;
            if (!mi || mi.length === 0) {
                LoggerService.log(this, `⏭️ [CountertopBoolean] Skipping entity without mesh: ${e.name}`);
                return false;
            }
            return true;
        });

        if (valid.length !== booleanElements.length) {
            LoggerService.log(this, `🔍 [CountertopBoolean] Validated: ${valid.length}/${booleanElements.length} cutters passed`);
        }

        return valid;
    }

    /**
     * Vessel boolean cutouts for the vessel sinks in `sinks` (resolver order): a clone of the countertop's
     * Vessel_BoolCut template per sink — `Vessel_BoolCut_Clone_<i>` for the i-th cabinet-hosted vessel
     * (the resolver's numbering), `Vessel_BoolCut_Clone_Countertop` for the countertop-hosted one.
     * @private
     */
    _syncVesselCutouts(sinks, countertop, compositionAdapter) {
        // Знайти template Vessel_BoolCut в countertop клоні
        const vesselTemplate = countertop.findByName("Vessel_BoolCut");
        if (!vesselTemplate) {
            this._cleanupVesselClones(countertop, new Set());
            return [];
        }

        const vesselSinks = sinks.filter(sink => isVesselSinkId(sink.sinkId));
        if (vesselSinks.length === 0) {
            this._cleanupVesselClones(countertop, new Set());
            vesselTemplate.enabled = false;
            return [];
        }

        const existingByName = this._findVesselCloneRoots(countertop).reduce((map, clone) => {
            const list = map.get(clone.name) || [];
            list.push(clone);
            map.set(clone.name, list);
            return map;
        }, new Map());
        const desiredNames = new Set();
        const manualOffsetX = Number(compositionAdapter?.getState?.()?.offset?.x);
        const offsetX = Number.isFinite(manualOffsetX) ? manualOffsetX : 0;

        const placeClone = (cloneName, worldX) => {
            desiredNames.add(cloneName);
            const matches = existingByName.get(cloneName) || [];
            const clone = matches.shift() || vesselTemplate.clone();
            matches.forEach(duplicate => duplicate.destroy());
            clone.name = cloneName;
            clone.enabled = true;
            if (clone.parent !== countertop) countertop.addChild(clone);
            const clonePos = clone.getPosition();
            clone.setPosition(worldX, clonePos.y, clonePos.z);
        };

        let cabinetIndex = 0;
        vesselSinks.forEach(sink => {
            if (sink.host.kind === 'cabinet') {
                // Reuse a stable clone by owner index. The cabinet stays where it stands, so the
                // logical assembly manual X is added once (to the cabinet's X, as before).
                placeClone(`Vessel_BoolCut_Clone_${cabinetIndex++}`, sink.host.root.getPosition().x + offsetX);
            } else {
                // The countertop anchor is a countertop child: its world X already carries the manual offset.
                placeClone(HOSTED_VESSEL_CUTTER_CLONE_NAME, sink.anchor.getPosition().x);
            }
        });

        this._cleanupVesselClones(countertop, desiredNames);

        // Сховати оригінальний template
        vesselTemplate.enabled = false;

        LoggerService.log(this, `🔧 [CountertopBoolean] Added ${desiredNames.size} Vessel cutouts`);
        return this._collectVesselCutterMeshes(countertop);
    }

    /**
     * Видаляє попередні Vessel клони
     * @private
     */
    _cleanupVesselClones(countertop, desiredNames = new Set()) {
        this._findVesselCloneRoots(countertop)
            .filter(clone => !desiredNames.has(clone.name))
            .forEach(clone => clone.destroy());
    }

    _findVesselCloneRoots(countertop) {
        const clones = [];
        countertop.forEach(entity => {
            if (String(entity.name || '').startsWith('Vessel_BoolCut_Clone_')) {
                clones.push(entity);
            }
        });
        return clones;
    }

    _collectVesselCutterMeshes(countertop) {
        return this._findVesselCloneRoots(countertop).flatMap(root => {
            const meshes = [];
            root.forEach(entity => {
                const meshInstances = entity.render?.meshInstances || entity.model?.meshInstances;
                if (Array.isArray(meshInstances) && meshInstances.length > 0) meshes.push(entity);
            });
            return meshes;
        });
    }

    async _updateResolvedCutters(compositionAdapter, countTopMesh, shared, validCutters, reason) {
        if (compositionAdapter?.updateBooleanCutouts) {
            return compositionAdapter.updateBooleanCutouts({
                composition: shared?.composition,
                compositionId: shared?.composition?.compositionId,
                entities: shared?.entities,
                validCutters,
                forceRebuild: true,
                reason
            });
        }

        // Compatibility fallback for a runtime where CT-07 has not bound yet.
        validCutters.forEach(cutter => { cutter.enabled = true; });
        const meshBoolean = countTopMesh.script.meshBoolean;
        meshBoolean.cutters = validCutters;
        countTopMesh.parent?.syncHierarchy?.();
        return meshBoolean.requestBoolean({
            reason,
            skipWhenNoActiveCutters: false
        });
    }
}
