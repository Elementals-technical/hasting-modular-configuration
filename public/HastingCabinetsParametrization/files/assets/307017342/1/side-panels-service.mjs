/**
 * @deprecated Замінений на domain/addons/side-panel-addon.mjs (SidePanelAddon extends AddonStateMachine).
 * Цей файл залишений для backward compatibility. Використовуйте import з index.mjs.
 */

import { LoggerService } from '../logger/logger-service.mjs';
import { ProductFactory } from '../../domain/product/factory/product-factory.mjs';
import { ProductRegistry_V2 } from '../../domain/product/registry/product-registry-v2.mjs';

/**
 * Сервіс для управління Side Panels
 *
 * Відповідає за:
 * - Встановлення типів side panels (per-side або обидві одночасно)
 * - Створення, оновлення та видалення side panels
 * - Синхронізацію параметрів панелей з шафами
 * - Розрахунок зміщення стільниці на основі side panels
 */
export class SidePanelsService {
  /**
   * Константа зміщення стільниці при наявності side panel (в метрах)
   * @type {number}
   */
  static COUNTERTOP_OFFSET_VALUE = 0.5 / 100;

  /**
   * @param {object} app - PlayCanvas app instance
   * @param {object} compositionManager - Посилання на CompositionManager
   */
  constructor(app, compositionManager) {
    this.app = app;
    this.compositionManager = compositionManager;

    // Зберігаємо глобальні типи панелей
    this._globalSidePanelTypeLeft = null;
    this._globalSidePanelTypeRight = null;

    LoggerService.log(this, '🎨 [SidePanelsService] Initialized');
  }

  // ====== ВАЛІДАЦІЯ ======

  /**
   * Валідує тип SidePanel
   * @param {string} type - Тип панелі
   * @returns {boolean}
   * @private
   */
  _validateType(type) {
    const registry = ProductRegistry_V2.instance;
    const config = registry.getProductConfig('SidePanel_Left');
    const validTypes = config?.meshConfig?.variants?.map(v => v.key) || [];

    if (!validTypes.includes(type)) {
      LoggerService.error(
        this,
        `Invalid SidePanel type "${type}". Valid: ${validTypes.join(', ')}`
      );
      return false;
    }
    return true;
  }

  /**
   * Отримує активну композицію та перевіряє наявність кабінетів
   * @returns {{ composition: CompositionStore, allProducts: object } | null}
   * @private
   */
  _getCompositionWithCabinets() {
    const composition = this.compositionManager.getActiveComposition();
    if (!composition) {
      LoggerService.error(this, 'No active composition');
      return null;
    }

    const allProducts = composition.getAllProducts();
    const hasCabinets = Object.values(allProducts).some(p => p.category === 'cabinets');

    if (!hasCabinets) {
      LoggerService.warn(this, 'No cabinets found');
      return null;
    }

    return { composition, allProducts };
  }

  // ====== ОСНОВНИЙ API ======

  /**
   * Встановлює тип SidePanel по стороні
   * @param {string} type - 'None' | 'UpperG' | 'CenterG' | 'DoubleG' | 'NoG'
   * @param {string} side - 'left' | 'right' | 'both'
   * @returns {Promise<boolean>} Успішність операції
   *
   * @example
   * // Встановити панель зліва
   * await sidePanelsService.setSidePanelType('UpperG', 'left');
   *
   * // Встановити панель справа
   * await sidePanelsService.setSidePanelType('CenterG', 'right');
   *
   * // Встановити обидві панелі одночасно
   * await sidePanelsService.setSidePanelType('UpperG', 'both');
   *
   * // Видалити панель зліва
   * await sidePanelsService.setSidePanelType('None', 'left');
   *
   * // Видалити обидві панелі
   * await sidePanelsService.setSidePanelType('None', 'both');
   */
  async setSidePanelType(type, side = 'both') {
    this.compositionManager?.getActiveComposition?.()?.assertMutable?.();
    if (!this._validateType(type)) return false;

    const ctx = this._getCompositionWithCabinets();
    if (!ctx) return false;

    const { composition, allProducts } = ctx;

    // Обробляємо ліву сторону
    if (side === 'left' || side === 'both') {
      await this._applySideForPanel('left', type, composition, allProducts);
    }

    // Обробляємо праву сторону
    if (side === 'right' || side === 'both') {
      await this._applySideForPanel('right', type, composition, allProducts);
    }

    // Тригеримо composition rules для позиціонування
    this.compositionManager.aggregator.onCompositionStructureChanged(
      this.compositionManager._activeCompositionId,
      this.compositionManager.getAllCompositions()
    );

    LoggerService.log(this, `🎨 [SidePanelsService] SidePanel type set to "${type}" on side "${side}"`);
    return true;
  }

