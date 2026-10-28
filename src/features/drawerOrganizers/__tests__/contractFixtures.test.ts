import { describe, expect, it, vi } from "vitest";

/**
 * The UI copy of the shared drawer-organizer fixtures is byte-for-byte the 3D canon
 * (hasting-modular-playcanvas-flow-git/src/tests/node/fixtures/drawer-organizers/). Never edit the copy:
 * a change goes to the canon first (new fixtureRevision + manifest), then the 8 files are copied here.
 */

// The same constant lives in the 3D test (drawer-organizers-fixtures.test.mjs); both move with the fixtures.
const EXPECTED_FIXTURE_REVISION = 2;

// Vitest runs this in Node; keep Node-only types out of the app's DOM tsconfig (as in configuratorApi/__tests__/bridge.test.ts).
const { createHash } = await vi.importActual<{
  createHash(algorithm: string): { update(data: Uint8Array): { digest(encoding: "hex"): string } };
}>("node:crypto");
const { readdirSync, readFileSync } = await vi.importActual<{
  readdirSync(path: URL): string[];
  readFileSync(path: URL): Uint8Array;
}>("node:fs");

const FIXTURES_URL = new URL("./fixtures/contract/", import.meta.url);
const bytesOf = (name: string) => readFileSync(new URL(name, FIXTURES_URL));
const jsonOf = (name: string): unknown => JSON.parse(new TextDecoder().decode(bytesOf(name)));

type Manifest = { fixtureRevision: number; files: Record<string, string> };
const manifest = jsonOf("manifest.json") as Manifest;

describe("drawer-organizer contract fixtures (UI copy)", () => {
  it("holds exactly the manifest files plus the manifest", () => {
    const expected = [...Object.keys(manifest.files), "manifest.json"].sort();

    expect(readdirSync(FIXTURES_URL).sort()).toEqual(expected);
  });

  it("matches the sha256 of the 3D canon for every file", () => {
    for (const [name, hash] of Object.entries(manifest.files)) {
      expect(createHash("sha256").update(bytesOf(name)).digest("hex"), name).toBe(hash);
    }
  });

  it("is the fixture revision this build expects", () => {
    expect(manifest.fixtureRevision).toBe(EXPECTED_FIXTURE_REVISION);
    const fixtures = Object.keys(manifest.files).filter((name) => !name.endsWith(".schema.json"));
    for (const name of fixtures) {
      expect((jsonOf(name) as { fixtureRevision: number }).fixtureRevision, name).toBe(EXPECTED_FIXTURE_REVISION);
    }
  });
});
