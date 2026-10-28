var OrbitCamera = pc.createScript('orbitCamera');

OrbitCamera.attributes.add('autoRender', { type: 'boolean', default: true, title: 'Auto Render' });

OrbitCamera.attributes.add('distanceMax', { type: 'number', default: 0, title: 'Distance Max', description: '0 = no max' });
OrbitCamera.attributes.add('distanceMin', { type: 'number', default: 0, title: 'Distance Min' });

OrbitCamera.attributes.add('pitchAngleMax', { type: 'number', default: 90, title: 'Pitch Angle Max (deg)' });
OrbitCamera.attributes.add('pitchAngleMin', { type: 'number', default: -90, title: 'Pitch Angle Min (deg)' });

// ⬇️ Нове: перемикач для лімітів yaw
OrbitCamera.attributes.add('limitYaw', { type: 'boolean', default: true, title: 'Limit Yaw' });
OrbitCamera.attributes.add('yawAngleMax', { type: 'number', default: 180, title: 'Yaw Angle Max (deg)' });
OrbitCamera.attributes.add('yawAngleMin', { type: 'number', default: -180, title: 'Yaw Angle Min (deg)' });

OrbitCamera.attributes.add('inertiaFactor', { type: 'number', default: 0, title: 'Inertia Factor', description: '0 = responsive' });

OrbitCamera.attributes.add('focusEntity', {
    type: 'entity',
    title: 'Focus Entity',
    description: 'If empty, uses whole scene'
});

OrbitCamera.attributes.add('frameOnStart', {
    type: 'boolean',
    default: true,
    title: 'Frame on Start',
    description: 'Frames entity/scene on start'
});

// ---- properties ----
Object.defineProperty(OrbitCamera.prototype, 'distance', {
    get: function () { return this._targetDistance; },
    set: function (v) { this._targetDistance = this._clampDistance(v); }
});

Object.defineProperty(OrbitCamera.prototype, 'pitch', {
    get: function () { return this._targetPitch; },
    set: function (v) { this._targetPitch = this._clampPitchAngle(v); }
});

Object.defineProperty(OrbitCamera.prototype, 'yaw', {
    get: function () { return this._targetYaw; },
    set: function (v) {
        // якщо ліміти увімкнені — клампимо, інакше ні
        var value = this.limitYaw ? this._clampYawAngle(v) : v;
        this._targetYaw = value;

        // короткий шлях до цілі (уникаємо «оборотів» >180°)
        var diff = this._targetYaw - this._yaw;
        var rem = diff % 360;
        if (rem > 180) {
            this._targetYaw = this._yaw - (360 - rem);
        } else if (rem < -180) {
            this._targetYaw = this._yaw + (360 + rem);
        } else {
            this._targetYaw = this._yaw + rem;
        }
    }
});

Object.defineProperty(OrbitCamera.prototype, 'pivotPoint', {
    get: function () { return this._pivotPoint; },
    set: function (v) { this._pivotPoint.copy(v); }
});

// ---- public methods ----
OrbitCamera.prototype.focus = function (focusEntity) {
    this._buildAabb(focusEntity, 0);

    var he = this._modelsAabb.halfExtents;
    var distance = Math.max(he.x, Math.max(he.y, he.z));
    distance = (distance / Math.tan(0.5 * this.entity.camera.fov * pc.math.DEG_TO_RAD)) * 2;

    this.distance = distance;
    this._removeInertia();
    this._pivotPoint.copy(this._modelsAabb.center);
};

OrbitCamera.distanceBetween = new pc.Vec3();

OrbitCamera.prototype.resetAndLookAtPoint = function (resetPoint, lookAtPoint) {
    this.pivotPoint.copy(lookAtPoint);
    this.entity.setPosition(resetPoint);
    this.entity.lookAt(lookAtPoint);

    var d = OrbitCamera.distanceBetween;
    d.sub2(lookAtPoint, resetPoint);
    this.distance = d.length();

    this.pivotPoint.copy(lookAtPoint);

    var q = this.entity.getRotation();
    this.yaw = this._calcYaw(q);
    this.pitch = this._calcPitch(q, this.yaw);

    this._removeInertia();
    this._updatePosition();

    if (!this.autoRender) this.app.renderNextFrame = true;
};

