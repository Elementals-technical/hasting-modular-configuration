import { Vec3, BoundingBox, StandardMaterial, CULLFACE_NONE, BLEND_NORMAL, Color, Entity, Texture, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, PIXELFORMAT_RGBA8, LAYERID_WORLD, MeshInstance, Mesh, PRIMITIVE_TRIANGLES } from '../../../../../playcanvas-stable.min.mjs';
import { ProductRegistry_V2 } from '../../domain/product/registry/product-registry-v2.mjs';

// ═══════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════
const DEFAULTS = {
    color: '#000000',
    lineWidth: 0.003,
    endcapLength: 0.015,
    endcapWidth: 0.002,
    fontSize: 36,
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    labelScale: 0.0008,
    labelOffset: 0.015,
    offset: 0.12,
    labelPosition: 'above',
    labelGap: 'auto',
    units: 'm',
    decimals: 2,
    labelTemplate: '$L'
};
// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
const YARD = 0.9144;
const UNITS = {
    m: {
        factor: 1,
        symbol: 'm'
    },
    cm: {
        factor: 100,
        symbol: 'cm'
    },
    mm: {
        factor: 1000,
        symbol: 'mm'
    },
    in: {
        factor: 1 / YARD * 3 * 12,
        symbol: '"'
    },
    ft: {
        factor: 1 / YARD * 3,
        symbol: "'"
    }
};
function formatLabel(customLabel, distanceMeters, options = {}) {
    if (customLabel && typeof customLabel === 'string' && customLabel.trim().length > 0) {
        return customLabel;
    }
    const unit = UNITS[options.units] || UNITS.m;
    const decimals = options.decimals ?? DEFAULTS.decimals;
    const template = options.labelTemplate || DEFAULTS.labelTemplate;
    const value = (distanceMeters * unit.factor).toFixed(decimals);
    return template.replace('$L', value + unit.symbol);
}
function normalizeDimValue(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') return {
        label: raw
    };
    if (typeof raw === 'object') {
        return {
            label: raw.label || raw.value || '',
            offset: raw.offset,
            offsetX: raw.offsetX ?? 0,
            offsetY: raw.offsetY ?? 0,
            offsetZ: raw.offsetZ ?? 0,
            start: raw.start || null,
            end: raw.end || null,
            color: raw.color,
            lineWidth: raw.lineWidth,
            endcapLength: raw.endcapLength,
            endcapWidth: raw.endcapWidth,
            fontSize: raw.fontSize,
            fontFamily: raw.fontFamily,
            labelPosition: raw.labelPosition,
            labelGap: raw.labelGap,
            units: raw.units,
            decimals: raw.decimals,
            labelTemplate: raw.labelTemplate
        };
    }
    return {
        label: String(raw)
    };
}
function isSegmentPlacementKeyword(value) {
    if (typeof value !== 'string') return false;
    const normalized = value.toLowerCase();
    return normalized === 'inside' || normalized === 'outside' || normalized === 'side' || normalized === 'inner' || normalized === 'outer';
}
function normalizeHeightSegments(raw) {
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : Object.entries(raw).map(([key, value])=>{
        if (typeof value === 'string' || typeof value === 'number') {
            return {
                key,
                label: String(value)
            };
        }
        return {
            key,
            ...value || {}
        };
    });
    return list.map((segment)=>{
        const norm = normalizeDimValue(segment);
        if (!norm) return null;
        const labelPlacement = segment.labelPlacement || segment.labelSide || segment.textPlacement || (isSegmentPlacementKeyword(segment.labelPosition) ? segment.labelPosition : undefined);
        return {
            ...segment,
            ...norm,
            key: segment.key,
            nodes: Array.isArray(segment.nodes) ? segment.nodes : [],
            source: segment.source,
            sourceNodes: Array.isArray(segment.sourceNodes) ? segment.sourceNodes : [],
            side: segment.side,
            sideOffset: segment.sideOffset,
            linePlacement: segment.linePlacement || segment.placement,
            labelPlacement,
            excludeNodeNames: Array.isArray(segment.excludeNodeNames) ? segment.excludeNodeNames : [],
            excludeNameIncludes: Array.isArray(segment.excludeNameIncludes) ? segment.excludeNameIncludes : []
        };
    }).filter(Boolean);
}
function parseVec3(v) {
    if (!v) return null;
    if (Array.isArray(v) && v.length >= 3) return new Vec3(v[0], v[1], v[2]);
    if (typeof v === 'object' && 'x' in v) return new Vec3(v.x || 0, v.y || 0, v.z || 0);
    return null;
}
function mergeSettings(local = {}, global = {}) {
    return {
        color: local.color ?? global.color,
        lineWidth: local.lineWidth ?? global.lineWidth,
        endcapLength: local.endcapLength ?? global.endcapLength,
        endcapWidth: local.endcapWidth ?? global.endcapWidth,
        fontSize: local.fontSize ?? global.fontSize,
        fontFamily: local.fontFamily ?? global.fontFamily,
        labelPosition: local.labelPosition ?? global.labelPosition,
        labelGap: local.labelGap ?? global.labelGap,
        units: local.units ?? global.units,
        decimals: local.decimals ?? global.decimals,
        labelTemplate: local.labelTemplate ?? global.labelTemplate
    };
}
function hexToColor(hex) {
    return new Color(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
}
// Pre-allocated vectors
const _v0 = new Vec3();
const _v1 = new Vec3();
const _v2 = new Vec3();
const _v3 = new Vec3();
const _lineDir = new Vec3();
const _toCamera = new Vec3();
const _widthDir = new Vec3();
const _midpoint = new Vec3();
const _tmp = new Vec3();
// ═══════════════════════════════════════════════
//  CANVAS TEXTURE HELPER
// ═══════════════════════════════════════════════
class CanvasTextureHelper {
    static createLabelTexture(device, text, fontSize, fontFamily) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const font = `bold ${fontSize}px ${fontFamily}`;
        ctx.font = font;
        const textWidth = Math.ceil(ctx.measureText(text).width);
        const textHeight = Math.ceil(fontSize * 1.4);
        const pad = 12;
        // Exact canvas size = text + padding (no power-of-2 waste)
        canvas.width = textWidth + pad * 2;
        canvas.height = textHeight + pad * 2;
        // Transparent background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = font;
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        const texture = new Texture(device, {
            width: canvas.width,
            height: canvas.height,
            format: PIXELFORMAT_RGBA8,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        texture.setSource(canvas);
        return {
            texture,
            canvas,
            canvasW: canvas.width,
            canvasH: canvas.height,
            textW: canvas.width,
            textH: canvas.height
        };
    }
    static updateLabel(info, text, fontSize, fontFamily) {
        const ctx = info.canvas.getContext('2d');
        // Recalculate exact size
        const font = `bold ${fontSize}px ${fontFamily}`;
        ctx.font = font;
        const textWidth = Math.ceil(ctx.measureText(text).width);
        const textHeight = Math.ceil(fontSize * 1.4);
        const pad = 12;
        info.canvas.width = textWidth + pad * 2;
        info.canvas.height = textHeight + pad * 2;
        info.canvasW = info.canvas.width;
        info.canvasH = info.canvas.height;
        info.textW = info.canvas.width;
        info.textH = info.canvas.height;
        ctx.clearRect(0, 0, info.canvas.width, info.canvas.height);
        ctx.font = font;
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, info.canvas.width / 2, info.canvas.height / 2);
        info.texture.setSource(info.canvas);
    }
    static _nextPow2(v) {
        let p = 1;
        while(p < v)p *= 2;
        return Math.max(p, 16);
    }
}
// ═══════════════════════════════════════════════
//  MESH HELPERS
// ═══════════════════════════════════════════════
function createQuadMesh(device) {
    const mesh = new Mesh(device);
    mesh.setPositions(new Float32Array(12));
    mesh.setNormals(new Float32Array([
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        1
    ]));
    mesh.setUvs(0, new Float32Array([
        0,
        0,
        0,
        1,
        1,
        0,
        1,
        1
    ]));
    mesh.setIndices(new Uint16Array([
        0,
        1,
        2,
        1,
        3,
        2
    ]));
    mesh.update(PRIMITIVE_TRIANGLES);
    return mesh;
}
function updateQuad(mesh, a, b, c, d) {
    mesh.setPositions(new Float32Array([
        a.x,
        a.y,
        a.z,
        b.x,
        b.y,
        b.z,
        c.x,
        c.y,
        c.z,
        d.x,
        d.y,
        d.z
    ]));
    mesh.setNormals(new Float32Array([
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        1
    ]));
    mesh.update();
}
function createEntity(name, mesh, material, parent) {
    const entity = new Entity(name);
    const app = parent.root?._app || parent._app;
    const immediateLayer = app?.scene?.layers?.getLayerByName('Immediate');
    const layerId = immediateLayer ? immediateLayer.id : LAYERID_WORLD;
    entity.addComponent('render', {
        meshInstances: [
            new MeshInstance(mesh, material)
        ],
        layers: [
            layerId
        ]
    });
    parent.addChild(entity);
    return entity;
}
// ═══════════════════════════════════════════════
//  DIMENSION LINE (low-level renderer)
// ═══════════════════════════════════════════════
class DimensionLine {
    setSharedDistScale(val) {
        this._sharedDistScale = val;
    }
    setData(startPos, endPos, labelText) {
        this._startPos.copy(startPos);
        this._endPos.copy(endPos);
        const dist = _tmp.sub2(endPos, startPos).length();
        const resolvedText = formatLabel(labelText, dist, {
            units: this.units,
            decimals: this.decimals,
            labelTemplate: this.labelTemplate
        });
        if (resolvedText !== this._labelText) {
            this._labelText = resolvedText;
            this._rebuildLabel(resolvedText);
        }
        this.refresh();
    }
    refresh() {
        const start = this._startPos;
        const end = this._endPos;
        _lineDir.sub2(end, start);
        const len = _lineDir.length();
        if (len < 0.0001) return;
        _lineDir.normalize();
        _midpoint.lerp(start, end, 0.5);
        const camFwd = this.camera.forward;
        _tmp.copy(_lineDir).mulScalar(_lineDir.dot(camFwd));
        _toCamera.copy(camFwd).sub(_tmp);
        if (_toCamera.lengthSq() < 0.0001) {
            _toCamera.copy(this.camera.up);
        }
        _toCamera.normalize();
        _widthDir.cross(_lineDir, _toCamera).normalize();
        const hw = this.lineWidth / 2;
        // Line segments with gap — use sharedDistScale for consistency with label billboard
        const gapDistScale = this._sharedDistScale ?? Math.max(_tmp.copy(_midpoint).sub(this.camera.getPosition()).length() / 2.0, 0.6);
        let gapSize = 0;
        if (this.labelGap === 'auto' && this._labelInfo) {
            gapSize = this._labelInfo.canvasW * DEFAULTS.labelScale * gapDistScale + 0.005;
        } else if (typeof this.labelGap === 'number') {
            gapSize = this.labelGap;
        }
        const gapHalf = gapSize / 2;
        const gapStart = new Vec3().copy(_midpoint).sub(_tmp.copy(_lineDir).mulScalar(gapHalf));
        const gapEnd = new Vec3().copy(_midpoint).add(_tmp.copy(_lineDir).mulScalar(gapHalf));
        // Ховаємо сегменти якщо gap займає більшу частину лінії
        const hideSegments = gapSize >= len * 0.8;
        if (hideSegments) {
            this._seg0Entity.enabled = false;
            this._seg1Entity.enabled = false;
        } else {
            this._seg0Entity.enabled = true;
            this._seg1Entity.enabled = true;
            _v0.copy(start).add(_tmp.copy(_widthDir).mulScalar(hw));
            _v1.copy(start).sub(_tmp.copy(_widthDir).mulScalar(hw));
            _v2.copy(gapStart).add(_tmp.copy(_widthDir).mulScalar(hw));
            _v3.copy(gapStart).sub(_tmp.copy(_widthDir).mulScalar(hw));
            updateQuad(this._seg0Mesh, _v0, _v1, _v2, _v3);
            _v0.copy(gapEnd).add(_tmp.copy(_widthDir).mulScalar(hw));
            _v1.copy(gapEnd).sub(_tmp.copy(_widthDir).mulScalar(hw));
            _v2.copy(end).add(_tmp.copy(_widthDir).mulScalar(hw));
            _v3.copy(end).sub(_tmp.copy(_widthDir).mulScalar(hw));
            updateQuad(this._seg1Mesh, _v0, _v1, _v2, _v3);
        }
        // Endcaps
        const ecHalf = this.endcapLength / 2;
        const ecW = this.endcapWidth / 2;
        const wOff = new Vec3().copy(_widthDir).mulScalar(ecHalf);
        const lOff = new Vec3().copy(_lineDir).mulScalar(ecW);
        _v0.copy(start).add(wOff).add(lOff);
        _v1.copy(start).sub(wOff).add(lOff);
        _v2.copy(start).add(wOff).sub(lOff);
        _v3.copy(start).sub(wOff).sub(lOff);
        updateQuad(this._ec0Mesh, _v0, _v1, _v2, _v3);
        _v0.copy(end).add(wOff).add(lOff);
        _v1.copy(end).sub(wOff).add(lOff);
        _v2.copy(end).add(wOff).sub(lOff);
        _v3.copy(end).sub(wOff).sub(lOff);
        updateQuad(this._ec1Mesh, _v0, _v1, _v2, _v3);
        // Label billboard
        if (this._labelEntity && this._labelInfo) {
            const scale = DEFAULTS.labelScale;
            // Use canvasW/canvasH (power-of-2) for quad sizing to match UV 0→1 mapping
            this._labelInfo.canvasW * scale / 2;
            this._labelInfo.canvasH * scale / 2;
            const camRight = this.camera.right;
            const camUp = this.camera.up;
            // Camera-distance compensation: use shared scale for uniform label sizes
            const distScale = this._sharedDistScale ?? (()=>{
                const camPos = this.camera.getPosition();
                const dist = _tmp.copy(_midpoint).sub(camPos).length();
                return Math.max(dist / 2.0, 0.6);
            })();
            const adjScale = scale * distScale;
            const adjLw = this._labelInfo.canvasW * adjScale / 2;
            const adjLh = this._labelInfo.canvasH * adjScale / 2;
            const adjROff = new Vec3().copy(camRight).mulScalar(adjLw);
            const adjUOff = new Vec3().copy(camUp).mulScalar(adjLh);
            const labelAnchor = new Vec3().copy(_midpoint);
            if (this._labelOffsetDir) {
                const labelOffset = DEFAULTS.labelOffset + Math.max(adjLw, adjLh);
                labelAnchor.add(new Vec3().copy(this._labelOffsetDir).normalize().mulScalar(labelOffset));
            } else if (this.labelPosition === 'above') {
                labelAnchor.add(new Vec3().copy(_widthDir).mulScalar(DEFAULTS.labelOffset + adjLh));
            } else if (this.labelPosition === 'below') {
                labelAnchor.sub(new Vec3().copy(_widthDir).mulScalar(DEFAULTS.labelOffset + adjLh));
            }
            // 'center' — label sits in the gap on the line, no perpendicular offset
            _v0.copy(labelAnchor).sub(adjROff).add(adjUOff);
            _v1.copy(labelAnchor).sub(adjROff).sub(adjUOff);
            _v2.copy(labelAnchor).add(adjROff).add(adjUOff);
            _v3.copy(labelAnchor).add(adjROff).sub(adjUOff);
            updateQuad(this._labelMesh, _v0, _v1, _v2, _v3);
        }
    }
    setVisible(v) {
        this.root.enabled = v;
    }
    destroy() {
        this.root.destroy();
        this._seg0Mesh?.destroy();
        this._seg1Mesh?.destroy();
        this._ec0Mesh?.destroy();
        this._ec1Mesh?.destroy();
        this._labelMesh?.destroy();
        this._lineMat?.destroy();
        this._labelMat?.destroy();
        this._labelInfo?.texture?.destroy();
    }
    _rebuildLabel(text) {
        if (!text) return;
        if (!this._labelInfo) {
            this._labelInfo = CanvasTextureHelper.createLabelTexture(this.device, text, this.fontSize, this.fontFamily);
            this._labelMat = new StandardMaterial();
            this._labelMat.useLighting = false;
            this._labelMat.depthWrite = false;
            this._labelMat.depthTest = false;
            this._labelMat.cull = CULLFACE_NONE;
            this._labelMat.blendType = BLEND_NORMAL;
            this._labelMat.diffuse = new Color(0, 0, 0);
            this._labelMat.emissive = new Color(1, 1, 1);
            this._labelMat.emissiveIntensity = 3;
            this._labelMat.emissiveMap = this._labelInfo.texture;
            this._labelMat.opacityMap = this._labelInfo.texture;
            this._labelMat.alphaTest = 0.01;
            this._labelMat.update();
            this._labelEntity = createEntity('lbl', this._labelMesh, this._labelMat, this.root);
        } else {
            CanvasTextureHelper.updateLabel(this._labelInfo, text, this.fontSize, this.fontFamily);
        }
    }
    constructor(app, camera, options = {}){
        this.app = app;
        this.camera = camera;
        this.device = app.graphicsDevice;
        this.lineWidth = options.lineWidth || DEFAULTS.lineWidth;
        this.endcapLength = options.endcapLength || DEFAULTS.endcapLength;
        this.endcapWidth = options.endcapWidth || DEFAULTS.endcapWidth;
        this.color = options.color || DEFAULTS.color;
        this.fontSize = options.fontSize || DEFAULTS.fontSize;
        this.fontFamily = options.fontFamily || DEFAULTS.fontFamily;
        this.labelPosition = options.labelPosition || DEFAULTS.labelPosition;
        this.units = options.units || DEFAULTS.units;
        this.decimals = options.decimals ?? DEFAULTS.decimals;
        this.labelTemplate = options.labelTemplate || DEFAULTS.labelTemplate;
        this.labelGap = options.labelGap !== undefined ? options.labelGap : DEFAULTS.labelGap;
        this._startPos = new Vec3();
        this._endPos = new Vec3();
        this._labelText = '';
        this.root = new Entity('dim');
        app.root.addChild(this.root);
        const c = hexToColor(this.color);
        this._lineMat = new StandardMaterial();
        this._lineMat.useLighting = false;
        this._lineMat.diffuse = c;
        this._lineMat.emissive = c;
        this._lineMat.depthWrite = false;
        this._lineMat.depthTest = false;
        this._lineMat.cull = CULLFACE_NONE;
        this._lineMat.update();
        this._seg0Mesh = createQuadMesh(this.device);
        this._seg1Mesh = createQuadMesh(this.device);
        this._seg0Entity = createEntity('seg0', this._seg0Mesh, this._lineMat, this.root);
        this._seg1Entity = createEntity('seg1', this._seg1Mesh, this._lineMat, this.root);
        this._ec0Mesh = createQuadMesh(this.device);
        this._ec1Mesh = createQuadMesh(this.device);
        this._ec0Entity = createEntity('ec0', this._ec0Mesh, this._lineMat, this.root);
        this._ec1Entity = createEntity('ec1', this._ec1Mesh, this._lineMat, this.root);
        this._labelInfo = null;
        this._labelMat = null;
        this._labelMesh = createQuadMesh(this.device);
        this._labelEntity = null;
    }
}
// ═══════════════════════════════════════════════
//  DIMENSION SYSTEM
// ═══════════════════════════════════════════════
class DimensionSystem {
    // ─── PUBLIC API ───
    showDimensions(data) {
        this._setup(data);
    }
    hideDimensions() {
        this.clear();
        this._visible = false;
        this._lastData = null;
    }
    toggleDimensions() {
        if (this._visible) this.hideDimensions();
        else if (this._lastData) this.showDimensions(this._lastData);
    }
    /**
     * Повністю переініціалізує dimensions з останніх даних.
     * Викликати після add/remove кабінету або зміни розмірів.
     */ refresh() {
        if (!this._visible || !this._lastData) return;
        this._setup(this._lastData);
    }
    clear() {
        this._dims.forEach((d)=>d.destroy());
        this._dims = [];
        this._lineBoxes = [];
        this._hasBox = false;
    }
    update() {
        if (!this._visible || this._dims.length === 0) return;
        this._repositionAll();
    }
    destroy() {
        this.clear();
    }
    // ─── SETUP ───
    _setup(data) {
        this.clear();
        this._lastData = data;
        this._visible = true;
        this._boxNodes = [];
        this._boxExcludeNodeNames = [];
        this._boxExcludeNameIncludes = [];
        const ls = data.labelSettings || {};
        this._offset = ls.offset ?? DEFAULTS.offset;
        if (data.box) {
            this._setupBox(data.box, ls);
        }
        if (data.lines && data.lines.length > 0) {
            this._setupLines(data.lines, ls);
        }
        this._repositionAll();
    }
    _setupBox(boxCfg, globalSettings) {
        this._boxNodes = boxCfg.nodes || [];
        this._boxExcludeNodeNames = Array.isArray(boxCfg.excludeNodeNames) ? boxCfg.excludeNodeNames : [];
        this._boxExcludeNameIncludes = Array.isArray(boxCfg.excludeNameIncludes) ? boxCfg.excludeNameIncludes : [];
        const entities = this._resolveNodes(this._boxNodes);
        if (entities.length === 0) return;
        const aabb = this._computeAABB(entities, this._getBoxAabbOptions());
        if (!aabb) return;
        this._boxCenter.copy(aabb.center);
        this._boxHalf.copy(aabb.halfExtents);
        this._hasBox = true;
        const axes = [
            {
                key: 'width',
                type: 'box:width'
            },
            {
                key: 'height',
                type: 'box:height'
            },
            {
                key: 'depth',
                type: 'box:depth'
            }
        ];
        for (const { key, type } of axes){
            const norm = normalizeDimValue(boxCfg[key]);
            if (!norm) continue;
            const opts = mergeSettings(norm, globalSettings);
            const d = new DimensionLine(this.app, this.camera, opts);
            d._dimType = type;
            d._customLabel = norm.label;
            d._dimOffset = norm.offset;
            d._offsetVec = new Vec3(norm.offsetX || 0, norm.offsetY || 0, norm.offsetZ || 0);
            d._customStart = parseVec3(norm.start);
            d._customEnd = parseVec3(norm.end);
            this._dims.push(d);
        }
        const heightSegments = normalizeHeightSegments(boxCfg.heightSegments);
        for (const segment of heightSegments){
            const opts = mergeSettings({
                ...segment,
                labelGap: segment.labelGap ?? 0,
                labelPosition: segment.labelPosition ?? 'above'
            }, globalSettings);
            const d = new DimensionLine(this.app, this.camera, opts);
            d._dimType = 'box:height-segment';
            d._customLabel = segment.label;
            d._dimOffset = segment.offset;
            d._offsetVec = new Vec3(segment.offsetX || 0, segment.offsetY || 0, segment.offsetZ || 0);
            d._customStart = parseVec3(segment.start);
            d._customEnd = parseVec3(segment.end);
            d._segmentNodes = segment.nodes || [];
            d._segmentSource = segment.source || null;
            d._segmentSourceNodes = segment.sourceNodes || [];
            d._segmentSide = segment.side || 'camera';
            d._segmentSideOffset = segment.sideOffset ?? 0.035;
            d._segmentLinePlacement = segment.linePlacement || 'outside';
            d._segmentLabelPlacement = segment.labelPlacement || d._segmentLinePlacement;
            d._segmentExcludeNodeNames = segment.excludeNodeNames || [];
            d._segmentExcludeNameIncludes = segment.excludeNameIncludes || [];
            this._dims.push(d);
        }
    }
    _setupLines(linesArray, globalSettings) {
        for (const lineCfg of linesArray){
            const opts = mergeSettings(lineCfg, globalSettings);
            const d = new DimensionLine(this.app, this.camera, opts);
            d._dimType = 'line';
            d._customLabel = lineCfg.label || '';
            d._dimOffset = lineCfg.offset;
            d._offsetVec = new Vec3(lineCfg.offsetX || 0, lineCfg.offsetY || 0, lineCfg.offsetZ || 0);
            d._customStart = parseVec3(lineCfg.start);
            d._customEnd = parseVec3(lineCfg.end);
            d._axis = lineCfg.axis || 'x';
            if (lineCfg.node) {
                const entity = this.app.root.findByName(lineCfg.node);
                if (entity) {
                    const box = this._entityAABB(entity, true);
                    if (box) {
                        d._lineIdx = this._lineBoxes.length;
                        this._lineBoxes.push({
                            entity,
                            center: box.center.clone(),
                            half: box.halfExtents.clone()
                        });
                    }
                }
            }
            this._dims.push(d);
        }
    }
    // ─── REPOSITIONING ───
    _repositionAll() {
        // Перераховуємо box AABB кожен кадр (реагуємо на add/remove/resize)
        if (this._boxNodes.length > 0) {
            const entities = this._resolveNodes(this._boxNodes);
            if (entities.length > 0) {
                const aabb = this._computeAABB(entities, this._getBoxAabbOptions());
                if (aabb) {
                    this._boxCenter.copy(aabb.center);
                    this._boxHalf.copy(aabb.halfExtents);
                    this._hasBox = true;
                } else {
                    this._hasBox = false;
                }
            } else {
                this._hasBox = false;
            }
        }
        const camPos = this.camera.getPosition();
        const off = this._offset;
        // Спільний distScale від камери до центру box — однаковий для всіх labels
        let sharedDistScale = 0.6;
        if (this._hasBox) {
            const distToCenter = _tmp.copy(this._boxCenter).sub(camPos).length();
            sharedDistScale = Math.min(Math.max(distToCenter / 2.0, 0.6), 1.2);
        }
        for (const d of this._dims){
            d.setSharedDistScale(sharedDistScale);
        }
        let frontZ, backZ, frontX;
        if (this._hasBox) {
            const c = this._boxCenter;
            const h = this._boxHalf;
            frontZ = camPos.z > c.z ? c.z + h.z + off : c.z - h.z - off;
            backZ = camPos.z > c.z ? c.z - h.z - off : c.z + h.z + off;
            frontX = camPos.x > c.x ? c.x + h.x + off : c.x - h.x - off;
        }
        for (const d of this._dims){
            const type = d._dimType;
            const label = d._customLabel || '';
            const dOff = d._dimOffset ?? off;
            const ax = d._offsetVec || Vec3.ZERO;
            let s, e;
            if (d._customStart && d._customEnd) {
                s = d._customStart.clone();
                e = d._customEnd.clone();
            } else if (this._hasBox && type.startsWith('box:')) {
                const c = this._boxCenter;
                const h = this._boxHalf;
                if (type === 'box:width') {
                    s = new Vec3(c.x - h.x, c.y + h.y + dOff, backZ);
                    e = new Vec3(c.x + h.x, c.y + h.y + dOff, backZ);
                } else if (type === 'box:height') {
                    s = new Vec3(frontX, c.y - h.y, frontZ);
                    e = new Vec3(frontX, c.y + h.y, frontZ);
                } else if (type === 'box:depth') {
                    s = new Vec3(frontX, c.y - h.y - dOff, c.z - h.z);
                    e = new Vec3(frontX, c.y - h.y - dOff, c.z + h.z);
                } else if (type === 'box:height-segment') {
                    const segmentAabb = this._computeSegmentAABB(d);
                    if (!segmentAabb) continue;
                    const placement = this._resolveHeightSegmentPlacement(d, c, h, camPos, frontX, frontZ);
                    d._labelOffsetDir = placement.labelOffsetDir;
                    s = new Vec3(placement.x, segmentAabb.center.y - segmentAabb.halfExtents.y, frontZ);
                    e = new Vec3(placement.x, segmentAabb.center.y + segmentAabb.halfExtents.y, frontZ);
                }
            } else if (type === 'line') {
                const lb = d._lineIdx !== undefined ? this._lineBoxes[d._lineIdx] : null;
                if (lb) {
                    const freshBox = this._entityAABB(lb.entity, true);
                    if (freshBox) {
                        lb.center.copy(freshBox.center);
                        lb.half.copy(freshBox.halfExtents);
                    }
                    const ec = lb.center;
                    const eh = lb.half;
                    const axis = d._axis || 'x';
                    if (axis === 'x') {
                        // Extra gap when box exists to avoid overlap with box:depth line
                        const lineStackGap = this._hasBox ? 0.035 : 0;
                        const yPos = this._hasBox ? this._boxCenter.y - this._boxHalf.y - dOff - lineStackGap : ec.y - eh.y - dOff;
                        const zPos = this._hasBox ? frontZ : ec.z + eh.z + dOff;
                        s = new Vec3(ec.x - eh.x, yPos, zPos);
                        e = new Vec3(ec.x + eh.x, yPos, zPos);
                    } else if (axis === 'y') {
                        const xPos = this._hasBox ? frontX : ec.x + eh.x + dOff;
                        const zPos = this._hasBox ? frontZ : ec.z + eh.z + dOff;
                        s = new Vec3(xPos, ec.y - eh.y, zPos);
                        e = new Vec3(xPos, ec.y + eh.y, zPos);
                    } else if (axis === 'z') {
                        const xPos = this._hasBox ? frontX : ec.x + eh.x + dOff;
                        const yPos = this._hasBox ? this._boxCenter.y - this._boxHalf.y - dOff : ec.y - eh.y - dOff;
                        s = new Vec3(xPos, yPos, ec.z - eh.z);
                        e = new Vec3(xPos, yPos, ec.z + eh.z);
                    }
                }
            }
            if (!s || !e) continue;
            s.x += ax.x;
            s.y += ax.y;
            s.z += ax.z;
            e.x += ax.x;
            e.y += ax.y;
            e.z += ax.z;
            d.setData(s, e, label);
            d.refresh();
        }
    }
    // ─── INTERNAL ───
    _resolveNodes(nodeNames) {
        if (!nodeNames || !nodeNames.length) return [];
        return nodeNames.map((name)=>this.app.root.findByName(name)).filter(Boolean);
    }
    _computeAABB(entities, options = {}) {
        const box = new BoundingBox();
        let init = false;
        for (const e of entities){
            if (!e?.enabled) continue;
            const b = this._entityAABB(e, false, options);
            if (!b) continue;
            if (!init) {
                box.copy(b);
                init = true;
            } else box.add(b);
        }
        return init ? box : null;
    }
    _getBoxAabbOptions() {
        return {
            excludeNodeNames: this._boxExcludeNodeNames,
            excludeNameIncludes: this._boxExcludeNameIncludes
        };
    }
    _computeSegmentAABB(dim) {
        const entities = dim._segmentSource === 'sink' ? this._resolveSinkSegmentEntities(dim._segmentSourceNodes) : this._resolveNodes(dim._segmentNodes || []);
        if (entities.length === 0) return null;
        return this._computeAABB(entities, {
            excludeNodeNames: dim._segmentExcludeNodeNames || [],
            excludeNameIncludes: dim._segmentExcludeNameIncludes || []
        });
    }
    _resolveSinkSegmentEntities(cabinetNodeNames) {
        const result = [];
        for (const cabinetName of cabinetNodeNames || []){
            const cabinet = this.app.root.findByName(cabinetName);
            const sinkAnchorName = ProductRegistry_V2.instance.getSinkAnchorName(cabinetName);
            const sinkPoint = sinkAnchorName ? cabinet?.findByName?.(sinkAnchorName) : null;
            if (!sinkPoint?.enabled) continue;
            for (const child of sinkPoint.children || []){
                if (child?.enabled) result.push(child);
            }
        }
        return result;
    }
    _resolveHeightSegmentPlacement(dim, boxCenter, boxHalf, camPos, frontX, frontZ) {
        const side = dim._segmentSide || 'camera';
        const sideOffset = dim._segmentSideOffset || 0;
        const linePlacement = dim._segmentLinePlacement || 'outside';
        const labelPlacement = dim._segmentLabelPlacement || linePlacement;
        const sideSign = this._resolveHeightSegmentSideSign(side, boxCenter, camPos);
        const normalizedLinePlacement = this._normalizeSegmentPlacement(linePlacement);
        const normalizedLabelPlacement = this._normalizeSegmentPlacement(labelPlacement);
        let x;
        if (normalizedLinePlacement === 'inside') {
            x = boxCenter.x + sideSign * Math.max(0, boxHalf.x - sideOffset);
        } else if (side === 'camera') {
            x = frontX + sideSign * sideOffset;
        } else {
            x = boxCenter.x + sideSign * (boxHalf.x + this._offset + sideOffset);
        }
        const sideVector = new Vec3(x - boxCenter.x, 0, frontZ - boxCenter.z);
        let screenSideSign = sideVector.dot(this.camera.right) >= 0 ? 1 : -1;
        if (sideVector.lengthSq() < 0.0001) {
            screenSideSign = sideSign;
        }
        const labelSign = normalizedLabelPlacement === 'inside' ? -screenSideSign : screenSideSign;
        return {
            x,
            labelOffsetDir: new Vec3().copy(this.camera.right).mulScalar(labelSign)
        };
    }
    _resolveHeightSegmentSideSign(side, boxCenter, camPos) {
        if (side === 'left' || side === 'screen-left') return -1;
        if (side === 'right' || side === 'screen-right') return 1;
        if (side === 'camera') return camPos.x > boxCenter.x ? 1 : -1;
        return 1;
    }
    _normalizeSegmentPlacement(value) {
        const normalized = typeof value === 'string' ? value.toLowerCase() : value;
        if (normalized === 'inner') return 'inside';
        if (normalized === 'outer') return 'outside';
        if (normalized === 'side') return 'outside';
        return normalized;
    }
    _entityAABB(entity, excludeHandles = false, options = {}) {
        const box = new BoundingBox();
        let init = false;
        const excludeNodeNames = options.excludeNodeNames || [];
        const excludeNameIncludes = options.excludeNameIncludes || [];
        const traverse = (n)=>{
            if (!n?.enabled) return;
            if (excludeNodeNames.includes(n.name)) return;
            if (excludeNameIncludes.some((part)=>n.name?.includes(part))) return;
            if (excludeHandles && n.name && n.name.startsWith('Handle')) return;
            const mis = n.render?.meshInstances || n.model?.meshInstances || [];
            for (const mi of mis){
                if (!mi?.aabb) continue;
                // Примусово оновлюємо world-space AABB
                if (mi.mesh?.aabb && n.getWorldTransform) {
                    mi._aabbDirty = true;
                }
                const aabb = mi.aabb;
                if (!init) {
                    box.copy(aabb);
                    init = true;
                } else box.add(aabb);
            }
            for (const child of n.children)traverse(child);
        };
        traverse(entity);
        return init ? box : null;
    }
    constructor(app, cameraEntity){
        this.app = app;
        this.camera = cameraEntity;
        this._dims = [];
        this._visible = false;
        this._lastData = null;
        this._boxCenter = new Vec3();
        this._boxHalf = new Vec3();
        this._hasBox = false;
        this._lineBoxes = [];
        this._offset = DEFAULTS.offset;
        this._boxNodes = [];
        this._boxExcludeNodeNames = [];
        this._boxExcludeNameIncludes = [];
    }
}

export { DimensionSystem };
