/**
 * Hasting collision proxy profiles: which proxy strategy (core/collision/proxies.mjs) derives the
 * collision volumes of each Hasting product, keyed by product type / template / entity name.
 * Product data, shared by every manipulable in a composition (countertop, modules …).
 * A product with no verified profile is `unsupported` — never a whole-body fallback.
 */
export const HASTING_COLLISION_PROFILE_VERSION = 1;

export const HASTING_COLLISION_PROFILE_DIAGNOSTIC = Object.freeze({
  PROFILE_NOT_FOUND: 'HASTING_COLLISION_PROFILE_NOT_FOUND',
  PROFILE_VERSION_UNSUPPORTED: 'HASTING_COLLISION_PROFILE_VERSION_UNSUPPORTED',
  GEOMETRY_UNSUPPORTED: 'HASTING_COLLISION_GEOMETRY_UNSUPPORTED'
});

const freezeDeep = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) freezeDeep(value[key]);
  return Object.freeze(value);
};

const profile = (definition) => freezeDeep({
  version: HASTING_COLLISION_PROFILE_VERSION,
  supported: true,
  ...definition
});

/**
 * UF side panel parts are named UF_SidePanel_{Panel,Inlay}_{Bot,Full,Top}. Cardinality is checked per
 * exact suffix (each part exists once); at least one active member is still required by the union.
 * Example: Bot+Top panels with both inlays (height 88) -> 4 members, one box.
 */
const UF_SIDE_PANEL_PROXY_STRATEGY = {
  type: 'active-member-union',
  semanticRole: 'side-panel',
  includeNameSuffixes: ['_Panel_Bot', '_Panel_Full', '_Panel_Top', '_Inlay_Bot', '_Inlay_Top'],
  excludeNameFragments: ['_Overlay'],
  cardinality: {
    _Panel_Bot: [0, 1],
    _Panel_Full: [0, 1],
    _Panel_Top: [0, 1],
    _Inlay_Bot: [0, 1],
    _Inlay_Top: [0, 1]
  }
};

const PROFILES = freezeDeep({
  topSolid: profile({
    id: 'top-solid/v1',
    kind: 'moving-volume',
    productTypes: [],
    templateNames: ['Top_Solid'],
    entityNames: ['TopSolid'],
    proxyStrategy: {
      type: 'single-box',
      exactEntityName: 'TopSolid',
      semanticRole: 'countertop-moving-volume'
    }
  }),
  cabinetUniBody: profile({
    id: 'cabinet-uni-body/v1',
    kind: 'obstacle',
    productTypes: ['CabinetUniBox', 'Sink-Base', 'Sink-Cabinet'],
    templateNames: ['CabinetUniBox'],
    entityNames: ['CabinetUniBody'],
    proxyStrategy: {
      type: 'opposed-boundary-slabs',
      exactEntityName: 'CabinetUniBody',
      boundaryAxis: 'x',
      semanticOrder: ['cabinet-side-left', 'cabinet-side-right'],
      topology: {
        componentCount: 2,
        shellTriangleCount: 52,
        secondaryTriangleCount: 12,
        shellUniqueVertexCount: 30,
        secondaryUniqueVertexCount: 8,
        minimumInteriorGapRatio: 0.5,
        maximumBoundaryThicknessRatio: 0.15
      }
    }
  }),
  uniOpenShelves: profile({
    id: 'uni-open-shelves/v1',
    kind: 'obstacle',
    productTypes: ['UniOpenShelves', 'Open-Shelf'],
    templateNames: ['UniOpenShelves'],
    entityNames: ['OpenShelvesSideWalls'],
    proxyStrategy: {
      type: 'component-boxes',
      exactEntityName: 'OpenShelvesSideWalls',
      componentCount: 2,
      boundaryAxis: 'x',
      semanticOrder: ['cabinet-side-left', 'cabinet-side-right']
    }
  }),
  sidePanelLeft: profile({
    id: 'side-panel-left/v1',
    kind: 'obstacle',
    productTypes: ['SidePanel_Left', 'ULH-SidePanel_Left', 'Tricot-SidePanel_Left'],
    templateNames: [],
    entityNames: [],
    proxyStrategy: {
      type: 'active-member-union',
      semanticRole: 'side-panel',
      includeNameSuffixes: ['_Panel', '_Inlay'],
      excludeNameFragments: ['_Overlay'],
      cardinality: { _Panel: [1, 1], _Inlay: [0, 1] }
    }
  }),
  sidePanelRight: profile({
    id: 'side-panel-right/v1',
    kind: 'obstacle',
    productTypes: ['SidePanel_Right', 'ULH-SidePanel_Right', 'Tricot-SidePanel_Right'],
    templateNames: [],
    entityNames: [],
    proxyStrategy: {
      type: 'active-member-union',
      semanticRole: 'side-panel',
      includeNameSuffixes: ['_Panel', '_Inlay'],
      excludeNameFragments: ['_Overlay'],
      cardinality: { _Panel: [1, 1], _Inlay: [0, 1] }
    }
  }),
  ufSidePanelLeft: profile({
    id: 'uf-side-panel-left/v1',
    kind: 'obstacle',
    productTypes: ['UF-SidePanel_Left'],
    templateNames: [],
    entityNames: [],
    proxyStrategy: UF_SIDE_PANEL_PROXY_STRATEGY
  }),
  ufSidePanelRight: profile({
    id: 'uf-side-panel-right/v1',
    kind: 'obstacle',
    productTypes: ['UF-SidePanel_Right'],
    templateNames: [],
    entityNames: [],
    proxyStrategy: UF_SIDE_PANEL_PROXY_STRATEGY
  })
});

