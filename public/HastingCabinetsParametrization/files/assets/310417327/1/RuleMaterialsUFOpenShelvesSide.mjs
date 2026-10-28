import { RuleMaterialsCabinetUrbanFreestanding } from '../RuleMaterialsCabinetUrbanFreestanding.mjs';

/** Use the UF material pipeline with only the open side shelf targets. */
export class RuleMaterialsUFOpenShelvesSide extends RuleMaterialsCabinetUrbanFreestanding {
    constructor() {
        super();
        this.name = 'RuleMaterialsUFOpenShelvesSide';
        this.materialTargets = {
            cabinet: ['UF_OSS_BackShelf_Bot', 'UF_OSS_BackShelf_Top', 'UF_OSS_Body',
                'UF_OSS_FrontShelf_Bot', 'UF_OSS_FrontShelf_Top', 'UF_OSS_MidWall'],
        };
        this.fixedMaterials = {};
    }
}
