-- SQL Editor 只讀核對，不修改床數或帳號。
select public.nrop_public_config()->>'bedCapacityManagement' as bed_management_enabled;
select count(*) filter(where effective_date='2000-01-01') as initial_units,count(*) as total_periods from nrop.bed_capacities;
select has_table_privilege('authenticated','nrop.bed_capacities','update') as browser_can_update_beds,
 has_table_privilege('authenticated','nrop.bed_change_requests','select') as browser_can_read_confirmation_requests;
select count(*)=4 as auth_session_columns_ready from information_schema.columns
where table_schema='auth' and table_name='sessions' and column_name in ('id','user_id','created_at','not_after');
select unit_id,effective_date,beds,created_at,updated_at from nrop.bed_capacities order by unit_id,effective_date;
