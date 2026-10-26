-- 由 npm run db:prepare 產生。完整貼進 SQL Editor 執行一次；失敗時整筆回滾。
begin;
-- NROP v1。請以 SQL Editor 管理者執行一次；只新增 nrop schema 與 public.nrop_* 函式。

create schema nrop;
revoke all on schema nrop from public, anon, authenticated;

create table nrop.units (
  id text primary key,
  beds integer not null check (beds >= 0),
  kind text not null check (kind in ('ward','special','emergency','delivery','operatingRoom','nursingHome','dialysis')),
  fields text[] not null,
  sort_order integer not null
);
create table nrop.settings (
  singleton boolean primary key default true check (singleton),
  registration_open boolean not null default true,
  live_start_date date not null default (now() at time zone 'Asia/Taipei')::date,
  demo_start_date date not null default '2026-08-01'
);
insert into nrop.settings(singleton) values(true);

create table nrop.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  role text not null default 'unit' check (role in ('unit','admin','sysadmin')),
  status text not null default 'pending' check (status in ('pending','active','disabled')),
  unit_id text references nrop.units(id),
  requested_unit text not null references nrop.units(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  check (role <> 'unit' or unit_id is not null)
);

create table nrop.records (
  dataset text not null check (dataset in ('live','demo')),
  report_date date not null check (report_date between '2000-01-01' and '2100-12-31'),
  shift text not null check (shift in ('N','D','E')),
  unit_id text not null references nrop.units(id),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null check (status in ('empty','draft','submitted')),
  opening_patients integer not null default 0 check (opening_patients >= 0),
  patients integer check (patients >= 0),
  version integer not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (dataset, report_date, shift, unit_id)
);
create index records_unit_date on nrop.records(dataset, unit_id, report_date);
-- 第一班沒有前班紀錄時，由管理者設定可追溯的期初人數，避免正式填報永遠卡在「前班未完成」。
create table nrop.opening_balances (
  dataset text not null check (dataset in ('live','demo')),
  unit_id text not null references nrop.units(id),
  report_date date not null,
  shift text not null check (shift in ('N','D','E')),
  patients integer not null check (patients >= 0),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key(dataset, unit_id)
);
create table nrop.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
alter table nrop.units enable row level security;
alter table nrop.settings enable row level security;
alter table nrop.members enable row level security;
alter table nrop.records enable row level security;
alter table nrop.opening_balances enable row level security;
alter table nrop.audit_log enable row level security;
-- 不授予瀏覽器直接讀寫資料表。RLS 無 policy 時預設拒絕；所有操作經過下列限縮 RPC。
revoke all on all tables in schema nrop from public, anon, authenticated;
revoke all on all sequences in schema nrop from public, anon, authenticated;

create function nrop.actor() returns nrop.members
language plpgsql security definer set search_path = '' as $$
declare m nrop.members;
begin
  select * into m from nrop.members where user_id = auth.uid() and status = 'active';
  if m.user_id is null or not exists(select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) then
    raise exception '帳號尚未啟用、已停用，或 Email 尚未驗證' using errcode = '42501';
  end if;
  return m;
end $$;

create function nrop.order_of_shift(s text) returns integer
language sql immutable set search_path = '' as $$ select case s when 'N' then 0 when 'D' then 1 else 2 end $$;

create function nrop.record_json(r nrop.records) returns jsonb
language sql stable set search_path = '' as $$
select r.payload || jsonb_build_object('status',r.status,'patients',r.patients,
  'opening',r.opening_patients,'version',r.version,'updatedAt',r.updated_at,'isDemo',r.dataset='demo')
$$;

create function public.nrop_public_config() returns jsonb
language sql stable security definer set search_path = '' as $$
select jsonb_build_object('registrationOpen',s.registration_open,'liveStartDate',s.live_start_date,
 'demoStartDate',s.demo_start_date,'demoLatestDate',(select max(report_date) from nrop.records where dataset='demo'),
 'units',(select jsonb_agg(jsonb_build_object('id',id,'beds',beds,'type',kind) order by sort_order) from nrop.units))
from nrop.settings s
$$;

create function public.nrop_current_account() returns jsonb
language sql stable security definer set search_path = '' as $$
select (select jsonb_build_object('userId',m.user_id,'name',m.display_name,'role',m.role,'status',m.status,
 'unit',m.unit_id,'requestedUnit',m.requested_unit,'version',m.version,'email',u.email,'emailVerified',u.email_confirmed_at is not null)
 from nrop.members m join auth.users u on u.id=m.user_id where m.user_id=auth.uid())
$$;

create function public.nrop_request_access(p_name text, p_unit text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
    raise exception '請先驗證 Email 並登入' using errcode='42501';
  end if;
  -- 既有停用帳號不可透過重新申請自行啟用。
  if exists(select 1 from nrop.members where user_id=auth.uid()) then return public.nrop_current_account(); end if;
  if not (select registration_open from nrop.settings) then raise exception '目前未開放新帳號申請' using errcode='42501'; end if;
  insert into nrop.members(user_id,display_name,unit_id,requested_unit) values(auth.uid(),btrim(p_name),p_unit,p_unit);
  insert into nrop.audit_log(actor_id,action,target) values(auth.uid(),'account.request',auth.uid()::text);
  return public.nrop_current_account();
end $$;

create function public.nrop_admin_accounts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m nrop.members;
begin
  m:=nrop.actor(); if m.role<>'sysadmin' then raise exception '僅系統管理者可管理帳號' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('userId',x.user_id,'name',x.display_name,'email',u.email,
   'role',x.role,'status',x.status,'unit',x.unit_id,'requestedUnit',x.requested_unit,'version',x.version,'createdAt',x.created_at)
   order by x.created_at desc) from nrop.members x join auth.users u on u.id=x.user_id),'[]'::jsonb);
end $$;

create function public.nrop_admin_update_account(p_user uuid,p_role text,p_status text,p_unit text,p_version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare m nrop.members; old nrop.members; updated nrop.members;
begin
  -- 序列化角色變更，避免兩位管理者同時停用後失去最後一位系統管理者。
  perform pg_advisory_xact_lock(17931,1);
  m:=nrop.actor(); if m.role<>'sysadmin' then raise exception '僅系統管理者可管理帳號' using errcode='42501'; end if;
  select * into old from nrop.members where user_id=p_user for update;
  if old.user_id is null then raise exception '找不到帳號'; end if;
  if old.version<>p_version then raise exception '帳號已被其他管理者修改，請重新整理' using errcode='40001'; end if;
  if old.role='sysadmin' and old.status='active' and (p_role<>'sysadmin' or p_status<>'active')
    and (select count(*) from nrop.members where role='sysadmin' and status='active')<=1 then
    raise exception '必須保留至少一位啟用的系統管理者';
  end if;
  update nrop.members set role=p_role,status=p_status,unit_id=p_unit,version=version+1,updated_at=now()
  where user_id=p_user returning * into updated;
  insert into nrop.audit_log(actor_id,action,target,before_data,after_data)
   values(m.user_id,'account.update',p_user::text,to_jsonb(old),to_jsonb(updated));
end $$;

create function public.nrop_admin_set_registration(p_open boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare m nrop.members; old boolean;
begin
 m:=nrop.actor(); if m.role<>'sysadmin' then raise exception '僅系統管理者可變更申請設定' using errcode='42501'; end if;
 select registration_open into old from nrop.settings for update;
 update nrop.settings set registration_open=p_open;
 insert into nrop.audit_log(actor_id,action,target,before_data,after_data)
 values(m.user_id,'registration.update','nrop',jsonb_build_object('open',old),jsonb_build_object('open',p_open));
end $$;

create function public.nrop_list_records(p_dataset text,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m nrop.members;
begin
 m:=nrop.actor();
 if p_dataset not in ('demo','live') or p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception '查詢範圍須在 367 天以內'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('date',r.report_date,'shift',r.shift,'unit',r.unit_id,
  'record',nrop.record_json(r)) order by r.report_date,nrop.order_of_shift(r.shift),r.unit_id)
 from nrop.records r where r.dataset=p_dataset and r.report_date between p_from and p_to
 and (m.role in ('admin','sysadmin') or r.unit_id=m.unit_id)),'[]'::jsonb);
