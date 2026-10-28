import { Script } from "playcanvas";

/**
 * MeshSubdivider — adaptive runtime mesh refinement for SSAO compatibility.
 *
 * PROBLEM:
 *   SSAO computes screen-space normals via dFdx/dFdy of view-space position.
 *   This gives FACE-normals, not the smooth vertex normals. On a mesh where
 *   triangles in one area are tiny (rim) and triangles in another are huge
 *   (basin interior), the SSAO sees the basin as a low-poly facet salad.
 *   Adjacent huge triangles have 10–20° normal discontinuities → visible
 *   stripes/bands along triangle edges, even though Blinn shading is smooth.
 *
 * SOLUTION:
 *   At load time, find triangles with area > maxArea and subdivide them
 *   recursively. Use red-green refinement (1→2, 1→3, 1→4 splits depending
 *   on how many edges of a triangle got midpoints) so neighbours don't
 *   develop T-junction cracks.
 *
 * USAGE:
 *   Attach this script to your sink/raise entity (or any entity with render
 *   components). It runs ONCE per mesh — even when the mesh is shared across
 *   multiple instances. Configure `maxArea` (m²) for your scale. For ~0.5 m
 *   bathroom sinks, 0.0001 m² (= 1 cm²) is the sweet spot.
 *
 *   If the sink variant changes at runtime (e.g. via EntityBuilder.changeVariant
 *   per RuleChangeSinkType / RuleChangeSidePanelVariant), call `subdivideNow()`
 *   on this script after the swap to re-process the new mesh.
 */
export class MeshSubdivider extends Script {
  static scriptName = "meshSubdivider";

  /** @attribute
   * @title Max Triangle Area (m²)
   * @description Triangles larger than this get split. 1e-4 = 1 cm². Lower = smoother SSAO but more polys.
   * @default 0.0001
   * */
  maxArea = 0.0001;

  /** @attribute
   * @title Max Iterations
   * @range [1, 8]
   * @default 6
   * */
  maxIterations = 6;

  /** @attribute
   * @title Run On Initialize
   * @type {boolean}
   * @default true
   * */
  runOnInit = true;

  /** @attribute
   * @title Verbose Logging
   * @type {boolean}
   * @default false
   * */
  verbose = false;

  initialize() {
    if (this.runOnInit) this._waitForMeshesThenProcess();
  }

  // Public — call after a variant swap if new meshes appear
  subdivideNow() {
    this._processEntity();
  }

  _waitForMeshesThenProcess() {
    if (this._meshesReady()) {
      this._processEntity();
      return;
    }
    // Wait for render-asset to load
    if (this.entity.render && this.entity.render.asset) {
      const asset = this.app.assets.get(this.entity.render.asset);
      if (asset && !asset.loaded) {
        asset.once("load", () => this._processEntity());
        return;
      }
    }
    // Wait for legacy model
    if (this.entity.model && !this.entity.model.model) {
      this.entity.model.on("model:loaded", () => this._processEntity(), this);
      return;
    }
    // No async path detected — try now
    this._processEntity();
  }

  _meshesReady() {
    const r = this.entity.findComponents("render");
    for (const c of r) if (c.meshInstances && c.meshInstances.length) return true;
    const m = this.entity.findComponents("model");
    for (const c of m) if (c.model && c.model.meshInstances) return true;
    return false;
  }

  _processEntity() {
    const renders = this.entity.findComponents("render");
    for (const rc of renders) {
      if (!rc.meshInstances) continue;
      for (const mi of rc.meshInstances) this._processMesh(mi.mesh);
    }
    const models = this.entity.findComponents("model");
    for (const mc of models) {
      if (!mc.model || !mc.model.meshInstances) continue;
      for (const mi of mc.model.meshInstances) this._processMesh(mi.mesh);
    }
  }

  _processMesh(mesh) {
    if (!mesh) return;
    // Shared mesh? Do it once.
    if (mesh._meshSubdividerDone) return;
    mesh._meshSubdividerDone = true;

    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    mesh.getPositions(positions);
    mesh.getNormals(normals);
    mesh.getUvs(0, uvs);
    mesh.getIndices(indices);

    if (!positions.length || !indices.length) return;
    const hasUv = uvs.length > 0;
    const startTris = indices.length / 3;

    let pos = positions.slice();
    let nrm = normals.slice();
    let uv = uvs.slice();
    let idx = indices.slice();

    for (let iter = 0; iter < this.maxIterations; iter++) {
      const r = this._pass(pos, nrm, uv, idx, hasUv);
      if (r.flagged === 0) break;
      pos = r.pos; nrm = r.nrm; uv = r.uv; idx = r.idx;
      if (this.verbose) {
        console.log(
          `[MeshSubdivider] iter ${iter + 1}: flagged ${r.flagged}, ` +
          `mesh now ${idx.length / 3} tris`
        );
      }
    }

    if (idx.length / 3 !== startTris) {
      mesh.setPositions(pos);
      mesh.setNormals(nrm);
      if (hasUv) mesh.setUvs(0, uv);
      mesh.setIndices(idx);
      mesh.update();
      if (this.verbose) {
        console.log(
          `[MeshSubdivider] Done: ${startTris} → ${idx.length / 3} tris, ` +
          `${pos.length / 3} verts`
        );
      }
    }
  }

