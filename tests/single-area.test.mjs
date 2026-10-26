import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const user='00000000-0000-4000-8000-000000000001';
const sql=path=>readFileSync(path,'utf8');
const upgrade=sql('supabase/UPGRADE_005_007.sql');
async function legacy(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.other_platform(value text);insert into public.other_platform values('unchanged');`);
 for(const path of ['supabase/migrations/001_nrop.sql','supabase/001_units.sql','tests/fixtures/legacy-demo-seed.sql'])await db.exec(sql(path));
 await db.query('insert into auth.users values($1,$2,now())',[user,'admin@example.invalid']);
 await db.query("insert into nrop.members(user_id,display_name,role,status,unit_id,requested_unit) values($1,'原管理者','sysadmin','active',null,'急診')",[user]);
 return db;
}
async function hash(db){
 return (await db.query("select md5(jsonb_agg(to_jsonb(r)-'dataset'-'is_sample' order by report_date,shift,unit_id)::text) as value from nrop.records r")).rows[0].value;
}
async function rpc(db,name,args){
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await db.exec('set role authenticated');
 try{return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;}
 finally{await db.exec('reset role');}
}

test('舊環境整併全部範例及人工填報，數值、版本、帳號與其他平台保留，可重跑',async()=>{
 const db=await legacy();
 try{
  await db.exec("insert into nrop.records(dataset,report_date,shift,unit_id,payload,status,version) values('live','2026-10-26','N','急診','{\"staff\":3.123}','draft',7)");
  await db.query("insert into nrop.opening_balances(dataset,unit_id,report_date,shift,patients,updated_by) values('demo','6A','2026-08-01','N',22,$1),('live','6B','2026-10-26','N',23,$1)",[user]);
  const beforeHash=await hash(db);
  const members=(await db.query('select to_jsonb(m) as value from nrop.members m')).rows;
  await db.exec(upgrade);
  assert.equal(await hash(db),beforeHash);
  assert.deepEqual((await db.query('select to_jsonb(m) as value from nrop.members m')).rows,members);
  const counts=(await db.query("select count(*)::int as total,count(*) filter(where is_sample)::int as samples,count(*) filter(where dataset<>'live')::int as legacy from nrop.records")).rows[0];
  assert.deepEqual(counts,{total:7225,samples:7224,legacy:0});
  assert.deepEqual((await db.query('select unit_id,is_sample from nrop.opening_balances order by unit_id')).rows,[{unit_id:'6A',is_sample:true},{unit_id:'6B',is_sample:false}]);
  const cfg=await rpc(db,'nrop_public_config',[]);assert.equal(cfg.dataArea,'shared');assert.equal(cfg.recordStartDate,'2026-08-01');assert.equal(cfg.latestRecordDate,'2026-10-26');
  assert.equal(cfg.demoStartDate,undefined);assert.equal(cfg.liveStartDate,undefined);assert.equal(cfg.applicationUnits.length,29);
  assert.equal((await rpc(db,'nrop_list_records',['live','2026-10-25','2026-10-26'])).length,85);
  await db.exec(upgrade);assert.equal(await hash(db),beforeHash);
  assert.equal((await db.query("select count(*)::int as n from nrop.audit_log where action='data.unify'")).rows[0].n,1);
  assert.equal((await db.query('select value from public.other_platform')).rows[0].value,'unchanged');
 }finally{await db.close();}
});

test('整併發現同日期班別單位衝突時，所有資料及結構完整回滾',async()=>{
 const db=await legacy();
 try{
  await db.exec("insert into nrop.records(dataset,report_date,shift,unit_id,payload,status) values('live','2026-10-25','N','急診','{\"staff\":9}','draft')");
  const beforeHash=await hash(db);
  await assert.rejects(db.exec(upgrade),/整併停止.*相同日期/);await db.exec('rollback');
  assert.equal(await hash(db),beforeHash);
  assert.equal((await db.query("select count(*)::int as n from information_schema.columns where table_schema='nrop' and table_name='records' and column_name='is_sample'")).rows[0].n,0);
  assert.equal((await db.query("select count(*)::int as n from nrop.records where dataset='demo'")).rows[0].n,7224);
  assert.equal((await db.query("select to_regclass('nrop.application_units')::text as name")).rows[0].name,null);
 }finally{await db.close();}
});

test('整併遇到同單位兩組期初人數會停止，不選邊覆蓋',async()=>{
 const db=await legacy();
 try{
  await db.query("insert into nrop.opening_balances(dataset,unit_id,report_date,shift,patients,updated_by) values('demo','6A','2026-08-01','N',22,$1),('live','6A','2026-10-26','N',23,$1)",[user]);
  await assert.rejects(db.exec(upgrade),/整併停止.*兩組期初/);await db.exec('rollback');
  assert.equal((await db.query("select count(*)::int as n from nrop.records where dataset='demo'")).rows[0].n,7224);
  assert.equal((await db.query('select count(*)::int as n from nrop.opening_balances')).rows[0].n,2);
 }finally{await db.close();}
});

test('同一資料區的範例可修改、新增填報可續接，來源不可由 payload 偽造，舊分區被拒絕',async()=>{
 const db=await legacy();
 try{
  await db.exec(upgrade);
  const body={staff:2.123,住院:0,出院:0,轉入:0,轉出:0,病危:0,死亡:0,is_sample:false};
  const first=await rpc(db,'nrop_save_record',['live','2026-08-01','N','7A',JSON.stringify(body),'submitted',1]);
  assert.equal(first.version,2);assert.equal(first.baselineReady,true);assert.equal(first.isDemo,undefined);
  assert.equal((await db.query("select is_sample from nrop.records where unit_id='7A' and report_date='2026-08-01' and shift='N'")).rows[0].is_sample,true);
  const next=await rpc(db,'nrop_save_record',['live','2026-10-26','N','7A',JSON.stringify({...body,is_sample:true}),'submitted',0]);
  const prior=(await db.query("select patients from nrop.records where unit_id='7A' and report_date='2026-10-25' and shift='E'")).rows[0].patients;
  assert.equal(next.opening,prior);assert.equal(next.baselineReady,false);
  assert.equal((await db.query("select is_sample from nrop.records where unit_id='7A' and report_date='2026-10-26'")).rows[0].is_sample,false);
  await assert.rejects(rpc(db,'nrop_list_records',['demo','2026-10-25','2026-10-25']),/已整併/);
  await assert.rejects(rpc(db,'nrop_list_openings',[null]),/已整併/);
  await assert.rejects(rpc(db,'nrop_save_record',['demo','2026-10-26','N','7A',JSON.stringify(body),'submitted',0]),/已整併/);
  await assert.rejects(db.exec("insert into nrop.records(dataset,report_date,shift,unit_id,payload,status) values('demo','2026-10-26','E','急診','{}','draft')"),/records_dataset_check/);
 }finally{await db.close();}
});
