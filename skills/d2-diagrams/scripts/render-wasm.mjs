#!/usr/bin/env node
// render-wasm.mjs — WASM fallback renderer used by render.sh when the d2 CLI
// is not installed (e.g. sandboxes or corporate networks where d2lang.com,
// GitHub releases and the Go proxy are blocked but the npm registry is not).
//
// Uses @terrastruct/d2 (the official WASM build of the same d2 compiler) with
// the ELK or dagre layout engines. TALA is not available in WASM.
//
// Not meant to be called directly — render.sh parses and validates flags, then
// invokes: node render-wasm.mjs --module DIR [options] input.d2 output.svg
//
//   --module DIR        directory containing node_modules/@terrastruct/d2
//   --engine elk|dagre  layout engine (default: elk)
//   --theme N / --dark-theme N / --sketch / --pad N
//   --target PATH       render a single board
//   --no-xml-tag / --salt VALUE
//   --png FILE          also write a PNG preview (browser if found, else resvg)
//   --validate-only     compile and exit (prints file:line:col errors)
//
// Output lines: "board: NAME" per extra board rendered, "png-via: browser|resvg".
// Exit codes: 0 ok; 1 compile/render error; 4 PNG preview failed.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opts = { engine: 'elk', theme: 0, sketch: false, noXmlTag: false };
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const next = () => args[++i];
  switch (a) {
    case '--module': opts.module = next(); break;
    case '--engine': opts.engine = next(); break;
    case '--theme': opts.theme = Number(next()); break;
    case '--dark-theme': opts.darkTheme = Number(next()); break;
    case '--sketch': opts.sketch = true; break;
    case '--pad': opts.pad = Number(next()); break;
    case '--target': opts.target = next(); break;
    case '--no-xml-tag': opts.noXmlTag = true; break;
    case '--salt': opts.salt = next(); break;
    case '--png': opts.png = next(); break;
    case '--validate-only': opts.validateOnly = true; break;
    default: positional.push(a);
  }
}
const [input, output] = positional;
const fail = (msg, code = 1) => { process.stderr.write(`render-wasm: ${msg}\n`); process.exit(code); };
if (!opts.module || !input) fail('usage: render-wasm.mjs --module DIR [options] input.d2 [output.svg]', 2);
if (!['elk', 'dagre'].includes(opts.engine)) fail(`engine "${opts.engine}" is not available in the WASM build (use elk or dagre)`, 2);

const req = createRequire(path.join(path.resolve(opts.module), 'package.json'));
// Resolve the ESM entry explicitly: createRequire picks the "require" export,
// and @terrastruct/d2's CJS build does not load under its "type": "module".
const load = async (name) => {
  const pkgDir = path.join(path.resolve(opts.module), 'node_modules', ...name.split('/'));
  let entry;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    const dot = pkg.exports && (pkg.exports['.'] || pkg.exports);
    const imp = dot && dot.import;
    const rel = typeof imp === 'string' ? imp : imp && (imp.node || imp.default);
    if (typeof rel === 'string') entry = path.join(pkgDir, rel);
  } catch { /* fall back to require resolution */ }
  return import(pathToFileURL(entry || req.resolve(name)).href);
};

// --- collect the input and every local .d2 file it may @import ------------------
const inputAbs = path.resolve(input);
const baseDir = path.dirname(inputAbs);
const vfs = {};
const walk = (dir, depth) => {
  if (depth > 4) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, depth + 1);
    else if (e.name.endsWith('.d2') && Object.keys(vfs).length < 200) {
      vfs[path.relative(baseDir, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8');
    }
  }
};
walk(baseDir, 0);
const inputPath = path.basename(inputAbs);
vfs[inputPath] = fs.readFileSync(inputAbs, 'utf8');

// --- compile ---------------------------------------------------------------------
const { D2 } = await load('@terrastruct/d2');
const d2 = new D2();
let compiled;
try {
  compiled = await d2.compile({
    fs: vfs,
    inputPath,
    options: { layout: opts.engine, sketch: opts.sketch, themeID: opts.theme },
  });
} catch (e) {
  const raw = e && e.message ? e.message : String(e);
  let lines = [raw];
  try { lines = JSON.parse(raw).map((x) => x.errmsg || JSON.stringify(x)); } catch { /* plain text */ }
  fail(`compile failed:\n${lines.join('\n')}`);
}
if (opts.validateOnly) process.exit(0);

