#!/usr/bin/env node
// Orchestrator: runs every retailer module, writes data/retailers/<key>.json, then builds
// the merged search index (data/products.json + data/meta.json).
//
//   node scraper/index.js                 # scrape all retailers, then build
//   node scraper/index.js --only adreno   # one (or comma-separated) retailer(s)
//   node scraper/index.js --previous-url https://glennmcgui.re/dive-gear-search
//                                         # on failure, reuse that deployment's data for the retailer
//                                         # (only when there is no data/retailers/<key>.json locally)
//   node scraper/index.js --no-build      # skip the build step
//
// Exit code is 0 as long as at least one retailer in the run returned fresh data (status "ok");
// a retailer that fails or looks suspicious keeps its previous data ("stale") and meta.json
// records the error. It is 1 when *no* retailer is "ok" - every one stale or failed, which
// includes a single `--only <key>` retailer that is stale - because there is nothing new to
// publish, and on a hard error (bad arguments, unknown retailer key, build crash).

import { readdir, mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fetchJson } from './lib/http.js';
import { packRetailerFile, unpackRetailerFile, formatRetailerJson } from './lib/pack.js';
import { build } from './build.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const RETAILER_DIR = path.join(DATA_DIR, 'retailers');

// If a retailer returns fewer than this many products, or less than this fraction of the
// previous run, the run is treated as broken and the previous data is kept.
const MIN_PRODUCTS = 15;
const MIN_FRACTION_OF_PREVIOUS = 0.4;

function parseOnly(value) {
  const keys = (value || '').split(',').map((s) => s.trim()).filter(Boolean);
  // An empty list would scrape nothing, rebuild the index and exit 1 without a word
  // (`npm run scrape:one` with the key forgotten).
  if (!keys.length) throw new Error('--only needs a comma-separated list of retailer keys, e.g. --only adreno,divebondi (npm run scrape:one <key>)');
  return keys;
}

