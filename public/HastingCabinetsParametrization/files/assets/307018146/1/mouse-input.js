var MouseInput = pc.createScript('mouseInput');

MouseInput.attributes.add('orbitSensitivity', {
    type: 'number', 
    default: 0.3, 
    title: 'Orbit Sensitivity', 
    description: 'How fast the camera moves around the orbit. Higher is faster'
});

MouseInput.attributes.add('distanceSensitivity', {
    type: 'number', 
    default: 0.15, 
    title: 'Distance Sensitivity', 
    description: 'How fast the camera moves in and out. Higher is faster'
});

MouseInput.attributes.add('touchOrbitSensitivity', {
    type: 'number',
    default: 0.3,
    title: 'Touch Orbit Sensitivity',
    description: 'How fast a one-finger drag orbits the camera. Higher is faster'
});

MouseInput.attributes.add('touchDistanceSensitivity', {
    type: 'number',
    default: 0.2,
    title: 'Touch Distance Sensitivity',
    description: 'How fast a two-finger pinch zooms the camera. Higher is faster'
});

// initialize code called once per entity
MouseInput.prototype.initialize = function() {
    this.orbitCamera = this.entity.script.orbitCamera;

    this.lookButtonDown = false;
    this.panButtonDown = false;
    this.lastPoint = new pc.Vec2();
    this.lastTouchPoint = new pc.Vec2();
    this.lastPinchDistance = 0;
    this.touchGesture = null;
    this.touchCanvas = null;
    this.previousTouchAction = null;

    if (this.orbitCamera && this.app.mouse) {
        var self = this;
        this.onMouseOutHandler = function (event) {
            self.onMouseOut(event);
        };
        this.onWindowMouseUpHandler = function (event) {
            self.onMouseUp(event);
        };
        this.onWindowBlurHandler = function () {
            self.resetMouseButtons();
        };
        this.onGestureOwnershipChanged = function (state) {
            if (state && state.owner) {
                self.resetMouseButtons();
                if (state.pointerType === 'touch') {
                    self.touchGesture = 'manipulation';
                    self.lastPinchDistance = 0;
                }
            }
        };

        this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
        this.app.mouse.on(pc.EVENT_MOUSEUP, this.onMouseUp, this);
        this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
        this.app.mouse.on(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);

        // Listen to when the mouse travels out of the window
        window.addEventListener('mouseout', this.onMouseOutHandler, false);
        window.addEventListener('mouseup', this.onWindowMouseUpHandler, true);
        window.addEventListener('blur', this.onWindowBlurHandler, false);
        this.app.on?.('spatial:gesture-ownership-change', this.onGestureOwnershipChanged, this);

        // Disabling the context menu stops the browser displaying a menu when
        // you right-click the page.
        this.app.mouse.disableContextMenu();
    }

    if (this.orbitCamera && this.app.touch) {
        this.app.touch.on(pc.EVENT_TOUCHSTART, this.onTouchStart, this);
        this.app.touch.on(pc.EVENT_TOUCHEND, this.onTouchEnd, this);
        this.app.touch.on(pc.EVENT_TOUCHCANCEL, this.onTouchCancel, this);
        this.app.touch.on(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);

        this.touchCanvas = this.app.graphicsDevice && this.app.graphicsDevice.canvas;
        if (this.touchCanvas && this.touchCanvas.style) {
            this.previousTouchAction = this.touchCanvas.style.touchAction;
            this.touchCanvas.style.touchAction = 'none';
        }
    }

    // Remove every device listener if this entity is destroyed.
    this.on('destroy', function() {
        if (this.app.mouse) {
            this.app.mouse.off(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
            this.app.mouse.off(pc.EVENT_MOUSEUP, this.onMouseUp, this);
            this.app.mouse.off(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
            this.app.mouse.off(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);
        }

        if (this.onMouseOutHandler) {
            window.removeEventListener('mouseout', this.onMouseOutHandler, false);
            this.onMouseOutHandler = null;
        }
        if (this.onWindowMouseUpHandler) {
            window.removeEventListener('mouseup', this.onWindowMouseUpHandler, true);
            this.onWindowMouseUpHandler = null;
        }
        if (this.onWindowBlurHandler) {
            window.removeEventListener('blur', this.onWindowBlurHandler, false);
            this.onWindowBlurHandler = null;
        }
        if (this.onGestureOwnershipChanged) {
            this.app.off?.('spatial:gesture-ownership-change', this.onGestureOwnershipChanged, this);
            this.onGestureOwnershipChanged = null;
        }

        if (this.app.touch) {
            this.app.touch.off(pc.EVENT_TOUCHSTART, this.onTouchStart, this);
            this.app.touch.off(pc.EVENT_TOUCHEND, this.onTouchEnd, this);
            this.app.touch.off(pc.EVENT_TOUCHCANCEL, this.onTouchCancel, this);
            this.app.touch.off(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
        }

        if (this.touchCanvas && this.touchCanvas.style) {
            this.touchCanvas.style.touchAction = this.previousTouchAction || '';
        }

        this.touchCanvas = null;
        this.touchGesture = null;
    });
};


MouseInput.fromWorldPoint = new pc.Vec3();
MouseInput.toWorldPoint = new pc.Vec3();
MouseInput.worldDiff = new pc.Vec3();


MouseInput.prototype.pan = function(screenPoint) {
    var fromWorldPoint = MouseInput.fromWorldPoint;
    var toWorldPoint = MouseInput.toWorldPoint;
    var worldDiff = MouseInput.worldDiff;
    
    // For panning to work at any zoom level, we use screen point to world projection
    // to work out how far we need to pan the pivotEntity in world space 
    var camera = this.entity.camera;
    var distance = this.orbitCamera.distance;
    
    camera.screenToWorld(screenPoint.x, screenPoint.y, distance, fromWorldPoint);
    camera.screenToWorld(this.lastPoint.x, this.lastPoint.y, distance, toWorldPoint);

    worldDiff.sub2(toWorldPoint, fromWorldPoint);
       
    this.orbitCamera.pivotPoint.add(worldDiff);    
};


/**
 * Manipulation arbitration seam: the shared spatial-manipulation input router reserves
 * before the camera mutates, and its owner blocks the camera (spec AC-23).
 */
MouseInput.prototype.forwardManipulationEvent = function (method, event) {
    this.app?.spatialManipulationInput?.[method]?.(event);
};

MouseInput.prototype.isCameraBlockedByManipulation = function () {
    return Boolean(
        this.app?.spatialManipulationInput?.blocksCamera?.()
    );
};

MouseInput.prototype.onMouseDown = function (event) {
    this.forwardManipulationEvent('handleMouseDown', event);
    if (this.isCameraBlockedByManipulation()) {
        this.resetMouseButtons();
        this.lastPoint.set(event.x, event.y);
        return;
    }

    switch (event.button) {
        case pc.MOUSEBUTTON_LEFT: {
            this.lookButtonDown = true;
        } break;
            
        case pc.MOUSEBUTTON_MIDDLE: 
        case pc.MOUSEBUTTON_RIGHT: {
            this.panButtonDown = true;
        } break;
    }
};


MouseInput.prototype.onMouseUp = function (event) {
    this.forwardManipulationEvent('handleMouseUp', event);

    switch (event.button) {
        case pc.MOUSEBUTTON_LEFT: {
            this.lookButtonDown = false;
        } break;
            
        case pc.MOUSEBUTTON_MIDDLE: 
        case pc.MOUSEBUTTON_RIGHT: {
            this.panButtonDown = false;            
        } break;
    }
};


MouseInput.prototype.onMouseMove = function (event) {    
    if (this.isCameraBlockedByManipulation()) {
        this.resetMouseButtons();
        this.lastPoint.set(event.x, event.y);
        return;
    }

    if (this.lookButtonDown) {
        this.orbitCamera.pitch -= event.dy * this.orbitSensitivity;
        this.orbitCamera.yaw -= event.dx * this.orbitSensitivity;
        
    } else if (this.panButtonDown) {
        this.pan(event);   
    }
    
    this.lastPoint.set(event.x, event.y);
};


MouseInput.prototype.onMouseWheel = function (event) {
    if (this.isCameraBlockedByManipulation()) {
        event.event?.preventDefault?.();
        return;
    }
    this.orbitCamera.distance -= event.wheel * this.distanceSensitivity * (this.orbitCamera.distance * 0.1);
    event.event.preventDefault();
};


MouseInput.prototype.resetMouseButtons = function () {
    this.lookButtonDown = false;
    this.panButtonDown = false;
};


MouseInput.prototype.onMouseOut = function (event) {
    this.resetMouseButtons();
};

MouseInput.prototype.getPinchDistance = function (firstTouch, secondTouch) {
    var deltaX = firstTouch.x - secondTouch.x;
    var deltaY = firstTouch.y - secondTouch.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
};

MouseInput.prototype.preventTouchDefault = function (event) {
    var nativeEvent = event && event.event;
    if (nativeEvent && nativeEvent.cancelable !== false) {
        nativeEvent.preventDefault();
    }
};

MouseInput.prototype.syncTouchGesture = function (touches) {
    if (touches && touches.length === 1) {
        this.touchGesture = 'orbit';
        this.lastTouchPoint.set(touches[0].x, touches[0].y);
        this.lastPinchDistance = 0;
        return;
    }

    if (touches && touches.length >= 2) {
        this.touchGesture = 'pinch';
        this.lastPinchDistance = this.getPinchDistance(touches[0], touches[1]);
        return;
    }

    this.touchGesture = null;
    this.lastPinchDistance = 0;
};

MouseInput.prototype.onTouchStart = function (event) {
    this.forwardManipulationEvent('handleTouchStart', event);
    this.preventTouchDefault(event);
    if (this.isCameraBlockedByManipulation()) {
        this.touchGesture = 'manipulation';
        this.lastPinchDistance = 0;
        return;
    }
    this.syncTouchGesture(event.touches);
};

MouseInput.prototype.onTouchEnd = function (event) {
    // Prevent a synthetic mouse event after a completed touch gesture.
    this.forwardManipulationEvent('handleTouchEnd', event);
    this.preventTouchDefault(event);
    if (this.isCameraBlockedByManipulation()) return;
    this.syncTouchGesture(event.touches);
};

MouseInput.prototype.onTouchCancel = function (event) {
    this.forwardManipulationEvent('handleTouchCancel', event);
    this.preventTouchDefault(event);
    if (this.isCameraBlockedByManipulation()) return;
    this.syncTouchGesture(event.touches);
};

MouseInput.prototype.onTouchMove = function (event) {
    var touches = event.touches;
    this.preventTouchDefault(event);

    if (this.isCameraBlockedByManipulation()) {
        this.touchGesture = 'manipulation';
        this.lastPinchDistance = 0;
        return;
    }

    if (!touches || touches.length === 0) {
        this.syncTouchGesture(touches);
        return;
    }

    if (touches.length === 1) {
        var touch = touches[0];

        // Rebase when transitioning from pinch to one-finger orbit so the
        // camera does not jump to the remaining finger.
        if (this.touchGesture !== 'orbit') {
            this.syncTouchGesture(touches);
            return;
        }

        this.orbitCamera.pitch -= (touch.y - this.lastTouchPoint.y) * this.touchOrbitSensitivity;
        this.orbitCamera.yaw -= (touch.x - this.lastTouchPoint.x) * this.touchOrbitSensitivity;
        this.lastTouchPoint.set(touch.x, touch.y);
        return;
    }

    var currentPinchDistance = this.getPinchDistance(touches[0], touches[1]);

    // Rebase when a second finger is added; applying the first pinch delta
    // immediately would produce a visible zoom jump.
    if (this.touchGesture !== 'pinch' || this.lastPinchDistance <= 0) {
        this.syncTouchGesture(touches);
        return;
    }

    var pinchDelta = currentPinchDistance - this.lastPinchDistance;
    this.lastPinchDistance = currentPinchDistance;
    this.orbitCamera.distance -=
        (pinchDelta * this.touchDistanceSensitivity * 0.1) *
        (this.orbitCamera.distance * 0.1);
};
