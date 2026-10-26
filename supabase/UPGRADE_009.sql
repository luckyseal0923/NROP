-- 已完成 005–007 的環境使用此檔：依日期保留床數母數、系統管理者帳密再次確認。請先備份，可重跑。
-- 先安裝 005–007；本檔可重跑，不重寫既有填報或 Auth 帳號。
begin;

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
commit;
