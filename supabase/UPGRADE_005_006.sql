-- 已安裝的資料庫只需執行此檔；護理部申請與管理者審核流程，可重跑。
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

commit;