end $$;

create function public.nrop_list_openings(p_dataset text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m nrop.members;
begin
 m:=nrop.actor();
 return coalesce((select jsonb_agg(to_jsonb(o)-'updated_by') from nrop.opening_balances o
 where o.dataset=p_dataset and (m.role in ('admin','sysadmin') or o.unit_id=m.unit_id)),'[]'::jsonb);
end $$;

create function public.nrop_set_opening(p_dataset text,p_unit text,p_date date,p_shift text,p_patients integer) returns void
language plpgsql security definer set search_path = '' as $$
declare m nrop.members;
begin
 m:=nrop.actor(); if m.role not in ('admin','sysadmin') then raise exception '期初人數由管理者設定' using errcode='42501'; end if;
 if p_dataset not in ('live','demo') or p_shift not in ('N','D','E') or p_date is null or p_patients is null or p_patients<0 then raise exception '期初資料格式錯誤'; end if;
 if not exists(select 1 from nrop.units where id=p_unit and kind in ('ward','special')) then raise exception '僅住院單位需要期初人數'; end if;
 perform pg_advisory_xact_lock(hashtext(p_dataset),hashtext(p_unit));
 if exists(select 1 from nrop.records where dataset=p_dataset and unit_id=p_unit) then
   raise exception '已有紀錄，請先由管理者檢視歷史資料；不可用期初設定覆蓋既有統計';
 end if;
 insert into nrop.opening_balances(dataset,unit_id,report_date,shift,patients,updated_by)
 values(p_dataset,p_unit,p_date,p_shift,p_patients,m.user_id)
 on conflict(dataset,unit_id) do update set report_date=excluded.report_date,shift=excluded.shift,
 patients=excluded.patients,updated_by=excluded.updated_by,updated_at=now();
 insert into nrop.audit_log(actor_id,action,target,after_data) values(m.user_id,'opening.set',p_dataset||'|'||p_unit,
 jsonb_build_object('date',p_date,'shift',p_shift,'patients',p_patients));
end $$;

-- 值由資料庫驗證及重算；不相信瀏覽器傳入的 patients、staff 合計、版本或權限。
create function public.nrop_save_record(p_dataset text,p_date date,p_shift text,p_unit text,p_payload jsonb,p_status text,p_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 m nrop.members; u nrop.units; old nrop.records; saved nrop.records; prior nrop.records; later nrop.records;
 clean jsonb:='{}'; field text; val numeric; admission integer; base integer:=0; closing integer;
 prev_date date; prev_shift text; ready boolean:=false; last_date date; last_shift text; last_patients integer;
 changed jsonb; opening nrop.opening_balances;
begin
 m:=nrop.actor();
 if m.role='unit' and m.unit_id<>p_unit then raise exception '無權填報其他單位' using errcode='42501'; end if;
 if p_dataset is null or p_dataset not in ('live','demo') or p_date is null or p_date>(now() at time zone 'Asia/Taipei')::date
   or p_shift is null or p_shift not in ('N','D','E') or p_status is null or p_status not in ('draft','submitted')
   or p_payload is null or jsonb_typeof(p_payload)<>'object' or p_version is null or p_version<0 then raise exception '填報格式或日期錯誤'; end if;
 select * into u from nrop.units where id=p_unit; if u.id is null then raise exception '單位不存在'; end if;
 perform pg_advisory_xact_lock(hashtext(p_dataset),hashtext(p_unit));
 select * into old from nrop.records where dataset=p_dataset and report_date=p_date and shift=p_shift and unit_id=p_unit for update;
 if coalesce(old.version,0)<>p_version then raise exception '資料已被其他人修改，請重新載入後再儲存' using errcode='40001'; end if;
 if old.status='submitted' and p_status='draft' and exists(select 1 from nrop.records where dataset=p_dataset and unit_id=p_unit and status='submitted'
   and (report_date>p_date or (report_date=p_date and nrop.order_of_shift(shift)>nrop.order_of_shift(p_shift)))) then
   raise exception '後續已有正式送出紀錄，請直接修正並正式送出，避免破壞後班基準';
 end if;
 foreach field in array u.fields loop
   if u.kind='nursingHome' and field='staff' then continue; end if;
   if not (p_payload ? field) or p_payload->field='null'::jsonb then raise exception '缺少必填欄位：%',field; end if;
   if jsonb_typeof(p_payload->field)<>'number' then raise exception '欄位必須是數字：%',field; end if;
   val:=(p_payload->>field)::numeric;
   if val<0 or val>100000 or val<>round(val,case when field in ('staff','nurseStaff','aideStaff') then 3 else 0 end) then
     raise exception '欄位數字超出範圍或小數位數錯誤：%',field;
   end if;
   clean:=clean||jsonb_build_object(field,val);
 end loop;
 if u.kind='nursingHome' then
  clean:=clean||jsonb_build_object('staff',(clean->>'nurseStaff')::numeric+(clean->>'aideStaff')::numeric);
 end if;
 if u.kind in ('ward','special') then
  if p_unit in ('6A','6B') then admission:=(clean->>'住院本科')::integer+(clean->>'住院非本科')::integer;
  elsif p_unit in ('12B','ICU-3') then admission:=(clean->>'住院一般病房')::integer+(clean->>'住院負壓隔離')::integer;
  else admission:=(clean->>'住院')::integer; end if;
  clean:=clean||jsonb_build_object('住院',admission);
  prev_date:=case when p_shift='N' then p_date-1 else p_date end;
  prev_shift:=case p_shift when 'N' then 'E' when 'D' then 'N' else 'D' end;
  select * into prior from nrop.records where dataset=p_dataset and report_date=prev_date and shift=prev_shift and unit_id=p_unit;
  if prior.unit_id is not null then base:=prior.patients; ready:=prior.status='submitted';
  else
   select * into opening from nrop.opening_balances where dataset=p_dataset and unit_id=p_unit and report_date=p_date and shift=p_shift;
   if opening.unit_id is not null then base:=opening.patients; ready:=true;
   elsif old.unit_id is not null then base:=old.opening_patients; end if;
  end if;
  if p_status='submitted' and not ready then raise exception '前一班尚未完成，請先暫存；第一班請管理者設定期初人數'; end if;
  closing:=base+admission-(clean->>'出院')::integer+(clean->>'轉入')::integer-(clean->>'轉出')::integer-(clean->>'死亡')::integer;
  if closing<0 then raise exception '住院人數不可為負，請確認期初人數與異動'; end if;
 end if;
 insert into nrop.records(dataset,report_date,shift,unit_id,payload,status,opening_patients,patients,version,updated_by)
 values(p_dataset,p_date,p_shift,p_unit,clean,p_status,base,closing,coalesce(old.version,0)+1,m.user_id)
 on conflict(dataset,report_date,shift,unit_id) do update set payload=excluded.payload,status=excluded.status,
 opening_patients=excluded.opening_patients,patients=excluded.patients,version=excluded.version,updated_by=excluded.updated_by,updated_at=now()
 returning * into saved;
 insert into nrop.audit_log(actor_id,action,target,before_data,after_data)
 values(m.user_id,'record.save',p_dataset||'|'||p_date||'|'||p_shift||'|'||p_unit,to_jsonb(old),to_jsonb(saved));
 if u.kind in ('ward','special') then
  last_date:=p_date; last_shift:=p_shift; last_patients:=closing;
  for later in select * from nrop.records where dataset=p_dataset and unit_id=p_unit
    and (report_date>p_date or (report_date=p_date and nrop.order_of_shift(shift)>nrop.order_of_shift(p_shift)))
    order by report_date,nrop.order_of_shift(shift) for update loop
    -- 只傳遞到連續下一班；缺班後的資料不假設前班為零。
    prev_date:=case when later.shift='N' then later.report_date-1 else later.report_date end;
    prev_shift:=case later.shift when 'N' then 'E' when 'D' then 'N' else 'D' end;
    if prev_date<>last_date or prev_shift<>last_shift then exit; end if;
    closing:=last_patients+coalesce((later.payload->>'住院')::integer,0)-coalesce((later.payload->>'出院')::integer,0)
      +coalesce((later.payload->>'轉入')::integer,0)-coalesce((later.payload->>'轉出')::integer,0)-coalesce((later.payload->>'死亡')::integer,0);
    if closing<0 then raise exception '修改後會造成後續班別住院人數為負，請先檢查後續資料'; end if;
    if later.opening_patients<>last_patients or later.patients<>closing then
      update nrop.records set opening_patients=last_patients,patients=closing,version=version+1,updated_by=m.user_id,updated_at=now()
        where dataset=p_dataset and report_date=later.report_date and shift=later.shift and unit_id=p_unit returning to_jsonb(records.*) into changed;
      insert into nrop.audit_log(actor_id,action,target,before_data,after_data)
      values(m.user_id,'record.recalculate',p_dataset||'|'||later.report_date||'|'||later.shift||'|'||p_unit,to_jsonb(later),changed);
    end if;
    last_date:=later.report_date; last_shift:=later.shift; last_patients:=closing;
  end loop;
 end if;
 return nrop.record_json(saved);
end $$;

create function public.nrop_admin_audit() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m nrop.members;
begin
 m:=nrop.actor(); if m.role<>'sysadmin' then raise exception '僅系統管理者可查看稽核紀錄' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.id desc) from
   (select id,actor_id,action,target,created_at from nrop.audit_log order by id desc limit 100) x),'[]'::jsonb);
