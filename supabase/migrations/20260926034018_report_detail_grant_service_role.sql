-- `drop view` ở migration report_detail_group_by_code làm mất luôn grant cũ
-- của service_role (3 view report_* còn lại vẫn có SELECT). Apps Script dùng
-- service_role key để xuất báo cáo nên phải cấp lại, nếu không sẽ nhận
-- HTTP 401/permission denied khi gọi PostgREST.

grant select on public.report_daily_member_detail to service_role;
