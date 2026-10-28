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
class OutlineDiagnostics {
    get enabled() {
        return this._enabled;
    }
    setEnabled(enabled = true) {
        this._enabled = Boolean(enabled);
        if (!this._enabled) this._currentReport = null;
        console.info(`[OutlineDiag] ${this._enabled ? 'enabled' : 'disabled'}`);
        return this._enabled;
    }
    getReports() {
        return JSON.parse(JSON.stringify(this._reports));
    }
    clear() {
        this._reports.length = 0;
        this._currentReport = null;
    }
    beginSelection(allSelected, added, removed, configuration, outlineRenderer = null) {
        if (!this._enabled) return null;
        if (this._currentReport) {
            this.finish(this._currentReport, outlineRenderer);
        }
        const report = {
            id: this._nextReportId++,
            startedAtMs: performance.now(),
            configuration: {
                ...configuration
            },
            selection: {
                selected: allSelected.map((entity)=>entity?.name || '<unnamed>'),
                added: added.map((entity)=>entity?.name || '<unnamed>'),
                removed: removed.map((entity)=>entity?.name || '<unnamed>')
            },
            entities: [],
            totals: {
                meshInstances: 0,
                uniqueMaterials: 0,
                shaderHookCalls: 0,
                uniqueDefineSets: 0
            },
            renderTargets: null,
            shaderDefineSets: []
        };
        Object.defineProperty(report, '_materialIds', {
            value: new Set(),
            enumerable: false
        });
        Object.defineProperty(report, '_defineSetsBySignature', {
            value: new Map(),
            enumerable: false
        });
        this._currentReport = report;
        performance.mark?.(`OutlineDiag selection ${report.id} start`);
        return report;
    }
    recordEntity(entity, meshInstances, collectionMs) {
        const report = this._currentReport;
        if (!this._enabled || !report) return;
        const materialIds = new Set();
        for (const meshInstance of meshInstances){
            const material = meshInstance?.material;
            if (!material) continue;
            const materialId = this._getMaterialId(material);
            materialIds.add(materialId);
            report._materialIds.add(materialId);
        }
        report.entities.push({
            name: entity?.name || '<unnamed>',
            meshInstances: meshInstances.length,
            uniqueMaterials: materialIds.size,
            collectionMs: Number(collectionMs.toFixed(3))
        });
        report.totals.meshInstances += meshInstances.length;
        report.totals.uniqueMaterials = report._materialIds.size;
    }
    recordShaderOptions(material, options) {
        const report = this._currentReport;
        if (!this._enabled || !report) return;
        report.totals.shaderHookCalls += 1;
        if (report.totals.shaderHookCalls === 1) {
            performance.mark?.(`OutlineDiag selection ${report.id} first shader hook`);
        }
        const defines = this._normalizeDefines(options?.defines);
        const litOptions = options?.litOptions || {};
        const signature = JSON.stringify({
            defines,
            alphaTest: Boolean(litOptions.alphaTest),
            skin: Boolean(litOptions.skin),
            batch: Boolean(litOptions.batch),
            instancing: Boolean(litOptions.useInstancing),
            morphPosition: Boolean(litOptions.useMorphPosition),
            morphNormal: Boolean(litOptions.useMorphNormal)
        });
        let defineSet = report._defineSetsBySignature.get(signature);
        if (!defineSet) {
            defineSet = {
                calls: 0,
                materialCount: 0,
                materials: [],
                defines,
                litOptions: {
                    alphaTest: Boolean(litOptions.alphaTest),
                    skin: Boolean(litOptions.skin),
                    batch: Boolean(litOptions.batch),
                    instancing: Boolean(litOptions.useInstancing),
                    morphPosition: Boolean(litOptions.useMorphPosition),
                    morphNormal: Boolean(litOptions.useMorphNormal),
                    morphTextureBasedInt: Boolean(litOptions.useMorphTextureBasedInt)
                }
            };
            Object.defineProperty(defineSet, '_materialLabels', {
                value: new Set(),
                enumerable: false
            });
            report._defineSetsBySignature.set(signature, defineSet);
            report.shaderDefineSets.push(defineSet);
        }
        defineSet.calls += 1;
        const materialLabel = `${this._getMaterialId(material)}:${material?.name || '<unnamed>'}`;
        if (!defineSet._materialLabels.has(materialLabel)) {
            defineSet._materialLabels.add(materialLabel);
            defineSet.materialCount += 1;
            if (defineSet.materials.length < 50) defineSet.materials.push(materialLabel);
        }
        report.totals.uniqueDefineSets = report.shaderDefineSets.length;
    }
    finish(report, outlineRenderer = null) {
        if (!report || report.finishedAtMs != null) return;
        const rt = outlineRenderer?.rt;
        const tempRt = outlineRenderer?.tempRt;
        const outlineCameraTarget = outlineRenderer?.outlineCameraEntity?.camera?.renderTarget;
        const rtPixels = (rt?.width || 0) * (rt?.height || 0);
        const tempPixels = (tempRt?.width || 0) * (tempRt?.height || 0);
        report.finishedAtMs = performance.now();
        report.elapsedMs = Number((report.finishedAtMs - report.startedAtMs).toFixed(3));
        report.renderTargets = {
            outline: rt ? {
                width: rt.width,
                height: rt.height,
                hasDepth: true
            } : null,
            temporary: tempRt ? {
                width: tempRt.width,
                height: tempRt.height,
                hasDepth: false
            } : null,
            camera: outlineCameraTarget ? {
                width: outlineCameraTarget.width,
                height: outlineCameraTarget.height
            } : null,
            cameraUsesOutlineTarget: Boolean(rt && outlineCameraTarget === rt),
            estimatedColorBytes: (rtPixels + tempPixels) * 4,
            estimatedDepthBytes: rtPixels * 4,
            expectedExtendOffsets: rt ? {
                horizontal: [
                    1 / rt.width / 2,
                    0
                ],
                vertical: [
                    0,
                    1 / rt.height / 2
                ]
            } : null,
            filtering: rt?.colorBuffer ? {
                minFilter: rt.colorBuffer.minFilter,
                magFilter: rt.colorBuffer.magFilter
            } : null
        };
        this._reports.push(report);
        if (this._reports.length > 50) this._reports.shift();
        if (this._currentReport === report) this._currentReport = null;
        const startMark = `OutlineDiag selection ${report.id} start`;
        const endMark = `OutlineDiag selection ${report.id} frameend`;
        performance.mark?.(endMark);
        try {
            performance.measure?.(`OutlineDiag selection ${report.id} to frameend`, startMark, endMark);
        } catch  {
        // User Timing is diagnostic-only and must never affect selection.
        }
        console.info(`[OutlineDiag #${report.id}] ${report.selection.selected.join(', ') || 'empty'} ` + `— ${report.totals.meshInstances} meshes, ${report.totals.uniqueMaterials} materials, ` + `${report.totals.uniqueDefineSets} define sets`, JSON.parse(JSON.stringify(report)));
    }
    _readEnabledFlag() {
        try {
            const queryEnabled = new URLSearchParams(globalThis.location?.search || '').get('outlineDiag') === '1';
            const storageEnabled = globalThis.localStorage?.getItem('outlineDiag') === '1';
            return queryEnabled || storageEnabled;
        } catch  {
            return false;
        }
    }
    _normalizeDefines(defines) {
        if (!defines) return [];
        let entries;
        if (defines instanceof Map) {
            entries = Array.from(defines.entries());
        } else if (Array.isArray(defines)) {
            entries = defines.map((value)=>[
                    String(value),
                    true
                ]);
        } else if (typeof defines === 'object') {
            entries = Object.entries(defines);
        } else {
            entries = [
                [
                    String(defines),
                    true
                ]
            ];
        }
        return entries.map(([name, value])=>`${name}=${String(value).slice(0, 120)}`).sort();
    }
    _getMaterialId(material) {
        let id = this._materialIds.get(material);
        if (!id) {
            id = this._nextMaterialId++;
            this._materialIds.set(material, id);
        }
        return id;
    }
    constructor(){
        _define_property(this, "_enabled", false);
        _define_property(this, "_reports", []);
        _define_property(this, "_currentReport", null);
        _define_property(this, "_nextReportId", 1);
        _define_property(this, "_materialIds", new WeakMap());
        _define_property(this, "_nextMaterialId", 1);
        this._enabled = this._readEnabledFlag();
    }
}

export { OutlineDiagnostics };