  /**
   * Застосовує тип панелі для конкретної сторони
   * @param {'left'|'right'} panelSide - Сторона
   * @param {string} type - Тип панелі
   * @param {CompositionStore} composition - Композиція
   * @param {object} allProducts - Всі продукти
   * @private
   */
  async _applySideForPanel(panelSide, type, composition, allProducts) {
    composition?.assertMutable?.();
    const panelProductType = panelSide === 'left' ? 'SidePanel_Left' : 'SidePanel_Right';

    // Зберігаємо глобальний тип
    if (panelSide === 'left') {
      this._globalSidePanelTypeLeft = type;
    } else {
      this._globalSidePanelTypeRight = type;
    }

    // Шукаємо існуючу панель
    const existingPanel = Object.entries(allProducts).find(([id, p]) =>
      p.category === 'addons' && id.includes(panelProductType)
    );

    if (type === 'None') {
      // Видаляємо панель якщо вона є
      if (existingPanel) {
        const [panelId] = existingPanel;
        this._destroyPanel(panelId, composition);
      }
    } else {
      // Оновлюємо або створюємо панель
      if (existingPanel) {
        const [panelId] = existingPanel;
        await this.compositionManager.updateProductConfig(panelId, { SidePanelType: type });
        LoggerService.log(this, `✅ Updated ${panelProductType} to "${type}"`);
      } else {
        // Визначаємо reference кабінет для успадкування параметрів
        const { leftCabinetId, rightCabinetId } = this.compositionManager.getEdgeCabinets();
        const refCabinetId = panelSide === 'left' ? leftCabinetId : rightCabinetId;
        await this.createSidePanel(panelProductType, type, composition, refCabinetId);
        LoggerService.log(this, `✅ Created ${panelProductType} "${type}"`);
      }
    }
  }

  // ====== СТВОРЕННЯ ======

  /**
   * Перевіряє чи існують side panels, якщо ні - створює при наявності хоча б 1 тумби
   * @param {CompositionStore} composition - Активна композиція
   * @returns {Promise<void>}
   */
  async ensureSidePanelsExist(composition) {
    composition?.assertMutable?.();
    const allProducts = composition.getAllProducts();
    const hasCabinets = Object.values(allProducts).some(p => p.category === 'cabinets');

    if (!hasCabinets) return;

    const { leftCabinetId, rightCabinetId } = this.compositionManager.getEdgeCabinets();

    const hasLeftPanel = Object.values(allProducts).some(p =>
      p.productType === 'SidePanel_Left'
    );
    const hasRightPanel = Object.values(allProducts).some(p =>
      p.productType === 'SidePanel_Right'
    );

    const leftPanelType = this._globalSidePanelTypeLeft || 'None';
    const rightPanelType = this._globalSidePanelTypeRight || 'None';

    if (!hasLeftPanel && leftPanelType !== 'None') {
      await this.createSidePanel('SidePanel_Left', leftPanelType, composition, leftCabinetId);
    }

    if (!hasRightPanel && rightPanelType !== 'None') {
      await this.createSidePanel('SidePanel_Right', rightPanelType, composition, rightCabinetId);
    }
  }

  /**
   * Створює side panel
   * @param {string} productType - 'SidePanel_Left' або 'SidePanel_Right'
   * @param {string} panelType - Тип панелі (UpperG, CenterG і т.д.)
   * @param {CompositionStore} composition - Композиція
   * @param {string} [referenceCabinetId] - ID крайньої шафи для отримання налаштувань
   * @returns {Promise<void>}
   */
  async createSidePanel(productType, panelType, composition, referenceCabinetId = null) {
    composition?.assertMutable?.();
    try {
      const entity = await new ProductFactory().createProductEntity(productType);

      if (!entity) {
        LoggerService.error(this, `Failed to create ${productType}`);
        return;
      }

      this.app.root.addChild(entity);

      const allProducts = composition.getAllProducts();

      // Визначаємо крайню шафу для отримання налаштувань
      let referenceCabinet = null;

      if (referenceCabinetId) {
        referenceCabinet = allProducts[referenceCabinetId];
      }

      // Якщо не вказана конкретна шафа, беремо першу або останню залежно від типу панелі
      if (!referenceCabinet) {
        const { leftCabinetId, rightCabinetId } = this.compositionManager.getEdgeCabinets();

        if (productType === 'SidePanel_Left') {
          referenceCabinet = allProducts[leftCabinetId];
        } else {
          referenceCabinet = allProducts[rightCabinetId];
        }
      }

      const productMeta = ProductRegistry_V2.instance.getProductConfig(productType) || {};

      const config = {
        entityName: entity.name,
        productType: productType,
        category: productMeta.category || 'addons',
        SidePanelType: panelType,
        side: productType.includes('Left') ? 'left' : 'right',

        Depth: referenceCabinet?.Depth || 46,
        Height: referenceCabinet?.Height || 56,

        CabinetColor: referenceCabinet?.CabinetColor,
        GrainDirection: referenceCabinet?.GrainDirection || 'None',
        HandleGrooveColor: referenceCabinet?.HandleGrooveColor || null
      };

      composition.addProduct(entity.name, config);

      await this.compositionManager._executeProductRules(entity, config);

      LoggerService.log(this, `✅ ${productType} created (${panelType}) with Color: ${config.CabinetColor}`);
    } catch (error) {
      LoggerService.error(this, `Failed to create ${productType}:`, error);
    }
  }

