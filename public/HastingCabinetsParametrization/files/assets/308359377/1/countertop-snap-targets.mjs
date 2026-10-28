/**
 * What the composition offers the countertop to snap to (targets in the composition's world XY
 * frame, u = x, v = y), from the cabinets and side panels of the scene:
 *
 *   composition:left | centerX | right   the row's outer edges and centre
 *   <cabinet|side-panel>:<id>:left|right  element edges
 *   cabinet:<id>:centerX                 cabinet centres
 *   support:<id>:top                     cabinet tops (the countertop rests on them)
 *   endpoint:<id>:leftTop|rightTop       the support corners at the composition's exterior
 *   cover-endpoint:<id>:leftTop|rightTop the same corners at the cover top (+ host.coverThicknessM(), only when > 0)
 *   joint:<a>|<b>                        joints between neighbouring cabinets (by orderIndex)
 *
 * Cabinets offer edges, centre, top and endpoints; side panels their edges and endpoints.
 * Elements without an integer `meta.orderIndex` are left out.
 */
const EPSILON_M = 1e-9;

const axis = (a, valueM) => ({ kind: 'axis', axis: a, valueM });
const point = (u, v) => ({ kind: 'point', pointM: { u, v } });

/**
 * Feature extractor over every cabinet and side panel at once (`perBody = false`).
 * @returns {Array<object>} feature descriptors (key, featureId, ownerObjectId, role, geometry …)
 */
export function compositionSnapTargets(bodies, ctx) {
  const compositionId = ctx.scene.scopeId;
  const elements = bodies
    .map(body => {
      const kind = body.tags.includes('cabinet') ? 'cabinet' : 'side-panel';
      const { min, max } = body.boundsUV;
      return {
        id: body.id,
        kind,
        orderIndex: body.meta?.orderIndex,
        left: min.u,
        right: max.u,
        top: max.v
      };
    })
    .filter(element => Number.isInteger(element.orderIndex));
  if (!elements.length) return [];

  const left = Math.min(...elements.map(element => element.left));
  const right = Math.max(...elements.map(element => element.right));
  const coverM = Number(ctx.host?.coverThicknessM?.()) || 0;
  const targets = [];
  const add = (featureId, ownerObjectId, role, geometry, extra = {}) => targets.push({ key: featureId, featureId, ownerObjectId, role, geometry, ...extra });

  add('composition:left', compositionId, 'composition-edge-left', axis('u', left));
  add('composition:centerX', compositionId, 'composition-center', axis('u', (left + right) / 2));
  add('composition:right', compositionId, 'composition-edge-right', axis('u', right));

  for (const element of elements) {
    const { id, kind } = element;
    const support = { min: element.left, max: element.right };
    add(`${kind}:${id}:left`, id, `${kind}-edge`, axis('u', element.left));
    add(`${kind}:${id}:right`, id, `${kind}-edge`, axis('u', element.right));
    if (kind === 'cabinet') {
      add(`cabinet:${id}:centerX`, id, 'cabinet-center', axis('u', (element.left + element.right) / 2));
      add(`support:${id}:top`, id, 'support-top', axis('v', element.top), { supportIntervalUM: { ...support } });
    }
    if (Math.abs(support.min - left) <= EPSILON_M) {
      add(`endpoint:${id}:leftTop`, id, 'support-endpoint-left', point(support.min, element.top), { supportIntervalUM: { ...support } });
      if (kind === 'cabinet' && coverM > 0) add(`cover-endpoint:${id}:leftTop`, id, 'cover-endpoint-left', point(support.min, element.top + coverM));
    }
    if (Math.abs(support.max - right) <= EPSILON_M) {
      add(`endpoint:${id}:rightTop`, id, 'support-endpoint-right', point(support.max, element.top), { supportIntervalUM: { ...support } });
      if (kind === 'cabinet' && coverM > 0) add(`cover-endpoint:${id}:rightTop`, id, 'cover-endpoint-right', point(support.max, element.top + coverM));
    }
  }

  const row = elements
    .filter(element => element.kind === 'cabinet')
    .sort((a, b) => a.orderIndex - b.orderIndex);
  for (let index = 0; index < row.length - 1; index += 1) {
    const [a, b] = [row[index], row[index + 1]];
    if (Math.abs(a.right - b.left) <= EPSILON_M) {
      add(`joint:${a.id}|${b.id}`, compositionId, 'module-joint', axis('u', a.right), { partId: `${a.id}|${b.id}` });
    }
  }
  return targets;
}
compositionSnapTargets.perBody = false;
