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
const pieces=[readFileSync('supabase/migrations/001_nrop.sql','utf8'),catalog,...upgrades,readFileSync('supabase/002_demo_seed.sql','utf8')];
const combine=pieces=>'begin;\n'+pieces.map(text=>text.replace(/^begin;\s*$/gm,'').replace(/^commit;\s*$/gm,'')).join('\n')+'\ncommit;\n';
const installation = '-- 由 npm run db:prepare 產生。完整貼進 SQL Editor 執行一次；失敗時整筆回滾。\nbegin;\n'
  +pieces.map(text=>text.replace(/^begin;\s*$/gm,'').replace(/^commit;\s*$/gm,'')).join('\n')+'\ncommit;\n';
writeFileSync('supabase/INSTALL.sql',installation);
writeFileSync('supabase/UPGRADE_005_006.sql','-- 已安裝的資料庫只需執行此檔；護理部申請與管理者審核流程，可重跑。\n'+combine(upgrades));
console.log('已產生 supabase/INSTALL.sql（建表、權限、單位設定、7,224 筆 DEMO）');