OrbitCamera.prototype.resetAndLookAtEntity = function (resetPoint, entity) {
    this._buildAabb(entity, 0);
    this.resetAndLookAtPoint(resetPoint, this._modelsAabb.center);
};

OrbitCamera.prototype.reset = function (yaw, pitch, distance) {
    this.pitch = pitch;
    this.yaw = yaw;
    this.distance = distance;

    this._removeInertia();
    if (!this.autoRender) this.app.renderNextFrame = true;
};

// ---- init / update ----
OrbitCamera.prototype.initialize = function () {
    this._checkAspectRatio();

    this._modelsAabb = new pc.BoundingBox();
    this._pivotPoint = new pc.Vec3();
    
    if (this.focusEntity) {
        this._pivotPoint.copy(this.focusEntity.getPosition());
    } else {
        this._buildAabb(this.app.root, 0);
        this._pivotPoint.copy(this._modelsAabb.center);
    }

    this._lastFramePivotPoint = this._pivotPoint.clone();

    var q = this.entity.getRotation();
    this._yaw = this._calcYaw(q);
    this._pitch = this._clampPitchAngle(this._calcPitch(q, this._yaw));

    this._targetYaw = this._yaw;
    this._targetPitch = this._pitch;

    if (this.frameOnStart) {
        this.focus(this.focusEntity || this.app.root);
    } else {
        var d = new pc.Vec3();
        d.sub2(this.entity.getPosition(), this._pivotPoint);
        this._distance = this._clampDistance(d.length());
        this._targetDistance = this._distance;
    }

    this._autoRenderDefault = this.app.autoRender;
    if (this.app.autoRender) this.app.autoRender = this.autoRender;
    if (!this.autoRender) this.app.renderNextFrame = true;

    // реагуємо на зміни атрибутів у редакторі
    this.on('attr:autoRender', function () {
        this.app.autoRender = this.autoRender;
        if (!this.autoRender) this.app.renderNextFrame = true;
    }, this);

    ['distanceMin', 'distanceMax', 'pitchAngleMin', 'pitchAngleMax', 'yawAngleMin', 'yawAngleMax', 'limitYaw'].forEach((name) => {
        this.on('attr:' + name, function () {
            // просто перерахувати цільові значення
            this._targetDistance = this._clampDistance(this._distance);
            this._targetPitch = this._clampPitchAngle(this._pitch);
            if (this.limitYaw) {
                this._targetYaw = this._clampYawAngle(this._yaw);
            }
        }, this);
    });

    this.on('attr:focusEntity', function (value) {
        this._pivotPoint.copy(value ? value.getPosition() : this.app.root.getPosition());
        if (this.frameOnStart) {
            this.focus(value || this.app.root);
        } else {
            this.resetAndLookAtEntity(this.entity.getPosition(), value || this.app.root);
        }
    }, this);

    this.on('attr:frameOnStart', function (value) {
        if (value) this.focus(this.focusEntity || this.app.root);
    }, this);

    var onResize = () => {
        this._checkAspectRatio();
        if (!this.autoRender) this.app.renderNextFrame = true;
    };
    this.app.graphicsDevice.on('resizecanvas', onResize, this);

    this.on('destroy', function () {
        this.app.graphicsDevice.off('resizecanvas', onResize, this);
        this.app.autoRender = this._autoRenderDefault;
    }, this);
};

