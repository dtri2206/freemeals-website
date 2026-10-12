-- Hiển thị mọi timestamptz theo giờ Việt Nam (+07) thay vì UTC (+00), để
-- Table Editor / SQL Editor trên Supabase khớp với giờ trong file báo cáo.
--
-- KHÔNG sửa dữ liệu: timestamptz lưu một thời điểm tuyệt đối, "+00" hay "+07"
-- chỉ là cách hiển thị theo tham số TimeZone của phiên kết nối. Đổi tham số
-- này thì toàn bộ dòng cũ lẫn mới đều tự hiện +07. (Nếu cộng thẳng 7 tiếng vào
-- created_at thì các view/RPC -- vốn đã tự chuyển sang Asia/Ho_Chi_Minh -- sẽ
-- bị lệch 14 tiếng và hạn mức theo tháng tính sai.)
--
-- Đã rà trước khi đổi (26/09/2026): checkin, get_member_info,
-- get_member_history và mọi view report_* đều ghi rõ 'Asia/Ho_Chi_Minh' khi
-- tính ngày/tháng; rate-limit dùng now() - interval (không phụ thuộc múi giờ);
-- quet.js và edge function misaigon parse ISO kèm offset rồi format với
-- timeZone Asia/Ho_Chi_Minh. Không role nào đặt TimeZone riêng.
--
-- Chỉ áp dụng cho kết nối MỚI; kết nối đang mở trong pool giữ UTC tới khi
-- được tạo lại (vô hại vì mọi client đều đọc offset).

alter database postgres set timezone to 'Asia/Ho_Chi_Minh';