end $$;

revoke all on all functions in schema nrop from public, anon, authenticated;
revoke all on function public.nrop_public_config() from public, anon, authenticated;
revoke all on function public.nrop_current_account() from public, anon, authenticated;
revoke all on function public.nrop_request_access(text,text) from public, anon, authenticated;
revoke all on function public.nrop_admin_accounts() from public, anon, authenticated;
revoke all on function public.nrop_admin_update_account(uuid,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.nrop_admin_set_registration(boolean) from public, anon, authenticated;
revoke all on function public.nrop_list_records(text,date,date) from public, anon, authenticated;
revoke all on function public.nrop_list_openings(text) from public, anon, authenticated;
revoke all on function public.nrop_set_opening(text,text,date,text,integer) from public, anon, authenticated;
revoke all on function public.nrop_save_record(text,date,text,text,jsonb,text,integer) from public, anon, authenticated;
revoke all on function public.nrop_admin_audit() from public, anon, authenticated;
grant execute on function public.nrop_public_config() to anon, authenticated;
grant execute on function public.nrop_current_account(), public.nrop_request_access(text,text),
 public.nrop_admin_accounts(), public.nrop_admin_update_account(uuid,text,text,text,integer),
 public.nrop_admin_set_registration(boolean), public.nrop_list_records(text,date,date), public.nrop_list_openings(text),
 public.nrop_set_opening(text,text,date,text,integer), public.nrop_save_record(text,date,text,text,jsonb,text,integer),
 public.nrop_admin_audit() to authenticated;

notify pgrst, 'reload schema';


insert into nrop.units(id,beds,kind,fields,sort_order) values
('6A',39,'ward',array['staff','住院本科','住院非本科','出院','轉入','轉出','病危','死亡'],0),
('6B',43,'ward',array['staff','住院本科','住院非本科','出院','轉入','轉出','病危','死亡'],1),
('7A',45,'ward',array['staff','住院','出院','轉入','轉出','病危','死亡'],2),
('7B',45,'ward',array['staff','住院','出院','轉入','轉出','病危','死亡'],3),
('8A',32,'ward',array['staff','住院','出院','轉入','轉出','病危','死亡'],4),
('安寧病房',10,'ward',array['staff','住院','出院','轉入','轉出','病危','死亡'],5),
('8B',33,'ward',array['staff','住院','出院','轉入','轉出','病危','死亡'],6),
('9A',45,'ward',array['staff','住院','出院','轉入','轉出','病危','死亡'],7),
('9B',45,'ward',array['staff','住院','出院','轉入','轉出','病危','死亡'],8),
('10A',45,'ward',array['staff','住院','出院','轉入','轉出','病危','死亡'],9),
('10B',45,'ward',array['staff','住院','出院','轉入','轉出','病危','死亡'],10),
('11A',40,'ward',array['staff','住院','出院','轉入','轉出','病危','死亡'],11),
('11B',45,'ward',array['staff','住院','出院','轉入','轉出','病危','死亡'],12),
('12B',10,'ward',array['staff','住院一般病房','住院負壓隔離','出院','轉入','轉出','病危','死亡'],13),
('精神科急性病房',30,'ward',array['staff','住院','出院','轉入','轉出','病危','死亡'],14),
('ICU-1',12,'special',array['staff','住院','出院','轉入','轉出','病危','死亡'],15),
('ICU-2',24,'special',array['staff','住院','出院','轉入','轉出','病危','死亡'],16),
('ICU-3',9,'special',array['staff','住院一般病房','住院負壓隔離','出院','轉入','轉出','病危','死亡'],17),
('NICU',3,'special',array['staff','住院','出院','轉入','轉出','病危','死亡'],18),
('PICU',2,'special',array['staff','住院','出院','轉入','轉出','病危','死亡'],19),
('BR',10,'special',array['staff','住院','出院','轉入','轉出','病危','死亡'],20),
('NBC',10,'special',array['staff','住院','出院','轉入','轉出','病危','死亡'],21),
('燙傷中心',4,'special',array['staff','住院','出院','轉入','轉出','病危','死亡'],22),
('急診',33,'emergency',array['staff','visits','referralIn','referralOut','admitted','observation','deaths','surgeries'],23),
('產房',6,'delivery',array['staff','visits','observation','waiting','cesarean','naturalBirth','drSurgery'],24),
('手術室',11,'operatingRoom',array['staff','inCount','outCount'],25),
('護理之家',39,'nursingHome',array['nurseStaff','aideStaff','staff','residents','occupiedBeds','reserved','admitted','discharged'],26),
('洗腎室',61,'dialysis',array['staff','hemodialysisOutpatient','hemodialysisInpatient','hemodialysisCritical','peritonealDialysis'],27);

-- 既有環境：將整份貼進 SQL Editor 執行，可重跑。
-- 新安裝已包含此更新。申請單位與填報單位分開，28 個填報單位及原 DEMO 保持原值。

create table if not exists nrop.application_units (
  id text primary key,
  report_unit_id text references nrop.units(id),
  sort_order integer not null
);
alter table nrop.application_units enable row level security;
revoke all on table nrop.application_units from public, anon, authenticated;
insert into nrop.application_units(id,report_unit_id,sort_order)
select id,id,sort_order from nrop.units on conflict do nothing;
insert into nrop.application_units(id,report_unit_id,sort_order)
values('護理部',null,-1) on conflict do nothing;

alter table nrop.members drop constraint if exists members_requested_unit_fkey;
alter table nrop.members add constraint members_requested_unit_fkey
 foreign key(requested_unit) references nrop.application_units(id);
-- 行政單位的待審核申請可以沒有填報單位；啟用的平台使用者必須有實際填報單位。
alter table nrop.members drop constraint if exists members_check;
alter table nrop.members drop constraint if exists members_active_unit_required;
alter table nrop.members add constraint members_active_unit_required
 check(status<>'active' or role<>'unit' or unit_id is not null);

create or replace function public.nrop_public_config() returns jsonb
language sql stable security definer set search_path = '' as $$
select jsonb_build_object('registrationOpen',s.registration_open,'liveStartDate',s.live_start_date,
 'demoStartDate',s.demo_start_date,'demoLatestDate',(select max(report_date) from nrop.records where dataset='demo'),
 'units',(select jsonb_agg(jsonb_build_object('id',id,'beds',beds,'type',kind) order by sort_order) from nrop.units),
 'applicationUnits',(select jsonb_agg(jsonb_build_object('id',id,'reportUnit',report_unit_id) order by sort_order,id) from nrop.application_units))
from nrop.settings s
$$;

create or replace function public.nrop_request_access(p_name text,p_unit text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare requested nrop.application_units;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
  raise exception '請先驗證 Email 並登入' using errcode='42501';
 end if;
 if exists(select 1 from nrop.members where user_id=auth.uid()) then return public.nrop_current_account(); end if;
 if not (select registration_open from nrop.settings) then raise exception '目前未開放新帳號申請' using errcode='42501'; end if;
 select * into requested from nrop.application_units where id=p_unit;
 if requested.id is null then raise exception '申請單位不存在'; end if;
 -- 申請護理部仍為待審核，不能由申請資料自行取得管理者權限。
 insert into nrop.members(user_id,display_name,unit_id,requested_unit)
 values(auth.uid(),btrim(p_name),requested.report_unit_id,requested.id);
 insert into nrop.audit_log(actor_id,action,target) values(auth.uid(),'account.request',auth.uid()::text);
 return public.nrop_current_account();
end $$;

revoke all on function public.nrop_public_config() from public, anon, authenticated;
revoke all on function public.nrop_request_access(text,text) from public, anon, authenticated;
grant execute on function public.nrop_public_config() to anon,authenticated;
grant execute on function public.nrop_request_access(text,text) to authenticated;
notify pgrst,'reload schema';

-- 既有環境先執行 005；或一次貼上 UPGRADE_005_006.sql。
-- NROP 使用資格只由管理者核准。此 SQL 不會更改 Supabase Auth 的全域寄信設定。

create or replace function nrop.actor() returns nrop.members
language plpgsql security definer set search_path = '' as $$
declare m nrop.members;
begin
 select * into m from nrop.members where user_id=auth.uid() and status='active';
 if m.user_id is null then raise exception '帳號尚未經管理者啟用，或已停用' using errcode='42501'; end if;
 return m;
end $$;

create or replace function public.nrop_request_access(p_name text,p_unit text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare requested nrop.application_units;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid()) then
  raise exception '請先登入並送出申請' using errcode='42501';
 end if;
 if exists(select 1 from nrop.members where user_id=auth.uid()) then return public.nrop_current_account(); end if;
 if not (select registration_open from nrop.settings) then raise exception '目前未開放新帳號申請' using errcode='42501'; end if;
 select * into requested from nrop.application_units where id=p_unit;
 if requested.id is null then raise exception '申請單位不存在'; end if;
 insert into nrop.members(user_id,display_name,unit_id,requested_unit)
 values(auth.uid(),btrim(p_name),requested.report_unit_id,requested.id);
 insert into nrop.audit_log(actor_id,action,target) values(auth.uid(),'account.request',auth.uid()::text);
 return public.nrop_current_account();
end $$;
revoke all on function nrop.actor() from public,anon,authenticated;
revoke all on function public.nrop_request_access(text,text) from public,anon,authenticated;
grant execute on function public.nrop_request_access(text,text) to authenticated;
notify pgrst,'reload schema';

-- 單一資料區：將既有範例與填報整併；不刪除或覆蓋既有填報。
-- 可重跑；遇到日期／班別／單位或期初人數衝突，整筆交易回滾。
-- 請先備份，並在暫停填報時於 SQL Editor 執行。005／006 尚未更新者使用 UPGRADE_005_007.sql。

lock table nrop.records, nrop.opening_balances in access exclusive mode;
do $$
begin
 if exists(select 1 from nrop.records d join nrop.records l
  on l.dataset='live' and d.report_date=l.report_date and d.shift=l.shift and d.unit_id=l.unit_id
  where d.dataset='demo') then
  raise exception '整併停止：相同日期、班別、單位已有兩筆紀錄，請先人工比對；尚未修改資料';
 end if;
 if exists(select 1 from nrop.opening_balances d join nrop.opening_balances l
  on l.dataset='live' and d.unit_id=l.unit_id where d.dataset='demo') then
  raise exception '整併停止：同一單位已有兩組期初人數，請先人工比對；尚未修改資料';
 end if;
end $$;
alter table nrop.records add column if not exists is_sample boolean not null default false;
alter table nrop.opening_balances add column if not exists is_sample boolean not null default false;
with moved as (
 update nrop.records set dataset='live',is_sample=true where dataset='demo' returning unit_id
)
insert into nrop.audit_log(action,target,after_data)
select 'data.unify','nrop.records',jsonb_build_object('movedRecords',count(*)) from moved having count(*)>0;
update nrop.opening_balances set dataset='live',is_sample=true where dataset='demo';
alter table nrop.records drop constraint if exists records_dataset_check;
alter table nrop.records add constraint records_dataset_check check(dataset='live');
alter table nrop.opening_balances drop constraint if exists opening_balances_dataset_check;
alter table nrop.opening_balances add constraint opening_balances_dataset_check check(dataset='live');

create or replace function nrop.record_json(r nrop.records) returns jsonb
language sql stable set search_path = '' as $$
select r.payload || jsonb_build_object('status',r.status,'patients',r.patients,
 'opening',r.opening_patients,'version',r.version,'updatedAt',r.updated_at,'baselineReady',r.is_sample)
$$;

create or replace function public.nrop_public_config() returns jsonb
language sql stable security definer set search_path = '' as $$
select jsonb_build_object('registrationOpen',s.registration_open,'dataArea','shared',
 'recordStartDate',coalesce((select min(report_date) from nrop.records),s.live_start_date),
 'latestRecordDate',(select max(report_date) from nrop.records),
 'units',(select jsonb_agg(jsonb_build_object('id',id,'beds',beds,'type',kind) order by sort_order) from nrop.units),
 'applicationUnits',(select jsonb_agg(jsonb_build_object('id',id,'reportUnit',report_unit_id) order by sort_order,id) from nrop.application_units))
from nrop.settings s
$$;

create or replace function public.nrop_list_records(p_dataset text,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m nrop.members;
begin
 m:=nrop.actor();
 if p_dataset is distinct from 'live' then raise exception '資料已整併為同一資料區，請更新網站後重新整理'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception '查詢範圍須在 367 天以內'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('date',r.report_date,'shift',r.shift,'unit',r.unit_id,
  'record',nrop.record_json(r)) order by r.report_date,nrop.order_of_shift(r.shift),r.unit_id)
 from nrop.records r where r.dataset=p_dataset and r.report_date between p_from and p_to
 and (m.role in ('admin','sysadmin') or r.unit_id=m.unit_id)),'[]'::jsonb);
