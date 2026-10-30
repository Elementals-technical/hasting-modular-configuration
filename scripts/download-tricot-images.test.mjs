import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../public/collections/tricot/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("sources/model-images.json", root), "utf8"));
const presets = JSON.parse(readFileSync(new URL("presets.json", root), "utf8"));

// Separate Node-only check: the application tsconfig intentionally excludes Node APIs.
test("41 exact Tricot PNGs match source hashes; the source 404 has no substitute", () => {
  assert.equal(manifest.models.length, 41);
  for (const model of manifest.models) {
    assert.match(model.path, /^images\/model-\d+\.png$/);
    assert.equal(model.url, `https://admin-fts.threekit.com/api/files/hash/sha256-${model.sha256}`);
    assert.equal(presets.find((p) => p.sourceModel === model.sourceModel)?.img, model.path);
    const bytes = readFileSync(new URL(model.path, root));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), model.sha256);
  }
  assert.deepEqual(
    manifest.missing.map((m) => m.sourceModel),
    ["Tricot 79 2DW 1_70"],
  );
  const missing = presets.find((p) => p.sourceModel === manifest.missing[0].sourceModel);
  assert.equal(missing.img, "");
  assert.equal(missing.availability.status, "pending-image");
});
