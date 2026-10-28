export class RootStore {
  static _instance = null;

  constructor() {
    this._productStates = new Map(); // Map<productId, SnapshotProductAttribute>
    this._selectedProductIds = new Set(); // Set<productId>

    this._orderProductIds = {}; // <productId, index>
    this.meta = {
      createdAt: Date.now(),
      lastModified: Date.now(),
    };
  }

  // ====== СІНГЛТОН ======
  static get instance() {
    if (!RootStore._instance) {
      RootStore._instance = new RootStore();
    }
    return RootStore._instance;
  }

  // ====== ПРОДУКТИ ======

  get rawProductStates() {
    return this._productStates;
  }

  getProducts() {
    return Object.fromEntries(this._productStates);
  }

  getAllProducts() {
    return Array.from(this._productStates.values());
  }

  getProductSnapshot(productId) {
    return this._productStates.get(productId) || null;
  }

  setProductSnapshot(productId, snapshot) {
    this._productStates.set(productId, snapshot);
    this.meta.lastModified = Date.now();
  }

  removeProductSnapshot(productId) {
    const deleted = this._productStates.delete(productId);

    if (this._selectedProductIds.has(productId)) {
      this._selectedProductIds.delete(productId);
    }

    this.meta.lastModified = Date.now();
    return deleted;
  }

  hasProduct(productId) {
    return this._productStates.has(productId);
  }

  // ====== ВИБРАНИЙ ПРОДУКТ (опціонально) ======

  selectProduct(productId) {
    this._selectedProductIds.add(productId);
    this.meta.lastModified = Date.now();
  }

  unselectProduct(productId) {
    this._selectedProductIds.delete(productId);
    this.meta.lastModified = Date.now();
  }

  getSelectedProducts() {
    return Array.from(this._selectedProductIds);
  }

  getOrderProductIds() {
    return this._orderProductIds;
  }

  setOrderProductIds(orderMap) {
    this._orderProductIds = orderMap;
    this.meta.lastModified = Date.now();
  }

  setOrderProductId(productId, index) {
    this._orderProductIds[productId] = index;
    this.meta.lastModified = Date.now();
  }
}
