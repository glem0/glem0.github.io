// Orchestrator safety logic (scraper/index.js): the ok / stale / failed / suspicious branches of
// scrapeRetailer(), the local-file-then---previous-url fallback, and the CLI's argument checks.
// Uses fake retailer modules and a temporary directory; the only network is a local HTTP server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrapeRetailer, parseArgs } from '../index.js';

const INDEX_JS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.js');

const products = (n, key = 'zzztest') => Array.from({ length: n }, (_, i) => ({ id: `${key}:${i + 1}`, title: `Item ${i + 1}`, price: 10 + i }));

function mod(fetch, key = 'zzztest') {
  return { key, name: 'Test Shop', homepage: 'https://example.invalid/', platform: 'custom', fetch };
}

async function withDir(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dive-gear-index-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Previous run's file as index.js writes it.
function previousRecord(n, over = {}) {
  return {
    retailer: { key: 'zzztest', name: 'Test Shop', homepage: 'https://example.invalid/', platform: 'custom' },
    status: 'ok',
    fetchedAt: '2026-09-01T00:00:00.000Z',
    durationMs: 1,
    count: n,
    error: null,
    products: products(n),
    ...over,
  };
}

async function run(m, dir, extra = {}) {
  const lines = [];
  const result = await scrapeRetailer(m, { retailerDir: dir, log: (s) => lines.push(s), ...extra });
  const written = JSON.parse(await readFile(path.join(dir, `${m.key}.json`), 'utf8'));
  return { result, written, lines };
}

test('ok: fresh products are written with status ok and no error', async () => {
  await withDir(async (dir) => {
    const { result, written, lines } = await run(mod(async () => products(20)), dir);
    assert.equal(result.status, 'ok');
    assert.equal(result.count, 20);
    assert.equal(result.error, null);
    assert.equal(result.products.length, 20);
    assert.ok(result.fetchedAt && !Number.isNaN(Date.parse(result.fetchedAt)));
    assert.deepEqual(written.retailer, { key: 'zzztest', name: 'Test Shop', homepage: 'https://example.invalid/', platform: 'custom' });
    assert.equal(written.status, 'ok');
    assert.match(lines.at(-1), /^zzztest: ok \(20 products, \d+\.\ds\)$/);
  });
});

test('validateProducts: duplicates are dropped, a foreign id fails the retailer', async () => {
  await withDir(async (dir) => {
    const dup = [...products(20), ...products(5)];
    const { result } = await run(mod(async () => dup), dir);
    assert.equal(result.count, 20);
    const bad = await run(mod(async () => [{ id: 'other:1' }]), dir + '-bad');
    assert.equal(bad.result.status, 'failed');
    assert.match(bad.result.error, /product id must start with "zzztest:"/);
  });
});

test('failed: a throw with no previous data at all', async () => {
  await withDir(async (dir) => {
    const { result, lines } = await run(mod(async () => { throw new Error('fetch failed'); }), dir);
    assert.equal(result.status, 'failed');
    assert.equal(result.count, 0);
    assert.deepEqual(result.products, []);
    assert.equal(result.error, 'fetch failed');
    assert.equal(result.staleSince, undefined);
    assert.ok(lines.some((l) => l === 'zzztest: FAILED: fetch failed'));
    assert.match(lines.at(-1), /^zzztest: failed \(0 products, .*\) - fetch failed$/);
  });
});

test('stale: a throw keeps the local previous file, staleSince = last good fetch and survives a second failure', async () => {
  await withDir(async (dir) => {
    await writeFile(path.join(dir, 'zzztest.json'), JSON.stringify(previousRecord(100)));
    const broken = mod(async () => { throw new Error('HTTP 503 for https://example.invalid/products.json'); });
    const first = await run(broken, dir);
    assert.equal(first.result.status, 'stale');
    assert.equal(first.result.count, 100);
    assert.equal(first.result.products.length, 100);
    assert.equal(first.result.fetchedAt, '2026-09-01T00:00:00.000Z');
    assert.equal(first.result.staleSince, '2026-09-01T00:00:00.000Z');
    assert.match(first.result.error, /HTTP 503/);
    assert.equal(first.written.status, 'stale');
    // next run: the previous file is now the stale record; staleSince must not move
    const second = await run(mod(async () => { throw new Error('still down'); }), dir);
    assert.equal(second.result.status, 'stale');
    assert.equal(second.result.staleSince, '2026-09-01T00:00:00.000Z');
    assert.equal(second.result.error, 'still down');
    assert.equal(second.result.count, 100);
    // and a good run afterwards clears it
    const third = await run(mod(async () => products(90)), dir);
    assert.equal(third.result.status, 'ok');
    assert.equal(third.result.staleSince, undefined);
    assert.equal(third.result.count, 90);
  });
});

test('suspicious: under 40% of the previous count keeps the previous data', async () => {
  await withDir(async (dir) => {
    await writeFile(path.join(dir, 'zzztest.json'), JSON.stringify(previousRecord(100)));
    const { result, lines } = await run(mod(async () => products(20)), dir);
    assert.equal(result.status, 'stale');
    assert.equal(result.count, 100);
    assert.equal(result.error, 'suspicious result: 20 products vs 100 previously');
    assert.equal(result.staleSince, '2026-09-01T00:00:00.000Z');
    assert.ok(lines.includes('zzztest: suspicious result (20 products vs 100 previously); keeping previous data'));
  });
});

test('not suspicious: 45 after 100 is a normal fluctuation', async () => {
  await withDir(async (dir) => {
    await writeFile(path.join(dir, 'zzztest.json'), JSON.stringify(previousRecord(100)));
    const { result } = await run(mod(async () => products(45)), dir);
    assert.equal(result.status, 'ok');
    assert.equal(result.count, 45);
    assert.equal(result.error, null);
  });
});

test('suspicious: fewer than 15 after a proper catalogue, even when it is not a 60% drop', async () => {
  await withDir(async (dir) => {
    await writeFile(path.join(dir, 'zzztest.json'), JSON.stringify(previousRecord(100)));
    const big = await run(mod(async () => products(5)), dir);
    assert.equal(big.result.status, 'stale');
    assert.equal(big.result.error, 'suspicious result: only 5 products');
    assert.equal(big.result.count, 100);
  });
  await withDir(async (dir) => {
    await writeFile(path.join(dir, 'zzztest.json'), JSON.stringify(previousRecord(20)));
    const small = await run(mod(async () => products(14)), dir);
    assert.equal(small.result.status, 'stale');
    assert.equal(small.result.error, 'suspicious result: only 14 products');
    assert.equal(small.result.count, 20);
  });
});

test('small catalogue: fewer than 15 with no previous data is ok with a warning', async () => {
  await withDir(async (dir) => {
    const { result, written } = await run(mod(async () => products(5)), dir);
    assert.equal(result.status, 'ok');
    assert.equal(result.count, 5);
    assert.equal(result.error, 'warning: only 5 products');
    assert.equal(written.products.length, 5);
  });
});

test('small catalogue: a shop that was already under 15 stays ok on later runs (not stale forever)', async () => {
  await withDir(async (dir) => {
    const first = await run(mod(async () => products(5)), dir);
    assert.equal(first.result.status, 'ok');
    const second = await run(mod(async () => products(5)), dir);
    assert.equal(second.result.status, 'ok');
    assert.equal(second.result.count, 5);
    assert.equal(second.result.error, 'warning: only 5 products');
    assert.equal(second.result.staleSince, undefined);
    // 14 -> 14 likewise, and growing past the floor drops the warning
    await writeFile(path.join(dir, 'zzztest.json'), JSON.stringify(previousRecord(14)));
    const third = await run(mod(async () => products(14)), dir);
    assert.equal(third.result.status, 'ok');
    assert.equal(third.result.error, 'warning: only 14 products');
    const fourth = await run(mod(async () => products(30)), dir);
    assert.equal(fourth.result.status, 'ok');
    assert.equal(fourth.result.error, null);
    // ...but a small shop that throws still keeps its (small) previous data as stale
    const fifth = await run(mod(async () => { throw new Error('down'); }), dir);
    assert.equal(fifth.result.status, 'stale');
    assert.equal(fifth.result.count, 30);
  });
});

test('--previous-url: with no local file the deployed data is fetched and kept as stale; a 404 is logged', async () => {
  const served = previousRecord(60, { fetchedAt: '2026-08-15T00:00:00.000Z' });
  const server = createServer((req, res) => {
    if (req.url === '/data/retailers/zzztest.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(served));
    } else {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await withDir(async (dir) => {
      const broken = mod(async () => { throw new Error('fetch failed'); });
      const { result, written, lines } = await run(broken, dir, { previousUrl: `${base}/` });
      assert.equal(result.status, 'stale');
      assert.equal(result.count, 60);
      assert.equal(result.products.length, 60);
      assert.equal(result.staleSince, '2026-08-15T00:00:00.000Z');
      assert.equal(result.error, 'fetch failed');
      assert.equal(written.status, 'stale');
      assert.ok(!lines.some((l) => l.includes('previous data not available')), lines.join('\n'));
    });
    await withDir(async (dir) => {
      // wrong site: the fallback itself fails -> "failed", and the log says why
      const broken = mod(async () => { throw new Error('fetch failed'); });
      const { result, lines } = await run(broken, dir, { previousUrl: `${base}/wrong-path` });
      assert.equal(result.status, 'failed');
      assert.equal(result.count, 0);
      const note = lines.find((l) => l.startsWith('zzztest: previous data not available from '));
      assert.ok(note, lines.join('\n'));
      assert.ok(note.includes(`${base}/wrong-path/data/retailers/zzztest.json`), note);
      assert.match(note, /HTTP 404/);
    });
    await withDir(async (dir) => {
      // a local file wins over the URL
      await writeFile(path.join(dir, 'zzztest.json'), JSON.stringify(previousRecord(100)));
      const broken = mod(async () => { throw new Error('fetch failed'); });
      const { result, lines } = await run(broken, dir, { previousUrl: `${base}/wrong-path` });
      assert.equal(result.status, 'stale');
      assert.equal(result.count, 100);
      assert.ok(!lines.some((l) => l.includes('previous data not available')));
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('parseArgs: --only needs at least one key; other flags parse', () => {
  assert.deepEqual(parseArgs(['--only', 'adreno, divebondi']).only, ['adreno', 'divebondi']);
  assert.deepEqual(parseArgs(['--only=tecdivegear']).only, ['tecdivegear']);
  assert.equal(parseArgs([]).only, null);
  assert.equal(parseArgs(['--no-build']).build, false);
  assert.equal(parseArgs(['--previous-url', 'https://x.example/']).previousUrl, 'https://x.example/');
  assert.equal(parseArgs(['--previous-url=https://y.example']).previousUrl, 'https://y.example');
  assert.throws(() => parseArgs(['--only']), /--only needs a comma-separated list of retailer keys/);
  assert.throws(() => parseArgs(['--only', '']), /--only needs/);
  assert.throws(() => parseArgs(['--only=']), /--only needs/);
  assert.throws(() => parseArgs(['--only', ' , ']), /--only needs/);
  assert.throws(() => parseArgs(['--bogus']), /Unknown argument: --bogus/);
});

test('CLI: `--only` without a key exits 1 with an explanation (npm run scrape:one with the key forgotten)', () => {
  const r = spawnSync(process.execPath, [INDEX_JS, '--only'], { encoding: 'utf8', timeout: 20_000 });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--only needs a comma-separated list of retailer keys/);
  assert.doesNotMatch(r.stdout, /scraping 0 retailer/);
  const bad = spawnSync(process.execPath, [INDEX_JS, '--nope'], { encoding: 'utf8', timeout: 20_000 });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Unknown argument: --nope/);
});
