-- 既有環境先執行 005；或一次貼上 UPGRADE_005_006.sql。
-- NROP 使用資格只由管理者核准。此 SQL 不會更改 Supabase Auth 的全域寄信設定。
begin;
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
