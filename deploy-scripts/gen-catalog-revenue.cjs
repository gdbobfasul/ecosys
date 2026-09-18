// gen-catalog-revenue.cjs — обединява приходите от покупки (Huawei + RuStore), събрани от ботовете,
// и ги записва в каталога като поле `revenue` на всяко приложение → показва се в pupikes.app вдясно на цената.
// Източници: app-shared/rustore-insights.json (money[]) + docs/store-metrics/huawei-<дата>.json (revenue/purchases).
// ВИКА СЕ от седмичния Scheduled Task СЛЕД обхождането на ботовете. НЕ обхожда сам — само сумира и записва.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
function readJson(f){ try { return JSON.parse(fs.readFileSync(f,'utf8')); } catch(_){ return null; } }
// извади число + валута от текст като "1 234 ₽" / "$56.7" / "350 руб"
function parseMoney(s){
  if(!s) return null;
  const m = String(s).match(/([\$€]|₽|руб|RUB|USD)?\s*([\d][\d\s.,]*)\s*([\$€]|₽|руб|RUB|USD)?/i);
  if(!m) return null;
  const cur = (m[1]||m[3]||'').replace(/руб|RUB/i,'₽').replace(/USD/i,'$');
  const num = parseFloat((m[2]||'').replace(/\s/g,'').replace(',','.'));
  if(!isFinite(num)||num<=0) return null;
  return { cur: cur||'', num };
}
// RuStore приходи по appName
const rs = readJson(path.join(ROOT,'app-shared','rustore-insights.json')) || {};
const rsApps = rs.apps || rs || {};
// Huawei — най-новият метрики файл
let hw = null; try {
  const dir = path.join(ROOT,'docs','store-metrics');
  const files = fs.readdirSync(dir).filter(f=>/^huawei-.*\.json$/.test(f)).sort();
  if(files.length) hw = readJson(path.join(dir, files[files.length-1]));
} catch(_){}
const hwApps = (hw && hw.apps) || [];
// каталог
for(const catFile of ['app-shared/pupikes-catalog.json','apk/catalog.json']){
  const c = readJson(path.join(ROOT,catFile)); if(!c) continue;
  const groups = c.groups||[]; let set=0;
  groups.forEach(g=>(g.apps||[]).forEach(a=>{
    // събери всички money стрингове за този ап (по име) от двата източника
    const nm = (a.name||'').toLowerCase();
    let rub=0, usd=0, any=false;
    // RuStore: rsApps е обект по appName ИЛИ масив
    const rsList = Array.isArray(rsApps)?rsApps:Object.values(rsApps);
    rsList.forEach(x=>{ if(!x)return; const xn=(x.appName||x.name||'').toLowerCase(); if(xn && (xn===nm || xn.includes(nm) || nm.includes(xn))){ (x.money||[]).forEach(mm=>{const p=parseMoney(mm); if(p){any=true; if(p.cur==='$')usd+=p.num; else rub+=p.num;}}); } });
    // Huawei: hwApps е масив с {name, metrics:{purchases/revenue}}
    hwApps.forEach(x=>{ const xn=(x.name||'').toLowerCase(); if(xn && (xn===nm || xn.includes(nm) || nm.includes(xn))){ const rv=(x.metrics&&(x.metrics.revenue||x.metrics.income))||''; const p=parseMoney(rv); if(p){any=true; if(p.cur==='$')usd+=p.num; else if(p.cur==='₽')rub+=p.num; else usd+=p.num;} } });
    if(any){ const parts=[]; if(rub>0)parts.push(Math.round(rub)+'₽'); if(usd>0)parts.push('$'+(usd%1?usd.toFixed(2):usd)); a.revenue = parts.length? ('💰 '+parts.join(' · ')) : ''; if(a.revenue)set++; }
  }));
  fs.writeFileSync(path.join(ROOT,catFile), JSON.stringify(c,null,1));
  console.log('  '+catFile+' → приходи записани за '+set+' апа');
}
console.log('Готово. (Приходите се показват вдясно на цената в pupikes.app.)');
