import { LoggerService } from '../../services/logger/logger-service.mjs';
import { ProductRegistry_V2 } from '../../domain/product/registry/product-registry-v2.mjs';
import { getCountertopRole } from '../../domain/countertop/countertop-role.mjs';

/**
 * Selection Plugin для ConfiguratorAPI.
 *
 * Інкапсулює методи вибору, інструментів та кнопок "+".
 * Методи доступні через ConfiguratorAPI.*
 */
export class SelectionPlugin {
  /**
   * @param {{ app: object, bridge: object }} ctx
   * @returns {object}
   */
  static create(ctx) {
    const { app, bridge } = ctx;

    /** Helper: повертає SceneManager */
    const _sm = () => {
      if (!app.sceneManager) throw new Error("SceneManager is not initialized yet!");
      return app.sceneManager;
    };

    return {

      /**
       * Показати/сховати кнопки "+"
       * @param {boolean} visible
       * @param {object} [options] - Опції фільтрації
       * @param {string} [options.productType] - Тип продукту ('Side-Shelf' для Side-Shelf позицій)
       * @param {{Height?: number, Handle?: string}} [options.config] - Висота / ручка тумби, яку ставлять, як у
       *   setProductByParams. UF ряд: "+" лишаються тільки там, де високі тумби залишаться одним блоком.
       *   Чого немає в config, береться з ряду (як при додаванні); без config UF-фільтра немає.
       *
       * @example
       * setVisibleButtons(true)                                    // cabinets (default)
       * setVisibleButtons(true, { productType: 'Side-Shelf' })    // Side-Shelf позиції
       * setVisibleButtons(true, { config: { Height: 56, Handle: 'UG' } })   // UF: коротка тумба
       * setVisibleButtons(false)                                   // сховати всі
       */
      setVisibleButtons: (visible, options = {}) => {
        app.fire("displayButtons:set", visible, options);
        LoggerService.log(bridge, `[API] setVisibleButtons`, { visible, options });
      },

      /**
       * Встановити callback для кнопки "+"
       * Column layout: side ∈ left | right | left-top | right-top | top | bottom, and the third argument is the
       * "+" itself ({ id, kind, cabinetId, rowId, positionM, availability }); legacy "+" pass undefined.
       * @param {(entityName: string, side: string, plus?: object) => void} callback
       */
      setHandleButtonClick: (callback) => {
        _sm().setHandleButtonClick(callback);
        LoggerService.log(bridge, `[Bridge] Set handle button click callback`);
      },

      /**
       * Show only the column "+" the filter accepts (null = all). Re-applied every time the "+" are rebuilt.
       * @param {((plus: {id, kind, cabinetId, rowId}) => boolean) | null} filter
       * @example setPlusFilter(plus => plus.kind === 'top' || plus.kind === 'bottom')
       */
      setPlusFilter: (filter) => {
        _sm().plusManager.setPlusFilter(filter);
      },

      /**
       * Column "+" buttons (collections whose rows hold columns, `columns: true`). The scene fires 'plusButtons:changed' after each rebuild.
       * @example
       * ConfiguratorAPI.plusButtons.list()                 // [{ id: 'top:b', kind: 'top', cabinetId: 'b', visible: true, ... }]
       * ConfiguratorAPI.plusButtons.hide('right-top:b')
       * ConfiguratorAPI.plusButtons.showForColumn('b')     // its 'top' and 'bottom' again
       * ConfiguratorAPI.plusButtons.reset()                // no filter, nothing hidden
       */
      plusButtons: {
        list: () => _sm().plusManager.listPlusButtons(),
        show: (id) => _sm().plusManager.showPlus(id),
        hide: (id) => _sm().plusManager.hidePlus(id),
        showForColumn: (cabinetId, kinds) => _sm().plusManager.showForColumn(cabinetId, kinds),
        hideForColumn: (cabinetId) => _sm().plusManager.hideForColumn(cabinetId),
        reset: () => _sm().plusManager.resetPlusVisibility(),
      },

      /**
       * Отримати SelectTool
       * @returns {object}
       */
      getSelectTool: () => {
        if (!app.selectTool) throw new Error("SelectTool is not initialized yet!");
        return app.selectTool;
      },

      /**
       * Отримати нормалізовану інформацію про поточний selection target.
       * Для Vessel Basin повертає parent productId і доступні intraplayer actions.
       * @returns {Array<object>}
       */
      getSelectionInfo: () => {
        if (!app.selectTool) throw new Error("SelectTool is not initialized yet!");
        return app.selectTool.getSelectionInfo?.() || [];
      },

      /**
       * Отримати DimensionTool
       * @returns {object}
       */
      getDimensionTool: () => {
        if (!app.dimensionTool) throw new Error("DimensionTool is not initialized yet!");
        return app.dimensionTool;
      },

      /**
       * Показати/сховати кнопки шухляд
       * @param {boolean} visible
       * @returns {boolean}
       */
      /**
       * Показати dimensions.
       * @param {object} data - { box: { nodes, width, height, depth }, lines: [...], labelSettings }
       */
      showDimensions: (data) => {
        if (!app.dimensionSystem) {
          LoggerService.error(bridge, '[Bridge] DimensionSystem not initialized');
          return;
        }
        if (app.dimensionTool) app.dimensionTool.setEnabled(false);

        const preparedData = SelectionPlugin._prepareDimensionData(app, data);
        const countertopDimensions = SelectionPlugin._getCountertopDimensionAdapter(app);
        if (countertopDimensions) {
          countertopDimensions.showDimensions(preparedData);
        } else {
          app.dimensionSystem.showDimensions(preparedData);
        }
        LoggerService.log(bridge, `[API] showDimensions`);
      },

      /**
       * Сховати dimensions
       */
      hideDimensions: () => {
        const countertopDimensions = SelectionPlugin._getCountertopDimensionAdapter(app);
        if (countertopDimensions) {
          countertopDimensions.hideDimensions();
        } else {
          app.dimensionSystem?.hideDimensions();
        }
        LoggerService.log(bridge, `[API] hideDimensions`);
      },

      /**
       * Toggle dimensions on/off
       */
      toggleDimensions: () => {
        const countertopDimensions = SelectionPlugin._getCountertopDimensionAdapter(app);
        if (!countertopDimensions?.toggleDimensions()) {
          app.dimensionSystem?.toggleDimensions();
        }
      },

      /**
       * Показати empty state кнопку "+" (кнопка порожньої сцени).
       * Автоматично ховається при додаванні тумб.
       */
      showEmptyButton: () => {
        _sm().plusManager.showEmptyButton();
        LoggerService.log(bridge, `[API] showEmptyButton`);
      },

      /**
       * Сховати empty state кнопку "+".
       */
      hideEmptyButton: () => {
        _sm().plusManager.hideEmptyButton();
        LoggerService.log(bridge, `[API] hideEmptyButton`);
      },

      setVisibleDrawerButtons: (visible) => {
        if (!app.drawerOverlaySystem) {
          LoggerService.error(bridge, '[Bridge] DrawerOverlaySystem not initialized');
          return false;
        }
        return app.drawerOverlaySystem.setEnabled(visible);
      }
    };
  }

