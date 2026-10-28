import { RuleChangeHandleGrooveColor } from '../../domain/product/rules/RuleChangeHandleGrooveColor.mjs';
import { MaterialService } from '../../services/material/material-service.mjs';

/**
 * Regression context: HandleGrooveColor=None on a Sink-Base with
 * CabinetColor=Pulpis Chiaro TKH used to visually change the material even
 * though the material asset stayed the same.
 *
 * The raycast/material inspector showed that the asset was still
 * "Pulpis Chiaro TKH"; the visual change came from a redundant material reapply
 * refreshing TriPlanar params on HandleGrooveColor targets:
 * - tri_scale changed from 0.5 to 0.01
 * - tri_normalTex changed from the built-in normal texture to Pulpis_Chiaro_TKH_N.jpg
 * - tri_glossTex changed from the built-in gray texture to Pulpis_Chiaro_TKH_R.jpg
 *
 * Important constraint: do not solve this globally in MaterialService with
 * `if (mi.material !== material)`, because existing flows rely on same-material
 * reapply to refresh TriPlanar/SmartStretch when material params changed.
 */ function state(values) {
    return {
        get (key) {
            return values[key];
        }
    };
}
function entity(name, material) {
    return {
        name,
        enabled: true,
        children: [],
        render: {
            meshInstances: [
                {
                    material
                }
            ]
        }
    };
}
function bodyEntity(material) {
    return {
        ...entity('CabinetUniBody', material),
        script: {
            triPlanarMapping: {}
        }
    };
}
function registerHandleGrooveTests(runner) {
    runner.suite('HandleGrooveColor', async (ctx)=>{
        await ctx.it('HG-1: None не перевикликає apply, якщо CabinetColor вже стоїть на groove targets', async (assert)=>{
            // This is the exact regression shape: None falls back to CabinetColor,
            // and CabinetColor is already applied to groove target entities.
            const material = {
                name: 'Pulpis Chiaro TKH'
            };
            const root = {
                name: 'Sink-Base-test',
                children: [
                    entity('CabinetFrontTopPlate', material),
                    entity('CabinetFBotPlate', material)
                ]
            };
            const originalLoadMaterial = MaterialService.loadMaterial;
            const originalApplyMaterialByName = MaterialService.applyMaterialByName;
            let applyCalls = 0;
            MaterialService.loadMaterial = async (materialName)=>{
                assert.equal(materialName, 'Pulpis Chiaro TKH', 'Should load CabinetColor material');
                return material;
            };
            MaterialService.applyMaterialByName = async ()=>{
                applyCalls++;
                return 1;
            };
            try {
                const rule = new RuleChangeHandleGrooveColor({
                    entity: root
                });
                await rule.execute({
                    currentState: state({
                        HandleGrooveColor: 'None',
                        CabinetColor: 'Pulpis Chiaro TKH'
                    }),
                    previousState: state({
                        HandleGrooveColor: undefined,
                        CabinetColor: 'Pulpis Chiaro TKH'
                    })
                });
                assert.equal(applyCalls, 0, 'Same material should not be reapplied by HandleGrooveColor=None');
            } finally{
                MaterialService.loadMaterial = originalLoadMaterial;
                MaterialService.applyMaterialByName = originalApplyMaterialByName;
            }
        });
        await ctx.it('HG-2: інший groove матеріал застосовується як раніше', async (assert)=>{
            const currentMaterial = {
                name: 'Pulpis Chiaro TKH'
            };
            const grooveMaterial = {
                name: 'White Matt'
            };
            const root = {
                name: 'Sink-Base-test',
                children: [
                    entity('CabinetFrontTopPlate', currentMaterial),
                    entity('CabinetFBotPlate', currentMaterial)
                ]
            };
            const originalLoadMaterial = MaterialService.loadMaterial;
            const originalApplyMaterialByName = MaterialService.applyMaterialByName;
            let appliedMaterialName = null;
            let appliedEntities = null;
            MaterialService.loadMaterial = async (materialName)=>{
                assert.equal(materialName, 'White Matt', 'Should load requested groove material');
                return grooveMaterial;
            };
            MaterialService.applyMaterialByName = async (materialName, entities)=>{
                appliedMaterialName = materialName;
                appliedEntities = entities;
                return entities.length;
            };
            try {
                const rule = new RuleChangeHandleGrooveColor({
                    entity: root
                });
                await rule.execute({
                    currentState: state({
                        HandleGrooveColor: 'White Matt',
                        CabinetColor: 'Pulpis Chiaro TKH',
                        Drawers: '2D',
                        Handle: 'handle_urban_topcut'
                    }),
                    previousState: state({
                        HandleGrooveColor: 'None',
                        CabinetColor: 'Pulpis Chiaro TKH'
                    })
                });
                assert.equal(appliedMaterialName, 'White Matt', 'Changed groove material should be applied');
                assert.equal(appliedEntities.length, 2, 'Should apply to matched groove entities');
            } finally{
                MaterialService.loadMaterial = originalLoadMaterial;
                MaterialService.applyMaterialByName = originalApplyMaterialByName;
            }
        });
        await ctx.it('HG-4: 2D -> 1D очищає groove матеріал з нижнього/second-drawer slot', async (assert)=>{
            const cabinetMaterial = {
                name: 'Pulpis Chiaro TKH'
            };
            const grooveMaterial = {
                name: 'White Matt'
            };
            const upper = entity('CabinetFrontTopPlate', grooveMaterial);
            const lower = entity('CabinetFBotPlate', grooveMaterial);
            const root = {
                name: 'Sink-Base-test',
                children: [
                    upper,
                    lower,
                    bodyEntity(cabinetMaterial)
                ]
            };
            const originalLoadMaterial = MaterialService.loadMaterial;
            const originalApplyMaterialByName = MaterialService.applyMaterialByName;
            MaterialService.loadMaterial = async (materialName)=>{
                if (materialName === 'White Matt') return grooveMaterial;
                if (materialName === 'Pulpis Chiaro TKH') return cabinetMaterial;
                throw new Error(`Unexpected material load: ${materialName}`);
            };
            MaterialService.applyMaterialByName = async (materialName, entities)=>{
                const material = materialName === 'White Matt' ? grooveMaterial : cabinetMaterial;
                entities.forEach((target)=>{
                    target.render?.meshInstances?.forEach((mi)=>{
                        mi.material = material;
                    });
                });
                return entities.length;
            };
            try {
                const rule = new RuleChangeHandleGrooveColor({
                    entity: root
                });
                await rule.execute({
                    currentState: state({
                        HandleGrooveColor: 'White Matt',
                        CabinetColor: 'Pulpis Chiaro TKH',
                        Drawers: '1D',
                        Handle: 'handle_urban_topcut'
                    }),
                    previousState: state({
                        HandleGrooveColor: 'White Matt',
                        CabinetColor: 'Pulpis Chiaro TKH',
                        Drawers: '2D',
                        Handle: 'handle_urban_topcut'
                    })
                });
                assert.equal(upper.render.meshInstances[0].material, grooveMaterial, '1D active groove keeps contrast material');
                assert.equal(lower.render.meshInstances[0].material, cabinetMaterial, 'Inactive second-drawer groove resets to CabinetColor');
            } finally{
                MaterialService.loadMaterial = originalLoadMaterial;
                MaterialService.applyMaterialByName = originalApplyMaterialByName;
            }
        });
        await ctx.it('HG-5: Upper Groove -> Central Groove очищає верхній cabinet slot', async (assert)=>{
            const cabinetMaterial = {
                name: 'Pulpis Chiaro TKH'
            };
            const grooveMaterial = {
                name: 'White Matt'
            };
            const upper = entity('CabinetFrontTopPlate', grooveMaterial);
            const lower = entity('CabinetFBotPlate', grooveMaterial);
            const root = {
                name: 'Sink-Base-test',
                children: [
                    upper,
                    lower,
                    bodyEntity(cabinetMaterial)
                ]
            };
            const originalLoadMaterial = MaterialService.loadMaterial;
            const originalApplyMaterialByName = MaterialService.applyMaterialByName;
            MaterialService.loadMaterial = async (materialName)=>{
                if (materialName === 'White Matt') return grooveMaterial;
                if (materialName === 'Pulpis Chiaro TKH') return cabinetMaterial;
                throw new Error(`Unexpected material load: ${materialName}`);
            };
            MaterialService.applyMaterialByName = async (materialName, entities)=>{
                const material = materialName === 'White Matt' ? grooveMaterial : cabinetMaterial;
                entities.forEach((target)=>{
                    target.render?.meshInstances?.forEach((mi)=>{
                        mi.material = material;
                    });
                });
                return entities.length;
            };
            try {
                const rule = new RuleChangeHandleGrooveColor({
                    entity: root
                });
                await rule.execute({
                    currentState: state({
                        HandleGrooveColor: 'White Matt',
                        CabinetColor: 'Pulpis Chiaro TKH',
                        Drawers: '2D',
                        Handle: 'handle_urban_botcut'
                    }),
                    previousState: state({
                        HandleGrooveColor: 'White Matt',
                        CabinetColor: 'Pulpis Chiaro TKH',
                        Drawers: '2D',
                        Handle: 'handle_urban_topcut'
                    })
                });
                assert.equal(upper.render.meshInstances[0].material, cabinetMaterial, 'Inactive upper groove resets to CabinetColor');
                assert.equal(lower.render.meshInstances[0].material, grooveMaterial, 'Central/lower groove keeps contrast material');
            } finally{
                MaterialService.loadMaterial = originalLoadMaterial;
                MaterialService.applyMaterialByName = originalApplyMaterialByName;
            }
        });
        await ctx.it('HG-6: side panel inactive inlay скидається і вимикається', async (assert)=>{
            const cabinetMaterial = {
                name: 'Pulpis Chiaro TKH'
            };
            const grooveMaterial = {
                name: 'White Matt'
            };
            const upper = entity('SidePanel_UpperG_46D_Inlay', grooveMaterial);
            const center = entity('SidePanel_CenterG_46D_Inlay', grooveMaterial);
            center.enabled = false;
            const root = {
                name: 'SidePanel-test',
                children: [
                    upper,
                    center,
                    bodyEntity(cabinetMaterial)
                ]
            };
            const originalLoadMaterial = MaterialService.loadMaterial;
            const originalApplyMaterialByName = MaterialService.applyMaterialByName;
            MaterialService.loadMaterial = async (materialName)=>{
                if (materialName === 'White Matt') return grooveMaterial;
                if (materialName === 'Pulpis Chiaro TKH') return cabinetMaterial;
                throw new Error(`Unexpected material load: ${materialName}`);
            };
            MaterialService.applyMaterialByName = async (materialName, entities)=>{
                const material = materialName === 'White Matt' ? grooveMaterial : cabinetMaterial;
                entities.forEach((target)=>{
                    target.render?.meshInstances?.forEach((mi)=>{
                        mi.material = material;
                    });
                });
                return entities.length;
            };
            try {
                const rule = new RuleChangeHandleGrooveColor({
                    entity: root
                });
                await rule.execute({
                    currentState: state({
                        HandleGrooveColor: 'White Matt',
                        CabinetColor: 'Pulpis Chiaro TKH',
                        SidePanelType: 'CenterG'
                    }),
                    previousState: state({
                        HandleGrooveColor: 'White Matt',
                        CabinetColor: 'Pulpis Chiaro TKH',
                        SidePanelType: 'UpperG'
                    })
                });
                assert.equal(upper.render.meshInstances[0].material, cabinetMaterial, 'Inactive upper inlay resets to CabinetColor');
                assert.isFalse(upper.enabled, 'Inactive upper inlay is disabled');
                assert.equal(center.render.meshInstances[0].material, grooveMaterial, 'Active center inlay keeps contrast material');
                assert.isTrue(center.enabled, 'Active center inlay is enabled');
            } finally{
                MaterialService.loadMaterial = originalLoadMaterial;
                MaterialService.applyMaterialByName = originalApplyMaterialByName;
            }
        });
        await ctx.it('HG-3: MaterialService лишається backward-compatible для reapply того самого material instance', async (assert)=>{
            // This protects against reintroducing the too-wide fix in MaterialService.
            // If material params change on the same instance, dependent scripts still
            // need a refresh path.
            const material = {
                name: 'Existing material'
            };
            let triPlanarRefreshCount = 0;
            let smartStretchRefreshCount = 0;
            const fakeEntity = {
                name: 'FakeMaterialTarget',
                render: {
                    meshInstances: [
                        {
                            material
                        }
                    ]
                },
                script: {
                    triPlanarMapping: {
                        refreshMaterials () {
                            triPlanarRefreshCount++;
                        }
                    },
                    smartStretch: {
                        refreshMaterials () {
                            smartStretchRefreshCount++;
                        }
                    }
                }
            };
            const changed = MaterialService.applyToEntity(fakeEntity, material);
            assert.isTrue(changed, 'MaterialService should still report reapply as changed');
            assert.equal(triPlanarRefreshCount, 1, 'TriPlanar refresh should still run on same-material reapply');
            assert.equal(smartStretchRefreshCount, 1, 'SmartStretch refresh should still run on same-material reapply');
        });
    });
}

export { registerHandleGrooveTests };
