const PW = require('playwright');
const fs=require('fs'), path=require('path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const F=path.resolve('G:/wrk/2026-06-02-toks/app-shared/moderation-huawei.json');
const pkgToId=p=>{const m=/com\.pupikes\.([a-z0-9]+)\.hw/i.exec(p||'');return m?m[1]:'';};
async function readReview(page){ for (const f of page.frames()){ let t=''; try{t=await f.evaluate(()=>document.body?document.body.innerText:'');}catch(e){} if(/App review results/i.test(t)){ const i=t.indexOf('App review results'); return t.slice(i,i+1500);} } return ''; }
(async () => {
  const browser = await PW.chromium.connectOverCDP('http://127.0.0.1:9222');
  let page=null; for (const c of browser.contexts()) for (const p of c.pages()) if (/developer\.huawei\.com/.test(p.url()||'')) page=p;
  if(!page){console.log('няма AGC');process.exit(0);}
  const LIST='https://developer.huawei.com/consumer/en/service/josp/agc/index.html#/myApp';
  let j; try{j=JSON.parse(fs.readFileSync(F,'utf8'));}catch(e){j={store:'huawei',apps:{}};} j.apps=j.apps||{};
  async function gotoList(){ await page.goto(LIST,{waitUntil:'load'}).catch(()=>{}); await sleep(2200); try{await page.locator('.el-tabs__item:has-text("Android")').first().click({timeout:4000});}catch(e){} await sleep(2500); }
  await gotoList();
  const rows = await page.evaluate(()=>{ const out=[]; document.querySelectorAll('tr,.el-table__row').forEach(r=>{const t=(r.innerText||'').replace(/\s+/g,' ').trim(); const m=/(com\.pupikes\.[a-z0-9]+\.hw)/i.exec(t); const nm=t.split(' com.pupikes')[0].trim(); if(m)out.push({name:nm,pkg:m[1]});}); return out; });
  console.log('апове:', rows.length);
  for (const row of rows){
    const id=pkgToId(row.pkg); if(!id)continue;
    await gotoList();
    const ok=await page.evaluate((pkg)=>{const rs=[...document.querySelectorAll('tr,.el-table__row')];const r=rs.find(x=>(x.innerText||'').includes(pkg));if(!r)return false;const e=[...r.querySelectorAll('a,button,span')].find(x=>/^\s*Edit\s*$/.test(x.innerText||''));if(!e)return false;e.click();return true;},row.pkg).catch(()=>false);
    if(!ok){console.log(id,'— не влязох');continue;}
    // изчакай да сме на страницата на апа
    for(let k=0;k<10 && !/#\/myApp\/\d+\//.test(page.url());k++) await sleep(600);
    await sleep(1500);
    // клик Workspace (пробвай до 3 пъти) + polling за review
    let full='';
    for(let attempt=0;attempt<3 && !full;attempt++){
      await page.evaluate(()=>{const el=[...document.querySelectorAll('a,span,div,li')].find(e=>/^\s*Workspace\s*$/.test((e.innerText||'').trim()));if(el)el.click();}).catch(()=>{});
      for(let k=0;k<16 && !full;k++){ await sleep(800); full=await readReview(page); }
    }
    if(full){ const clean=full.replace(/\[Test Environment[\s\S]*$/i,'').replace(/\s+/g,' ').trim().slice(0,1400);
      j.apps[id]={notes:[{text:clean,seenAt:'2026-08-11',source:'App review results (Workspace)'}],collectedAt:'2026-08-11',consoleName:row.name};
      console.log('\n#### '+id+' ####\n  '+clean.slice(0,260));
    } else console.log(id,'— няма review results');
  }
  fs.writeFileSync(F,JSON.stringify(j,null,2)+'\n','utf8');
  console.log('\n✓ записани',Object.keys(j.apps).length,'апа');
  await browser.close().catch(()=>{});
})();
