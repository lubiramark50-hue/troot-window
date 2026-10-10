#!/usr/bin/env node
/**
 * Checks every configured job source is still live and returning listings.
 *
 * An approved employer is removed from the board the moment its feed breaks, so
 * this runs before each sync and in CI. Exit code 1 means at least one source is
 * broken — the sync then refuses to touch that source's rows.
 *
 *   node scripts/verify-sources.mjs            # all sources
 *   node scripts/verify-sources.mjs --only=remotive
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ATS, FEEDS } from './job-sources.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2).find((a) => a.startsWith('--only='))?.split('=')[1];

// An approved employer with an empty board is treated as broken: either the
// token changed or the company stopped publishing, and either way we should know.
const MIN_LISTINGS = 1;

async function check(label, url, parse, min = MIN_LISTINGS) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30_000);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { 'user-agent': 'TrootWindow-source-check/1.0', accept: 'application/json' },
    });
    if (!res.ok) return { label, ok: false, count: 0, detail: `HTTP ${res.status}` };
    const body = await res.json();
    const count = (parse(body) ?? []).length;
    if (count < min) return { label, ok: false, count, detail: `only ${count} listings` };
    return { label, ok: true, count, detail: '' };
  } catch (err) {
    return { label, ok: false, count: 0, detail: String(err.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

const companies = JSON.parse(await readFile(path.join(HERE, 'approved-companies.json'), 'utf8')).companies ?? [];

const checks = [
  ...companies
    .filter((c) => (!only || only === c.source) && ATS[c.source])
    .map((c) => check(`${c.source}/${c.token} (${c.name})`, ATS[c.source].url(c.token), ATS[c.source].parse)),
  ...FEEDS.filter((f) => !only || only === f.source).map((f) => check(`${f.source} feed`, f.url, f.parse, 1)),
];

const results = await Promise.all(checks);

for (const r of results.sort((a, b) => Number(a.ok) - Number(b.ok) || a.label.localeCompare(b.label))) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${String(r.count).padStart(5)}  ${r.label}${r.detail ? `  — ${r.detail}` : ''}`);
}

const broken = results.filter((r) => !r.ok);
console.log(`\n${results.length - broken.length}/${results.length} sources healthy`);
if (broken.length) {
  console.error('\nBroken sources:');
  for (const b of broken) console.error(`  - ${b.label}: ${b.detail}`);
  process.exit(1);
}