OrbitCamera.prototype.update = function (dt) {
    if (!this.autoRender) {
        var distanceDiff = Math.abs(this._targetDistance - this._distance);
        var yawDiff = Math.abs(this._targetYaw - this._yaw);
        var pitchDiff = Math.abs(this._targetPitch - this._pitch);
        var pivotDiff = this._lastFramePivotPoint.distance(this._pivotPoint);

        this.app.renderNextFrame = this.app.renderNextFrame ||
            distanceDiff > 0.01 || yawDiff > 0.01 ||
            pitchDiff > 0.01 || pivotDiff > 0;
    }

    var t = this.inertiaFactor === 0 ? 1 : Math.min(dt / this.inertiaFactor, 1);
    this._distance = pc.math.lerp(this._distance, this._targetDistance, t);
    this._yaw = pc.math.lerp(this._yaw, this._targetYaw, t);
    this._pitch = pc.math.lerp(this._pitch, this._targetPitch, t);

    this._lastFramePivotPoint.copy(this._pivotPoint);
    // ⬇️ більше не клампимо yaw тут, тільки якщо limitYaw true у сеттері
    this._updatePosition();
};

// ---- internals ----
OrbitCamera.prototype._updatePosition = function () {
    this.entity.setLocalPosition(0, 0, 0);
    this.entity.setLocalEulerAngles(this._pitch, this._yaw, 0);

    var p = this.entity.getPosition();
    p.copy(this.entity.forward);
    p.scale(-this._distance);
    p.add(this.pivotPoint);
    this.entity.setPosition(p);
};

OrbitCamera.prototype._removeInertia = function () {
    this._yaw = this._targetYaw;
    this._pitch = this._targetPitch;
    this._distance = this._targetDistance;
};

OrbitCamera.prototype._checkAspectRatio = function () {
    var gd = this.app.graphicsDevice;
    this.entity.camera.horizontalFov = gd.height > gd.width;
};

OrbitCamera.prototype._buildAabb = function (entity, modelsAdded) {
    var i = 0, j = 0, meshInstances;

    if (entity instanceof pc.Entity) {
        var all = [];
        var renders = entity.findComponents('render');
        for (i = 0; i < renders.length; ++i) {
            meshInstances = renders[i].meshInstances;
            if (meshInstances) for (j = 0; j < meshInstances.length; j++) all.push(meshInstances[j]);
        }
        var models = entity.findComponents('model');
        for (i = 0; i < models.length; ++i) {
            meshInstances = models[i].meshInstances;
            if (meshInstances) for (j = 0; j < meshInstances.length; j++) all.push(meshInstances[j]);
        }
        for (i = 0; i < all.length; i++) {
            if (modelsAdded === 0) this._modelsAabb.copy(all[i].aabb);
            else this._modelsAabb.add(all[i].aabb);
            modelsAdded += 1;
        }
    }
    for (i = 0; i < entity.children.length; ++i) {
        modelsAdded += this._buildAabb(entity.children[i], modelsAdded);
    }
    return modelsAdded;
};

OrbitCamera.prototype._calcYaw = function (quat) {
    var f = new pc.Vec3();
    quat.transformVector(pc.Vec3.FORWARD, f);
    return Math.atan2(-f.x, -f.z) * pc.math.RAD_TO_DEG;
};

OrbitCamera.prototype._clampDistance = function (d) {
    return (this.distanceMax > 0) ? pc.math.clamp(d, this.distanceMin, this.distanceMax)
        : Math.max(d, this.distanceMin);
};

OrbitCamera.prototype._clampPitchAngle = function (p) {
    return pc.math.clamp(p, -this.pitchAngleMax, -this.pitchAngleMin);
};

OrbitCamera.prototype._clampYawAngle = function (y) {
    return pc.math.clamp(y, this.yawAngleMin, this.yawAngleMax);
};

OrbitCamera.quatWithoutYaw = new pc.Quat();
OrbitCamera.yawOffset = new pc.Quat();

OrbitCamera.prototype._calcPitch = function (quat, yaw) {
    var qNoYaw = OrbitCamera.quatWithoutYaw;
    var yawOff = OrbitCamera.yawOffset;

    yawOff.setFromEulerAngles(0, -yaw, 0);
    qNoYaw.mul2(yawOff, quat);

    var f = new pc.Vec3();
    qNoYaw.transformVector(pc.Vec3.FORWARD, f);

    return Math.atan2(f.y, -f.z) * pc.math.RAD_TO_DEG;
};