  static _prepareDimensionData(app, data) {
    if (!data?.box) return data;

    const box = data.box;
    const originalNodes = Array.isArray(box.nodes) ? [...box.nodes] : [];
    const compositionManager = app.compositionManager;
    const composition = compositionManager?.getActiveComposition?.();
    const countertops = (compositionManager?.getProductEntitiesByCategory('countertops') || [])
      .filter(entity => getCountertopRole(composition?.getProduct?.(entity.name)) === 'basinTop');
    const countertopNodes = countertops.map((ct) => ct.name);

    const boxNodes = [...originalNodes];

    // Автоматично додаємо countertop до box nodes,
    // бо він живе на рівні app.root, а не як child кабінету.
    for (const nodeName of countertopNodes) {
      if (!boxNodes.includes(nodeName)) {
        boxNodes.push(nodeName);
      }
    }

    const cabinetNodes = originalNodes.filter((nodeName) => !countertopNodes.includes(nodeName));
    const excludeNodeNames = Array.isArray(box.excludeNodeNames) ? [...box.excludeNodeNames] : [];
    const sinkAnchorNames = ProductRegistry_V2.instance.getSinkAnchorNames();
    for (const sinkAnchorName of sinkAnchorNames) {
      if (!excludeNodeNames.includes(sinkAnchorName)) excludeNodeNames.push(sinkAnchorName);
    }

    const preparedBox = {
      ...box,
      nodes: boxNodes,
      excludeNodeNames
    };

    if (box.heightSegments) {
      preparedBox.heightSegments = SelectionPlugin._normalizeHeightSegments(
        box.heightSegments,
        cabinetNodes.length > 0 ? cabinetNodes : originalNodes,
        countertopNodes,
        sinkAnchorNames
      );
    }

    return {
      ...data,
      box: preparedBox
    };
  }

  static _getCountertopDimensionAdapter(app) {
    return app?.compositionManager?.countertopCompositionAdapter?.dimensionAdapter || null;
  }

  static _normalizeHeightSegments(heightSegments, cabinetNodes, countertopNodes, sinkAnchorNames = ['Sink_Point']) {
    const list = Array.isArray(heightSegments)
      ? heightSegments
      : Object.entries(heightSegments).map(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number') {
          return { key, label: String(value) };
        }
        return { key, ...(value || {}) };
      });

    return list.map((segment, index) => {
      const key = String(segment.key || segment.type || segment.segment || '').toLowerCase();
      let nodes = Array.isArray(segment.nodes) ? [...segment.nodes] : null;
      let resolvedAsCabinet = key.includes('cabinet') || key.includes('base');
      const resolvedAsSink = SelectionPlugin._isSinkHeightSegmentKey(key);
      let source = segment.source;
      let sourceNodes = Array.isArray(segment.sourceNodes) ? [...segment.sourceNodes] : undefined;

      if (!nodes) {
        if (resolvedAsSink) {
          nodes = [];
          source = 'sink';
          sourceNodes = [...cabinetNodes];
          resolvedAsCabinet = false;
        } else if (key.includes('countertop') || key.includes('top')) {
          nodes = [...countertopNodes];
          resolvedAsCabinet = false;
        } else if (key.includes('cabinet') || key.includes('base')) {
          nodes = [...cabinetNodes];
          resolvedAsCabinet = true;
        } else {
          if (index === 1) {
            nodes = [...countertopNodes];
            resolvedAsCabinet = false;
          } else if (index === 2) {
            nodes = [];
            source = 'sink';
            sourceNodes = [...cabinetNodes];
            resolvedAsCabinet = false;
          } else {
            nodes = [...cabinetNodes];
            resolvedAsCabinet = true;
          }
        }
      }

      return {
        ...segment,
        nodes,
        source,
        sourceNodes,
        excludeNodeNames: segment.excludeNodeNames || (resolvedAsCabinet ? [...sinkAnchorNames] : undefined)
      };
    });
  }

  static _isSinkHeightSegmentKey(key) {
    return key.includes('sink') ||
      key.includes('slink') ||
      key.includes('vessel') ||
      key.includes('basin');
  }
}
