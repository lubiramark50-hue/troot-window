import { chromium } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

const port = 4182;
const origin = "http://127.0.0.1:" + port;
const workerId = "11111111-2222-4333-8444-555555555555";
const userId = "22222222-3333-4444-8555-666666666666";
const publicWorker = {
  id: workerId, display_name: "Amina Testworker", country_code: "UG", town: "Kampala",
  services: ["Plumbing"], skills: "Pipe repair", service_areas: ["Wakiso"],
  travel_mode: "mobile", availability: "Available", phone: "+256700111222",
  whatsapp: "+256700111222", description: "Home and office plumbing", work_examples: "",
  photo_url: null, experience_years: 5, starting_price: "UGX 50000",
  updated_at: "2026-10-01T00:00:00Z",
};
const jwt = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
  Buffer.from(JSON.stringify({ sub:userId, role:"authenticated", email:"worker@example.test", exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url"),
  "test_signature"].join(".");
const fakeSession = { access_token:jwt, token_type:"bearer", expires_in:3600, refresh_token:"fake-refresh", user:{ id:userId, aud:"authenticated", role:"authenticated", email:"worker@example.test", app_metadata:{provider:"email",providers:["email"]}, user_metadata:{}, created_at:"2026-10-01T00:00:00Z" } };
const server = spawn(process.execPath,
  ["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port",String(port),"--strictPort"],
  { stdio:"pipe", env:{...process.env,VITE_SUPABASE_URL:"https://fake.supabase.test",VITE_SUPABASE_ANON_KEY:"fake-publishable-key"} });
let browser;
try {
  let started = false;
  for (let i=0;i<60;i++) {
    try { if ((await fetch(origin)).ok) { started=true; break; } } catch {}
    await sleep(250);
  }
  assert(started,"Vite dev server did not start");
  browser = await chromium.launch({headless:true});
  for (const viewport of [{ width:1280,height:850 },{ width:390,height:844 }]) {
    const page = await browser.newPage({viewport, permissions:[]});
    let stored = null;
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("https://fake.supabase.test/**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const headers = { "access-control-allow-origin":"*", "access-control-allow-headers":"*", "access-control-allow-methods":"GET,POST,OPTIONS,PATCH,DELETE", "content-type":"application/json" };
      const fulfill = (status, value) => route.fulfill({status,headers,body:typeof value==="string"?value:JSON.stringify(value)});
      if (request.method()==="OPTIONS") return fulfill(200, {});
      if (path.endsWith("/worker_directory") && request.method()==="GET") {
        const workers = [publicWorker];
        const filtered = workers.filter(w =>
          (!url.searchParams.has("country_code") || w.country_code === url.searchParams.get("country_code").replace("eq.","")) &&
          (!url.searchParams.has("services") || url.searchParams.get("services").includes(w.services[0])));
        const byId = url.searchParams.has("id");
        return fulfill(200, byId ? filtered[0] ?? null : filtered);
      }
      if (path.endsWith("/worker_profiles") && request.method()==="GET") return fulfill(200,stored);
      if (path.endsWith("/worker_profiles") && request.method()==="POST") {
        const submitted = JSON.parse(request.postData()||"{}");
        assert.equal(submitted.user_id,userId,"Only authenticated user's ID may be written");
        assert(!("email" in submitted), "Never write auth email into public worker profile");
        stored={ ...publicWorker, ...submitted };
        return fulfill(201,[]);
      }
      if (path.endsWith("/auth/v1/token") && request.method()==="POST") return fulfill(200,fakeSession);
      if (path.endsWith("/auth/v1/signup") && request.method()==="POST") return fulfill(200,{user:fakeSession.user,session:null});
      if (path.endsWith("/auth/v1/recover") && request.method()==="POST") return fulfill(200,{});
      if (path.endsWith("/auth/v1/user")) return fulfill(200,fakeSession.user);
      if (path.endsWith("/auth/v1/logout")) return fulfill(204,"");
      return fulfill(404,{message:"Unknown test route: "+path});
    });
    await page.goto(origin+"/workers");
    await page.getByRole("heading",{name:"Find a worker"}).waitFor();
    await page.getByRole("heading",{name:"Amina Testworker"}).waitFor();
    assert.equal(await page.getByRole("link",{name:/Call worker/i}).first().getAttribute("href"),"tel:+256700111222");
    assert.equal(await page.getByRole("link",{name:/WhatsApp/i}).first().getAttribute("href"),"https://wa.me/256700111222");
    await page.getByRole("combobox",{name:"Service needed"}).selectOption("Mechanic");
    await page.getByRole("heading",{name:"No matching workers yet"}).waitFor();
    await page.getByRole("combobox",{name:"Service needed"}).selectOption("Plumbing");
    await page.getByRole("textbox",{name:"Town or area"}).fill("Wakiso");
    await page.getByRole("heading",{name:"Amina Testworker"}).waitFor();
    await page.getByRole("button",{name:/Use my approximate location/i}).click();
    await page.getByText(/Location access was denied or unavailable/i).waitFor();
    assert.equal(await page.getByRole("textbox",{name:"Town or area"}).inputValue(),"Wakiso","Permission denial must not erase manual town");
    await page.context().grantPermissions(["geolocation"], { origin });
    await page.context().setGeolocation({latitude:0.3136,longitude:32.5811});
    await page.route("https://nominatim.openstreetmap.org/**", route => {
      const query = new URL(route.request().url()).searchParams;
      assert.equal(query.get("lat"), "0.31", "Share approximate latitude only");
      assert.equal(query.get("lon"), "32.58", "Share approximate longitude only");
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        address:{city:"Kampala Capital City",country_code:"ug"}
      })});
    });
    await page.getByRole("button",{name:/Use my approximate location/i}).click();
    await page.getByText(/Approximate area detected: Kampala/i).waitFor();
    assert.equal(await page.getByRole("textbox",{name:"Town or area"}).inputValue(),"Kampala","Granted permission should set a detected town");
    await page.getByRole("link",{name:"Amina Testworker",exact:false}).first().click();
    await page.getByRole("heading",{name:"Amina Testworker"}).waitFor();
    await page.getByRole("link",{name:/Call worker/i}).waitFor();
    await page.goto(origin+"/workers/account");
    await page.getByRole("heading",{name:"Worker sign in"}).waitFor();
    await page.getByRole("textbox",{name:"Email address"}).fill("worker@example.test");
    await page.getByLabel("Password",{exact:true}).fill("password123");
    await page.getByRole("button",{name:"Sign in"}).click();
    await page.getByRole("heading",{name:"Your worker profile"}).waitFor();
    await page.getByRole("textbox",{name:"Public name"}).fill("Test Plumber");
    await page.getByRole("checkbox",{name:"Plumbing"}).check();
    await page.getByRole("textbox",{name:"Town or district"}).fill("Kampala");
    await page.getByRole("textbox",{name:"Public contact phone"}).fill("+256 700 111 222");
    await page.getByRole("checkbox",{name:/Publish my worker listing/i}).check();
    await page.getByRole("button",{name:"Create profile"}).click();
    await page.getByText(/Public profile saved/i).waitFor();
    assert.equal(stored.is_active,true);
    await page.reload();
    await page.getByRole("heading",{name:"Your worker profile"}).waitFor();
    await page.getByRole("checkbox",{name:/Publish my worker listing/i}).uncheck();
    await page.getByRole("button",{name:"Save changes"}).click();
    await page.getByText(/listing is paused/i).waitFor();
    assert.equal(stored.is_active,false);
    await page.getByRole("button",{name:/Log out/i}).click();
    await page.getByRole("heading",{name:"Worker sign in"}).waitFor();
    await page.getByRole("button",{name:"New worker? Register"}).click();
    await page.getByRole("heading",{name:"Register as a worker"}).waitFor();
    await page.getByRole("textbox",{name:"Email address"}).fill("newworker@example.test");
    await page.getByLabel("Password",{exact:true}).fill("password123");
    await page.getByRole("button",{name:"Create account"}).click();
    await page.getByText(/Check your email for a confirmation link/i).waitFor();
    await page.getByRole("button",{name:"Forgot password?"}).click();
    await page.getByRole("heading",{name:"Recover your password"}).waitFor();
    await page.getByRole("button",{name:"Send recovery email"}).click();
    await page.getByText(/recovery link will be sent/i).waitFor();
    assert.deepEqual(errors,[], "Unexpected browser JavaScript errors");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert(overflow < 3,"Horizontal overflow on viewport "+viewport.width+": "+overflow);
    await page.close();
    console.log("PASS worker directory, manual search, location denied, phone/WhatsApp, auth, session restore, edit/pause/logout: "+viewport.width+"px");
  }
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

