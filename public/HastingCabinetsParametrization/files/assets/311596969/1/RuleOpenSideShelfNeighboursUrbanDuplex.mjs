import { Vec3 } from "playcanvas";
import { LoggerService } from "../../../services/logger/logger-service.mjs";
import { BaseCompositionRule } from "./base-composition-rule.mjs";
import { SceneEntityHelper } from "../../../helpers/scene-entity-helper.mjs";
import { SceneTransformHelper } from "../../../helpers/scene-transform-helper.mjs";
import { AutoPlacementService } from "../../../services/autoPlacement/auto-placement-service.mjs";
import { ProductRegistry_V2 } from "../../product/registry/product-registry-v2.mjs";
import { CABINET_LAYOUT_GAP_METERS } from "../layout-constants.mjs";
import { getCountertopRole } from "../../countertop/countertop-role.mjs";
import { URBAN_DUPLEX_WIDTH_STRETCH_BY_WIDTH } from "../../product/rules/CabinetUrbanDuplex/RuleWidthCabinetUrbanDuplex.mjs";
import {
    UD_OPEN_SHELVES_SIDE_HEIGHT_MOVE_Y,
    UD_OPEN_SHELVES_SIDE_HEIGHT_STRETCH_Y,
    UD_OPEN_SHELVES_SIDE_STRETCH_MARGIN_M,
} from "../../product/rules/CabinetUrbanDuplex/OpenShelvesSide/RuleHeightUDOpenShelvesSide.mjs";
import { DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID } from "../../countertop/countertop-support-resolver.mjs";

/**
 * Urban Duplex: an open side shelf (OSS) and its neighbouring UD cabinets, in three steps.
 *
 * Neighbour = the OSS touches the cabinet on X (row gap + tolerance) and their vertical ranges overlap.
 * Measured on the scene, not taken from the row order or a UI attribute: column rows also order
 * the lower cabinets, and after a drag the shelf can end up on the other side of its cabinet.
 *
 * (1) Height of each OSS, by its countertop context (Andriy 16.10), on top of RuleHeightUDOpenShelvesSide values:
 * - same SupportGroupId as the basin top ("underTop"): bottom and top equal to the neighbouring cabinet, the basin
 *   top lies on both;
 * - another group ("cover"): bottom equal to the cabinet, top equal to the cover top (cabinet top + cover thickness);
 *   the shelf continues the cover slab itself, no cover lies on it (OSS is a line type, see countertop-collections).
 *
 * (2) Orientation of each OSS, as SceneManager._updateSideShelfOrientation does for Urban Standard Height:
 * - a UD cabinet on the right of the shelf only (the shelf is on the left) → mirrored;
 * - a cabinet on the left only, on both sides, or none → template orientation.
 * Mirrored = scaleX −1 on OpenSideShelves_Point, template = +1 (Y/Z scale untouched). A real mirror: the frame mesh
 * (top + bottom + side wall) is not symmetric about its pivot, so moving the meshes did not mirror the shelf.
 * The negative scale is safe: OSS is a line type, so cover-support-adapter never measures it (it rejects mirrored
 * world matrices of cover supports); and the point stands in the centre of the shelf, so the footprint stays put.
 *
 * (3) Handles of a cabinet run on to the front of a neighbouring OSS, as RuleHandleStretchForSideShelf does for USH:
 * - Handle meshes: stretch.x = width stretch (RuleWidthCabinetUrbanDuplex table) + OSS width per shelf.
 * - Handle points: localX −half OSS width (shelf on the left), +half (on the right), 0 (both or none).
 * - Cabinets without a neighbouring OSS go back to the width stretch and localX 0.
 *
 * Why the point and not the mesh: HandleSide mirrors the points (scaleX −1). That scale applies to the
 * point's children, not to the point's own local position, which lives in the cabinet's frame — so
 * localX −0.075 always means "toward cabinet-local −X". The stretch is centred on the point (USH pairs
 * stretch 0.15 with move 0.075), so the mirror does not change where the stretched handle reaches.
 * Signs follow USH; not checked in the scene.
 */
export class RuleOpenSideShelfNeighboursUrbanDuplex extends BaseCompositionRule {
    static SHELF_PRODUCT_TYPE = "UD-open-shelves-side";
    static CABINET_PRODUCT_TYPES = Object.freeze(["UD-sink-cabinet", "UD-side-cabinet"]);

    // Parent of the whole shelf, in its centre: carries the Height move and the mirror (scaleX).
    static SHELF_POINT_NAME = "OpenSideShelves_Point";
    // Meshes stretched on Y by RuleHeightUDOpenShelvesSide.
    static HEIGHT_MESH_NAMES = Object.freeze(Object.keys(UD_OPEN_SHELVES_SIDE_HEIGHT_STRETCH_Y.values));
    // Cover / TopSolid thickness, 0.5″: used when the composition has no saved cover settings.
    static DEFAULT_COVER_THICKNESS_M = 0.0127;

