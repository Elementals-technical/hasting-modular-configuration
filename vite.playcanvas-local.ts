import fs from "node:fs";
import path from "node:path";
import { loadEnv, type Plugin } from "vite";

/**
 * Dev-only bridge: the UI's PlayCanvas iframe (`/HastingCabinetsParametrization/`) runs on LOCAL, uncommitted
 * PlayCanvas code instead of the minified build in `public/`.
 *
 * - The iframe is served from a NON-minified PlayCanvas web export (one file per script in `js/esm-scripts/`).
 * - Each script `js/esm-scripts/<path>` is taken from the PlayCanvas repo (`<src>/<path>`) when it exists there,
 *   otherwise from the export. The iframe stays same-origin, so `contentWindow.ConfiguratorAPI` works as usual.
 *
 * On only with `npm run dev:pc-local` (vite --mode pc-local) and both paths set in `.env.pc-local.local` (git-ignored):
 *   PC_LOCAL_EXPORT_DIR=/abs/path/Hasting-phase-2-stage-v72              (index.html, config.json, js/esm-scripts/…)
 *   PC_LOCAL_SRC_DIR=/abs/path/hasting-modular-playcanvas-flow-git/src  (Scripts/…)
 * `npm run dev` and the production build are not affected.
 *
 * Limits: scene, templates and assets come from the export (its build); a NEW script file is loaded only when an
 * existing script imports it (a new PlayCanvas script asset needs a fresh export).
 */
const BASE = "/HastingCabinetsParametrization/";
const SCRIPTS = `${BASE}js/esm-scripts/`;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

/** `root/relative` when it stays inside `root` and is a file; null otherwise. */
function fileInside(root: string, relative: string): string | null {
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  try {
    return fs.statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
}

function directory(value: string | undefined, name: string): string | null {
  if (!value) return null;
  const dir = path.resolve(value);
  if (!fs.existsSync(dir)) {
    console.warn(`[pc-local] ${name} does not exist: ${dir} — bridge off`);
    return null;
  }
  return dir;
}

export function playcanvasLocalBridge(): Plugin {
  let exportDir: string | null = null;
  let srcDir: string | null = null;
  return {
    name: "playcanvas-local-bridge",
    apply: "serve",
    config(_config, { mode }) {
      if (mode !== "pc-local") return;
      const env = { ...loadEnv(mode, process.cwd(), "PC_LOCAL_"), ...process.env };
      exportDir = directory(env.PC_LOCAL_EXPORT_DIR, "PC_LOCAL_EXPORT_DIR");
      srcDir = directory(env.PC_LOCAL_SRC_DIR, "PC_LOCAL_SRC_DIR");
      if (exportDir && srcDir) console.info(`[pc-local] iframe from ${exportDir}\n[pc-local] scripts from ${srcDir}`);
      else exportDir = srcDir = null;
    },
    configureServer(server) {
      const exportRoot = exportDir, srcRoot = srcDir;
      if (!exportRoot || !srcRoot) return;
      // Added directly (not returned): runs before Vite's own middlewares, so `public/` is never mixed in.
      server.middlewares.use((req, res, next) => {
        let pathname: string;
        try {
          pathname = decodeURIComponent(new URL(req.url ?? "", "http://local").pathname);
        } catch {
          return next();
        }
        if (!pathname.startsWith(BASE)) return next();
        const scriptFile = pathname.startsWith(SCRIPTS) ? fileInside(srcRoot, pathname.slice(SCRIPTS.length)) : null;
        const file = scriptFile ?? fileInside(exportRoot, pathname.slice(BASE.length) || "index.html");
        if (!file) {
          res.statusCode = 404;
          res.end(`[pc-local] not found: ${pathname}`);
          return;
        }
        res.setHeader("Content-Type", CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-PC-Local-Source", scriptFile ? "repo" : "export");
        fs.createReadStream(file).on("error", next).pipe(res);
      });
    },
  };
}
