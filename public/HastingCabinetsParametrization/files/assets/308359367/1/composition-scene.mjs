/**
 * The active composition as a spatial-manipulation scene source.
 *
 * Bodies (one per product with a live root entity):
 *   countertops           tags ['countertop'], measured on its TopSolid mesh
 *   cabinets              tags ['cabinet'], meta.orderIndex from the composition order
 *   SidePanel_Left/Right  tags ['side-panel', 'side-panel-left'|'side-panel-right'], orderIndex
 *                         outside its edge cabinet for grouped ULH panels; outside all cabinets for legacy
 * Every body carries meta.productType (for collision profiles) and meta.measure (the product's
 * AABB ignore nodes).
 *
 * The scene is read on every geometry read; measurements are cached by the World per scene
 * revision, so hosts call `world.invalidate()` when the composition changes.
 */
import { DEFAULT_EXCLUDED_NODE_FRAGMENTS } from '../../spatial-manipulation/playcanvas/index.mjs';
import { getCountertopRole } from '../../countertop/countertop-role.mjs';

const TOP_SOLID_NAME = 'TopSolid';

const read = (snapshot, key) => (typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key]);

const productControllerConfig = root => {
  try {
    return root?.script?.get?.('productController')?.ruleExecutor?.context?.productConfig || null;
  } catch {
    return null;
  }
};

/** productType / category from the snapshot, the live product controller, then the registry. */
export const resolveProductIdentity = (snapshot, root, productId, registry = null) => {
  const live = productControllerConfig(root);
  const productType = read(snapshot, 'productType') ?? live?.productType ?? registry?.detectProductType?.(root?.name ?? productId) ?? null;
  const registered = productType ? registry?.getProductConfig?.(productType) : null;
  const category = read(snapshot, 'category') ?? live?.category ?? registered?.category ?? null;
  return { productType, category };
};

const findNamedDescendant = (root, name) => {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node !== root && node.name === name) return node;
    for (const child of node.children || []) stack.push(child);
  }
  return null;
};

const excludeFor = (productId, registry) => [
  ...DEFAULT_EXCLUDED_NODE_FRAGMENTS,
  ...(registry?.getAabbIgnoreNodesByEntity?.(productId) ?? [])
];

/**
 * @param {object} options
 * @param {object} options.app                      PlayCanvas app (entity lookup by product id)
 * @param {() => object|null} options.getComposition the active composition
 * @param {object} [options.registry]              ProductRegistry_V2 instance (types, AABB ignore nodes)
 */
export function createCompositionScene({ app, getComposition, registry = null }) {
  const entityOf = productId => app?.root?.findByName?.(productId) ?? null;
  return Object.freeze({
    scopeId: () => getComposition()?.compositionId ?? 'no-composition',
    bodies() {
      const composition = getComposition();
      if (!composition) return [];
      const products = composition.getAllProducts?.() ?? {};
      const order = composition.getOrderProductIds?.() ?? {};
      const entries = products instanceof Map ? [...products.entries()] : Object.entries(products);
      const bodies = [];
      const cabinetOrders = [];
      const panels = { left: [], right: [] };
      for (const [productId, snapshot] of entries) {
        const entity = entityOf(productId);
        if (!entity) continue;
        const { productType, category } = resolveProductIdentity(snapshot, entity, productId, registry);
        const meta = {
          productType,
          category,
          supportGroupId: read(snapshot, 'SupportGroupId') || 'group-1',
          entityName: entity.name,
          measure: { excludeNameFragments: excludeFor(productId, registry) }
        };
        if (category === 'countertops' && getCountertopRole(snapshot, productType) === 'basinTop') {
          bodies.push({ id: productId, entity, measureEntity: findNamedDescendant(entity, TOP_SOLID_NAME) ?? entity, tags: ['countertop'], meta });
        } else if (category === 'cabinets') {
          const orderIndex = Number(order[productId]);
          cabinetOrders.push(orderIndex);
          bodies.push({ id: productId, entity, tags: ['cabinet'], meta: { ...meta, orderIndex } });
        } else if (
          String(productType || '').endsWith('SidePanel_Left') ||
          String(productType || '').endsWith('SidePanel_Right')
        ) {
          const side = String(productType).endsWith('SidePanel_Left') ? 'left' : 'right';
          const tags = ['side-panel', `side-panel-${side}`];
          // A joint strip stays an obstacle but is not a snap target (see module.manipulable.mjs).
          if (read(snapshot, 'SidePanelFace') === 'joint') tags.push('side-panel-joint');
          const body = { id: productId, entity, tags, meta };
          const anchor = read(snapshot, 'SidePanelAnchorCabinetId');
          if (read(snapshot, 'SidePanelLayout') === 'group-edge' && Number.isFinite(Number(order[anchor]))) {
            // A grouped panel sits immediately outside its own edge cabinet in the reading order.
            body.meta.orderIndex = Number(order[anchor]) + (side === 'left' ? -0.5 : 0.5);
            body.meta.anchorCabinetId = anchor;
          }
          panels[side].push(body);
          bodies.push(body);
        }
      }
      // Legacy panels sit outside the composition. Grouped ULH panels already have an anchor-relative order.
      const finite = cabinetOrders.filter(Number.isInteger);
      const minOrder = finite.length ? Math.min(...finite) : 0;
      const maxOrder = finite.length ? Math.max(...finite) : -1;
      panels.left.filter(body => body.meta.orderIndex === undefined).sort((a, b) => a.id.localeCompare(b.id))
        .forEach((body, index, list) => { body.meta.orderIndex = minOrder - list.length + index; });
      panels.right.filter(body => body.meta.orderIndex === undefined).sort((a, b) => a.id.localeCompare(b.id))
        .forEach((body, index) => { body.meta.orderIndex = maxOrder + 1 + index; });
      return bodies;
    }
  });
}
