import { RuleMaterialsCabinetUrbanDuplex } from "../RuleMaterialsCabinetUrbanDuplex.mjs";

export class RuleMaterialsUDOpenShelvesSide extends RuleMaterialsCabinetUrbanDuplex {
    constructor() {
        super();
        this.name = "RuleMaterialsUDOpenShelvesSide";
        this.materialTargets = {
            cabinet: [
                "OpenSideShelvesBackWall",
                "OpenSideShelvesFrontShelf",
                "OpenSideShelvesMidWall",
                "OpenSideShelvesBackShelf",
                "OpenSideShelvesSideWall",
            ],
        };
    }
}
