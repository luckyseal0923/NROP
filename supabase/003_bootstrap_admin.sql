-- 先在網站送出帳號申請。只需改下面的 Email；請勿填寫密碼。
-- 首位系統管理者需要資料庫擁有者指定，網站不能自行提權。
begin;
do $$
declare target_email text := '請改成你的Email@example.org'; target_id uuid;
begin
 perform pg_advisory_xact_lock(17931,1);
 if exists(select 1 from nrop.members where role='sysadmin' and status='active') then
   raise exception '已有系統管理者，請改由網站的帳號管理頁籤授權';
 end if;
 select id into target_id from auth.users where lower(email)=lower(target_email);
 if target_id is null then raise exception '找不到帳號，請先完成註冊與送出申請'; end if;
 insert into nrop.members(user_id,display_name,role,status,unit_id,requested_unit)
 values(target_id,'系統管理者','sysadmin','active',null,'6A')
 on conflict(user_id) do update set role='sysadmin',status='active',unit_id=null,version=members.version+1,updated_at=now();
 insert into nrop.audit_log(actor_id,action,target) values(target_id,'account.bootstrap',target_id::text);
end $$;
commit;
