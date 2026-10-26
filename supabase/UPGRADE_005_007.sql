-- 現有環境執行此檔：護理部、人工審核及單一資料區。先備份並暫停填報；可重跑，衝突時回滾。
begin;
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

commit;
