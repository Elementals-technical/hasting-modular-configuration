/**
 * @class GLBExporter
 * @classdesc Exports scene geometry AND textures to GLB (glTF 2.0 binary) format
 */ class GLBExporter {
    static async export(geometryData, options = {}) {
        const exporter = new GLBExporter();
        return await exporter._export(geometryData, options);
    }
    async _export(geometryData, options) {
        const scaleToMeters = options.scaleToMeters || 0.01;
        geometryData.forEach((product)=>{
            this._addProduct(product, scaleToMeters);
        });
        await this._processTexturesInMaterials(options);
        return this._createGLB();
    }
    _addProduct(product, scaleToMeters) {
        product.meshes.forEach((meshData)=>{
            meshData.meshes.forEach((mesh)=>{
                const meshIndex = this._addMesh(mesh, scaleToMeters);
                const materialIndex = this._getMaterialIndex(mesh.material);
                this.gltf.meshes[meshIndex].primitives[0].material = materialIndex;
                const nodeIndex = this.gltf.nodes.length;
                this.gltf.nodes.push({
                    name: mesh.name,
                    mesh: meshIndex,
                    translation: this._scaleVector(meshData.transform.position, scaleToMeters),
                    rotation: meshData.transform.rotation,
                    scale: meshData.transform.scale
                });
                this.gltf.scenes[0].nodes.push(nodeIndex);
            });
        });
    }
    _addMesh(mesh, scaleToMeters) {
        const meshIndex = this.gltf.meshes.length;
        const positionsAccessor = this._addAccessor(this._scalePositions(mesh.positions, scaleToMeters), 'VEC3', 5126, false);
        const normalsAccessor = this._addAccessor(mesh.normals, 'VEC3', 5126, false);
        const uvsAccessor = mesh.uvs && mesh.uvs.length > 0 ? this._addAccessor(mesh.uvs, 'VEC2', 5126, false) : null;
        const indicesAccessor = this._addAccessor(mesh.indices, 'SCALAR', 5125, true);
        const primitive = {
            attributes: {
                POSITION: positionsAccessor,
                NORMAL: normalsAccessor
            },
            indices: indicesAccessor,
            mode: 4
        };
        if (uvsAccessor !== null) primitive.attributes.TEXCOORD_0 = uvsAccessor;
        this.gltf.meshes.push({
            name: mesh.name,
            primitives: [
                primitive
            ]
        });
        return meshIndex;
    }
    _getMaterialIndex(materialData) {
        const diffId = materialData.diffuseMap ? materialData.diffuseMap.id || materialData.diffuseMap.name : 'no_diff';
        const key = `${materialData.name}_${diffId}`;
        if (this.materialMap.has(key)) {
            return this.materialMap.get(key).index;
        }
        const materialIndex = this.gltf.materials.length;
        const matDef = {
            name: materialData.name,
            pbrMetallicRoughness: {
                baseColorFactor: materialData.baseColor,
                metallicFactor: materialData.metallic,
                roughnessFactor: materialData.roughness
            },
            emissiveFactor: materialData.emissive || [
                0,
                0,
                0
            ],
            doubleSided: true
        };
        this.gltf.materials.push(matDef);
        this.materialMap.set(key, {
            index: materialIndex,
            data: materialData
        });
        return materialIndex;
    }
    async _processTexturesInMaterials(options) {
        for (const [key, entry] of this.materialMap.entries()){
            const matDef = this.gltf.materials[entry.index];
            const matData = entry.data;
            if (matData.diffuseMap) {
                const texIndex = await this._addTexture(matData.diffuseMap, options);
                if (texIndex !== -1) {
                    matDef.pbrMetallicRoughness.baseColorTexture = {
                        index: texIndex
                    };
                    matDef.pbrMetallicRoughness.baseColorFactor = [
                        1,
                        1,
                        1,
                        1
                    ];
                }
            }
            if (matData.normalMap) {
                const texIndex = await this._addTexture(matData.normalMap, options);
                if (texIndex !== -1) {
                    matDef.normalTexture = {
                        index: texIndex
                    };
                }
            }
        }
    }
    async _addTexture(textureObj, options) {
        if (!textureObj) return -1;
        const cacheKey = textureObj.id || textureObj.name;
        if (this.textureMap.has(cacheKey)) {
            return this.textureMap.get(cacheKey);
        }
        try {
            const imageBuffer = await this._textureToPNG(textureObj, options.maxTextureSize || 1024);
            if (!imageBuffer) return -1;
            const bufferViewIndex = this._addBufferView(imageBuffer, 0, false);
            const imageIndex = this.gltf.images.length;
            this.gltf.images.push({
                bufferView: bufferViewIndex,
                mimeType: "image/png"
            });
            const textureIndex = this.gltf.textures.length;
            this.gltf.textures.push({
                source: imageIndex,
                sampler: 0
            });
            this.textureMap.set(cacheKey, textureIndex);
            return textureIndex;
        } catch (e) {
            return -1;
        }
    }
    _textureToPNG(texture, maxSize) {
        return new Promise((resolve)=>{
            let source = texture.getSource();
            if (!source && texture._levels && texture._levels[0]) {
                source = texture._levels[0];
            }
            const isValidSource = source && (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement || source instanceof ImageBitmap || source instanceof HTMLVideoElement);
            if (!isValidSource) {
                resolve(null);
                return;
            }
            try {
                const canvas = document.createElement('canvas');
                let width = source.width || texture.width;
                let height = source.height || texture.height;
                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (source instanceof HTMLImageElement && !source.crossOrigin && source.src.startsWith('http')) {
                    source.crossOrigin = "anonymous";
                }
                ctx.drawImage(source, 0, 0, width, height);
                canvas.toBlob((blob)=>{
                    if (!blob) {
                        resolve(null);
                        return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = ()=>resolve(new Uint8Array(reader.result));
                    reader.readAsArrayBuffer(blob);
                }, 'image/png');
            } catch (err) {
                resolve(null);
            }
        });
    }
    _addAccessor(data, type, componentType, isIndices) {
        const accessorIndex = this.gltf.accessors.length;
        let componentSize = type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1;
        let count = data.length / componentSize;
        const bufferViewIndex = this._addBufferView(data, componentType, isIndices);
        const accessor = {
            bufferView: bufferViewIndex,
            byteOffset: 0,
            componentType: componentType,
            count: count,
            type: type
        };
        if (type === 'VEC3' && !isIndices) {
            const min = [
                Infinity,
                Infinity,
                Infinity
            ], max = [
                -Infinity,
                -Infinity,
                -Infinity
            ];
            for(let i = 0; i < data.length; i += 3){
                for(let j = 0; j < 3; j++){
                    min[j] = Math.min(min[j], data[i + j]);
                    max[j] = Math.max(max[j], data[i + j]);
                }
            }
            accessor.min = min;
            accessor.max = max;
        }
        this.gltf.accessors.push(accessor);
        return accessorIndex;
    }
    _addBufferView(data, componentType, isIndices) {
        const bufferViewIndex = this.gltf.bufferViews.length;
        let rawBuffer;
        if (data instanceof Uint8Array) {
            rawBuffer = data;
        } else {
            rawBuffer = componentType === 5126 ? new Float32Array(data) : new Uint32Array(data);
            rawBuffer = new Uint8Array(rawBuffer.buffer);
        }
        const byteLength = rawBuffer.byteLength;
        const byteOffset = this.currentBufferOffset;
        const padding = (4 - byteLength % 4) % 4;
        this.bufferData.push({
            data: rawBuffer,
            padding: padding
        });
        const bufferView = {
            buffer: 0,
            byteOffset: byteOffset,
            byteLength: byteLength
        };
        if (isIndices !== undefined) {
            bufferView.target = isIndices ? 34963 : 34962;
        }
        this.gltf.bufferViews.push(bufferView);
        this.currentBufferOffset += byteLength + padding;
        return bufferViewIndex;
    }
    _scalePositions(positions, scale) {
        const scaled = new Float32Array(positions.length);
        for(let i = 0; i < positions.length; i++)scaled[i] = positions[i] * scale;
        return scaled;
    }
    _scaleVector(vec, scale) {
        return [
            vec[0] * scale,
            vec[1] * scale,
            vec[2] * scale
        ];
    }
    _createGLB() {
        this.gltf.buffers[0].byteLength = this.currentBufferOffset;
        const jsonString = JSON.stringify(this.gltf);
        const jsonBuffer = new TextEncoder().encode(jsonString);
        const jsonPadding = (4 - jsonBuffer.length % 4) % 4;
        const jsonChunkLength = jsonBuffer.length + jsonPadding;
        const binaryChunkLength = this.currentBufferOffset;
        const totalLength = 12 + 8 + jsonChunkLength + 8 + binaryChunkLength;
        const glbBuffer = new ArrayBuffer(totalLength);
        const view = new DataView(glbBuffer);
        const uint8View = new Uint8Array(glbBuffer);
        let offset = 0;
        view.setUint32(offset, 0x46546C67, true);
        offset += 4;
        view.setUint32(offset, 2, true);
        offset += 4;
        view.setUint32(offset, totalLength, true);
        offset += 4;
        view.setUint32(offset, jsonChunkLength, true);
        offset += 4;
        view.setUint32(offset, 0x4E4F534A, true);
        offset += 4;
        uint8View.set(jsonBuffer, offset);
        offset += jsonBuffer.length;
        for(let i = 0; i < jsonPadding; i++)uint8View[offset++] = 0x20;
        view.setUint32(offset, binaryChunkLength, true);
        offset += 4;
        view.setUint32(offset, 0x004E4942, true);
        offset += 4;
        this.bufferData.forEach(({ data, padding })=>{
            uint8View.set(data, offset);
            offset += data.byteLength;
            for(let i = 0; i < padding; i++)uint8View[offset++] = 0x00;
        });
        return glbBuffer;
    }
    constructor(){
        this.gltf = {
            asset: {
                version: '2.0',
                generator: 'PlayCanvas Configurator'
            },
            scene: 0,
            scenes: [
                {
                    name: 'Scene',
                    nodes: []
                }
            ],
            nodes: [],
            meshes: [],
            materials: [],
            accessors: [],
            bufferViews: [],
            textures: [],
            images: [],
            samplers: [
                {
                    magFilter: 9729,
                    minFilter: 9987,
                    wrapS: 10497,
                    wrapT: 10497
                }
            ],
            buffers: [
                {
                    byteLength: 0
                }
            ]
        };
        this.bufferData = [];
        this.materialMap = new Map();
        this.textureMap = new Map();
        this.currentBufferOffset = 0;
    }
}

export { GLBExporter };
