import { RuleMaterialsCabinetUrbanFreestanding } from '../RuleMaterialsCabinetUrbanFreestanding.mjs';

/** Use the UF material pipeline with only the open-shelf targets. */ class RuleMaterialsUFOpenShelves extends RuleMaterialsCabinetUrbanFreestanding {
    constructor(){
        super();
        this.name = 'RuleMaterialsUFOpenShelves';
        this.materialTargets = {
            cabinet: [
                'UF_OS_Back',
                'UF_OS_Body',
                'UF_OS_DividerBot',
                'UF_OS_DividerTop'
            ]
        };
        this.fixedMaterials = {};
    }
}

export { RuleMaterialsUFOpenShelves };
