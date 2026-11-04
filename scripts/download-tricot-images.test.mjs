import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../public/collections/tricot/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("sources/model-images.json", root), "utf8"));
const presets = JSON.parse(readFileSync(new URL("presets.json", root), "utf8"));

// Separate Node-only check: the application tsconfig intentionally excludes Node APIs.
test("41 original Tricot PNGs still match their exact public source hashes", () => {
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
});

test("the original404 model is published with a sourced client-viewer thumbnail", () => {
  assert.equal(presets.length, 42);
  assert.equal(manifest.localOverrides.length, 1);
  const image = manifest.localOverrides[0];
  assert.equal(image.sourceModel, manifest.missing[0].sourceModel);
  assert.equal(image.kind, "client-viewer-capture");
  assert.equal(new URL(image.sourceUrl).hostname, "www.hastingsbathcollection.com");
  const preset = presets.find((p) => p.sourceModel === image.sourceModel);
  assert.equal(preset.img, image.path);
  assert.equal(preset.availability, undefined);
  const bytes = readFileSync(new URL(image.path, root));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), image.sha256);
  assert.equal(bytes.readUInt32BE(16), 300);
  assert.equal(bytes.readUInt32BE(20), 300);
});
