#!/usr/bin/env node
// Minimal stdio MCP client: starts a browser MCP server exactly as registered for this repo in
// ~/.claude.json (local scope) and runs scenarios of real tool calls, saving evidence.
// Dependency-free; macOS, Linux and Windows (npx is wrapped in `cmd /c` on Windows).
//
//   node mcp-smoke.mjs --server <name> --list-tools
//   node mcp-smoke.mjs --server <name> --scenario <file.json> --out <evidence-dir>
//   node mcp-smoke.mjs --server <name> --serve <state.json>     keep ONE server/browser connection open
//   node mcp-smoke.mjs --via <state.json> --scenario <file.json> --out <dir>   run through that session
//   node mcp-smoke.mjs --via <state.json> --stop
//
// --serve exists because Chrome asks the user to allow every new DevTools connection: one approval per
// session instead of one per scenario. It listens on 127.0.0.1 only, on a random port, and requires the
// random token written (mode 0600) to the state file.
//
// Scenario: { "steps": [ { "tool": "take_snapshot", "args": {}, "save": "snap.txt",
//             "capture": { "pageId": "regex with (group)" }, "optional": false }, { "sleep": 5000 } ] }
// String args may reference earlier captures as ${name}; a whole-string numeric capture becomes a number.

import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const serverName = opt("--server");
const scenarioPath = opt("--scenario");
const outDir = opt("--out");
const servePath = opt("--serve");
const viaPath = opt("--via");
const timeoutMs = Number(opt("--timeout") ?? 180000);

function usage() {
  console.error("usage: mcp-smoke.mjs --server <name> (--list-tools | --scenario <f> --out <d> | --serve <state>) | --via <state> (--scenario <f> --out <d> | --stop)");
  process.exit(2);
}

// ---------- client side of a running session ----------
if (viaPath) {
  const state = JSON.parse(fs.readFileSync(viaPath, "utf8"));
  const payload = argv.includes("--stop")
    ? { op: "stop" }
    : { op: "run", scenario: JSON.parse(fs.readFileSync(scenarioPath, "utf8")), out: path.resolve(outDir) };
  const body = JSON.stringify(payload);
  const req = http.request(
    { host: "127.0.0.1", port: state.port, method: "POST", path: "/", headers: { "content-type": "application/json", "x-token": state.token, "content-length": Buffer.byteLength(body) } },
    (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const result = JSON.parse(data || "{}");
        for (const line of result.lines ?? []) console.log(line);
        if (result.error) console.error(`mcp-smoke: ${result.error}`);
        process.exit(result.failures || result.error ? 1 : 0);
      });
    },
  );
  req.on("error", (e) => {
    console.error(`mcp-smoke: session not reachable (${e.message}); start it with --serve`);
    process.exit(1);
  });
  req.end(body);
} else {
  if (!serverName) usage();
  startServerProcess();
}

// ---------- MCP server process ----------
function registeredServer(name) {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude.json"), "utf8"));
  const project = cfg.projects?.[root] ?? cfg.projects?.[root.replace(/\\/g, "/")];
  const server = project?.mcpServers?.[name] ?? cfg.mcpServers?.[name];
  if (!server) throw new Error(`MCP server "${name}" is not registered for ${root}`);
  return server;
}

function startServerProcess() {
  const server = registeredServer(serverName);
  let command = server.command;
  let args = server.args ?? [];
  if (process.platform === "win32" && ["npx", "npm", "node"].includes(command)) {
    args = ["/c", command, ...args];
    command = "cmd.exe";
  }
  const child = spawn(command, args, { env: { ...process.env, ...(server.env ?? {}) }, stdio: ["pipe", "pipe", "pipe"] });
  const stderrLines = [];
  child.stderr.on("data", (d) => stderrLines.push(String(d)));

  let nextId = 1;
  const pending = new Map();
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve, reject, timer } = pending.get(msg.id);
        clearTimeout(timer);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    }
  });

  const request = (method, params) => {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timeout after ${timeoutMs} ms: ${method}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
    });
  };
  const notify = (method, params) => child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);

  const fatal = (e) => {
    console.error(`mcp-smoke: ${e.message}`);
    const tail = stderrLines.join("").split("\n").filter(Boolean).slice(-8).join("\n");
    if (tail) console.error(`server stderr (tail):\n${tail}`);
    child.kill();
    process.exit(1);
  };

  (async () => {
    const init = await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "hastings-mcp-smoke", version: "1.1.0" } });
    notify("notifications/initialized", {});
    const info = `${init.serverInfo?.name ?? "?"} ${init.serverInfo?.version ?? "?"}`;
    const tools = (await request("tools/list", {})).tools ?? [];
    console.log(`server: ${info}; tools: ${tools.length}`);

    if (argv.includes("--list-tools")) {
      for (const t of tools) {
        const props = t.inputSchema?.properties ?? {};
        const required = new Set(t.inputSchema?.required ?? []);
        console.log(`  ${t.name}(${Object.keys(props).map((k) => (required.has(k) ? `${k}*` : k)).join(", ")})`);
      }
      child.kill();
      process.exit(0);
    }

    const ctx = { request, info, tools: tools.map((t) => t.name) };
    if (servePath) return serve(ctx, child);
    if (!scenarioPath || !outDir) usage();
    const { lines, failures } = await runScenario(ctx, JSON.parse(fs.readFileSync(scenarioPath, "utf8")), outDir);
    for (const l of lines) console.log(l);
    child.kill();
    process.exit(failures ? 1 : 0);
  })().catch(fatal);
}