// --- render ----------------------------------------------------------------------
const renderOpts = (target) => {
  const o = { ...(compiled.renderOptions || {}) };
  o.themeID = opts.theme;
  o.sketch = opts.sketch;
  if (opts.darkTheme !== undefined) o.darkThemeID = opts.darkTheme; else delete o.darkThemeID;
  if (opts.pad !== undefined) o.pad = opts.pad;
  if (opts.salt !== undefined) o.salt = opts.salt;
  o.noXMLTag = opts.noXmlTag;
  o.scale = 1;
  if (target !== undefined) o.target = target;
  return o;
};

// Board paths for multi-board sources (layers/scenarios/steps), CLI-style.
const boards = [];
const collect = (diagram, prefix) => {
  for (const kind of ['layers', 'scenarios', 'steps']) {
    for (const b of diagram[kind] || []) {
      if (!b) continue;
      const p = `${prefix}${prefix ? '.' : ''}${kind}.${b.name}`;
      if (!b.isFolderOnly) boards.push(p);
      collect(b, p);
    }
  }
};
collect(compiled.diagram, '');

const outputs = []; // [svgPath, svgText]
try {
  if (opts.target !== undefined || boards.length === 0) {
    const svg = await d2.render(compiled.diagram, renderOpts(opts.target));
    outputs.push([output, svg]);
  } else {
    // Mirror the CLI: one SVG per board inside a directory named after the output.
    const dir = output.replace(/\.svg$/, '');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    outputs.push([path.join(dir, 'index.svg'), await d2.render(compiled.diagram, renderOpts(''))]);
    for (const b of boards) {
      const file = path.join(dir, `${b.split('.').filter((_, i) => i % 2 === 1).join('/')}.svg`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      outputs.push([file, await d2.render(compiled.diagram, renderOpts(b))]);
      process.stdout.write(`board: ${b}\n`);
    }
  }
} catch (e) {
  fail(`render failed: ${e && e.message ? e.message : e}`);
}
for (const [file, svg] of outputs) fs.writeFileSync(file, svg);

// --- optional PNG preview ------------------------------------------------------------
if (!opts.png) process.exit(0);

const findBrowser = () => {
  const env = process.env.D2_BROWSER_PATH || process.env.CHROME_PATH;
  if (env && fs.existsSync(env)) return env;
  const candidates = [];
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pw && fs.existsSync(pw)) {
    for (const d of fs.readdirSync(pw)) {
      if (!d.startsWith('chromium')) continue;
      candidates.push(path.join(pw, d), path.join(pw, d, 'chrome-linux', 'chrome'),
        path.join(pw, d, 'chrome-linux64', 'chrome'));
    }
  }
  candidates.push(
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable', '/usr/bin/microsoft-edge', '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  );
  for (const base of [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]) {
    if (!base) continue;
    candidates.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  }
  return candidates.find((c) => { try { return fs.statSync(c).isFile(); } catch { return false; } });
};

const pngTargets = outputs.map(([file, svg]) => [
  outputs.length === 1 ? opts.png : path.join(`${output.replace(/\.svg$/, '')}-preview`, path.relative(output.replace(/\.svg$/, ''), file).replace(/\.svg$/, '.png')),
  svg,
]);
for (const [f] of pngTargets) fs.mkdirSync(path.dirname(f), { recursive: true });

const viaBrowser = async (exe) => {
  const { chromium } = await load('playwright-core');
  const browser = await chromium.launch({ executablePath: exe });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1.5 });
    for (const [file, svg] of pngTargets) {
      await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff">${svg.replace(/<\?xml[^>]*>/, '')}</body></html>`);
      await (await page.$('svg')).screenshot({ path: file });
    }
  } finally { await browser.close(); }
};

const viaResvg = async () => {
  const { Resvg } = await load('@resvg/resvg-js');
  for (const [file, svg] of pngTargets) {
    const r = new Resvg(svg, { fitTo: { mode: 'zoom', value: 1.5 }, background: '#ffffff', font: { loadSystemFonts: true } });
    fs.writeFileSync(file, r.render().asPng());
  }
};

const exe = findBrowser();
try {
  if (exe) {
    await viaBrowser(exe);
    process.stdout.write('png-via: browser\n');
  } else {
    await viaResvg();
    process.stdout.write('png-via: resvg\n');
    process.stderr.write('render-wasm: no Chrome/Chromium/Edge found — PNG preview rendered with resvg, which ignores\n'
      + 'render-wasm: D2\'s embedded fonts: label widths are APPROXIMATE (text may appear to overlap edges).\n'
      + 'render-wasm: Judge layout from it, not text fit. Set D2_BROWSER_PATH to a Chromium-based browser for an exact preview.\n');
  }
} catch (e) {
  fail(`PNG preview failed: ${e && e.message ? e.message : e}`, 4);
}
process.exit(0);
