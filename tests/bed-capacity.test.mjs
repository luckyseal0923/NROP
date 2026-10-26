import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

let db,today,tomorrow,yesterday;
const ids={sys:randomUUID(),second:randomUUID(),admin:randomUUID(),unit:randomUUID(),pending:randomUUID()};
const sessions={};
async function rpc(actor,name,args=[],session=sessions[actor],method='password'){
 await db.exec('savepoint bed_rpc');
 try{
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[ids[actor]||'',JSON.stringify({sub:ids[actor],session_id:session,amr:[{method,timestamp:Math.floor(Date.now()/1000)}]})]);
  await db.exec('set role '+(actor?'authenticated':'anon'));
  return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;
 }catch(error){await db.exec('rollback to savepoint bed_rpc');throw error;}
 finally{await db.exec('reset role;release savepoint bed_rpc');}
}
async function fresh(actor='sys',createdAt=null){const sid=randomUUID();await db.query('insert into auth.sessions(id,user_id,created_at) values($1,$2,coalesce($3::timestamptz,clock_timestamp()))',[sid,ids[actor],createdAt]);return sid;}
const prepare=(extra={})=>rpc('sys','nrop_prepare_bed_change',[extra.unit||'7A',extra.date||tomorrow,extra.beds??40,extra.version??1,extra.reason||'床位調整']);
const confirm=(request,actor='sys',sid,method)=>rpc(actor,'nrop_confirm_bed_change',[request.requestId],sid,method);
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz,not_after timestamptz);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.other_platform(value text);insert into public.other_platform values('unchanged');`);
 await db.exec(readFileSync('supabase/INSTALL.sql','utf8'));
 const dates=(await db.query("select (now() at time zone 'Asia/Taipei')::date::text as today,((now() at time zone 'Asia/Taipei')::date+1)::text as tomorrow,((now() at time zone 'Asia/Taipei')::date-1)::text as yesterday")).rows[0];
 ({today,tomorrow,yesterday}=dates);
 for(const actor of Object.keys(ids)){
  await db.query('insert into auth.users values($1,$2,now())',[ids[actor],actor+'@example.invalid']);
  const role=['sys','second'].includes(actor)?'sysadmin':actor==='admin'?'admin':'unit';
  await db.query("insert into nrop.members(user_id,display_name,role,status,unit_id,requested_unit) values($1,$2,$3,$4,$5,'7A')",[ids[actor],actor,role,actor==='pending'?'pending':'active',role==='unit'?'7A':null]);
  sessions[actor]=await fresh(actor,'2001-01-01T00:00:00Z');
 }
});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');});
afterEach(async()=>{await db.exec('rollback');});

test('只有啟用系統管理者可查看及發起修改，直接讀寫表格與匿名函式皆被拒絕',async()=>{
 for(const actor of [null,'admin','unit','pending']){
  await assert.rejects(rpc(actor,'nrop_admin_bed_settings'),/permission denied|僅系統管理者|尚未.*啟用/);
  await assert.rejects(rpc(actor,'nrop_prepare_bed_change',['7A',tomorrow,40,1,'']),/permission denied|僅系統管理者|尚未.*啟用/);
 }
 await db.exec('savepoint bed_direct;set role authenticated');
 try{await assert.rejects(db.query('select * from nrop.bed_capacities'),/permission denied/);}
 finally{await db.exec('rollback to savepoint bed_direct;release savepoint bed_direct;reset role');}
 const config=await rpc(null,'nrop_public_config');assert.equal(config.bedCapacityManagement,true);
 const settings=await rpc('sys','nrop_admin_bed_settings');assert.equal(settings.units.length,28);assert.equal(settings.history.length,0);
});

test('只用原登入憑證、刷新舊工作階段、非密碼驗證及別人的帳號都不能確認',async()=>{
 const oldSession=await fresh('sys','2001-01-01T00:00:00Z'),request=await prepare();
 await assert.rejects(confirm(request,'sys',sessions.sys),/重新輸入/);
 await assert.rejects(confirm(request,'sys',oldSession),/密碼驗證無效/);
 await assert.rejects(confirm(request,'sys',await fresh(),'oauth'),/密碼驗證無效/);
 await assert.rejects(confirm(request,'second',await fresh('second')),/無效的床數確認/);
 await assert.rejects(confirm(request,'admin',await fresh('admin')),/僅系統管理者/);
 assert.equal((await db.query("select count(*)::int as n from nrop.audit_log where action='beds.update'")).rows[0].n,0);
});

test('指定日期三班套用同一床數，生效日前母數及既有填報完全不變，修改時間與操作者可追溯',async()=>{
 const before=(await db.query('select md5(jsonb_agg(to_jsonb(r) order by report_date,shift,unit_id)::text) as hash from nrop.records r')).rows[0].hash;
 const request=await prepare(),proof=await fresh();await confirm(request,'sys',proof);
 const rows=await rpc('admin','nrop_list_bed_capacities',[yesterday,tomorrow]);
 const unit=rows.filter(r=>r.unit==='7A');assert.deepEqual(unit.map(r=>[r.effectiveDate,r.beds]),[['2000-01-01',45],[tomorrow,40]]);
 assert.equal((await db.query('select nrop.beds_at($1,$2) as n',['7A',yesterday])).rows[0].n,45);
 assert.equal((await db.query('select nrop.beds_at($1,$2) as n',['7A',tomorrow])).rows[0].n,40);
 assert.equal((await db.query('select md5(jsonb_agg(to_jsonb(r) order by report_date,shift,unit_id)::text) as hash from nrop.records r')).rows[0].hash,before);
 const settings=await rpc('sys','nrop_admin_bed_settings');assert.equal(settings.history[0].actor,'sys');assert.equal(settings.history[0].after.beds,40);assert.equal(settings.history[0].after.effectiveDate,tomorrow);assert.ok(settings.history[0].createdAt);
 assert.equal((await db.query('select value from public.other_platform')).rows[0].value,'unchanged');
});

test('每次變更需新密碼工作階段，相同確認重試不重複寫入或新增紀錄',async()=>{
 const request=await prepare(),proof=await fresh();await confirm(request,'sys',proof);await confirm(request,'sys',proof);
 assert.equal((await db.query("select count(*)::int as n from nrop.audit_log where action='beds.update'")).rows[0].n,1);
 const another=await prepare({unit:'7B',beds:42});
 await assert.rejects(confirm(another,'sys',proof),/密碼驗證無效|每次床數調整/);
 await confirm(another,'sys',await fresh());
 assert.equal((await db.query("select count(*)::int as n from nrop.audit_log where action='beds.update'")).rows[0].n,2);
});

test('過期、缺少驗證請求、權限被停用與版本衝突皆不能變更母數',async()=>{
 await assert.rejects(confirm({requestId:randomUUID()},'sys',await fresh()),/無效/);
 const request=await prepare();await db.query("update nrop.bed_change_requests set expires_at=clock_timestamp()-interval '1 second' where id=$1",[request.requestId]);
 await assert.rejects(confirm(request,'sys',await fresh()),/逾時/);
 const second=await prepare();await db.query("update nrop.units set bed_version=2 where id='7A'");
 await assert.rejects(confirm(second,'sys',await fresh()),/其他管理者/);
 await db.query("update nrop.members set status='disabled' where user_id=$1",[ids.sys]);
 await assert.rejects(confirm(second,'sys',await fresh()),/已停用/);
 assert.equal((await db.query("select count(*)::int as n from nrop.audit_log where action='beds.update'")).rows[0].n,0);
});

test('拒絕過去日期及無效床數；0 床可設定，僅影響生效日以後',async()=>{
 await assert.rejects(prepare({date:yesterday}),/歷史日期/);
 await assert.rejects(prepare({beds:-1}),/0 到 9999/);
 await assert.rejects(prepare({beds:10000}),/0 到 9999/);
 await assert.rejects(prepare({beds:45}),/無須變更/);
 const request=await prepare({date:today,beds:0});await confirm(request,'sys',await fresh());
 const config=await rpc(null,'nrop_public_config');assert.equal(config.units.find(u=>u.id==='7A').beds,0);
 assert.equal((await db.query('select nrop.beds_at($1,$2) as n',['7A',yesterday])).rows[0].n,45);
});

test('依單位授權查詢床數、同日修正保留稽核，重跑升級不覆蓋設定',async()=>{
 const request=await prepare();await confirm(request,'sys',await fresh());
 const change=await prepare({beds:41,version:2});assert.equal(change.oldBeds,40);await confirm(change,'sys',await fresh());
 const own=await rpc('unit','nrop_list_bed_capacities',[yesterday,tomorrow]);assert.ok(own.every(r=>r.unit==='7A'));assert.equal(own.at(-1).beds,41);
 const rowsBefore=(await db.query('select * from nrop.bed_capacities order by unit_id,effective_date')).rows;
 await db.exec(readFileSync('supabase/UPGRADE_009.sql','utf8'));
 assert.deepEqual((await db.query('select * from nrop.bed_capacities order by unit_id,effective_date')).rows,rowsBefore);
 assert.equal((await db.query("select count(*)::int as n from nrop.audit_log where action='beds.update'")).rows[0].n,2);
});