function serve(ctx, child) {
  const token = randomBytes(24).toString("hex");
  let busy = false;
  const srv = http.createServer((req, res) => {
    if (req.method !== "POST" || req.headers["x-token"] !== token) {
      res.writeHead(403).end();
      return;
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      const msg = JSON.parse(body || "{}");
      if (msg.op === "stop") {
        res.end(JSON.stringify({ lines: ["session stopped"] }));
        child.kill();
        fs.rmSync(servePath, { force: true });
        process.exit(0);
      }
      if (busy) {
        res.end(JSON.stringify({ error: "session busy: one scenario at a time" }));
        return;
      }
      busy = true;
      try {
        const result = await runScenario(ctx, msg.scenario, msg.out);
        res.end(JSON.stringify(result));
      } catch (e) {
        res.end(JSON.stringify({ error: String(e.message) }));
      } finally {
        busy = false;
      }
    });
  });
  srv.listen(0, "127.0.0.1", () => {
    fs.writeFileSync(servePath, JSON.stringify({ port: srv.address().port, token, server: serverName, pid: process.pid }), { mode: 0o600 });
    console.log(`serving ${serverName} on 127.0.0.1:${srv.address().port}; state ${servePath}`);
  });
  child.on("exit", () => {
    fs.rmSync(servePath, { force: true });
    process.exit(1);
  });
}

function substitute(value, vars) {
  if (typeof value === "string") {
    const whole = value.match(/^\$\{(\w+)\}$/);
    if (whole && whole[1] in vars && /^-?\d+(\.\d+)?$/.test(vars[whole[1]])) return Number(vars[whole[1]]);
    return value.replace(/\$\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, vars));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, vars)]));
  return value;
}

async function runScenario({ request, info, tools }, scenario, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const vars = { ...(scenario.vars ?? {}) };
  const log = [];
  const lines = [];
  let failures = 0;
  for (const [index, step] of scenario.steps.entries()) {
    const n = String(index + 1).padStart(2);
    if (step.sleep) {
      await new Promise((r) => setTimeout(r, step.sleep));
      continue;
    }
    const started = Date.now();
    let status = "ok";
    let summary = "";
    try {
      const result = await request("tools/call", { name: step.tool, arguments: substitute(step.args ?? {}, vars) });
      const texts = [];
      for (const [k, c] of (result.content ?? []).entries()) {
        if (c.type === "text") texts.push(c.text);
        if (c.type === "image" && step.save) {
          const file = path.join(dir, step.save.replace(/(\.\w+)?$/, k ? `-${k}.png` : ".png"));
          fs.writeFileSync(file, Buffer.from(c.data, "base64"));
          summary += `image ${path.basename(file)}; `;
        }
      }
      const text = texts.join("\n");
      if (step.save) fs.writeFileSync(path.join(dir, step.save.replace(/\.png$/, ".txt")), text);
      for (const [k, re] of Object.entries(step.capture ?? {})) {
        const m = text.match(new RegExp(re));
        if (m) vars[k] = m[1];
      }
      if (result.isError) status = "tool-error";
      summary += text.replace(/\s+/g, " ").slice(0, 220);
    } catch (e) {
      status = "error";
      summary = String(e.message).slice(0, 300);
    }
    if (status !== "ok" && !step.optional) failures++;
    log.push({ step: index + 1, tool: step.tool, status, ms: Date.now() - started, summary });
    lines.push(`${n} ${step.tool.padEnd(24)} ${status.padEnd(10)} ${Date.now() - started}ms  ${summary}`);
    if (status !== "ok" && step.stopOnFail) break;
  }
  fs.writeFileSync(path.join(dir, "smoke-log.json"), JSON.stringify({ server: serverName ?? "session", serverInfo: info, tools, steps: log }, null, 2));
  return { lines, failures };
}
