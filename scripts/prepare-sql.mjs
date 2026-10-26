import { readFileSync, writeFileSync } from 'node:fs';
import { allLoginUnits, admissionFieldsByUnit, events } from '../src/catalog.js';
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const rows = allLoginUnits.map((u,i) => {
  const fields=u.fields ? u.fields.map(([key])=>key) : events.flatMap(k=>k==='住院' && admissionFieldsByUnit[u.id] ? admissionFieldsByUnit[u.id].map(([key])=>key) : [k]);
  if(!u.fields) fields.unshift('staff');
  return `(${quote(u.id)},${u.beds},${quote(u.type)},array[${fields.map(quote).join(',')}],${i})`;
});
const catalog = 'begin;\ninsert into nrop.units(id,beds,kind,fields,sort_order) values\n' + rows.join(',\n') + ';\ncommit;\n';
writeFileSync('supabase/001_units.sql',catalog);
const upgrades=['supabase/migrations/005_application_units.sql','supabase/migrations/006_admin_approval_only.sql'].map(path=>readFileSync(path,'utf8'));
const singleArea=readFileSync('supabase/migrations/007_single_data_area.sql','utf8');
const pieces=[readFileSync('supabase/migrations/001_nrop.sql','utf8'),catalog,...upgrades,singleArea,readFileSync('supabase/002_demo_seed.sql','utf8')];
const combine=pieces=>'begin;\n'+pieces.map(text=>text.replace(/^begin;\s*$/gm,'').replace(/^commit;\s*$/gm,'')).join('\n')+'\ncommit;\n';
const installation = '-- 由 npm run db:prepare 產生。完整貼進 SQL Editor 執行一次；失敗時整筆回滾。\nbegin;\n'
  +pieces.map(text=>text.replace(/^begin;\s*$/gm,'').replace(/^commit;\s*$/gm,'')).join('\n')+'\ncommit;\n';
writeFileSync('supabase/INSTALL.sql',installation);
writeFileSync('supabase/UPGRADE_005_006.sql','-- 舊版更新檔，僅保留供歷史版本使用；目前版本請執行 UPGRADE_005_007.sql。\n'+combine(upgrades));
writeFileSync('supabase/UPGRADE_005_007.sql','-- 現有環境執行此檔：護理部、人工審核及單一資料區。先備份並暫停填報；可重跑，衝突時回滾。\n'+combine([...upgrades,singleArea]));
console.log('已產生 INSTALL.sql 與 UPGRADE_005_007.sql（單一資料區，保留 7,224 筆範例）');
