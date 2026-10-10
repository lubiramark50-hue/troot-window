#!/usr/bin/env node
/**
 * Troot Window — category mapping check.
 *
 * The sync fills the board from 17 outside sources, so the words that decide a
 * category come from titles this repo does not control. Every title below was
 * taken from a real payload (or is a short, obvious variant), so a rule that
 * stops matching shows up here instead of on the live board.
 *
 * Dry, offline and deterministic: it never fetches anything.
 *
 *   node scripts/verify-categories.mjs
 */
import { readFileSync } from 'node:fs';
import { mapCategory, categoryNames } from './job-categories.mjs';

/** [title, expected category]. Left column is verbatim from the live sync. */
const CASES = [
  // --- software and IT, including titles that borrow field words
  ['Senior Software QA Engineer', 'Technology'],
  ['Staff Fullstack Engineer', 'Technology'],
  ['Mobile Architect', 'Technology'],
  ['Senior Independent AI Engineer / Architect', 'Technology'],
  ['Lead Solutions Architect - Generative AI (EMEA Emerging DNB)', 'Technology'],
  ['Senior Solutions Engineer', 'Technology'],
  ['AI Solutions Manager', 'Technology'],
  ['Senior Staff Firmware Engineer', 'Technology'],
  ['Data Analyst', 'Technology'],
  ['Information Security Officer', 'Technology'],
  ['Systems Administrator', 'Technology'],
  ['Tier III Service Desk Engineer', 'Technology'],
  ['IS - Administrator Analyst (Abuja)', 'Technology'],
  // "Site" does not make an engineer a construction role.
  ['Site Reliability Engineer', 'Technology'],
  ['Engineering Manager (Site Reliability)', 'Technology'],
  ['Team Lead, Site Reliability Engineering', 'Technology'],

  // --- business roles must not be filed by a borrowed word
  ['Finance Manager', 'Other'],
  ['Financial Planning Analyst', 'Other'],
  ['Credit Risk Analyst', 'Other'],
  ['Analyst, Office of the CFO (Fixed-Term)', 'Other'],
  ['Senior Business Analyst', 'Other'],
  ['Fractional Senior People Advisor', 'Other'],
  ['Business Development Manager', 'Other'],
  ['Technical Sales Representative', 'Other'],
  ['Sales Network Manager', 'Other'],
  ['Head of Marketing', 'Other'],
  ['Customer Success Manager', 'Other'],

  // --- a business word must not hide a field role: these are still field work
  ['Logistics Network & Operations Manager - Jumia (Full Time)', 'Transport'],
  ['Last Mile Team Lead - Door Delivery - Jumia (Full Time)', 'Transport'],
  ['Tupande Export Logistics Senior Specialist', 'Transport'],
  ['Truck Driver', 'Transport'],
  ['Warehouse Supervisor', 'Transport'],

  // --- trades, the words that a trailing \b used to kill
  ['Rwanda Plumbing and Mechanical Engineer (Fixed-Term)', 'Trades'],
  ['Tupande Electrical Maintenance Engineer / Specialist (Fixed-Term)', 'Trades'],
  ['Tupande Mechanical Maintenance Engineer / Specialist (Fixed-Term)', 'Trades'],
  ['Senior Mechanical Engineer (Sustaining)', 'Trades'],
  ['Senior Welder', 'Trades'],
  ['Refrigeration Technician', 'Trades'],
  ['Solar Installation Technician', 'Trades'],
  ['Carpenter', 'Trades'],

  // --- construction
  ['Rwanda Quantity Surveyor Lead (Fixed-Term)', 'Construction'],
  ['Quantity Surveyor', 'Construction'],
  ['Bricklaying Supervisor', 'Construction'],
  ['Site Engineer', 'Construction'],

  // --- hospitality
  ['Hotel Manager', 'Hospitality'],
  ['Head Chef', 'Hospitality'],
  ['Housekeeping Supervisor', 'Hospitality'],
  ['Restaurant Supervisor', 'Hospitality'],
  ['Front Desk Officer', 'Hospitality'],
];

const failures = [];
const expect = (ok, msg) => { if (!ok) failures.push(msg); };

// The schema is what actually rejects a bad value, so the rules must be a subset
// of its CHECK list, and the app's filter chips must be the same list.
const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const constraint = sql.match(/category text not null check \(category in \(([^)]+)\)\)/i);
expect(constraint, 'schema.sql: could not find the category CHECK constraint');
const allowed = constraint ? [...constraint[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
expect(allowed.length >= 6, `schema.sql: parsed ${allowed.length} categories, expected at least 6`);

const api = readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8');
const chips = api.match(/export const CATEGORIES = \[([^\]]+)\]/);
expect(chips, 'src/api.ts: could not find the CATEGORIES list');
const chipList = chips ? [...chips[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
expect(
  chipList.length > 0 && chipList.every((c) => allowed.includes(c)) && allowed.every((c) => chipList.includes(c)),
  `the board's filter chips (${chipList.join(', ')}) and the schema's categories (${allowed.join(', ')}) have drifted apart`,
);

for (const name of categoryNames) expect(allowed.includes(name), `rule "${name}" is not a category the schema allows`);
for (const [, want] of CASES) expect(allowed.includes(want), `case expects "${want}", which the schema does not allow`);

let mappedAsIntended = 0;
for (const [title, want] of CASES) {
  const got = mapCategory(title);
  if (got === want) mappedAsIntended += 1;
  else failures.push(`"${title}" -> ${got}, expected ${want}`);
}

// The employer's own department is only a fallback, and it must never turn a
// business title into a technology one.
expect(
  mapCategory('Finance Manager', 'Engineering') === 'Other',
  'an "Engineering" department overrode the business title "Finance Manager"',
);
// ...but a department label does place a title that says nothing on its own.
expect(
  mapCategory('Senior Specialist', 'Logistics') === 'Transport',
  'the “Logistics” department did not place a title that names no field',
);

console.log(`${mappedAsIntended}/${CASES.length} titles mapped as intended`);
console.log(`categories in play: ${categoryNames.join(', ')}`);
if (failures.length) {
  console.log(`\n${failures.length} problem(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('category check passed.');