    // OSS width, 15 cm: the extra handle length per neighbouring shelf.
    static SHELF_WIDTH_STRETCH_X = 0.15;
    // Half the OSS width: shifting the centred stretch by it keeps the cabinet's far handle end in place.
    static HANDLE_POINT_SHIFT_X = 0.075;
    // Measured AABBs are not exact; 5 mm on top of the row gap still means "touching".
    static TOUCH_TOLERANCE_METERS = 0.005;
    // Same level = the vertical ranges overlap by at least half of the lower one. Bottoms are not compared: the
    // shelf is measured before its height is fitted (template 18.7 mm taller than the cabinet) and in cover mode
    // it ends above the cabinet, while a cabinet of the other row overlaps it only by millimetres.
    static MIN_VERTICAL_OVERLAP_SHARE = 0.5;

    // Handle meshes stretched by RuleWidthCabinetUrbanDuplex.
    static HANDLE_MESH_NAMES = Object.freeze([
        "UD_Handle_BaseP_Top",
        "UD_Handle_BaseP_Bot",
        "UD_Handle_LateralP_Top",
        "UD_Handle_LateralP_Bot",
        "UD_Handle_Full_Top",
        "UD_Handle_Full_Bot",
    ]);

    // Parents of the handle meshes; nobody else sets their X (HandleSide: scaleX, Height/Depth: Y/Z).
    static HANDLE_POINT_NAMES = Object.freeze(
        RuleOpenSideShelfNeighboursUrbanDuplex.HANDLE_MESH_NAMES.map((meshName) => `${meshName}_Point`),
    );

    /**
     * @param {{ measureWorldBounds?: (entity: object, entities: object[]) => { minX: number, maxX: number, minY: number, maxY: number } }} [options]
     */
    constructor({ measureWorldBounds = measureWorldBoundsLikeRowLayout } = {}) {
        super({
            name: "OpenSideShelfNeighboursUrbanDuplex",
            watchCompositions: ["cabinets"],
            watchParams: ["Width", "productType", "Height", "SupportGroupId"],
        });
        this.measureWorldBounds = measureWorldBounds;
    }

    aggregateFn(compositions) {
        const cabinetsComposition = compositions.cabinets;
        if (!cabinetsComposition) return { hasCabinets: false };
        return {
            hasCabinets: true,
            allProducts: cabinetsComposition.getAllProducts(),
            coverThicknessM: cabinetsComposition.getCabinetCoverSettings?.()?.thicknessM,
        };
    }

    async applyFn(result, context) {
        // No cabinets composition: no shelves or handles to touch.
        if (!result.hasCabinets) return;

        // 1. Split the scene cabinets into UD cabinets and OSS by product type.
        const entities = context.app.compositionManager.getProductEntitiesByCategory("cabinets");
        const productTypeOf = (entity) => result.allProducts[entity.name]?.productType;
        const shelves = entities.filter((entity) => isUrbanDuplexOpenSideShelf(productTypeOf(entity)));
        const cabinets = entities.filter((entity) => isUrbanDuplexCabinet(productTypeOf(entity)));

        // 2. Each shelf: height by its countertop context (under the basin top, or beside its own cover).
        const basinTopGroupIds = basinTopSupportGroupIds(result.allProducts);
        const coverThicknessM = result.coverThicknessM ?? RuleOpenSideShelfNeighboursUrbanDuplex.DEFAULT_COVER_THICKNESS_M;
        for (const shelf of shelves) {
            const shelfProduct = result.allProducts[shelf.name];
            const mode = isUnderBasinTop(shelfProduct, basinTopGroupIds) ? "underTop" : "cover";
            applyShelfHeight(shelf, Number(shelfProduct?.Height), mode, coverThicknessM);
        }

        // 3. Measure after the product rules and the height step have moved and stretched everything.
        const measureAll = () => {
            entities.forEach((entity) => entity.syncHierarchy());
            return new Map([...shelves, ...cabinets].map((entity) => [entity, this.measureWorldBounds(entity, entities)]));
        };
        const boundsBeforeOrientation = measureAll();

        // 4. Each shelf: mirror it when its only neighbouring cabinets stand on its right.
        for (const shelf of shelves) {
            const shelfBounds = boundsBeforeOrientation.get(shelf);
            const neighbours = cabinets.filter((cabinet) => isTouchingOnSameLevel(boundsBeforeOrientation.get(cabinet), shelfBounds));
            const hasCabinetOnLeft = neighbours.some((cabinet) => !isOnLeftOf(shelfBounds, boundsBeforeOrientation.get(cabinet)));
            const hasCabinetOnRight = neighbours.some((cabinet) => isOnLeftOf(shelfBounds, boundsBeforeOrientation.get(cabinet)));
            const isMirrored = hasCabinetOnRight && !hasCabinetOnLeft;
            applyShelfOrientation(shelf, isMirrored);
        }

        // No UD cabinet: no UD handles to touch.
        if (cabinets.length === 0) return;

        // 5. Measure again: the handles reach to the shelf AABB as it stands after the orientation.
        const boundsOf = measureAll();

        // 6. Each cabinet: count neighbouring shelves per side, then stretch and shift its handles.
        for (const cabinet of cabinets) {
            const baseStretch = URBAN_DUPLEX_WIDTH_STRETCH_BY_WIDTH[result.allProducts[cabinet.name]?.Width]?.x;

            // Width outside the table: RuleWidthCabinetUrbanDuplex does not size it either, leave it alone.
            if (baseStretch === undefined) continue;

            const cabinetBounds = boundsOf.get(cabinet);
            const neighbours = shelves.filter((shelf) => isTouchingOnSameLevel(cabinetBounds, boundsOf.get(shelf)));
            const shelvesOnLeft = neighbours.filter((shelf) => isOnLeftOf(boundsOf.get(shelf), cabinetBounds)).length;
            const shelvesOnRight = neighbours.length - shelvesOnLeft;

            const stretchX = baseStretch + RuleOpenSideShelfNeighboursUrbanDuplex.SHELF_WIDTH_STRETCH_X * neighbours.length;
            const pointX = handlePointShiftX(shelvesOnLeft, shelvesOnRight);
            applyHandleStretchAndShift(cabinet, stretchX, pointX);
        }

        LoggerService.log(this, `[OpenSideShelfNeighboursUrbanDuplex] Applied to ${cabinets.length} cabinet(s), ${shelves.length} shelf(s)`);
    }
}