export function parseArgs(argv) {
  const args = { only: null, previousUrl: process.env.PREVIOUS_URL || '', build: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--only') args.only = parseOnly(argv[++i]);
    else if (a.startsWith('--only=')) args.only = parseOnly(a.slice(7));
    else if (a === '--previous-url') args.previousUrl = argv[++i] || '';
    else if (a.startsWith('--previous-url=')) args.previousUrl = a.slice(15);
    else if (a === '--no-build') args.build = false;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

export async function loadRetailers(only = null) {
  const dir = path.join(__dirname, 'retailers');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.js') && !f.startsWith('_')).sort();
  const mods = [];
  for (const f of files) {
    const mod = (await import(pathToFileURL(path.join(dir, f)).href)).default;
    if (!mod || !mod.key || typeof mod.fetch !== 'function') throw new Error(`retailers/${f} must default-export {key, name, homepage, fetch}`);
    if (mod.key !== f.replace(/\.js$/, '')) throw new Error(`retailers/${f}: key "${mod.key}" must match file name`);
    if (!only || only.includes(mod.key)) mods.push(mod);
  }
  if (only) for (const k of only) if (!mods.some((m) => m.key === k)) throw new Error(`Unknown retailer key: ${k}`);
  return mods;
}

async function readPrevious(key, { previousUrl, retailerDir, log }) {
  // 1. local file from a previous run, 2. the currently deployed site
  try {
    return unpackRetailerFile(JSON.parse(await readFile(path.join(retailerDir, `${key}.json`), 'utf8')));
  } catch {
    /* none */
  }
  if (previousUrl) {
    const url = `${previousUrl.replace(/\/$/, '')}/data/retailers/${key}.json`;
    try {
      return unpackRetailerFile(await fetchJson(url, { retries: 1 }));
    } catch (err) {
      // Not fatal (the very first deployment has nothing to fetch yet), but say so: silently
      // ignoring a wrong SITE_URL or an unpublished Pages site turns "stale" into "failed".
      log(`${key}: previous data not available from ${url}: ${err?.message || err}${err?.cause?.code ? ` (${err.cause.code})` : ''}`);
    }
  }
  return null;
}

function validateProducts(products, key) {
  if (!Array.isArray(products)) throw new Error('fetch() must return an array');
  const seen = new Set();
  const out = [];
  for (const p of products) {
    if (!p || typeof p !== 'object') continue;
    if (!p.id || !p.id.startsWith(`${key}:`)) throw new Error(`product id must start with "${key}:" (got ${p.id})`);
    if (seen.has(p.id)) continue; // duplicates are common when a product is in several collections
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

// `retailerDir` (where <key>.json is read from and written to) is a parameter so tests can use a
// temporary directory; the CLI always uses data/retailers.
export async function scrapeRetailer(mod, { previousUrl = '', log = () => {}, retailerDir = RETAILER_DIR } = {}) {
  const started = Date.now();
  const previous = await readPrevious(mod.key, { previousUrl, retailerDir, log });
  const info = { key: mod.key, name: mod.name, homepage: mod.homepage, platform: mod.platform || 'custom' };
  let result;
  try {
    const products = validateProducts(await mod.fetch({ log }), mod.key);
    const prevCount = previous?.count ?? 0;
    const few = products.length < MIN_PRODUCTS;
    // A shop whose last good run was itself under the floor is just small, not broken (otherwise
    // it would be "stale" on every run after its first); dropping below the floor from a proper
    // catalogue is suspicious even when it is less than a 60% drop (20 -> 14).
    const tooFew = few && prevCount >= MIN_PRODUCTS;
    const bigDrop = prevCount >= MIN_PRODUCTS && products.length < prevCount * MIN_FRACTION_OF_PREVIOUS;
    if ((tooFew || bigDrop) && previous?.products?.length) {
      const why = tooFew ? `only ${products.length} products` : `${products.length} products vs ${prevCount} previously`;
      log(`${mod.key}: suspicious result (${why}); keeping previous data`);
      result = { ...previous, retailer: info, status: 'stale', error: `suspicious result: ${why}`, staleSince: previous.staleSince || previous.fetchedAt };
    } else {
      result = { retailer: info, status: 'ok', fetchedAt: new Date().toISOString(), durationMs: Date.now() - started, count: products.length, error: null, products };
      if (few) result.error = `warning: only ${products.length} products`;
    }
  } catch (err) {
    const message = err && err.stack ? String(err.message || err) : String(err);
    log(`${mod.key}: FAILED: ${message}`);
    if (previous?.products?.length) {
      result = { ...previous, retailer: info, status: 'stale', error: message, staleSince: previous.staleSince || previous.fetchedAt };
    } else {
      result = { retailer: info, status: 'failed', fetchedAt: new Date().toISOString(), durationMs: Date.now() - started, count: 0, error: message, products: [] };
    }
  }
  await mkdir(retailerDir, { recursive: true });
  await writeFile(path.join(retailerDir, `${mod.key}.json`), formatRetailerJson(packRetailerFile(result)));
  log(`${mod.key}: ${result.status} (${result.count} products, ${((Date.now() - started) / 1000).toFixed(1)}s)${result.error ? ` - ${result.error}` : ''}`);
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
  const mods = await loadRetailers(args.only);
  log(`scraping ${mods.length} retailer(s): ${mods.map((m) => m.key).join(', ')}`);
  const results = await Promise.all(mods.map((m) => scrapeRetailer(m, { previousUrl: args.previousUrl, log })));
  const ok = results.filter((r) => r.status === 'ok').length;
  log(`done: ${ok}/${results.length} ok, ${results.filter((r) => r.status === 'stale').length} stale, ${results.filter((r) => r.status === 'failed').length} failed`);
  if (args.build) {
    const meta = await build({ log });
    log(`index built: ${meta.totals.products} products in ${meta.totals.groups} groups (${meta.totals.excluded} excluded)`);
  }
  if (ok === 0) {
    log('no retailer returned fresh data (every one stale or failed); exiting 1');
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
