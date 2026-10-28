/** Explicit test-only line setup. The normal legacy cabinet path always owns its basin top. */
export function allowEngineeringSCWithoutTop({search='',hasRuntimeOptions=false,hasLineProvider=false}={}){
    const flags=new URLSearchParams(search);
    return flags.get('cabinetFromLine')==='1' && flags.get('cabinetEngineering')==='1' &&
        hasRuntimeOptions===false && hasLineProvider===false;
}

const exactSC=product=>product?.productType==='ULH-side-cabinet' && product?.category==='cabinets' &&
    [60,80].includes(product.Width) && product.Height===28 && product.Depth===46 &&
    product.Handle==='handle_urban_topcut' && product.Drawers==='1DW';

/** Skip creation only while every current primary product is the approved SC sample. */
export function shouldSkipEngineeringCountertop({enabled=false,products={}}={}){
    if(enabled!==true || !products || typeof products!=='object' || Array.isArray(products))return false;
    const rows=Object.values(products);
    return rows.length>0 && rows.every(exactSC);
}
