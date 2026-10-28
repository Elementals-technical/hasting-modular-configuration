import { Script } from 'playcanvas';

// /**
//  * The {@link https://api.playcanvas.com/classes/Engine.Script.html | Script} class is
//  * the base class for all PlayCanvas scripts. Learn more about writing scripts in the
//  * {@link https://developer.playcanvas.com/user-manual/scripting/ | scripting guide}.
//  */
export class UI extends Script {
    static scriptName = 'uI';

    /**
        * CSS asset that will be injected into a <style> tag in the document head.
        * 
        * @attribute
        * @type {pc.Asset}
        * @title CSS Asset
        */
    css;

    /**
     * HTML asset that will be injected into a <div> element in the document body.
     * 
     * @attribute
     * @type {pc.Asset}
     * @title HTML Asset
     */
    html;



    /**
     * Called when the script is about to run for the first time.
     */


    initialize() {
        // Inject CSS
        const style = document.createElement('style');
        style.innerHTML = this.css?.resource || '';
        document.head.appendChild(style);

        // Inject HTML
        this.div = document.createElement('div');
        this.div.classList.add('container');
        this.div.innerHTML = this.html?.resource || '';
        document.body.appendChild(this.div);

        this.counter = 0;

        this.bindEvents();
    }



    bindEvents() {
        const modelButtons = this.div.querySelectorAll('.button');

        if (modelButtons && modelButtons.length > 0) {
            modelButtons.forEach((button) => {
                const modelId = button.getAttribute("data-model-id");

                button.addEventListener('click', () => {
                    // findModelByName(modelId);
                    debugger

                    // --- контролюємо активний клас ---
                    modelButtons.forEach(b => b.classList.remove("is-active"));
                    button.classList.add("is-active");


                    const listModel = this.app.root.findByTag("model")
                    const data = this.app.root.findByName(modelId)


                    listModel.forEach((entity, index) => {
                        listModel[index].enabled = entity.name === modelId
                    })
                })
            });
        }

        const materialButtons = this.div.querySelectorAll('.swatch');

        if (materialButtons && materialButtons.length > 0) {
            materialButtons.forEach((button) => {
                const materialName = button.getAttribute("data-material-id");

                button.addEventListener('click', () => {

                    // --- контролюємо активний клас ---
                    materialButtons.forEach(b => b.classList.remove("is-active"));
                    button.classList.add("is-active");

                    const materialAsset = this.app.assets.find(materialName, 'material');

                    const listModel = this.app.root.findByTag("material")

                    listModel.forEach((entity, index) => {

                        listModel[index].render.meshInstances[0].material = materialAsset.resource;
                        listModel[index]?.script.triPlanarMapping.applyTriplanar()
                    })
                })
            });
        }

    }

    /**
     * Called for enabled (running state) scripts on each tick.
     *
     * @param {number} dt - The delta time in seconds since the last frame.
     */
    update(dt) {
    }
}



function findModelByName(modelId) {
    console.log("Searching model in PlayCanvas:", modelId);
 

    // Приклад звернення до PlayCanvas
    // const entity = pc.app.root.findByName(modelId);
    // if (entity) {
    //     console.log("FOUND!", entity);
    //     // тут будь-які дії з об’єктом
    // } else {
    //     console.warn("Model not found:", modelId);
    // }
}



// MaterialChanger.prototype.changeMaterial = function (optName, valName) {
 
//     this.partOptions.forEach(
//         (partOption) => {

//             if (optName == partOption.optionName) {
//                 let model = this.entity.findComponent('model');
//                 let allMeshInstances = [];
//                 // allMeshInstances = model.meshInstances;

//                 let materialIndex = partOption.materialNames.indexOf(valName);
//                 if (materialIndex < 0) {
//                     return;
//                 }

//                 if (materialIndex >= partOption.materials.length) {
//                     return;
//                 }



//                 let mat = partOption.materials[materialIndex];

// this.entity.render.meshInstances[0].material = mat.resource
//                 // for (i = 0; i < allMeshInstances.length; ++i) {
//                 //     var mesh = allMeshInstances[i];
//                 //     if (partOption.matIndices.includes(i)) {
//                 //         // console.log('applying material', this.entity.name);
//                 //         mesh.material = mat.resource;
//                 //     }
//                 // }
//             }
//         }
//     );

//     // let model = this.entity.findComponent('model');
//     // let allMeshInstances = [];
//     // allMeshInstances = model.meshInstances;

//     // let materialIndex = this.partOptions.materialNames.indexOf(valName);
//     // if (materialIndex < 0) {
//     //     return;
//     // }

//     // if (materialIndex >= this.partOptions.materials.length) {
//     //     return;
//     // }



//     // let mat = this.partOptions.materials[materialIndex];

//     // for (i = 0; i < allMeshInstances.length; ++i) {
//     //     var mesh = allMeshInstances[i];
//     //     if (this.partOptions.matIndices.includes(i)) {
//     //         console.log('applying material', this.entity.name);
//     //         mesh.material = mat.resource;
//     //     }
//     // }
//     // console.log('renders: ', allMeshInstances);
// }