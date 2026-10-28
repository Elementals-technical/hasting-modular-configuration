import { BoundingBox } from 'playcanvas';
import { LoggerService } from "../../../services/logger/logger-service.mjs";
import { BaseCompositionRule } from "./base-composition-rule.mjs";
import { SceneEntityHelper } from "../../../helpers/scene-entity-helper.mjs";
import { SceneTransformHelper } from "../../../helpers/scene-transform-helper.mjs";
import { ProductRegistry_V2 } from "../../product/registry/product-registry-v2.mjs";
import { RuleCountertopLayout } from "./RuleCountertopLayout.mjs";
import { sidePanelProfileOf } from "../../addons/side-panel-profiles.mjs";
import { cabinetDepthIgnoreNodes } from "../../addons/side-panel-group-measurement.mjs";

const GROUP_EDGE_LAYOUT = 'group-edge';

const isGroupEdgePanel = panelConfig => panelConfig?.SidePanelLayout === GROUP_EDGE_LAYOUT;

// A profiled panel mirrors itself through its point scale, so its root never rotates.
const isProfiledPanel = panelConfig => sidePanelProfileOf(panelConfig?.SidePanelProfile) !== null;

// Its root stands on the cabinet bottom, whatever parts are visible (a joint strip shows only top parts).
const isRootAtCabinetBottomPanel = panelConfig =>
  sidePanelProfileOf(panelConfig?.SidePanelProfile)?.rootAtCabinetBottom === true;

// An unsupported joint pair is a normal layout, so only an unresolved END face is worth a warning.
const isUnresolvedEndFace = face => Boolean(face.reason) && face.face === 'end';

export class RuleSidePanels extends BaseCompositionRule {
  constructor() {
    super({
      name: "SidePanels",
      watchCompositions: ["cabinets", "addons"],
      watchParams: ["Width", "Height", "Depth", "Handle", "CabinetColor", "SidePanelType", "SidePanelRequestedType", "HandleGrooveColor", "GrainDirection", 'SpatialOffsetM', 'SupportGroupId', 'productType', 'enabled'],
    });
  }

  aggregateFn(compositions) {
    const cabinetsComp = compositions.cabinets;
    if (!cabinetsComp) return { hasCabinets: false };

    const allProducts = cabinetsComp.getAllProducts();
    const cabinetProducts = Object.values(allProducts).filter(
      (p) => p.category === "cabinets"
    );

    if (cabinetProducts.length === 0) return { hasCabinets: false };

    return {
      hasCabinets: true,
      cabinets: cabinetProducts,
      compositions: compositions,
    };
  }