  // Single adaptive pass — returns new arrays if anything was split
  _pass(positions, normals, uvs, indices, hasUv) {
    const numTris = indices.length / 3;
    const maxArea = this.maxArea;

    // 1. Flag oversized triangles by computed area
    const flag = new Uint8Array(numTris);
    let flagged = 0;
    for (let t = 0; t < numTris; t++) {
      const i0 = indices[t * 3], i1 = indices[t * 3 + 1], i2 = indices[t * 3 + 2];
      const ax = positions[i1 * 3]     - positions[i0 * 3];
      const ay = positions[i1 * 3 + 1] - positions[i0 * 3 + 1];
      const az = positions[i1 * 3 + 2] - positions[i0 * 3 + 2];
      const bx = positions[i2 * 3]     - positions[i0 * 3];
      const by = positions[i2 * 3 + 1] - positions[i0 * 3 + 1];
      const bz = positions[i2 * 3 + 2] - positions[i0 * 3 + 2];
      const cx = ay * bz - az * by;
      const cy = az * bx - ax * bz;
      const cz = ax * by - ay * bx;
      const area = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
      if (area > maxArea) {
        flag[t] = 1;
        flagged++;
      }
    }
    if (flagged === 0) {
      return { pos: positions, nrm: normals, uv: uvs, idx: indices, flagged: 0 };
    }

    const pos = positions.slice();
    const nrm = normals.slice();
    const uv = uvs.slice();
    let vCount = positions.length / 3;
    const midCache = new Map();

    // Multiplier large enough for any reasonable mesh; collision-free key
    const KEY_MULT = 10000000;
    const edgeKey = (a, b) => (a < b ? a * KEY_MULT + b : b * KEY_MULT + a);

    function getMid(a, b) {
      const k = edgeKey(a, b);
      const cached = midCache.get(k);
      if (cached !== undefined) return cached;
      const mid = vCount++;
      // position midpoint
      pos.push(
        (pos[a * 3]     + pos[b * 3])     * 0.5,
        (pos[a * 3 + 1] + pos[b * 3 + 1]) * 0.5,
        (pos[a * 3 + 2] + pos[b * 3 + 2]) * 0.5
      );
      // normal midpoint (re-normalised)
      const nx = (nrm[a * 3]     + nrm[b * 3])     * 0.5;
      const ny = (nrm[a * 3 + 1] + nrm[b * 3 + 1]) * 0.5;
      const nz = (nrm[a * 3 + 2] + nrm[b * 3 + 2]) * 0.5;
      const L = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (L > 1e-9) {
        const inv = 1 / L;
        nrm.push(nx * inv, ny * inv, nz * inv);
      } else {
        nrm.push(0, 1, 0);
      }
      // uv midpoint
      if (hasUv) {
        uv.push(
          (uv[a * 2]     + uv[b * 2])     * 0.5,
          (uv[a * 2 + 1] + uv[b * 2 + 1]) * 0.5
        );
      }
      midCache.set(k, mid);
      return mid;
    }

    // 2. Place midpoints on flagged triangles' edges
    for (let t = 0; t < numTris; t++) {
      if (!flag[t]) continue;
      const i0 = indices[t * 3], i1 = indices[t * 3 + 1], i2 = indices[t * 3 + 2];
      getMid(i0, i1); getMid(i1, i2); getMid(i2, i0);
    }

    // 3. Build new index buffer — adaptive split based on edge midpoints
    const newIdx = [];
    for (let t = 0; t < numTris; t++) {
      const i0 = indices[t * 3], i1 = indices[t * 3 + 1], i2 = indices[t * 3 + 2];
      const m01 = midCache.get(edgeKey(i0, i1));
      const m12 = midCache.get(edgeKey(i1, i2));
      const m20 = midCache.get(edgeKey(i2, i0));
      const h01 = m01 !== undefined;
      const h12 = m12 !== undefined;
      const h20 = m20 !== undefined;
      const cnt = (h01 ? 1 : 0) + (h12 ? 1 : 0) + (h20 ? 1 : 0);

      if (cnt === 0) {
        newIdx.push(i0, i1, i2);
      } else if (cnt === 3) {
        // RED split: 4 sub-triangles
        newIdx.push(i0,  m01, m20);
        newIdx.push(m01, i1,  m12);
        newIdx.push(m20, m12, i2);
        newIdx.push(m01, m12, m20);
      } else if (cnt === 1) {
        // GREEN split: 2 sub-triangles through the lone midpoint
        if (h01) {
          newIdx.push(i0,  m01, i2);
          newIdx.push(m01, i1,  i2);
        } else if (h12) {
          newIdx.push(i0,  i1,  m12);
          newIdx.push(i0,  m12, i2);
        } else {
          newIdx.push(i0,  i1,  m20);
          newIdx.push(m20, i1,  i2);
        }
      } else {
        // BLUE split: 3 sub-triangles
        if (!h01) {
          newIdx.push(i0,  i1,  m12);
          newIdx.push(i0,  m12, m20);
          newIdx.push(m20, m12, i2);
        } else if (!h12) {
          newIdx.push(i0,  m01, m20);
          newIdx.push(m01, i1,  i2);
          newIdx.push(m01, i2,  m20);
        } else {
          newIdx.push(i0,  m01, i2);
          newIdx.push(m01, m12, i2);
          newIdx.push(m01, i1,  m12);
        }
      }
    }

    return { pos, nrm, uv, idx: newIdx, flagged };
  }
}
