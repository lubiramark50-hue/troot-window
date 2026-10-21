// Visual regression smoke test. Uses synthetic, clearly labelled test-only data.
// No requests are sent to a real Supabase project and nothing is deployed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const host = 'http://127.0.0.1:4173';
const site = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'pipe' });
const results = [];
const jobs = [
  ['Senior Frontend Developer','Nile Digital','Kampala, Uganda','Technology','Hybrid','UGX 5Mâ8M/month',true],
  ['Creative Graphic Designer','Lakeview Studio','Entebbe, Uganda','Technology','Remote','UGX 2Mâ4M/month',true],
  ['Site Project Manager','Kampala Build Co.','Kampala, Uganda','Construction','OnSite','UGX 3Mâ5M/month',true],
  ['Hotel Guest Experience Lead','Pearl Hospitality','Jinja, Uganda','Hospitality','OnSite','UGX 1.5Mâ2.5M/month',false],
  ['Fleet Operations Officer','Transit Works','Mbarara, Uganda','Transport','OnSite','UGX 2Mâ3M/month',false],
  ['Senior Electrician','Greenline Services','Gulu, Uganda','Trades','OnSite','UGX 120K/day',false],
  ['Remote Customer Specialist','Apex Connect','Remote','Other','Remote','UGX 2M/month',false],
  ['Software Engineer','Bright Futures Lab','Kampala, Uganda','Technology','Hybrid','UGX 4Mâ6M/month',false],
].map((p,i) => ({
  id: '00000000-0000-4000-8000-' + String(i+1).padStart(12,'0'),
  title:p[0],employer_name:p[1],location:p[2],category:p[3],mode:p[4],pay:p[5],
  description:'A genuine opportunity to grow your career and build useful professional skills.',
  requirements:'Relevant experience, Communication, Teamwork',
  employer_verified:p[6],status:'published',source:p[6]?'greenhouse':null,
  created_at:'2026-10-20T08:00:00Z',published_at:'2026-10-20T08:00:00Z'
}));
async function ready() {
  for(let i=0;i<90;i++){
    if(site.exitCode!==null) throw Error('Vite preview exited: '+site.exitCode);
    try {const r=await fetch(host);if(r.ok)return;} catch{}
    await new Promise(r=>setTimeout(r,500));
  }
  throw Error('Preview server did not start');
}
async function render(browser, name, viewport, mobile) {
  const page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
  await page.route('https://example.supabase.co/rest/v1/**',async route=>{
    if(route.request().method()!=='GET')return route.fulfill({status:405,body:'{}'});
    return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-7/8','access-control-expose-headers':'content-range'},body:JSON.stringify(jobs)});
  });
  const exceptions=[];
  page.on('pageerror',e=>exceptions.push(String(e)));
  await page.goto(host,{waitUntil:'networkidle',timeout:30000});
  await page.locator('.job-row').first().waitFor({timeout:15000});
  const count=await page.locator('.job-row').count();
  const sidebarVisible=await page.locator('.tw-sidebar').isVisible();
  const tabsVisible=await page.locator('.tabbar').isVisible();
  const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
  const verified=await page.locator('.tw-verified-company').count();
  assert.ok(count>=3,'Job cards must render');
  assert.ok(verified>=1,'Verified companies must come from job data');
  assert.equal(sidebarVisible,viewport.width>=900,'Sidebar visibility at '+name);
  assert.equal(tabsVisible,viewport.width<900,'Mobile navigation visibility at '+name);
  assert.equal(horizontalOverflow,false,'Unexpected horizontal overflow at '+name);
  assert.equal(exceptions.length,0,'Unexpected browser exceptions at '+name+': '+exceptions.join('; '));
  await page.screenshot({path:'test-results/'+name+'.png',fullPage:viewport.width>=900,animations:'disabled'});
  results.push({name,viewport,jobCards:count,verifiedEmployers:verified,sidebarVisible,tabsVisible,horizontalOverflow,exceptions});
  await page.close();
}
let browser;
try{
  await ready();
  await mkdir('test-results',{recursive:true});
  browser=await chromium.launch({headless:true});
  await render(browser,'troot-desktop-1440',{width:1440,height:1000},false);
  await render(browser,'troot-phone-390',{width:390,height:844},true);
  await render(browser,'troot-tablet-768',{width:768,height:1024},false);
  await writeFile('test-results/report.json',JSON.stringify({type:'synthetic-visual-test-only',results},null,2));
  console.log('Desktop, mobile and tablet screenshot checks passed');
} finally {
  await browser?.close();
  site.kill('SIGTERM');
}