  async applyFn(result, context) {
    if (!result.hasCabinets) return;

    // Використовуємо shared context замість повторних запитів
    const { shared } = context;
    const compositionManager = context.app.compositionManager;

    const composition = shared?.composition || compositionManager.getActiveComposition();
    if (!composition) return;
    if (compositionManager.sidePanelAddon?.usesGroupPanels(composition)) {
      const plan = await compositionManager.sidePanelAddon.prepareGroupPlan(shared);
      if (plan.status !== 'ready') {
        LoggerService.warn(this, '[RuleSidePanels] Group plan unresolved', plan.reason);
        return;
      }
      for (const face of plan.faces) {
        if (isUnresolvedEndFace(face)) LoggerService.warn(this, '[RuleSidePanels] Selected edge has no compatible panel', face);
      }
      const targets = await compositionManager.sidePanelAddon.materializeGroupPlan(shared, plan);
      const bounds = box => {
        const aabb = new BoundingBox();
        for (const axis of ['x', 'y', 'z']) {
          aabb.center[axis] = (box.minM[axis] + box.maxM[axis]) / 2;
          aabb.halfExtents[axis] = (box.maxM[axis] - box.minM[axis]) / 2;
        }
        return aabb;
      };
      for (const { panel, entity } of targets) {
        await this._updatePanel(entity, bounds(panel.boxM), bounds(panel.depthBoxM), panel.side,
          panel.config, compositionManager);
      }
      // Later handlers in this same cycle must see every new panel and no removed products.
      if (shared) {
        shared.allProducts = composition.getAllProducts();
        if (shared.entities) shared.entities.addons = compositionManager.getProductEntitiesByCategory('addons');
      }
      return;
    }

    const cabinets = (shared?.entities?.cabinets || []).filter((e) => e.enabled);
    if (cabinets.length === 0) return;

    // SmartStretch оновлює mesh AABB після render frame. Для depth 50.5
    // shared.cabinetsAabb може бути зібраний ще по попередній геометрії.
    await SceneTransformHelper.waitForFrames(2);
    cabinets.forEach(e => e.syncHierarchy());

    // Беремо fresh AABB після стабілізації stretch, fallback — shared context.
    // X: footprint корпусу — той самий ignore-список, що й у RuleCountertopLayout
    // (registry aabbIgnoreNodes + піддерево sink mount anchor), щоб мийка/ручки не зсували панелі.
    // Z: AABB з фасадами й ручками (footprint-ignore відкидає частину 50D depth-геометрії, див. 8338e29),
    // без піддерева мийки і без boolean-катерів, що стирчать за задню стінку (cabinetDepthIgnoreNodes).
    const allProducts = shared?.allProducts || {};
    const cabinetsAabb = this._aggregateCabinetsAabb(cabinets, allProducts) || shared?.cabinetsAabb;
    const cabinetsDepthAabb = this._aggregateCabinetsAabb(cabinets, allProducts, { depth: true }) || cabinetsAabb;
    if (!cabinetsAabb) {
      LoggerService.warn(this, "Failed to get cabinets AABB from shared context");
      return;
    }

    const addons = shared?.entities?.addons || [];

    const leftPanel = addons.find((e) => e.name.includes("SidePanel_Left"));
    if (leftPanel && leftPanel.enabled) {
      const cabinetDepthHeight = this._getCabinetDepthHeight(shared, compositionManager, "left");
      await this._updatePanel(leftPanel, cabinetsAabb, cabinetsDepthAabb, "left", cabinetDepthHeight, compositionManager);
    }

    const rightPanel = addons.find((e) => e.name.includes("SidePanel_Right"));
    if (rightPanel && rightPanel.enabled) {
      const cabinetDepthHeight = this._getCabinetDepthHeight(shared, compositionManager, "right");
      await this._updatePanel(rightPanel, cabinetsAabb, cabinetsDepthAabb, "right", cabinetDepthHeight, compositionManager);
    }

    LoggerService.log(this, "✅ [RuleSidePanels] Positioned panels");
  }

  _aggregateCabinetsAabb(cabinets, allProducts = {}, { depth = false } = {}) {
    const registry = ProductRegistry_V2.instance;
    const totalAabb = new BoundingBox();
    let initialized = false;

    cabinets.forEach(entity => {
      if (!entity.enabled) return;

      const aabb = SceneEntityHelper.traverseAabb(
        entity,
        depth ? cabinetDepthIgnoreNodes(registry, allProducts?.[entity.name] || {}, entity.name)
          : RuleCountertopLayout.cabinetFootprintIgnoreNodes(registry, allProducts?.[entity.name] || {}, entity.name)
      );
      if (!aabb) return;

      if (!initialized) {
        totalAabb.copy(aabb);
        initialized = true;
      } else {
        totalAabb.add(aabb);
      }
    });

    return initialized ? totalAabb : null;
  }

  _getCabinetDepthHeight(shared, compositionManager, side) {
    const allProducts = shared?.allProducts;
    if (!allProducts) return { Depth: 46, Height: 56 };

    const cabinetProducts = Object.values(allProducts).filter(
      (p) => p.category === "cabinets"
    );

    if (cabinetProducts.length === 0) return { Depth: 46, Height: 56 };

    const edgeCabinets = compositionManager?.getEdgeCabinets?.() || {};
    const edgeCabinetId = side === "left"
      ? edgeCabinets.leftCabinetId
      : edgeCabinets.rightCabinetId;
    const firstCabinet = allProducts[edgeCabinetId] || cabinetProducts[0];

    return {
      Depth: firstCabinet.Depth || 46,
      Height: firstCabinet.Height || 56,
      Handle: firstCabinet.Handle,
      CabinetColor: firstCabinet.CabinetColor,
      GrainDirection: firstCabinet.GrainDirection || 'None',
      HandleGrooveColor: firstCabinet.HandleGrooveColor || null,
      productType: firstCabinet.productType || null
    };
  }