function isUrbanDuplexOpenSideShelf(productType) {
    return productType === RuleOpenSideShelfNeighboursUrbanDuplex.SHELF_PRODUCT_TYPE;
}

function isUrbanDuplexCabinet(productType) {
    return RuleOpenSideShelfNeighboursUrbanDuplex.CABINET_PRODUCT_TYPES.includes(productType);
}

/**
 * Gap ≤ row gap + tolerance. An overlap also counts: once stretched, the cabinet's handles
 * reach over the shelf front and its measured AABB covers the shelf.
 */
function isTouchingOnSameLevel(cabinetBounds, shelfBounds) {
    const gap = Math.max(shelfBounds.minX - cabinetBounds.maxX, cabinetBounds.minX - shelfBounds.maxX);
    const isTouching = gap <= CABINET_LAYOUT_GAP_METERS + RuleOpenSideShelfNeighboursUrbanDuplex.TOUCH_TOLERANCE_METERS;
    return isTouching && overlapsVertically(cabinetBounds, shelfBounds);
}

/**
 * True when two boxes stand on the same level: their vertical ranges overlap by at least half of the lower box.
 * Example (Multi-Level 70″, cm, template shelf before the height fit): OSS 27.1..56.9 and SB 28..56 -> overlap 28
 * of 28 -> true; OSS 27.1..56.9 and the floor SC 0..28 -> overlap 0.9 of 28 -> false.
 */
function overlapsVertically(first, second) {
    const overlap = Math.min(first.maxY, second.maxY) - Math.max(first.minY, second.minY);
    const lowerHeight = Math.min(first.maxY - first.minY, second.maxY - second.minY);
    return overlap >= lowerHeight * RuleOpenSideShelfNeighboursUrbanDuplex.MIN_VERTICAL_OVERLAP_SHARE;
}
/** Compared by centres, so a cabinet AABB grown over the shelf still has the shelf on the correct side. */
function isOnLeftOf(shelfBounds, cabinetBounds) {
    return shelfBounds.minX + shelfBounds.maxX < cabinetBounds.minX + cabinetBounds.maxX;
}

/** Shelf on the left → −half, on the right → +half; both sides (or none) cancel out to 0. */
function handlePointShiftX(shelvesOnLeft, shelvesOnRight) {
    return (shelvesOnRight - shelvesOnLeft) * RuleOpenSideShelfNeighboursUrbanDuplex.HANDLE_POINT_SHIFT_X;
}

/** SupportGroupId of every basin top in the composition; a product without one is in the default group. */
function basinTopSupportGroupIds(allProducts) {
    // The canonical role check: a Top_Solid without an explicit role is a basin top too; generated covers are not.
    const basinTops = Object.values(allProducts).filter((product) => getCountertopRole(product) === "basinTop");
    return new Set(basinTops.map(supportGroupOf));
}

function supportGroupOf(product) {
    return product?.SupportGroupId ?? DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID;
}

