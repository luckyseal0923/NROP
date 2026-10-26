-- 由 SQL Editor 執行，只讀檢查。
select 'unit_count' as item,count(*)::text as value from nrop.units
union all select 'total_records',count(*)::text from nrop.records
union all select 'sample_records',count(*)::text from nrop.records where is_sample
union all select 'legacy_partition_records',count(*)::text from nrop.records where dataset<>'live'
union all select 'active_system_admins',count(*)::text from nrop.members where role='sysadmin' and status='active'
union all select 'anon_can_read_records',has_table_privilege('anon','nrop.records','select')::text
union all select 'authenticated_can_write_records_directly',has_table_privilege('authenticated','nrop.records','insert')::text;
-- 首次安裝預期：28、7224、7224、0、（設定首位管理者前為 0）、false、false。
select tablename,rowsecurity from pg_tables where schemaname='nrop' order by tablename;