const UNSUPPORTED_OPEN_SIDE_SHELVES = freezeDeep({
  version: HASTING_COLLISION_PROFILE_VERSION,
  supported: false,
  id: 'uni-open-side-shelves/unsupported-v1',
  kind: 'obstacle',
  productTypes: ['UniOpenSideShelves', 'Side-Shelf'],
  templateNames: ['UniOpenSideShelves'],
  entityNames: ['OpenSideShelvesSideWall'],
  diagnostic: {
    code: HASTING_COLLISION_PROFILE_DIAGNOSTIC.GEOMETRY_UNSUPPORTED,
    reason: 'The archived OpenSideShelvesSideWall is one broad connected shape; a cabinet side-wall slab has not been proven.'
  }
});

export const HASTING_COLLISION_PROFILES = PROFILES;

/**
 * Role vocabulary derived from the registry (spatial-manipulation V1, T12): the one moving
 * volume role and the exact obstacle roles the countertop collision profile may publish as
 * target volumes (`data-model.md` §6, spec AC-12). Consumers import these instead of
 * repeating the literals.
 */
export const HASTING_COUNTERTOP_VOLUME_ROLE = PROFILES.topSolid.proxyStrategy.semanticRole;

export const HASTING_OBSTACLE_ROLES = Object.freeze([...new Set(
  Object.values(PROFILES)
    .filter(candidate => candidate.kind === 'obstacle')
    .flatMap(candidate => candidate.proxyStrategy.semanticOrder ?? [candidate.proxyStrategy.semanticRole])
)]);

const asRequest = (input) => typeof input === 'string' ? { productType: input } : (input || {});
const includes = (values, value) => typeof value === 'string' && values.includes(value);

const matches = (candidate, request) =>
  includes(candidate.productTypes, request.productType) ||
  includes(candidate.templateNames, request.templateName) ||
  includes(candidate.entityNames, request.entityName);

/**
 * Resolve the immutable project-specific semantic profile for a normalized live
 * product/mesh descriptor. `role: "countertop"` is an explicit request for the
 * one TopSolid moving volume; it does not make sibling cutters or sinks members.
 */
export function resolveHastingCollisionProfile(input = {}) {
  const request = asRequest(input);
  const requestedVersion = request.profileVersion ?? HASTING_COLLISION_PROFILE_VERSION;

  if (requestedVersion !== HASTING_COLLISION_PROFILE_VERSION) {
    return freezeDeep({
      status: 'unsupported',
      profile: null,
      diagnostic: {
        code: HASTING_COLLISION_PROFILE_DIAGNOSTIC.PROFILE_VERSION_UNSUPPORTED,
        requestedVersion,
        supportedVersion: HASTING_COLLISION_PROFILE_VERSION
      }
    });
  }

  if (request.role === 'countertop' || request.role === 'moving-volume') {
    return freezeDeep({ status: 'supported', profile: PROFILES.topSolid, diagnostic: null });
  }

  if (matches(UNSUPPORTED_OPEN_SIDE_SHELVES, request)) {
    return freezeDeep({
      status: 'unsupported',
      profile: UNSUPPORTED_OPEN_SIDE_SHELVES,
      diagnostic: UNSUPPORTED_OPEN_SIDE_SHELVES.diagnostic
    });
  }

  for (const candidate of Object.values(PROFILES)) {
    if (matches(candidate, request)) {
      return freezeDeep({ status: 'supported', profile: candidate, diagnostic: null });
    }
  }

  return freezeDeep({
    status: 'unsupported',
    profile: null,
    diagnostic: {
      code: HASTING_COLLISION_PROFILE_DIAGNOSTIC.PROFILE_NOT_FOUND,
      productType: request.productType ?? null,
      templateName: request.templateName ?? null,
      entityName: request.entityName ?? null
    }
  });
}

/**
 * `volumes` resolver for manipulable specs: the supported profile of a scene body (its
 * `meta.productType` / `templateName` / `entityName`), an `{ supported: false }` marker for a
 * known-unsupported product, or null for a body without collision geometry.
 */
export function hastingCollisionProfileFor(body) {
  const meta = body?.meta ?? {};
  const resolution = resolveHastingCollisionProfile({
    productType: meta.productType,
    templateName: meta.templateName,
    entityName: meta.entityName ?? body?.entity?.name,
    profileVersion: meta.profileVersion
  });
  if (resolution.status === 'supported') return resolution.profile;
  return { supported: false, id: resolution.profile?.id ?? 'unknown', diagnostic: resolution.diagnostic };
}
