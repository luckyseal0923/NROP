import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';

let db;
const ids={sys:'00000000-0000-4000-8000-000000000001',admin:'00000000-0000-4000-8000-000000000002',
 unit:'00000000-0000-4000-8000-000000000003',pending:'00000000-0000-4000-8000-000000000004',
 other:'00000000-0000-4000-8000-000000000005',new:'00000000-0000-4000-8000-000000000006'};
async function rpc(actor,name,args=[]) {
  await db.exec('savepoint rpc_call');
  try {
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[actor]||'']);
   await db.exec('set role '+(actor?'authenticated':'anon'));
   return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;
  }catch(error){await db.exec('rollback to savepoint rpc_call');throw error;}
  finally {await db.exec('reset role;release savepoint rpc_call');}
}
const ward=(extra={})=>({staff:1.234,住院:0,出院:0,轉入:0,轉出:0,病危:0,死亡:0,...extra});
const save=(actor,unit,date,shift,body,status='submitted',version=0,dataset='live')=>rpc(actor,'nrop_save_record',[dataset,date,shift,unit,JSON.stringify(body),status,version]);
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.other_platform_sentinel(value text);insert into public.other_platform_sentinel values('unchanged');`);
 await db.exec(readFileSync('supabase/INSTALL.sql','utf8'));
 for(const [name,id] of Object.entries(ids)) await db.query('insert into auth.users values($1,$2,now())',[id,name+'@example.invalid']);
 for(const [name,role,status,unit] of [['sys','sysadmin','active',null],['admin','admin','active',null],['unit','unit','active','7A'],['pending','unit','pending','7A'],['other','unit','active','7B']]) {
  await db.query('insert into nrop.members(user_id,display_name,role,status,unit_id,requested_unit) values($1,$2,$3,$4,$5,$6)',[ids[name],name,role,status,unit,unit||'6A']);
 }
});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');});
afterEach(async()=>{await db.exec('rollback');});

test('安裝 28 單位與 7,224 筆範例，全部位於同一資料區，無跨平台更動',async()=>{
 assert.equal((await db.query('select count(*)::int as n from nrop.units')).rows[0].n,28);
 assert.equal((await db.query("select count(*)::int as n from nrop.records where is_sample")).rows[0].n,7224);
 assert.equal((await db.query("select count(*)::int as n from nrop.records where dataset='live'")).rows[0].n,7224);
 assert.equal((await db.query('select value from public.other_platform_sentinel')).rows[0].value,'unchanged');
 const nh=(await db.query("select payload from nrop.records where unit_id='護理之家' limit 1")).rows[0].payload;
 assert.equal(nh.nurseStaff,undefined);assert.equal(nh.staff,3);
 const cfg=await rpc(null,'nrop_public_config');assert.equal(cfg.units.length,28);assert.equal(cfg.latestRecordDate,'2026-10-25');assert.equal(cfg.dataArea,'shared');
 assert.equal(cfg.applicationUnits.length,29);assert.equal(cfg.applicationUnits.find(u=>u.id==='護理部').reportUnit,null);
});
test('護理部申請待審核且不自動提權，核准管理者不需要填報單位',async()=>{
 const departmentId='00000000-0000-4000-8000-000000000099';ids.department=departmentId;
 await db.query('insert into auth.users values($1,$2,now())',[departmentId,'department@example.invalid']);
 try{
  const member=await rpc('department','nrop_request_access',['護理部人員','護理部']);
  assert.equal(member.requestedUnit,'護理部');assert.equal(member.unit,null);assert.equal(member.status,'pending');assert.equal(member.role,'unit');
  await assert.rejects(rpc('department','nrop_list_records',['live','2026-10-25','2026-10-25']),/尚未.*啟用/);
  await assert.rejects(rpc('sys','nrop_admin_update_account',[departmentId,'unit','active',null,1]),/members_active_unit_required/);
  await rpc('sys','nrop_admin_update_account',[departmentId,'admin','active',null,1]);
  assert.equal((await rpc('department','nrop_list_records',['live','2026-10-25','2026-10-25'])).length,84);
  assert.equal((await db.query('select count(*)::int as n from nrop.units')).rows[0].n,28);
 }finally{await db.query('delete from auth.users where id=$1',[departmentId]);delete ids.department;}
});
test('匿名及待審核帳號無法取得資料，無 schema / 直接資料表存取權',async()=>{
 await assert.rejects(rpc(null,'nrop_list_records',['live','2026-10-25','2026-10-25']),/permission denied/);
 await assert.rejects(rpc('pending','nrop_list_records',['live','2026-10-25','2026-10-25']),/帳號尚未.*啟用/);
 await db.exec('savepoint direct_read;set role authenticated');
 try{await assert.rejects(db.query('select * from nrop.records'),/permission denied/);}finally{await db.exec('rollback to savepoint direct_read;release savepoint direct_read;reset role');}
});
test('搬移後 7,224 筆數值與原前端 DEMO 快照完全一致',async()=>{
 const snapshot=JSON.parse(readFileSync('tests/demo-snapshot.json','utf8'));
 const rows=(await db.query("select report_date::text as date,shift,unit_id,payload,status,patients from nrop.records where is_sample")).rows;
 const normalized=rows.map(r=>({key:`${r.date}|${r.shift}|${r.unit_id}`,status:r.status,patients:r.patients,
   payload:Object.fromEntries(Object.entries(r.payload).sort(([a],[b])=>a.localeCompare(b,'en')))})).sort((a,b)=>a.key.localeCompare(b.key,'en'));
 assert.equal(normalized.length,snapshot.records);
 assert.equal(createHash('sha256').update(JSON.stringify(normalized)).digest('hex'),snapshot.sha256);
});
test('單位使用者只讀本單位，管理者可跨單位讀取，DEMO seed 可重跑',async()=>{
 const own=await rpc('unit','nrop_list_records',['live','2026-10-25','2026-10-25']);
 assert.equal(own.length,3);assert.ok(own.every(x=>x.unit==='7A'));
 assert.equal((await rpc('admin','nrop_list_records',['live','2026-10-25','2026-10-25'])).length,84);
 await db.exec(readFileSync('supabase/002_demo_seed.sql','utf8'));
 assert.equal((await db.query('select count(*)::int as n from nrop.records')).rows[0].n,7224);
});
test('不信任前端角色與跨單位寫入，缺前班不能正式送出',async()=>{
 await assert.rejects(save('unit','7B','2026-10-24','N',ward()),/無權填報/);
 await assert.rejects(rpc('admin','nrop_admin_accounts'),/僅系統管理者/);
 await assert.rejects(save('unit','7A','2026-07-01','N',ward()),/前一班尚未完成/);
 await assert.rejects(rpc('unit','nrop_set_opening',['live','7A','2026-10-24','N',20]),/管理者/);
});
test('管理者設定期初、三位小數、版本衝突與連續班重算',async()=>{
 await db.exec("delete from nrop.records where unit_id='7A'");
 await rpc('admin','nrop_set_opening',['live','7A','2026-10-24','N',20]);
 const first=await save('unit','7A','2026-10-24','N',ward({住院:1,patients:999,role:'sysadmin'}));
 assert.equal(first.patients,21);assert.equal(first.staff,1.234);assert.equal(first.role,undefined);
 await save('unit','7A','2026-10-24','D',ward({出院:2}));
 await save('unit','7A','2026-10-24','E',ward());
 await assert.rejects(save('unit','7A','2026-10-24','N',ward(), 'submitted',0),/重新載入/);
 await save('unit','7A','2026-10-24','N',ward({住院:3}), 'submitted',1);
 const rows=await rpc('unit','nrop_list_records',['live','2026-10-24','2026-10-24']);
 assert.deepEqual(rows.map(x=>x.record.patients),[23,21,21]);
 assert.deepEqual(rows.map(x=>x.record.version),[2,2,2]);
 await assert.rejects(save('unit','7A','2026-10-24','N',ward(),'draft',2),/後續已有正式/);
 await assert.rejects(save('unit','7A','2026-10-24','N',ward({staff:0.1234}),'submitted',2),/小數位數/);
 await assert.rejects(save('unit','7A','2026-10-24','N',ward({住院:0.5}),'submitted',2),/小數位數/);
 await assert.rejects(rpc('admin','nrop_set_opening',['live','7A','2026-10-24','N',40]),/已有紀錄/);
});
test('負數住院拒絕且整個交易回滾，既有範例數值保留',async()=>{
 const before=(await db.query("select to_jsonb(r) as value from nrop.records r where unit_id='7A' and report_date='2026-10-24' and shift='N'")).rows;
 await assert.rejects(save('unit','7A','2026-10-24','N',ward({出院:100}),'submitted',1),/不可為負/);
 assert.deepEqual((await db.query("select to_jsonb(r) as value from nrop.records r where unit_id='7A' and report_date='2026-10-24' and shift='N'")).rows,before);
});
test('護理之家合計在 DB 重算，洗腎重症欄位不可缺漏',async()=>{
 await db.exec("delete from nrop.records where unit_id in ('護理之家','洗腎室')");
 const body={nurseStaff:0.1,aideStaff:0.2,staff:999,residents:31,occupiedBeds:31,reserved:6,admitted:0,discharged:0};
 const nh=await save('admin','護理之家','2026-10-24','N',body);
 assert.equal(nh.staff,0.3);
 const dialysis={staff:2.123,hemodialysisOutpatient:10,hemodialysisInpatient:3,hemodialysisCritical:2,peritonealDialysis:0};
 assert.equal((await save('admin','洗腎室','2026-10-24','N',dialysis)).hemodialysisCritical,2);
 delete dialysis.hemodialysisCritical;
 await assert.rejects(save('admin','洗腎室','2026-10-24','D',dialysis),/缺少必填/);
});
test('住院分類總和由 DB 計算，病危不增減住院數',async()=>{
 await db.exec("delete from nrop.records where unit_id in ('6A','6B','12B','ICU-3')");
 for(const [unit,parts] of [['6A',{住院本科:1,住院非本科:2}],['6B',{住院本科:2,住院非本科:1}],['12B',{住院一般病房:2,住院負壓隔離:1}],['ICU-3',{住院一般病房:1,住院負壓隔離:2}]]) {
  await rpc('admin','nrop_set_opening',['live',unit,'2026-10-24','N',5]);
  const r=await save('admin',unit,'2026-10-24','N',ward({...parts,住院:999,病危:4}));
  assert.equal(r.住院,3);assert.equal(r.patients,8);
 }
});
test('最後一位系統管理者不得停用或降權',async()=>{
 await assert.rejects(rpc('sys','nrop_admin_update_account',[ids.sys,'admin','active',null,1]),/至少一位/);
 await assert.rejects(rpc('sys','nrop_admin_update_account',[ids.sys,'sysadmin','disabled',null,1]),/至少一位/);
});
test('核准申請、停用立即阻擋仍持 JWT 的帳號、重申請不能繞過',async()=>{
 let pending=await rpc('pending','nrop_current_account');assert.equal(pending.status,'pending');
 await rpc('sys','nrop_admin_update_account',[ids.pending,'unit','active','7A',pending.version]);
 assert.equal((await rpc('pending','nrop_list_records',['live','2026-10-25','2026-10-25'])).length,3);
 await rpc('sys','nrop_admin_update_account',[ids.pending,'unit','disabled','7A',2]);
 await assert.rejects(rpc('pending','nrop_list_records',['live','2026-10-25','2026-10-25']),/已停用/);
 await assert.rejects(save('pending','7A','2026-10-24','N',ward(),'draft',2),/已停用/);
 assert.equal((await rpc('pending','nrop_request_access',['again','7B'])).status,'disabled');
});
test('共用 Auth 使用者不自動取得 NROP 權限；開關申請不影響其他平台',async()=>{
 assert.equal(await rpc('new','nrop_current_account'),null);
 await rpc('sys','nrop_admin_set_registration',[false]);
 await assert.rejects(rpc('new','nrop_request_access',['New Member','6A']),/未開放/);
 await rpc('sys','nrop_admin_set_registration',[true]);
 const requested=await rpc('new','nrop_request_access',['New Member','6A']);
 assert.equal(requested.role,'unit');assert.equal(requested.status,'pending');
 assert.ok((await rpc('sys','nrop_admin_audit')).some(x=>x.action==='account.request'));
 assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,6);
});
test('以管理者審核決定資格，Email 確認欄位不替代審核；既有管理者不被初始化覆寫',async()=>{
 await rpc('new','nrop_request_access',['New Member','6A']);
 await db.query('update auth.users set email_confirmed_at=null where id=$1',[ids.new]);
 assert.equal((await rpc('new','nrop_request_access',['New Member','6A'])).status,'pending');
 await assert.rejects(rpc('new','nrop_list_records',['live','2026-10-25','2026-10-25']),/尚未.*啟用/);
 await rpc('sys','nrop_admin_update_account',[ids.new,'unit','active','6A',1]);
 assert.equal((await rpc('new','nrop_list_records',['live','2026-10-25','2026-10-25'])).length,3);
 await assert.rejects(db.exec(readFileSync('supabase/003_bootstrap_admin.sql','utf8')),/已有系統管理者/);
 await db.exec('rollback');
});
test('即使誤授資料表 SELECT，RLS 仍預設拒絕；重跑結構不覆蓋現有資料',async()=>{
 await db.exec('grant usage on schema nrop to authenticated;grant select on nrop.records to authenticated;set role authenticated;');
 try{assert.equal((await db.query('select count(*)::int as n from nrop.records')).rows[0].n,0);}finally{await db.exec('reset role;revoke usage on schema nrop from authenticated;revoke select on nrop.records from authenticated;');}
 await assert.rejects(db.exec(readFileSync('supabase/INSTALL.sql','utf8')),/already exists/);await db.exec('rollback');
 assert.equal((await db.query("select count(*)::int as n from nrop.records where is_sample")).rows[0].n,7224);
});
test('首次初始化只提升指定的帳號，不建立固定密碼或修改其他 Auth 使用者',async()=>{
 await db.query("update nrop.members set status='disabled' where role='sysadmin'");
 const script=readFileSync('supabase/003_bootstrap_admin.sql','utf8').replace('請改成你的Email@example.org','other@example.invalid');
 await db.exec(script);
 const member=(await db.query('select role,status from nrop.members where user_id=$1',[ids.other])).rows[0];assert.equal(member.role,'sysadmin');assert.equal(member.status,'active');
 assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,6);
});
test('005 更新適用已安裝的舊資料庫，可重跑且保留既有成員和全部 DEMO',async()=>{
 const legacy=new PGlite();
 try{
  await legacy.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  for(const path of ['supabase/migrations/001_nrop.sql','supabase/001_units.sql','tests/fixtures/legacy-demo-seed.sql'])await legacy.exec(readFileSync(path,'utf8'));
  await legacy.query('insert into auth.users values($1,$2,now())',[ids.unit,'existing@example.invalid']);
  await legacy.query("insert into nrop.members(user_id,display_name,role,status,unit_id,requested_unit) values($1,'既有成員','unit','active','7A','7A')",[ids.unit]);
  const beforeRecords=(await legacy.query('select md5(jsonb_agg(to_jsonb(r) order by report_date,shift,unit_id)::text) as hash from nrop.records r')).rows[0].hash;
  const beforeMembers=(await legacy.query('select to_jsonb(m) as value from nrop.members m')).rows;
  for(let i=0;i<2;i++)await legacy.exec(readFileSync('supabase/UPGRADE_005_006.sql','utf8'));
  assert.equal((await legacy.query('select md5(jsonb_agg(to_jsonb(r) order by report_date,shift,unit_id)::text) as hash from nrop.records r')).rows[0].hash,beforeRecords);
  assert.deepEqual((await legacy.query('select to_jsonb(m) as value from nrop.members m')).rows,beforeMembers);
  assert.equal((await legacy.query('select public.nrop_public_config() as config')).rows[0].config.applicationUnits.length,29);
 }finally{await legacy.close();}
});