  // ====== ВИДАЛЕННЯ ======

  /**
   * Видаляє всі side panels
   * @param {CompositionStore} composition - Композиція
   * @returns {void}
   */
  removeSidePanels(composition) {
    composition?.assertMutable?.();
    const sidePanels = this.compositionManager.getProductEntitiesByCategory('addons')
      .filter(e => e.name.includes('SidePanel'));

    sidePanels.forEach(panel => {
      composition.removeProduct(panel.name);
      panel.destroy();
      LoggerService.log(this, `🗑️ Removed ${panel.name}`);
    });
  }

  /**
   * Видаляє конкретну панель по ID
   * @param {string} panelId - ID панелі
   * @param {CompositionStore} composition - Композиція
   * @private
   */
  _destroyPanel(panelId, composition) {
    composition?.assertMutable?.();
    const entity = this.app.root.findByName(panelId);
    if (entity) {
      composition.removeProduct(panelId);
      entity.destroy();
      LoggerService.log(this, `🗑️ Removed ${panelId}`);
    }
  }

  // ====== УТИЛІТИ ======

  /**
   * Розраховує зміщення стільниці залежно від side panels
   * @param {Array} listSidePanel - Масив конфігурацій side panels
   * @returns {number} Зміщення по X в метрах
   *
   * Логіка:
   * - Тільки ліва панель: -COUNTERTOP_OFFSET_VALUE (зміщення вліво)
   * - Тільки права панель: +COUNTERTOP_OFFSET_VALUE (зміщення вправо)
   * - Обидві панелі або жодної: 0 (без зміщення)
   */
  calculateCountertopOffset(listSidePanel) {
    const hasLeftPanel = listSidePanel.some(p => p.productType === 'SidePanel_Left');
    const hasRightPanel = listSidePanel.some(p => p.productType === 'SidePanel_Right');

    if (hasLeftPanel && !hasRightPanel) {
      return -SidePanelsService.COUNTERTOP_OFFSET_VALUE;
    } else if (!hasLeftPanel && hasRightPanel) {
      return SidePanelsService.COUNTERTOP_OFFSET_VALUE;
    }

    return 0;
  }

  /**
   * Синхронізує параметри side panel з шафою
   * @param {string} panelId - ID панелі
   * @param {object} cabinetConfig - Конфігурація шафи
   * @returns {Promise<void>}
   */
  async syncPanelWithCabinet(panelId, cabinetConfig) {
    const updates = {
      Depth: cabinetConfig.Depth,
      Height: cabinetConfig.Height,
      CabinetColor: cabinetConfig.CabinetColor,
      HandleGrooveColor: cabinetConfig.HandleGrooveColor || null
    };

    await this.compositionManager.updateProductConfig(panelId, updates);
    LoggerService.log(this, `🔄 Synced ${panelId} with cabinet config`);
  }

  /**
   * Отримує глобальні типи side panels
   * @returns {object} { left, right }
   */
  getGlobalSidePanelTypes() {
    return {
      left: this._globalSidePanelTypeLeft,
      right: this._globalSidePanelTypeRight
    };
  }

  /**
   * Встановлює глобальні типи side panels (для відновлення стану)
   * @param {string} leftType - Тип лівої панелі
   * @param {string} rightType - Тип правої панелі
   */
  setGlobalSidePanelTypes(leftType, rightType) {
    this.compositionManager?.getActiveComposition?.()?.assertMutable?.();
    this._globalSidePanelTypeLeft = leftType;
    this._globalSidePanelTypeRight = rightType;
  }
}