/** True when the shelf shares its support group with a basin top: that top lies over the shelf. */
function isUnderBasinTop(shelfProduct, basinTopGroupIds) {
    return basinTopGroupIds.has(supportGroupOf(shelfProduct));
}

/**
 * Height table value + context addition. "underTop": the table value (the shelf is as high as the cabinet); "cover":
 * the shelf grows by the cover thickness and its point moves up by half of it, so the bottom stays level with the
 * cabinet and the top meets the cover top.
 * Example (Height 28): underTop -> stretch -0.28, move -0.14; cover 12.7 mm -> stretch -0.2673, move -0.13365.
 */
function applyShelfHeight(shelf, height, mode, coverThicknessM) {
    const tableStretchY = UD_OPEN_SHELVES_SIDE_HEIGHT_STRETCH_Y.values[RuleOpenSideShelfNeighboursUrbanDuplex.HEIGHT_MESH_NAMES[0]]?.[height]?.y;
    const tableMoveY = UD_OPEN_SHELVES_SIDE_HEIGHT_MOVE_Y.values[RuleOpenSideShelfNeighboursUrbanDuplex.SHELF_POINT_NAME]?.[height]?.y;

    // Height outside the table: RuleHeightUDOpenShelvesSide does not size it either, leave it alone.
    if (tableStretchY === undefined || tableMoveY === undefined) return;

    const coverAdditionM = mode === "cover" ? coverThicknessM : 0;
    const stretchY = tableStretchY + coverAdditionM;
    const moveY = tableMoveY + coverAdditionM / 2;

    const meshes = SceneEntityHelper.collectByNames(shelf, RuleOpenSideShelfNeighboursUrbanDuplex.HEIGHT_MESH_NAMES);
    // The stretch margin is set here too, not only in RuleHeightUDOpenShelvesSide: measured live 16.10 (UI preset
    // Multi-Level 70″), after the import the walls had the template margin 0.3 again, the shelf stayed 298.6 mm high
    // instead of 280, the basin top floated and a cover was planned over the sink cabinet. With 0.1 set here: 280.
    for (const mesh of meshes) {
        const smartStretch = mesh.script?.smartStretch;
        if (smartStretch) smartStretch.margin = new Vec3(
            UD_OPEN_SHELVES_SIDE_STRETCH_MARGIN_M, UD_OPEN_SHELVES_SIDE_STRETCH_MARGIN_M, UD_OPEN_SHELVES_SIDE_STRETCH_MARGIN_M);
    }
    meshes.forEach((mesh) => SceneTransformHelper.setStretch(mesh, { y: stretchY }));
    const points = SceneEntityHelper.collectByNames(shelf, [RuleOpenSideShelfNeighboursUrbanDuplex.SHELF_POINT_NAME]);
    points.forEach((point) => SceneTransformHelper.setLocalPosition(point, { y: moveY }));
}

/** Shelf point scaleX: −1 when mirrored, +1 otherwise; Y/Z scale stay as they are. */
function applyShelfOrientation(shelf, isMirrored) {
    const points = SceneEntityHelper.collectByNames(shelf, [RuleOpenSideShelfNeighboursUrbanDuplex.SHELF_POINT_NAME]);
    for (const point of points) {
        const scale = point.getLocalScale();
        point.setLocalScale(isMirrored ? -1 : 1, scale.y, scale.z);
    }
}

function applyHandleStretchAndShift(cabinet, stretchX, pointX) {
    const meshes = SceneEntityHelper.collectByNames(cabinet, RuleOpenSideShelfNeighboursUrbanDuplex.HANDLE_MESH_NAMES);
    meshes.forEach((mesh) => SceneTransformHelper.setStretch(mesh, { x: stretchX }));

    const points = SceneEntityHelper.collectByNames(cabinet, RuleOpenSideShelfNeighboursUrbanDuplex.HANDLE_POINT_NAMES);
    points.forEach((point) => SceneTransformHelper.setLocalPosition(point, { x: pointX }));
}

/** World AABB the same way the row layout measures cabinets (CompositionManager boundsOnX). */
function measureWorldBoundsLikeRowLayout(entity, entities) {
    const placement = new AutoPlacementService()
        .setAxis("x")
        .setGap(CABINET_LAYOUT_GAP_METERS)
        .setIgnoreNodes(ProductRegistry_V2.instance.collectAabbIgnoreNodes(entities));
    const bounds = placement._getEntityAABB(entity, placement._ignoreNodes);
    return {
        minX: bounds.center.x - bounds.halfExtents.x,
        maxX: bounds.center.x + bounds.halfExtents.x,
        minY: bounds.center.y - bounds.halfExtents.y,
        maxY: bounds.center.y + bounds.halfExtents.y,
    };
}
