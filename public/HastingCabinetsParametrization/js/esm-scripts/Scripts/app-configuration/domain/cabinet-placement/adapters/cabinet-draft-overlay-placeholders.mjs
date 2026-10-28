/**
 * TEMPORARY placeholders for the draft overlay icons, drawn inside the configurator document.
 *
 * The real icons are the UI's SVGs, positioned by the UI from `placementOverlay` frames. These
 * placeholders exist so Launch / an older UI still has a working move marker, Apply and Cancel.
 * The UI switches them off with `ConfiguratorAPI.placementOverlay.setPlaceholdersEnabled(false)`.
 */ const MOVE_ICON = `<svg width="29" height="29" viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M14.0833 0.75V27.4167M18.0833 4.75L14.0833 0.75L10.0833 4.75M10.0833 23.4167L14.0833 27.4167L18.0833 23.4167M23.4167 18.0833L27.4167 14.0833L23.4167 10.0833M27.4167 14.0833H0.75M4.75 18.0833L0.75 14.0833L4.75 10.0833" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
const CLOSE_ICON = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
function createDraftOverlayPlaceholders({ document: doc, onApply, onCancel, layerId = 'cabinet-draft-overlay-layer' } = {}) {
    if (!doc?.createElement || typeof onApply !== 'function' || typeof onCancel !== 'function') {
        throw new TypeError('Draft overlay placeholders require a document and Apply/Cancel handlers');
    }
    let layer = null, move = null, apply = null, cancel = null;
    const guard = (element)=>{
        // The buttons sit over the canvas: never let a press start a camera orbit or a drag.
        for (const type of [
            'pointerdown',
            'mousedown',
            'touchstart',
            'wheel'
        ]){
            element.addEventListener(type, (event)=>event.stopPropagation(), {
                passive: type !== 'pointerdown'
            });
        }
    };
    const build = ()=>{
        layer = doc.createElement('div');
        layer.id = layerId;
        layer.className = 'cabinet-draft-placeholder-layer';
        Object.assign(layer.style, {
            position: 'absolute',
            left: '0',
            top: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'hidden',
            zIndex: '95',
            display: 'none'
        });
        move = doc.createElement('div');
        move.className = 'cabinet-draft-placeholder cabinet-draft-placeholder--move';
        move.innerHTML = MOVE_ICON;
        Object.assign(move.style, {
            position: 'absolute',
            width: '29px',
            height: '29px',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            lineHeight: '0'
        });
        apply = doc.createElement('button');
        apply.type = 'button';
        apply.className = 'cabinet-draft-placeholder cabinet-draft-placeholder--apply';
        apply.textContent = 'Apply';
        Object.assign(apply.style, {
            position: 'absolute',
            transform: 'translateX(-100%)',
            pointerEvents: 'auto',
            padding: '3px 10px',
            border: 'none',
            borderRadius: '999px',
            background: '#AC5331',
            color: '#fff',
            font: '500 12px/16px Poppins, Arial, sans-serif',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
        });
        cancel = doc.createElement('button');
        cancel.type = 'button';
        cancel.className = 'cabinet-draft-placeholder cabinet-draft-placeholder--cancel';
        cancel.setAttribute('aria-label', 'Cancel placement');
        cancel.innerHTML = CLOSE_ICON;
        Object.assign(cancel.style, {
            position: 'absolute',
            pointerEvents: 'auto',
            width: '22px',
            height: '22px',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #282828',
            borderRadius: '50%',
            background: '#fff',
            color: '#282828',
            cursor: 'pointer'
        });
        for (const button of [
            apply,
            cancel
        ])guard(button);
        apply.addEventListener('click', (event)=>{
            event.stopPropagation();
            if (!apply.disabled) onApply();
        });
        cancel.addEventListener('click', (event)=>{
            event.stopPropagation();
            if (!cancel.disabled) onCancel();
        });
        layer.append(move, apply, cancel);
        (doc.body ?? doc.documentElement).appendChild(layer);
    };
    return Object.freeze({
        get element () {
            return layer;
        },
        /** frame: a placementOverlay frame or null; color: CSS colour of the current status. */ render (frame, { color = '#39D080' } = {}) {
            if (!frame?.visible || !frame.points) {
                if (layer) layer.style.display = 'none';
                return;
            }
            if (!layer) build();
            const { frontCenter } = frame.points;
            // Keep Apply / x on screen when the cabinet's corner is near or past the viewport edge.
            const width = frame.viewport?.width || Infinity, height = frame.viewport?.height || Infinity;
            const bottomRight = {
                x: Math.min(Math.max(frame.points.bottomRight.x, 64), width - 30),
                y: Math.min(Math.max(frame.points.bottomRight.y, 0), height - 30)
            };
            layer.style.display = 'block';
            layer.dataset.status = frame.status;
            move.style.left = `${frontCenter.x}px`;
            move.style.top = `${frontCenter.y}px`;
            move.style.color = color;
            const actions = frame.lifecycle === 'preview';
            apply.style.display = cancel.style.display = actions ? '' : 'none';
            apply.style.left = `${bottomRight.x - 3}px`;
            apply.style.top = `${bottomRight.y + 5}px`;
            apply.disabled = !frame.canApply;
            apply.style.opacity = frame.canApply ? '1' : '0.45';
            apply.style.cursor = frame.canApply ? 'pointer' : 'not-allowed';
            apply.title = frame.status === 'colliding' ? 'The cabinet overlaps another cabinet' : '';
            cancel.style.left = `${bottomRight.x + 3}px`;
            cancel.style.top = `${bottomRight.y + 3}px`;
            cancel.disabled = !frame.canCancel;
        },
        destroy () {
            layer?.remove();
            layer = move = apply = cancel = null;
        }
    });
}

export { createDraftOverlayPlaceholders };
