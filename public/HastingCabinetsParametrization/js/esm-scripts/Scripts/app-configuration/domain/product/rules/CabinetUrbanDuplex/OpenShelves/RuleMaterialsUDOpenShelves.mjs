import { RuleMaterialsCabinetUrbanDuplex } from '../RuleMaterialsCabinetUrbanDuplex.mjs';

class RuleMaterialsUDOpenShelves extends RuleMaterialsCabinetUrbanDuplex {
    constructor(){
        super();
        this.name = 'RuleMaterialsUDOpenShelves';
        this.materialTargets = {
            cabinet: [
                'OpenShelvesBack',
                'OpenShelvesDivider',
                'OpenShelvesSideWalls',
                'OpenShelvesTopBot'
            ]
        };
    }
}

export { RuleMaterialsUDOpenShelves };
