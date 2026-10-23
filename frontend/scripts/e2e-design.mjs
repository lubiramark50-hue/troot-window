import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4179';
const live = !origin.includes('127.0.0.1');
const out = process.env.TEST_OUTPUT_DIR || new URL('../../../../outputs/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({headless:true});
try {
 for (const width of [390,768,1280,1600]) {
  const page = await browser.newPage({viewport:{width,height:900}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  let fail=false, empty=false;
  if(!live) await page.route('https://fake.supabase.test/**', async route=>{
   if(fail) return route.fulfill({status:500,json:{message:'Test unavailable'}});
   const job={id:'11111111-2222-4333-8444-555555555555',title:'Community technology assistant with responsibility for customer support and reporting',employer_name:'Example Employer',location:'Kampala',category:'Technology',mode:'OnSite',pay:'UGX 80,000/day',created_at:new Date().toISOString(),published_at:new Date().toISOString(),employer_verified:false,description:'Help customers and prepare reports.',requirements:'Communication, Teamwork',status:'published',source:null,phone:null,whatsapp:null,email:'jobs@example.org'};
   return route.fulfill({status:200,headers:{'content-range':empty?'*/0':'0-0/1','access-control-expose-headers':'content-range'},json:empty?[]:[job]});
  });
  await page.goto(origin,{waitUntil:'networkidle'});
  await page.locator('.job-row, .state').first().waitFor();
  await page.screenshot({path:`${out}/${live?'live':'review'}-${width}.png`,fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow at ${width}`);
  if(!live){
   await page.getByRole('heading',{name:'Find your next job.'}).waitFor();
   const filters=page.getByRole('button',{name:'Filters',exact:true});
   await filters.click();assert(await filters.getAttribute('aria-expanded')==='true');
   await page.getByRole('button',{name:'Remote',exact:true}).click();
   assert(new URL(page.url()).searchParams.get('m')==='Remote');
   await page.getByRole('button',{name:'Any type',exact:true}).click();
   const search=page.getByRole('searchbox',{name:'Search jobs'});
   await search.fill('assistant'); await page.waitForTimeout(500);
   assert(new URL(page.url()).searchParams.get('q')==='assistant');
   await page.reload(); await search.waitFor(); assert(await search.inputValue()==='assistant');
   await page.getByRole('button',{name:'Clear search'}).click();
   assert(!new URL(page.url()).searchParams.has('q'));
   await page.getByRole('button',{name:'Technology',exact:true}).click();
   assert(new URL(page.url()).searchParams.get('c')==='Technology');
   await page.getByRole('button',{name:'All categories'}).click();
   await page.getByRole('button',{name:'Save job',exact:true}).first().click();
   assert(await page.getByRole('button',{name:'Remove from saved'}).first().getAttribute('aria-pressed')==='true');
   await page.goto(`${origin}/saved`); await page.getByRole('heading',{name:/Community technology/}).waitFor();
   await page.goto(`${origin}/safety`); await page.getByText('What Verified means').waitFor();
   await page.getByRole('link',{name:'Privacy',exact:true}).click(); await page.getByText('Saved jobs stay on your device.',{exact:false}).waitFor();
   empty=true; await page.goto(origin); await page.getByRole('heading',{name:'No matching jobs'}).waitFor();
   empty=false;fail=true;await page.reload();await page.getByRole('heading',{name:"Couldn't load jobs"}).waitFor();
   fail=false;await page.getByRole('button',{name:'Try again'}).click();await page.locator('.job-row').first().waitFor();
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.keyboard.press('Tab');
   assert(await page.evaluate(()=>document.activeElement!==document.body));
  }
  assert.deepEqual(errors,[]);console.log(`${live?'Live':'Isolated'} ${width}px: passed`);
  await page.close();
 }
} finally { await browser.close(); }

