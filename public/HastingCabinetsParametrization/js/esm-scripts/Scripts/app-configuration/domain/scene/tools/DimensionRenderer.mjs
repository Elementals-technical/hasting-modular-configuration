import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';

class SimpleDimensionRenderer {
    render(bounds, dimensionStrings, productName, entity) {
        this.clear();
        if (!bounds || !dimensionStrings || !entity) return;
        this.currentBounds = bounds;
        this.currentEntity = entity;
        this.currentStrings = dimensionStrings;
        this.currentProductName = productName;
        if (productName) {
            this._createLabelElement("name", productName, "product-name");
        }
        if (dimensionStrings.height) {
            this._createLabelElement("height", dimensionStrings.height, "height");
        }
        if (dimensionStrings.width) {
            this._createLabelElement("width", dimensionStrings.width, "width");
        }
        if (dimensionStrings.depth) {
            this._createLabelElement("depth", dimensionStrings.depth, "depth");
        }
    }
    _createLabelElement(id, text, cssClass) {
        const labelDiv = document.createElement('div');
        labelDiv.className = `dimension-label dimension-label-${cssClass}`;
        labelDiv.textContent = text;
        // Базовые стили
        labelDiv.style.position = 'absolute';
        labelDiv.style.pointerEvents = 'none';
        labelDiv.style.zIndex = '1000';
        labelDiv.style.whiteSpace = 'nowrap';
        labelDiv.style.fontFamily = "'Inter', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";
        labelDiv.style.transform = 'translate(-50%, -50%)';
        labelDiv.style.display = 'none';
        labelDiv.style.webkitFontSmoothing = 'antialiased';
        labelDiv.style.MozOsxFontSmoothing = 'grayscale';
        labelDiv.style.color = '#1a1a1a';
        labelDiv.style.fontWeight = '600';
        labelDiv.style.letterSpacing = '0.02em';
        labelDiv.style.textShadow = '0 0 3px #fff, 0 0 3px #fff, 0 0 6px rgba(255,255,255,0.8)';
        labelDiv.style.background = 'transparent';
        labelDiv.style.padding = '2px 6px';
        if (id === 'name') {
            labelDiv.style.fontSize = '13px';
            labelDiv.style.fontWeight = '700';
            labelDiv.style.textTransform = 'uppercase';
        } else {
            labelDiv.style.fontSize = '13px';
        }
        document.body.appendChild(labelDiv);
        this.labelEntities.push({
            id: id,
            element: labelDiv,
            worldPosition: new Vec3() // Будет обновляться
        });
    }
    updateLabelPositions(cameraEntity) {
        if (!cameraEntity || !this.currentBounds || !this.currentEntity) return;
        const camera = cameraEntity.camera;
        const center = this.currentBounds.center;
        const half = this.currentBounds.halfExtents;
        const entity = this.currentEntity;
        this._camForward.copy(cameraEntity.forward).normalize();
        this._camRight.copy(cameraEntity.right).normalize();
        this._camUp.copy(cameraEntity.up).normalize();
        const objRight = entity.right;
        const objForward = entity.forward;
        const visualRadiusX = Math.abs(objRight.dot(this._camRight)) * half.x + Math.abs(objForward.dot(this._camRight)) * half.z;
        const offset = 0.08;
        const dotFwd = Math.abs(entity.forward.dot(this._camForward));
        const isFrontView = dotFwd > 0.5;
        this.labelEntities.forEach((item)=>{
            const pos = item.worldPosition;
            if (item.id === 'height') {
                pos.copy(center);
                this._vecA.copy(this._camRight).scale(-(visualRadiusX + offset));
                pos.add(this._vecA);
            } else if (item.id === 'name') {
                pos.copy(center);
                this._vecA.copy(this._camUp).scale(half.y + offset + 0.15);
                pos.add(this._vecA);
            } else {
                const isMainDimension = isFrontView && item.id === 'width' || !isFrontView && item.id === 'depth';
                const isSecondaryDimension = !isFrontView && item.id === 'width' || isFrontView && item.id === 'depth';
                if (isMainDimension) {
                    pos.copy(center);
                    this._vecA.copy(this._camUp).scale(half.y + offset);
                    pos.add(this._vecA);
                } else if (isSecondaryDimension) {
                    pos.copy(center);
                    this._vecA.copy(this._camRight).scale(visualRadiusX + offset);
                    this._vecB.copy(this._camUp).scale(-half.y); // На уровне пола
                    pos.add(this._vecA).add(this._vecB);
                }
            }
        });
        const canvasRect = this.app.graphicsDevice.canvas.getBoundingClientRect();
        const screenPos = new Vec3();
        // Обчислюємо відстань кожного label до камери
        const camPos = cameraEntity.getPosition();
        const distances = this.labelEntities.map((item)=>{
            return this._vecA.copy(item.worldPosition).sub(camPos).length();
        });
        const refDist = Math.min(...distances) || 1;
        this.labelEntities.forEach((item, i)=>{
            camera.worldToScreen(item.worldPosition, screenPos);
            if (screenPos.z > 0 && screenPos.z < camera.farClip) {
                const x = canvasRect.left + screenPos.x;
                const y = canvasRect.top + screenPos.y;
                // Компенсуємо перспективу: далекі labels збільшуємо, clamp щоб не було надто різних
                const scale = Math.min(Math.max(distances[i] / refDist, 0.85), 1.15);
                const fontSize = Math.round(13 * scale);
                item.element.style.fontSize = `${fontSize}px`;
                item.element.style.left = `${x}px`;
                item.element.style.top = `${y}px`;
                item.element.style.display = 'block';
            } else {
                item.element.style.display = 'none';
            }
        });
    }
    clear() {
        this.labelEntities.forEach((item)=>{
            if (item.element && item.element.parentNode) {
                item.element.parentNode.removeChild(item.element);
            }
        });
        this.labelEntities = [];
        this.currentBounds = null;
        this.currentEntity = null;
    }
    constructor(app){
        this.app = app;
        this.labelEntities = [];
        this.currentBounds = null;
        this.currentEntity = null;
        this.currentStrings = null;
        this.currentProductName = null;
        this._vecA = new Vec3();
        this._vecB = new Vec3();
        this._camForward = new Vec3();
        this._camRight = new Vec3();
        this._camUp = new Vec3();
    }
}

export { SimpleDimensionRenderer };