end $$;

create or replace function public.nrop_list_openings(p_dataset text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m nrop.members;
begin
 m:=nrop.actor();
 if p_dataset is distinct from 'live' then raise exception '資料已整併為同一資料區，請更新網站後重新整理'; end if;
 return coalesce((select jsonb_agg(to_jsonb(o)-'updated_by') from nrop.opening_balances o
 where o.dataset=p_dataset and (m.role in ('admin','sysadmin') or o.unit_id=m.unit_id)),'[]'::jsonb);
end $$;

create or replace function public.nrop_set_opening(p_dataset text,p_unit text,p_date date,p_shift text,p_patients integer) returns void
language plpgsql security definer set search_path = '' as $$
declare m nrop.members;
begin
 m:=nrop.actor();
 if p_dataset is distinct from 'live' then raise exception '資料已整併為同一資料區，請更新網站後重新整理'; end if; if m.role not in ('admin','sysadmin') then raise exception '期初人數由管理者設定' using errcode='42501'; end if;
 if p_shift not in ('N','D','E') or p_date is null or p_patients is null or p_patients<0 then raise exception '期初資料格式錯誤'; end if;
 if not exists(select 1 from nrop.units where id=p_unit and kind in ('ward','special')) then raise exception '僅住院單位需要期初人數'; end if;
 perform pg_advisory_xact_lock(hashtext(p_dataset),hashtext(p_unit));
 if exists(select 1 from nrop.records where dataset=p_dataset and unit_id=p_unit) then
   raise exception '已有紀錄，請先由管理者檢視歷史資料；不可用期初設定覆蓋既有統計';
 end if;
 insert into nrop.opening_balances(dataset,unit_id,report_date,shift,patients,updated_by)
 values(p_dataset,p_unit,p_date,p_shift,p_patients,m.user_id)
 on conflict(dataset,unit_id) do update set report_date=excluded.report_date,shift=excluded.shift,
 patients=excluded.patients,updated_by=excluded.updated_by,updated_at=now();
 insert into nrop.audit_log(actor_id,action,target,after_data) values(m.user_id,'opening.set',p_dataset||'|'||p_unit,
 jsonb_build_object('date',p_date,'shift',p_shift,'patients',p_patients));
end $$;

-- 值由資料庫驗證及重算；不相信瀏覽器傳入的 patients、staff 合計、版本或權限。
create or replace function public.nrop_save_record(p_dataset text,p_date date,p_shift text,p_unit text,p_payload jsonb,p_status text,p_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 m nrop.members; u nrop.units; old nrop.records; saved nrop.records; prior nrop.records; later nrop.records;
 clean jsonb:='{}'; field text; val numeric; admission integer; base integer:=0; closing integer;
 prev_date date; prev_shift text; ready boolean:=false; last_date date; last_shift text; last_patients integer;
 changed jsonb; opening nrop.opening_balances;
begin
 m:=nrop.actor();
 if p_dataset is distinct from 'live' then raise exception '資料已整併為同一資料區，請更新網站後重新整理'; end if;
 if m.role='unit' and m.unit_id<>p_unit then raise exception '無權填報其他單位' using errcode='42501'; end if;
 if p_date is null or p_date>(now() at time zone 'Asia/Taipei')::date
   or p_shift is null or p_shift not in ('N','D','E') or p_status is null or p_status not in ('draft','submitted')
   or p_payload is null or jsonb_typeof(p_payload)<>'object' or p_version is null or p_version<0 then raise exception '填報格式或日期錯誤'; end if;
 select * into u from nrop.units where id=p_unit; if u.id is null then raise exception '單位不存在'; end if;
 perform pg_advisory_xact_lock(hashtext(p_dataset),hashtext(p_unit));
 select * into old from nrop.records where dataset=p_dataset and report_date=p_date and shift=p_shift and unit_id=p_unit for update;
 if coalesce(old.version,0)<>p_version then raise exception '資料已被其他人修改，請重新載入後再儲存' using errcode='40001'; end if;
 if old.status='submitted' and p_status='draft' and exists(select 1 from nrop.records where dataset=p_dataset and unit_id=p_unit and status='submitted'
   and (report_date>p_date or (report_date=p_date and nrop.order_of_shift(shift)>nrop.order_of_shift(p_shift)))) then
   raise exception '後續已有正式送出紀錄，請直接修正並正式送出，避免破壞後班基準';
 end if;
 foreach field in array u.fields loop
   if u.kind='nursingHome' and field='staff' then continue; end if;
   if not (p_payload ? field) or p_payload->field='null'::jsonb then raise exception '缺少必填欄位：%',field; end if;
   if jsonb_typeof(p_payload->field)<>'number' then raise exception '欄位必須是數字：%',field; end if;
   val:=(p_payload->>field)::numeric;
   if val<0 or val>100000 or val<>round(val,case when field in ('staff','nurseStaff','aideStaff') then 3 else 0 end) then
     raise exception '欄位數字超出範圍或小數位數錯誤：%',field;
   end if;
   clean:=clean||jsonb_build_object(field,val);
 end loop;
 if u.kind='nursingHome' then
  clean:=clean||jsonb_build_object('staff',(clean->>'nurseStaff')::numeric+(clean->>'aideStaff')::numeric);
 end if;
 if u.kind in ('ward','special') then
  if p_unit in ('6A','6B') then admission:=(clean->>'住院本科')::integer+(clean->>'住院非本科')::integer;
  elsif p_unit in ('12B','ICU-3') then admission:=(clean->>'住院一般病房')::integer+(clean->>'住院負壓隔離')::integer;
  else admission:=(clean->>'住院')::integer; end if;
  clean:=clean||jsonb_build_object('住院',admission);
  prev_date:=case when p_shift='N' then p_date-1 else p_date end;
  prev_shift:=case p_shift when 'N' then 'E' when 'D' then 'N' else 'D' end;
  select * into prior from nrop.records where dataset=p_dataset and report_date=prev_date and shift=prev_shift and unit_id=p_unit;
  if prior.unit_id is not null then base:=prior.patients; ready:=prior.status='submitted';
  else
   select * into opening from nrop.opening_balances where dataset=p_dataset and unit_id=p_unit and report_date=p_date and shift=p_shift;
   if opening.unit_id is not null then base:=opening.patients; ready:=true;
   elsif old.unit_id is not null then base:=old.opening_patients; ready:=old.is_sample; end if;
  end if;
  if p_status='submitted' and not ready then raise exception '前一班尚未完成，請先暫存；第一班請管理者設定期初人數'; end if;
  closing:=base+admission-(clean->>'出院')::integer+(clean->>'轉入')::integer-(clean->>'轉出')::integer-(clean->>'死亡')::integer;
  if closing<0 then raise exception '住院人數不可為負，請確認期初人數與異動'; end if;
 end if;
 insert into nrop.records(dataset,report_date,shift,unit_id,payload,status,opening_patients,patients,version,updated_by)
 values(p_dataset,p_date,p_shift,p_unit,clean,p_status,base,closing,coalesce(old.version,0)+1,m.user_id)
 on conflict(dataset,report_date,shift,unit_id) do update set payload=excluded.payload,status=excluded.status,
 opening_patients=excluded.opening_patients,patients=excluded.patients,version=excluded.version,updated_by=excluded.updated_by,updated_at=now()
 returning * into saved;
 insert into nrop.audit_log(actor_id,action,target,before_data,after_data)
 values(m.user_id,'record.save',p_dataset||'|'||p_date||'|'||p_shift||'|'||p_unit,to_jsonb(old),to_jsonb(saved));
 if u.kind in ('ward','special') then
  last_date:=p_date; last_shift:=p_shift; last_patients:=closing;
  for later in select * from nrop.records where dataset=p_dataset and unit_id=p_unit
    and (report_date>p_date or (report_date=p_date and nrop.order_of_shift(shift)>nrop.order_of_shift(p_shift)))
    order by report_date,nrop.order_of_shift(shift) for update loop
    -- 只傳遞到連續下一班；缺班後的資料不假設前班為零。
    prev_date:=case when later.shift='N' then later.report_date-1 else later.report_date end;
    prev_shift:=case later.shift when 'N' then 'E' when 'D' then 'N' else 'D' end;
    if prev_date<>last_date or prev_shift<>last_shift then exit; end if;
    closing:=last_patients+coalesce((later.payload->>'住院')::integer,0)-coalesce((later.payload->>'出院')::integer,0)
      +coalesce((later.payload->>'轉入')::integer,0)-coalesce((later.payload->>'轉出')::integer,0)-coalesce((later.payload->>'死亡')::integer,0);
    if closing<0 then raise exception '修改後會造成後續班別住院人數為負，請先檢查後續資料'; end if;
    if later.opening_patients<>last_patients or later.patients<>closing then
      update nrop.records set opening_patients=last_patients,patients=closing,version=version+1,updated_by=m.user_id,updated_at=now()
        where dataset=p_dataset and report_date=later.report_date and shift=later.shift and unit_id=p_unit returning to_jsonb(records.*) into changed;
      insert into nrop.audit_log(actor_id,action,target,before_data,after_data)
      values(m.user_id,'record.recalculate',p_dataset||'|'||later.report_date||'|'||later.shift||'|'||p_unit,to_jsonb(later),changed);
    end if;
    last_date:=later.report_date; last_shift:=later.shift; last_patients:=closing;
  end loop;
 end if;
 return nrop.record_json(saved);
end $$;

notify pgrst,'reload schema';

-- 先安裝 005–007；本檔可重跑，不重寫既有填報或 Auth 帳號。

alter table nrop.units add column if not exists bed_version integer not null default 1;
create table if not exists nrop.bed_capacities (
 unit_id text not null references nrop.units(id),
 effective_date date not null check(effective_date between '2000-01-01' and '2100-12-31'),
 beds integer not null check(beds between 0 and 9999),
 updated_by uuid,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(unit_id,effective_date)
);
-- 原床數成為歷史基準；日後重新執行不覆蓋已存在的設定。
insert into nrop.bed_capacities(unit_id,effective_date,beds)
select id,'2000-01-01',beds from nrop.units on conflict do nothing;
create table if not exists nrop.bed_change_requests (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null,
 source_session uuid not null,
 unit_id text not null references nrop.units(id),
 effective_date date not null,
 old_beds integer not null,
 new_beds integer not null check(new_beds between 0 and 9999),
 unit_version integer not null,
 reason text not null default '' check(length(reason)<=400),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '5 minutes',
 confirmed_at timestamptz,
 confirmed_session uuid unique
);
alter table nrop.bed_capacities enable row level security;
alter table nrop.bed_change_requests enable row level security;
revoke all on nrop.bed_capacities,nrop.bed_change_requests from public,anon,authenticated;

create or replace function nrop.beds_at(p_unit text,p_date date) returns integer
language sql stable set search_path='' as $$
 select beds from nrop.bed_capacities where unit_id=p_unit and effective_date<=p_date order by effective_date desc limit 1
$$;

create or replace function public.nrop_list_bed_capacities(p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare m nrop.members;
begin
 m:=nrop.actor();
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception '床數查詢範圍須在 367 天以內'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('unit',b.unit_id,'effectiveDate',b.effective_date,'beds',b.beds) order by b.unit_id,b.effective_date)
 from nrop.bed_capacities b where b.effective_date<=p_to and
 (b.effective_date>=p_from or b.effective_date=(select max(x.effective_date) from nrop.bed_capacities x where x.unit_id=b.unit_id and x.effective_date<p_from))
 and (m.role in ('admin','sysadmin') or b.unit_id=m.unit_id)),'[]'::jsonb);
