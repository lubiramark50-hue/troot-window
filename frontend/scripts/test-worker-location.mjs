import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const workersSource = readFileSync(new URL("../src/workers.ts", import.meta.url), "utf8");
const isoCodes = workersSource.match(/export const COUNTRY_CODES = "([^"]+)"/)?.[1];
assert(isoCodes && isoCodes.split(" ").length === 249, "Expect full ISO country dataset");
const source = readFileSync(new URL("../src/worker-location.ts", import.meta.url), "utf8")
  .replace('import { COUNTRIES } from "./workers";', 'const COUNTRIES = "' + isoCodes + '".split(" ").map(code => ({code}));');
const compiled = ts.transpileModule(source, { compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 }}).outputText;
const moduleExports = {};
new Function("exports","require",compiled)(moduleExports, createRequire(import.meta.url));
const { parseBigDataCloud, parseOpenStreetMap, reverseGeocode, geolocationError } = moduleExports;
const expected = {country:"UG",town:"Kampala",locality:"Nakawa",provider:"BigDataCloud"};
assert.deepEqual(parseBigDataCloud({countryCode:"UG",city:"Kampala Capital City",locality:"Nakawa"}),expected);
assert.equal(parseBigDataCloud({countryCode:"ZZ",city:"Unknown"}),null);
assert.equal(parseBigDataCloud({countryCode:"UG",city:""}),null);
assert.deepEqual(parseOpenStreetMap({address:{country_code:"ug",city:"Kampala Capital City",suburb:"Nakawa"}}),
  {country:"UG",town:"Kampala",locality:"Nakawa",provider:"OpenStreetMap"});
assert.deepEqual(parseOpenStreetMap({address:{country_code:"ke",town:"Nairobi City",city_district:"Westlands"}}),
  {country:"KE",town:"Nairobi",locality:"Westlands",provider:"OpenStreetMap"});
assert.equal(parseOpenStreetMap({address:{country_code:"ug"}}),null);
assert.equal(parseBigDataCloud({countryCode:"US",city:"New York"}).town,"New York");
assert.equal(parseBigDataCloud({countryCode:"FR",city:"Paris"}).country,"FR");
assert.equal(parseBigDataCloud({countryCode:"JP",city:"東京"}).town,"東京");
assert.equal(parseBigDataCloud({countryCode:"BR",city:"São Paulo"}).country,"BR");
assert.equal(parseOpenStreetMap({address:{country_code:"de",city:"München"}}).country,"DE");
assert.equal(parseOpenStreetMap({address:{country_code:"in",city:"Bengaluru"}}).country,"IN");
assert.match(geolocationError({code:1}),/permission/i);
assert.match(geolocationError({code:2}),/device/i);
assert.match(geolocationError({code:3}),/timed out/i);
const originalFetch = globalThis.fetch;
const mock = (body, status=200) => ({ok:status>=200&&status<300,status, json:async()=>body});
try {
 let calls=[];
 globalThis.fetch = async url => {
   calls.push(url);
   assert(new URL(url).host==="api.bigdatacloud.net");
   return mock({countryCode:"UG",city:"Kampala Capital City"});
 };
 const area = await reverseGeocode(0.3136,32.5811);
 assert.equal(area.town,"Kampala");
 assert.equal(calls.length,1,"Successful primary lookup must not hit fallback");
 assert.equal(new URL(calls[0]).searchParams.get("latitude"),"0.314","Only rounded approximate coordinates are shared");
 assert.equal(new URL(calls[0]).searchParams.get("longitude"),"32.581");
 globalThis.fetch = async url => {
   calls.push(url);
   return url.includes("api.bigdatacloud.net") ? mock({},503) :
     mock({address:{town:"Wakiso",country_code:"ug"}});
 };
 calls=[];
 assert.equal((await reverseGeocode(0.3136,32.5811)).town,"Wakiso");
 assert.equal(calls.length,2);
 globalThis.fetch=async()=>{throw new Error("No network");};
 await assert.rejects(reverseGeocode(0.3136,32.5811),/enter your town manually/i);
 await assert.rejects(reverseGeocode(NaN,10),/valid device coordinates/);
} finally {globalThis.fetch=originalFetch;}
console.log("PASS: consent-based town lookup normalization, backup geocoder, coordinate privacy and manual fallback");
