import { Script, Vec3, Color, BoundingBox } from "playcanvas";
import { ProductRegistry_V2 } from "../../product/registry/product-registry-v2.mjs";
import { SimpleDimensionRenderer } from "./DimensionRenderer.mjs";

/**
 * DimensionTool - manages dimension display for selected products
 */
export class DimensionTool extends Script {
  static scriptName = "dimensionTool";

  _isEnabled = false;
  _dimensionData = new Map(); 
  _currentSelectedEntity = null;
  _cameraEntity = null;
  _renderer = null;

  initialize() {
    this.app.dimensionTool = this;

    // Initialize renderer
    this._renderer = new SimpleDimensionRenderer(this.app);

    // Find camera
    this._cameraEntity =
      this.app.root.findByName("Camera") ||
      this.app.root.findComponent("camera")?.entity;

    // Subscribe to SelectTool events
    if (this.app.selectTool) {
      this.app.selectTool.on("select", this._onSelectionChanged, this);
    }

    this.on("destroy", () => {
      if (this.app.selectTool) {
        this.app.selectTool.off("select", this._onSelectionChanged, this);
      }
      this._clearDimensionDisplay();
    });
  }

  update(dt) {
    if (this._renderer && this._renderer.updateLabelPositions && this._cameraEntity) {
      this._renderer.updateLabelPositions(this._cameraEntity);
    }
  }

  // ========== PUBLIC API ==========

  setEnabled(enabled) {
    this._isEnabled = enabled;

    if (!enabled) {
      this._clearDimensionDisplay();
    } else if (this._currentSelectedEntity) {
      this._updateDimensionDisplay(this._currentSelectedEntity);
    }
  }

  isEnabled() {
    return this._isEnabled;
  }

  toggle() {
    this.setEnabled(!this._isEnabled);
  }

  setDimensionData(data) {
    const dataArray = Array.isArray(data) ? data : [data];

    dataArray.forEach(config => {
      if (!config.productId) return;

      const dimensionConfig = {
        Height: config.Height || {},
        Width: config.Width || {},
        Depth: config.Depth || {}
      };

      this._dimensionData.set(config.productId, dimensionConfig);
    });

    if (this._currentSelectedEntity && this._isEnabled) {
      const productId = this._currentSelectedEntity.name;
      if (this._dimensionData.has(productId)) {
        this._updateDimensionDisplay(this._currentSelectedEntity);
      }
    }
  }

  clearDimensionData(productId) {
    if (productId) {
      this._dimensionData.delete(productId);
      if (this._currentSelectedEntity && this._currentSelectedEntity.name === productId) {
        this._clearDimensionDisplay();
      }
    } else {
      this._dimensionData.clear();
      this._clearDimensionDisplay();
    }
  }

  getDimensionData(productId) {
    return this._dimensionData.get(productId) || null;
  }

  // ========== PRIVATE METHODS ==========

  _onSelectionChanged(allSelected) {
    if (!this._isEnabled) return;

    this._clearDimensionDisplay();

    if (allSelected && allSelected.length > 0) {
      this._currentSelectedEntity = allSelected[0];
      this._updateDimensionDisplay(this._currentSelectedEntity);
    } else {
      this._currentSelectedEntity = null;
    }
  }

  _updateDimensionDisplay(entity) {
    if (!entity) return;

    const productId = entity.name;
    const dimensionStrings = this._getDimensionStrings(productId);

    if (!dimensionStrings) return;

    const bounds = this._getEntityBounds(entity);
    if (!bounds) return;

    // Passing entity is crucial for local rotation calculations
    this._createDimensionVisualization(bounds, dimensionStrings, entity);
  }

  _getDimensionStrings(productId) {
    const dimensionConfig = this._dimensionData.get(productId);
    if (!dimensionConfig) return null;

    const compositionManager = this.app.compositionManager;
    if (!compositionManager) return null;

    const activeComposition = compositionManager.getActiveComposition();
    if (!activeComposition) return null;

    const snapshot = activeComposition.getProduct(productId);
    if (!snapshot) return null;

    const result = {};

    if (snapshot.Width !== undefined && dimensionConfig.Width && dimensionConfig.Width[snapshot.Width]) {
      result.width = dimensionConfig.Width[snapshot.Width];
    }

    if (snapshot.Depth !== undefined && dimensionConfig.Depth && dimensionConfig.Depth[snapshot.Depth]) {
      result.depth = dimensionConfig.Depth[snapshot.Depth];
    }

    if (snapshot.Height !== undefined && dimensionConfig.Height && dimensionConfig.Height[snapshot.Height]) {
      result.height = dimensionConfig.Height[snapshot.Height];
    }

    if (!result.width && !result.depth && !result.height) return null;

    return result;
  }

  _getEntityBounds(entity) {
    const totalAABB = new BoundingBox();
    let isInitialized = false;

    const traverse = (node) => {
      if (!node.enabled) return;

      let meshInstances = [];
      if (node.render) meshInstances = node.render.meshInstances;
      else if (node.model) meshInstances = node.model.meshInstances;

      if (meshInstances && meshInstances.length > 0) {
        meshInstances.forEach(mi => {
          if (!isInitialized) {
            totalAABB.copy(mi.aabb);
            isInitialized = true;
          } else {
            totalAABB.add(mi.aabb);
          }
        });
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(entity);

    if (!isInitialized) return null;

    return {
      aabb: totalAABB,
      center: totalAABB.center,
      halfExtents: totalAABB.halfExtents
    };
  }

  _createDimensionVisualization(bounds, dimensionStrings, entity) {
    if (this._renderer) {
      const productName = this._currentSelectedEntity ?
        this._getDisplayName(this._currentSelectedEntity.name) : null;

      this._renderer.render(bounds, dimensionStrings, productName, entity);
    }
  }

  _clearDimensionDisplay() {
    if (this._renderer) {
      this._renderer.clear();
    }
  }

  _getDisplayName(productType) {
    const productConfig = ProductRegistry_V2.instance.getProductConfig(productType);

    return productConfig?.displayName || productType;
  }
}