/**
 * Snap guide geometry (engine-free): which lines/points to draw for the pairs a motion report
 * marks active and satisfied, in world space. Presentation only — never feeds back into motion.
 */
const pointOf = (frame, u, v) => ({
  x: frame.originM.x + frame.uAxis.x * u + frame.vAxis.x * v,
  y: frame.originM.y + frame.uAxis.y * u + frame.vAxis.y * v,
  z: frame.originM.z + frame.uAxis.z * u + frame.vAxis.z * v
});

const axisValue = (feature, axis) => {
  if (!feature) return null;
  if (feature.geometry.kind === 'axis') return feature.geometry.axis === axis ? feature.geometry.valueM : null;
  return feature.geometry.pointM[axis];
};

/**
 * @param {object} args
 * @param {object} args.report     motion report (`report.snap.results`, `report.applied.offsetM`)
 * @param {object} args.geometry   the compiled snap geometry the report was resolved against
 * @param {object} args.frame      MotionFrameV1
 * @returns {Array<{ kind: 'line'|'point', ruleId: string, pairId: string, startM: object, endM: object }>}
 */
export function computeSnapGuides({ report, geometry, frame }) {
  const snap = report?.snap;
  const applied = report?.applied?.offsetM;
  if (!geometry || snap?.status !== 'ready' || !applied) return [];
  const features = new Map([...geometry.sourceFeatures, ...geometry.targetFeatures].map(feature => [feature.featureId, feature]));
  const shift = { u: applied.u - geometry.referenceOffsetM.u, v: applied.v - geometry.referenceOffsetM.v };
  const moving = {
    min: { u: geometry.movingBoundsM.min.u + shift.u, v: geometry.movingBoundsM.min.v + shift.v },
    max: { u: geometry.movingBoundsM.max.u + shift.u, v: geometry.movingBoundsM.max.v + shift.v }
  };
  const guides = [];
  const seen = new Set();
  for (const pair of snap.results ?? []) {
    if (pair.selection !== 'active' || !pair.satisfiedAtAppliedPose) continue;
    const target = features.get(pair.target?.featureId);
    if (!target) continue;
    let guide = null;
    const axes = pair.controlledAxes ?? [];
    if (axes.length === 2) {
      const u = axisValue(target, 'u');
      const v = axisValue(target, 'v');
      if (u !== null && v !== null) guide = { kind: 'point', startM: pointOf(frame, u, v), endM: pointOf(frame, u, v) };
    } else if (axes[0] === 'u') {
      const u = axisValue(target, 'u');
      if (u !== null) guide = { kind: 'line', startM: pointOf(frame, u, moving.min.v), endM: pointOf(frame, u, moving.max.v) };
    } else if (axes[0] === 'v') {
      const v = axisValue(target, 'v');
      const span = target.supportIntervalUM;
      const min = span ? Math.min(span.min, moving.min.u) : moving.min.u;
      const max = span ? Math.max(span.max, moving.max.u) : moving.max.u;
      if (v !== null) guide = { kind: 'line', startM: pointOf(frame, min, v), endM: pointOf(frame, max, v) };
    }
    if (!guide) continue;
    const key = `${guide.kind}:${[guide.startM, guide.endM].map(p => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`).join(':')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    guides.push({ ...guide, ruleId: pair.ruleId, pairId: pair.pairId });
  }
  return guides;
}
