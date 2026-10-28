import { Script, Vec3, VertexIterator } from 'playcanvas';

/**
 * @class StretchRegion
 * @classdesc Розтягування частини GLB-моделі у межах певної області.
 * Використовується для створення ефекту локального "stretch" уздовж вибраної осі.
 */
export class StretchRegion extends Script {

    static scriptName = 'stretchRegion';

    /** 
        * @attribute 
        * `power` and `speed` are exposed as sub attributes
        */
    enum = "X";


    /**
     * @attribute
     * @type {number}
     */
    margin = 0.4;


    /**
     * @attribute
     * @type {number}
     */
    stretchDistance = 0;

    /**
     * Викликається при першому запуску скрипта.
     */
    initialize() {
        this.originalVertices = null;

        // === Значення за замовчуванням ===
        this.axis = this.axis ?? 'x'; // X | Y | Z
        this.margin = this.margin ?? 0.4; // зона впливу
        this.stretchDistance = this.stretchDistance ?? 0; // наскільки розтягувати

        // одразу застосовуємо перше розтягування
        this.applyStretch();
    }

    /**
     * Основна логіка деформації геометрії.
     */
    applyStretch() {
        const model = this.entity.model;
        if (!model || !model.meshInstances?.length) return;

        const mesh = model.meshInstances[0].mesh;
        const vb = mesh.vertexBuffer;
        const iterator = new VertexIterator(vb);

        // 1️⃣ Зберігаємо початкові вершини, якщо ще не збережено
        if (!this.originalVertices) {
            this.originalVertices = [];
            while (iterator.next()) {
                const pos = new Vec3();
                iterator.getElement('POSITION', pos);
                this.originalVertices.push(pos.clone());
            }
        }

        // 2️⃣ Проходимо всі вершини й розтягуємо ті, що в межах margin
        let i = 0;
        iterator.seek(0);
        while (iterator.next()) {
            const pos = this.originalVertices[i++].clone();
            const axis = this.axis;
            const center = 0;
            const dist = pos[axis] - center;

            if (Math.abs(dist) <= this.margin) {
                const direction = dist >= 0 ? 1 : -1;
                pos[axis] += direction * this.stretchDistance;
            }

            iterator.setElement('POSITION', pos);
        }

        iterator.end();
        mesh.vertexBuffer = vb;
        mesh.update();
    }

    /**
     * Оновлення кожен кадр (необов'язково).
     * Можна використовувати для анімованого stretch-ефекту.
     */
    update(dt) {
        // Наприклад, динамічне розтягування:
        // this.stretchDistance = Math.sin(this.app.time.now * 0.001) * 0.2;
        // this.applyStretch();
    }
}

// // === Реєстрація скрипта у PlayCanvas Engine ===
// pc.app?.scripts?.register(StretchRegion);



// // === Атрибути у редакторі ===
// StretchRegion.attributes.add('axis', {
//     type: 'string',
//     enum: [
//         { X: 'x' },
//         { Y: 'y' },
//         { Z: 'z' }
//     ],
//     default: 'x',
//     title: 'Axis'
// });



// StretchRegion.attributes.add('margin', {
//     type: 'number',
//     default: 0.4,
//     title: 'Margin'
// });





// StretchRegion.attributes.add('stretchDistance', {
//     type: 'number',
//     default: 0,
//     title: 'Stretch Distance'
// });
