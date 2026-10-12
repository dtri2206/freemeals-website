-- report_daily_member_detail: gom nhóm theo CODE, hiển thị TÊN HIỆN TẠI.
--
-- Vấn đề đang sửa: view cũ group by cả member_name/location_name, mà
-- meal_log lưu tên dạng snapshot tại thời điểm quét. Khi tab `Thành Viên`
-- đổi tên một khách (thực tế: kh_0002 "Nguyễn Đức Trí" -> "Admin QBS" lúc
-- 11/09/2026 14:36), cùng một người, cùng một ngày, cùng một quán bị tách
-- thành 2 dòng trên dashboard -- trông như hai người khác nhau.
--
-- Cách sửa: gom nhóm theo member_code/location_code; tên hiển thị lấy từ
-- members/locations (tên hiện tại). Đánh đổi có ý thức: bảng chi tiết hiện
-- tên hiện tại chứ không phải tên lúc ăn -- đúng thứ nhân viên quỹ cần khi
-- đối chiếu với danh sách Thành Viên hôm nay. Snapshot cũ vẫn còn nguyên
-- trong meal_log.member_name / location_name nếu cần truy vết.
--
-- Vẫn tách dòng khi một khách ăn ở NHIỀU QUÁN trong cùng ngày -- đó là cố ý,
-- báo cáo cần biết suất ăn thuộc quán nào.
--
-- Thêm visits / first_check_in / last_check_in: check_in_times là chuỗi text
-- đã nối, Data Studio không sort/filter/tính toán theo thời gian trên cột đó
-- được. Ba cột mới cho phép làm việc đó mà vẫn giữ cột text để đọc bằng mắt.

drop view if exists public.report_daily_member_detail;

create view public.report_daily_member_detail as
select
  (m.created_at at time zone 'Asia/Ho_Chi_Minh')::date                       as day,
  m.member_code,
  mem.name                                                                   as member_name,
  m.location_code,
  loc.name                                                                   as location_name,
  count(*)                                                                   as visits,
  sum(m.portions)                                                            as portions,
  min(m.created_at at time zone 'Asia/Ho_Chi_Minh')                          as first_check_in,
  max(m.created_at at time zone 'Asia/Ho_Chi_Minh')                          as last_check_in,
  string_agg(
    to_char(m.created_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'),
    ', ' order by m.created_at
  )                                                                          as check_in_times
from public.meal_log m
join public.members   mem on mem.code  = m.member_code
join public.locations loc on loc.code  = m.location_code
-- mem.name / loc.name phụ thuộc hàm vào khoá chính nên thêm vào group by
-- không làm tách thêm dòng nào.
group by 1, m.member_code, mem.name, m.location_code, loc.name
order by 1 desc, mem.name;

revoke all  on public.report_daily_member_detail from anon, authenticated;
grant select on public.report_daily_member_detail to fund_staff;

comment on view public.report_daily_member_detail is
  'Chi tiết "ngày đó ai ăn ở đâu" cho dashboard của quỹ. 1 dòng = 1 (ngày, khách, quán). Tên hiển thị là tên hiện tại trong members/locations, không phải snapshot lúc ăn.';