  async _updatePanel(panel, cabinetsAabb, cabinetsDepthAabb, side, cabinetDepthHeight, compositionManager) {
    const changes = {
      Depth: cabinetDepthHeight.Depth,
      Height: cabinetDepthHeight.Height,
      Handle: cabinetDepthHeight.Handle,
      CabinetColor: cabinetDepthHeight.CabinetColor,
      GrainDirection: cabinetDepthHeight.GrainDirection,
      HandleGrooveColor: cabinetDepthHeight.HandleGrooveColor
    };
    if (isGroupEdgePanel(cabinetDepthHeight)) {
      // A reused panel entity must re-run its layout rule with the face the group policy chose.
      Object.assign(changes, {
        SidePanelFace: cabinetDepthHeight.SidePanelFace,
        SidePanelNeighbourHeight: cabinetDepthHeight.SidePanelNeighbourHeight
      });
    }

    // Оновити store без повного перезапуску всіх правил
    const composition = compositionManager.getActiveComposition();
    if (!composition) return;
    const currentConfig = composition.getProduct(panel.name);
    if (!currentConfig) return;

    const support = ProductRegistry_V2.instance.getSidePanelSupport(cabinetDepthHeight.productType);
    const profile = sidePanelProfileOf(support?.profile);
    if (profile) {
      const requestedType = currentConfig.SidePanelRequestedType || currentConfig.SidePanelType;
      Object.assign(changes, {
        SidePanelType: profile.resolveAppearance({ cabinetConfig: cabinetDepthHeight, requestedType }),
        SidePanelRequestedType: requestedType,
        SidePanelProfile: support.profile
      });
    }

    const updatedConfig = { ...currentConfig, ...changes };
    composition.addProduct(panel.name, updatedConfig);

    // Спочатку синхронізуємо mesh/visibility з фактичними Depth/Height.
    // Для 50D панелей AABB має читатися тільки після перемикання depth-mesh,
    // інакше позиціювання може бути розраховане по попередній геометрії.
    await compositionManager._executeProductRulesWithChanges(panel, changes, updatedConfig);

    if (isGroupEdgePanel(updatedConfig)) {
      await SceneTransformHelper.waitForFrames(2);
    }

    this._updatePosition(panel, cabinetsAabb, cabinetsDepthAabb, side, updatedConfig);
  }

  _updatePosition(instance, cabinetsAabb, cabinetsDepthAabb, side, panelConfig = {}) {
    if (isProfiledPanel(panelConfig)) {
      // Profiled panels mirror their point node in the product rule; do not also rotate the root.
      instance.setLocalEulerAngles(0, 0, 0);
    } else if (side === "left") {
      instance.setLocalEulerAngles(0, 180, 0);
    } else {
      instance.setLocalEulerAngles(0, 0, 0);
    }

    instance.syncHierarchy();

    const panelAabb = this._getPanelPositionAabb(instance);
    if (!panelAabb) return;

    const currentPos = instance.getPosition();

    const cabinetEdgeX = side === "left"
      ? cabinetsAabb.center.x - cabinetsAabb.halfExtents.x
      : cabinetsAabb.center.x + cabinetsAabb.halfExtents.x;

    const panelEdgeX = side === "left"
      ? panelAabb.center.x + panelAabb.halfExtents.x
      : panelAabb.center.x - panelAabb.halfExtents.x;

    const moveX = cabinetEdgeX - panelEdgeX;
    const moveZ = cabinetsDepthAabb.center.z - panelAabb.center.z;

    instance.setPosition(
      currentPos.x + moveX,
      this._panelRootY(currentPos.y, cabinetsAabb, panelAabb, panelConfig),
      currentPos.z + moveZ
    );
  }

  /**
   * Group-edge panels stand on the anchor cabinet bottom: root-at-cabinet-bottom profiles put the root there,
   * the others align their visible bottom with it. Legacy panels keep their Y.
   */
  _panelRootY(currentRootY, cabinetsAabb, panelAabb, panelConfig) {
    if (!isGroupEdgePanel(panelConfig)) return currentRootY;

    const cabinetBottomY = cabinetsAabb.center.y - cabinetsAabb.halfExtents.y;
    if (isRootAtCabinetBottomPanel(panelConfig)) return cabinetBottomY;

    const panelVisibleBottomY = panelAabb.center.y - panelAabb.halfExtents.y;
    return currentRootY + cabinetBottomY - panelVisibleBottomY;
  }

  _getPanelPositionAabb(instance) {
    return SceneEntityHelper.traverseAabb(instance, ["_Inlay", "_Overlay"])
      || SceneEntityHelper.traverseAabb(instance);
  }
}