end $$;

create or replace function public.nrop_admin_bed_settings() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare m nrop.members; d date:=(now() at time zone 'Asia/Taipei')::date;
begin
 m:=nrop.actor(); if m.role<>'sysadmin' then raise exception '僅系統管理者可管理床數' using errcode='42501'; end if;
 return jsonb_build_object('today',d,'units',(select jsonb_agg(jsonb_build_object('id',u.id,'type',u.kind,'version',u.bed_version,
 'beds',nrop.beds_at(u.id,d),'periods',(select jsonb_agg(jsonb_build_object('effectiveDate',b.effective_date,'beds',b.beds,'updatedAt',b.updated_at) order by b.effective_date) from nrop.bed_capacities b where b.unit_id=u.id)) order by u.sort_order) from nrop.units u),
 'history',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'unit',a.target,'before',a.before_data,'after',a.after_data,'createdAt',a.created_at,'actor',coalesce(m2.display_name,'原管理者')) order by a.id desc)
 from (select * from nrop.audit_log where action='beds.update' order by id desc limit 100) a left join nrop.members m2 on m2.user_id=a.actor_id),'[]'::jsonb));
end $$;

create or replace function public.nrop_prepare_bed_change(p_unit text,p_date date,p_beds integer,p_version integer,p_reason text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare m nrop.members; u nrop.units; r nrop.bed_change_requests; claims jsonb; sid uuid;
begin
 perform pg_advisory_xact_lock(17931,1);
 m:=nrop.actor(); if m.role<>'sysadmin' then raise exception '僅系統管理者可管理床數' using errcode='42501'; end if;
 claims:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 sid:=nullif(claims->>'session_id','')::uuid;
 if sid is null or not exists(select 1 from auth.sessions where id=sid and user_id=m.user_id) then
  raise exception '無法確認原登入工作階段，請重新登入' using errcode='42501';
 end if;
 if p_date is null or p_date<(clock_timestamp() at time zone 'Asia/Taipei')::date or p_date>'2100-12-31' then raise exception '生效日期僅能選今天或未來，歷史日期不可修改'; end if;
 if p_beds is null or p_beds<0 or p_beds>9999 then raise exception '床數須為 0 到 9999 的整數'; end if;
 if p_reason is null or length(p_reason)>400 then raise exception '調整原因最多 400 字'; end if;
 select * into u from nrop.units where id=p_unit for update;
 if u.id is null then raise exception '找不到填報單位'; end if;
 if u.bed_version is distinct from p_version then raise exception '床數設定已被其他管理者修改，請重新整理後再確認' using errcode='40001'; end if;
 if nrop.beds_at(p_unit,p_date)=p_beds then raise exception '新床數與該生效日期原床數相同，無須變更'; end if;
 -- 每位管理者僅保留一筆未完成確認；已完成紀錄保留以防重用驗證工作階段。
 delete from nrop.bed_change_requests where actor_id=m.user_id and confirmed_at is null;
 insert into nrop.bed_change_requests(actor_id,source_session,unit_id,effective_date,old_beds,new_beds,unit_version,reason)
 values(m.user_id,sid,p_unit,p_date,nrop.beds_at(p_unit,p_date),p_beds,p_version,btrim(p_reason)) returning * into r;
 return jsonb_build_object('requestId',r.id,'unit',r.unit_id,'effectiveDate',r.effective_date,'oldBeds',r.old_beds,'newBeds',r.new_beds,'reason',r.reason,'expiresAt',r.expires_at);
end $$;

create or replace function public.nrop_confirm_bed_change(p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m nrop.members; r nrop.bed_change_requests; u nrop.units; claims jsonb; sid uuid; stamp timestamptz:=clock_timestamp();
begin
 perform pg_advisory_xact_lock(17931,1);
 m:=nrop.actor(); if m.role<>'sysadmin' then raise exception '僅系統管理者可管理床數' using errcode='42501'; end if;
 select * into r from nrop.bed_change_requests where id=p_request for update;
 if r.id is null or r.actor_id<>m.user_id then raise exception '無效的床數確認請求' using errcode='42501'; end if;
 claims:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 sid:=nullif(claims->>'session_id','')::uuid;
 if sid is null or sid=r.source_session or jsonb_typeof(claims->'amr') is distinct from 'array' then
  raise exception '請重新輸入目前系統管理者的帳號密碼確認' using errcode='42501';
 end if;
 -- JWT 已由 API 驗章；同時檢查 Auth 真實工作階段，刷新舊 token 不能替代重新輸入密碼。
 if not exists(select 1 from jsonb_array_elements(claims->'amr') a where a->>'method'='password') or
 not exists(select 1 from auth.sessions s where s.id=sid and s.user_id=m.user_id and s.created_at>=r.created_at and (s.not_after is null or s.not_after>stamp)) then
  raise exception '密碼驗證無效，請重新輸入帳號密碼確認' using errcode='42501';
 end if;
 if r.confirmed_at is not null then
  if r.confirmed_session<>sid then raise exception '此確認請求已完成，請重新整理' using errcode='42501'; end if;
  return jsonb_build_object('unit',r.unit_id,'effectiveDate',r.effective_date,'beds',r.new_beds,'confirmedAt',r.confirmed_at);
 end if;
 if r.expires_at<=stamp then raise exception '確認已逾時，請重新核對調整內容'; end if;
 if r.effective_date<(stamp at time zone 'Asia/Taipei')::date then raise exception '生效日期已成為歷史日期，請重新設定'; end if;
 if exists(select 1 from nrop.bed_change_requests where confirmed_session=sid) then raise exception '每次床數調整都必須重新輸入帳號密碼' using errcode='42501'; end if;
 select * into u from nrop.units where id=r.unit_id for update;
 if u.bed_version<>r.unit_version then raise exception '床數設定已被其他管理者修改，請重新整理後再確認' using errcode='40001'; end if;
 insert into nrop.bed_capacities(unit_id,effective_date,beds,updated_by,created_at,updated_at)
 values(r.unit_id,r.effective_date,r.new_beds,m.user_id,stamp,stamp)
 on conflict(unit_id,effective_date) do update set beds=excluded.beds,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 update nrop.units set bed_version=bed_version+1 where id=r.unit_id;
 update nrop.bed_change_requests set confirmed_at=stamp,confirmed_session=sid where id=r.id;
 insert into nrop.audit_log(actor_id,action,target,before_data,after_data,created_at)
 values(m.user_id,'beds.update',r.unit_id,jsonb_build_object('beds',r.old_beds,'effectiveDate',r.effective_date),
 jsonb_build_object('beds',r.new_beds,'effectiveDate',r.effective_date,'reason',r.reason,'confirmedAt',stamp),stamp);
 return jsonb_build_object('unit',r.unit_id,'effectiveDate',r.effective_date,'beds',r.new_beds,'confirmedAt',stamp);
end $$;

create or replace function public.nrop_public_config() returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object('registrationOpen',s.registration_open,'dataArea','shared','bedCapacityManagement',true,
 'recordStartDate',coalesce((select min(report_date) from nrop.records),s.live_start_date),
 'latestRecordDate',(select max(report_date) from nrop.records),
 'units',(select jsonb_agg(jsonb_build_object('id',id,'beds',nrop.beds_at(id,(now() at time zone 'Asia/Taipei')::date),'type',kind) order by sort_order) from nrop.units),
 'applicationUnits',(select jsonb_agg(jsonb_build_object('id',id,'reportUnit',report_unit_id) order by sort_order,id) from nrop.application_units))
from nrop.settings s
$$;
revoke all on function nrop.beds_at(text,date) from public,anon,authenticated;
revoke all on function public.nrop_list_bed_capacities(date,date),public.nrop_admin_bed_settings(),public.nrop_prepare_bed_change(text,date,integer,integer,text),public.nrop_confirm_bed_change(uuid) from public,anon,authenticated;
grant execute on function public.nrop_list_bed_capacities(date,date),public.nrop_admin_bed_settings(),public.nrop_prepare_bed_change(text,date,integer,integer,text),public.nrop_confirm_bed_change(uuid) to authenticated;
-- CREATE OR REPLACE 保留 public_config 既有 anon / authenticated EXECUTE。
notify pgrst,'reload schema';

-- 範例與填報共用同一資料區；is_sample 僅保留來源，方便正式啟用前清除。
-- 重跑不覆蓋任何既有紀錄，包括人工填報。
-- 將原前端 2026-08-01 起的演算法搬到資料庫，固定匯入截至 2026-10-25 的快照。

do $$
declare
 u nrop.units; d date; s text; si integer; ui integer; day_index integer;
 patients integer; before_count integer; admitted integer; discharged integer; tin integer; tout integer; deaths integer;
 next_count integer; staff integer; lo integer; hi integer; body jsonb; record_status text;
begin
 for u in select * from nrop.units order by sort_order loop
  ui:=u.sort_order;
  patients:=greatest(1,round(u.beds*(0.58+(ui%5)*0.025))::integer);
  for d in select generate_series('2026-08-01'::date,'2026-10-25'::date,'1 day'::interval)::date loop
   day_index:=d-'2026-08-01'::date;
   for si in 0..2 loop
    s:=(array['N','D','E'])[si+1]; body:='{}'; record_status:='submitted'; before_count:=patients;
    if u.kind in ('ward','special') then
     admitted:=case when (ui+day_index+si*2)%9=0 then 1 else 0 end;
     discharged:=case when (ui*2+day_index+si)%11=0 then 1 else 0 end;
     tin:=case when (ui+day_index+si)%17=0 then 1 else 0 end;
     tout:=case when (ui*3+day_index+si)%19=0 then 1 else 0 end;
     deaths:=case when (ui+day_index*3+si)%127=0 then 1 else 0 end;
     lo:=greatest(0,floor(u.beds*0.48)::integer); hi:=greatest(1,floor(u.beds*0.78)::integer);
     next_count:=patients+admitted-discharged+tin-tout-deaths;
     if next_count<lo then discharged:=0;tout:=0;deaths:=0;next_count:=patients+admitted+tin; end if;
     if next_count>hi then admitted:=0;tin:=0;next_count:=patients-discharged-tout-deaths; end if;
     patients:=next_count;
     staff:=greatest(1,round(u.beds/(case s when 'D' then 9.0 when 'E' then 12.0 else 14.0 end))::integer+(ui+si)%2);
     body:=jsonb_build_object('staff',staff,'住院',admitted,'出院',discharged,'轉入',tin,'轉出',tout,
       '死亡',deaths,'病危',case when (ui*3+day_index+si)%71=0 then 1 else 0 end);
     -- 舊 DEMO 未分本科／隔離分類，保留合計；不虛構各分類。
     if d='2026-08-12' and s='E' and u.id='8B' then record_status:='draft'; end if;
     if d='2026-08-19' and s='N' and u.id='ICU-2' then record_status:='draft';body:=body||'{"staff":null}'::jsonb; end if;
     if d='2026-09-01' and s='E' and u.id='9A' then record_status:='empty'; end if;
    else
     body:=jsonb_build_object('staff',greatest(1,round(u.beds/(case s when 'D' then 10.0 else 14.0 end))::integer));
     if u.kind='emergency' then body:=body||jsonb_build_object('visits',12+(day_index*3+si*5)%15,
       'referralIn',case when (day_index+si)%7=0 then 1 else 0 end,'referralOut',case when (day_index+si)%9=0 then 1 else 0 end,
       'admitted',2+(day_index+si)%4,'observation',8+(day_index*2+si)%9,
       'deaths',case when (day_index+si)%43=0 then 1 else 0 end,'surgeries',case when (day_index+si)%6=0 then 1 else 0 end);
     elsif u.kind='delivery' then body:=body||jsonb_build_object('visits',1+(day_index+si)%4,'observation',(day_index+si)%3,
       'waiting',(day_index*2+si)%3,'cesarean',case when (day_index+si)%5=0 then 1 else 0 end,
       'naturalBirth',case when (day_index+si)%4=0 then 1 else 0 end,'drSurgery',case when (day_index+si)%5=0 then 1 else 0 end);
     elsif u.kind='operatingRoom' then body:=body||jsonb_build_object('inCount',case s when 'D' then 10+day_index%7 when 'E' then 3+day_index%4 else day_index%3 end,
       'outCount',case s when 'D' then 10+day_index%7 when 'E' then 3+day_index%4 else day_index%3 end);
     elsif u.kind='nursingHome' then body:=body||jsonb_build_object('residents',31,'occupiedBeds',31,'reserved',6,
       'admitted',case when (day_index+si)%29=0 then 1 else 0 end,'discharged',case when (day_index+si)%31=0 then 1 else 0 end);
     elsif u.kind='dialysis' then body:=body||jsonb_build_object('hemodialysisOutpatient',case s when 'D' then 25+day_index%8 when 'E' then 16+day_index%7 else 0 end,
       'hemodialysisInpatient',case s when 'D' then 3+day_index%3 when 'E' then 1+day_index%2 else 0 end,
       'hemodialysisCritical',0,'peritonealDialysis',(day_index+si)%5);
     end if;
    end if;
    insert into nrop.records(dataset,is_sample,report_date,shift,unit_id,payload,status,opening_patients,patients,updated_at)
    values('live',true,d,s,u.id,body,record_status,case when u.kind in ('ward','special') then before_count else 0 end,
      case when u.kind in ('ward','special') then patients else null end,
      (d::text||' '||case s when 'N' then '07:45' when 'D' then '15:45' else '23:45' end||':00+08')::timestamptz)
    on conflict do nothing;
   end loop;
  end loop;
 end loop;
end $$;

-- 初次應有 28 單位 × 86 日 × 3 班 = 7,224 筆範例，與後續填報一起查詢。
select count(*) as record_count,count(*) filter(where is_sample) as sample_count,min(report_date) as first_date,max(report_date) as last_date from nrop.records;

commit;
