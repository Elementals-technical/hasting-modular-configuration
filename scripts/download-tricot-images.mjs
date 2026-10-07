import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

// Downloads exact public 2D thumbnails. Never stores tokens or overwrites different files.
const root = fileURLToPath(new URL("../public/collections/tricot/", import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, "sources/model-images.json"), "utf8"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const model of manifest.models) {
  if (!/^images\/model-\d+\.png$/.test(model.path) || !/^[a-f0-9]{64}$/.test(model.sha256))
    throw new Error("Invalid image manifest");
  const url = new URL(model.url);
  if (
    url.origin !== "https://admin-fts.threekit.com" ||
    url.pathname !== `/api/files/hash/sha256-${model.sha256}` ||
    url.search
  )
    throw new Error("Unexpected image source");
  const target = resolve(root, model.path);
  try {
    const existing = await readFile(target);
    if (digest(existing) !== model.sha256) throw new Error(`Existing image differs: ${model.path}`);
    continue;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png"))
    throw new Error(`Image unavailable: ${model.sourceModel}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || digest(bytes) !== model.sha256)
    throw new Error(`Image integrity failed: ${model.sourceModel}`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
}
console.log(
  `Verified ${manifest.models.length} Tricot model images; ${manifest.missing.length} source images remain unavailable.`,
);
