# Đăng Ký Thẻ Thành Viên - Chương Trình Bữa Ăn Miễn Phí

Web app thu thập thông tin người đăng ký "Member Card", dùng cho tình nguyện viên gọi điện xác minh và cấp thẻ.

---

## 1. Cấu Trúc Dự Án

```
FreeMeals_Website/
├── index.html              # Trang web chính - form đăng ký
├── style.css                # Toàn bộ giao diện (màu xanh dương/trắng, chữ to, mobile-first)
├── script.js                 # Xử lý validate + gửi dữ liệu lên Google Sheets
├── google-apps-script.gs    # Code để dán vào Google Apps Script (KHÔNG chạy trên máy)
├── assets/
│   └── logo.png              # (Tùy chọn) Logo quỹ từ thiện - tự thêm vào
└── README.md                 # File hướng dẫn này
```

Bạn chỉ cần 3 file `index.html`, `style.css`, `script.js` để chạy website. File `.gs` chỉ để copy nội dung dán vào Google, không phải chạy trực tiếp.

---

## 2. Giải Thích Nhanh Về Code

- **index.html**: Có 3 khối chính — form đăng ký (`#registerForm`), khối "Cảm ơn" (`#successMessage`), khối "Lỗi" (`#errorMessage`). JS sẽ ẩn/hiện 3 khối này tùy trạng thái.
- **style.css**: Dùng biến màu ở đầu file (`--color-primary: #1565C0`) — nếu quỹ tài trợ có mã màu xanh riêng, chỉ cần đổi giá trị này, không cần sửa gì khác.
- **script.js**:
  - Kiểm tra dữ liệu hợp lệ (họ tên, số điện thoại 10 số bắt đầu bằng 0, ngày sinh, quán ăn) trước khi gửi.
  - Gửi dữ liệu bằng `fetch()` tới URL của Google Apps Script (biến `GOOGLE_SCRIPT_URL` ở đầu file — **bạn phải thay giá trị này**, xem Phần 3 bên dưới).
  - Hiện thông báo "Cảm ơn" nếu gửi thành công, hoặc "Có lỗi" nếu mất mạng.
  - Tự động đọc tham số `?location=...` trên URL (do mã QR mang tới) và điền tên quán ăn vào form — người dùng không cần tự chọn. Xem chi tiết cơ chế này ở Phần 5.

---

## 3. Thiết Lập Cloud Database (Google Sheets + Apps Script)

Đây là phương án **miễn phí và dễ nhất** cho người không rành kỹ thuật — không cần tạo tài khoản dịch vụ nào khác ngoài Google.

### Bước 3.1 — Tạo Google Sheet

1. Vào [sheets.google.com](https://sheets.google.com), tạo **Spreadsheet trống mới**.
2. Đặt tên file, ví dụ: `Danh Sach Dang Ky The Thanh Vien`.
3. Ở dòng đầu tiên (dòng 1), nhập tiêu đề cột theo đúng thứ tự sau — dữ liệu người dùng gửi lên sẽ tự động điền vào từ **dòng 2** trở đi, không đè lên dòng tiêu đề này:
   ```
   A1: Họ và Tên    B1: Ngày tháng năm sinh    C1: SĐT    D1: Quán ăn    E1: Trạng thái    F1: Thời gian
   ```

### Bước 3.2 — Tạo Apps Script gắn với Sheet này

1. Trong Google Sheet vừa tạo, vào menu **Tiện ích mở rộng (Extensions) → Apps Script**.
2. Trình soạn thảo Apps Script sẽ mở ra với file mặc định `Code.gs` có sẵn 1 hàm `myFunction()`. Xóa hết nội dung đó.
3. Mở file [`google-apps-script.gs`](google-apps-script.gs) trong dự án này, copy toàn bộ nội dung, dán vào trình soạn thảo Apps Script.
4. Nhấn biểu tượng **Lưu** (hình đĩa mềm) hoặc `Ctrl+S`.

### Bước 3.3 — Triển khai (Deploy) thành Web App

1. Ở góc trên bên phải, nhấn nút **Deploy (Triển khai) → New deployment (Triển khai mới)**.
2. Nhấn biểu tượng bánh răng ⚙️ cạnh "Select type", chọn **Web app**.
3. Điền cấu hình:
   - **Description**: `Form dang ky the thanh vien` (tùy ý)
   - **Execute as (Thực thi với tư cách)**: chọn **Me (email của bạn)**
   - **Who has access (Ai có quyền truy cập)**: chọn **Anyone (Bất kỳ ai)** — ⚠️ bắt buộc chọn mục này, nếu không web sẽ không gửi được dữ liệu.
4. Nhấn **Deploy**.
5. Google sẽ yêu cầu **cấp quyền (Authorize access)**:
   - Chọn tài khoản Google của bạn.
   - Nếu hiện cảnh báo "Google chưa xác minh ứng dụng này" — đây là bình thường vì đây là script riêng của bạn. Nhấn **Advanced (Nâng cao)** → **Go to [tên project] (unsafe)** → **Allow (Cho phép)**.
6. Sau khi deploy xong, Google hiển thị một **Web app URL** dạng:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```
   **Copy toàn bộ URL này lại.**

### Bước 3.4 — Gắn URL vào code

1. Mở file [`script.js`](script.js) trong dự án.
2. Tìm dòng đầu tiên:
   ```js
   const GOOGLE_SCRIPT_URL = "DÁN_URL_WEB_APP_CỦA_BẠN_VÀO_ĐÂY";
   ```
3. Thay bằng URL vừa copy ở Bước 3.3, ví dụ:
   ```js
   const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec";
   ```
4. Lưu file.

> **Lưu ý quan trọng khi cập nhật code sau này:** Mỗi khi bạn sửa nội dung file `google-apps-script.gs` trong trình soạn thảo Apps Script, bạn phải **Deploy → Manage deployments → biểu tượng bút chì → Version: New version → Deploy** thì thay đổi mới có hiệu lực. Chỉ nhấn "Lưu" (Ctrl+S) thôi thì chưa cập nhật lên Web App.

### Kiểm tra thử

Mở file `index.html` trực tiếp trên máy (double-click hoặc kéo vào trình duyệt), điền thử form và nhấn "Gửi thông tin". Nếu thành công, mở lại Google Sheet, bạn sẽ thấy 1 dòng dữ liệu mới xuất hiện.

---

## 4. Đưa Code Lên GitHub Và Bật GitHub Pages

### Bước 4.1 — Tạo tài khoản và repository trên GitHub

1. Nếu chưa có, tạo tài khoản tại [github.com](https://github.com) (miễn phí).
2. Nhấn nút **+** góc trên bên phải → **New repository**.
3. Đặt tên, ví dụ: `freemeals-website`.
4. Chọn **Public** (bắt buộc để dùng GitHub Pages miễn phí).
5. Không tick "Add a README" (vì bạn đã có sẵn). Nhấn **Create repository**.

### Bước 4.2 — Đẩy (push) code lên GitHub

Mở Terminal, di chuyển vào thư mục dự án và chạy lần lượt các lệnh sau (thay `TEN-TAI-KHOAN` và `freemeals-website` bằng thông tin thật của bạn):

```bash
cd /Users/dtri/FreeMeals_Website
git init
git add index.html style.css script.js google-apps-script.gs README.md assets
git commit -m "Khoi tao du an dang ky the thanh vien"
git branch -M main
git remote add origin https://github.com/TEN-TAI-KHOAN/freemeals-website.git
git push -u origin main
```

Nếu được yêu cầu đăng nhập, làm theo hướng dẫn của GitHub (dùng trình duyệt hoặc Personal Access Token).

### Bước 4.3 — Bật GitHub Pages

1. Trên trang GitHub của repository, vào tab **Settings**.
2. Menu bên trái, chọn **Pages**.
3. Ở mục **Build and deployment → Source**, chọn **Deploy from a branch**.
4. Ở mục **Branch**, chọn `main` và thư mục `/ (root)`, nhấn **Save**.
5. Đợi khoảng 1–2 phút, tải lại trang. GitHub sẽ hiển thị dòng:
   ```
   Your site is live at https://TEN-TAI-KHOAN.github.io/freemeals-website/
   ```

Đây chính là **link website** để tạo mã QR ở bước tiếp theo.

---

## 5. Tạo Mã QR Riêng Cho Từng Quán Ăn

Mục "Quán ăn" trên form **không còn là danh sách để người dùng tự chọn** — nó tự động hiển thị tên quán dựa vào tham số gắn trong link mà mã QR dẫn tới. Vì vậy **mỗi quán ăn cần một mã QR riêng**, dẫn đến cùng một website nhưng có thêm `?location=mã_quán` ở cuối link.

### Bước 5.1 — Kiểm tra / cập nhật danh sách quán trong `script.js`

Mở file [`script.js`](script.js), xem khối `LOCATION_MAP` ở đầu file:

```js
const LOCATION_MAP = {
  quan_1: "Quán Cơm Yêu Thương - Quận 1",
  quan_2: "Quán Cơm 2000 - Quận 3",
  quan_3: "Bếp Ấm Tình Thương - Quận 4",
  quan_4: "Quán Cơm Nụ Cười - Quận 5",
  quan_5: "Bếp Cơm Từ Thiện - Quận Bình Thạnh",
};
```

- Bên trái dấu `:` (ví dụ `quan_1`) là **mã quán** — chỉ dùng chữ thường, không dấu, không khoảng trắng, dùng để ghép vào link QR.
- Bên phải dấu `:` (trong ngoặc kép) là **tên quán thật** sẽ hiển thị lên form và lưu vào Google Sheet.
- Muốn thêm quán mới, thêm 1 dòng theo đúng khuôn mẫu, ví dụ:
  ```js
  quan_6: "Bếp Cơm Hạnh Phúc - Quận 10",
  ```
- Sửa xong, `git add`, `git commit`, `git push` lại (xem Phần 6) để cập nhật lên GitHub Pages.

### Bước 5.2 — Ghép link riêng cho từng quán

Lấy link website gốc từ Bước 4.3, ví dụ:
```
https://TEN-TAI-KHOAN.github.io/freemeals-website/
```

Thêm `?location=mã_quán` vào cuối, tương ứng với từng quán trong `LOCATION_MAP`:

| Quán ăn | Link đầy đủ cho mã QR |
|---|---|
| Quán Cơm Yêu Thương - Quận 1 | `https://TEN-TAI-KHOAN.github.io/freemeals-website/?location=quan_1` |
| Quán Cơm 2000 - Quận 3 | `https://TEN-TAI-KHOAN.github.io/freemeals-website/?location=quan_2` |
| Bếp Ấm Tình Thương - Quận 4 | `https://TEN-TAI-KHOAN.github.io/freemeals-website/?location=quan_3` |
| Quán Cơm Nụ Cười - Quận 5 | `https://TEN-TAI-KHOAN.github.io/freemeals-website/?location=quan_4` |
| Bếp Cơm Từ Thiện - Quận Bình Thạnh | `https://TEN-TAI-KHOAN.github.io/freemeals-website/?location=quan_5` |

Khi người dùng quét đúng mã của quán nào, form sẽ tự hiển thị đúng tên quán đó — họ không cần làm gì thêm ở mục này.

### Bước 5.3 — Tạo và in mã QR cho từng link

1. Truy cập một công cụ tạo QR miễn phí, ví dụ: [qr-code-generator.com](https://www.qr-code-generator.com) hoặc dùng Google: tìm "QR code generator free".
2. Với **mỗi quán**, dán đúng link riêng của quán đó (từ bảng ở Bước 5.2) vào ô nhập URL.
3. Tải xuống định dạng **PNG hoặc SVG** ở độ phân giải cao (để in rõ nét).
4. In mã QR ra giấy khổ lớn (A5/A4), kèm dòng chữ hướng dẫn to, rõ, ví dụ:
   ```
   QUÉT MÃ ĐỂ ĐĂNG KÝ THẺ THÀNH VIÊN NHẬN CƠM MIỄN PHÍ
   ```
5. Dán **đúng mã QR của quán đó** tại quầy phát đồ ăn — không dán nhầm mã của quán khác, vì mã QR nào sẽ tự điền tên quán đó vào form.

> **Mẹo:** Vì đối tượng người dùng lớn tuổi có thể không biết cách quét QR, nên bố trí tình nguyện viên đứng cạnh để hỗ trợ quét giúp hoặc hướng dẫn trực tiếp trong 30 giây đầu triển khai.

> **Trường hợp ngoại lệ:** Nếu ai đó mở link gốc không có `?location=...` (ví dụ gõ tay link website), form sẽ hiển thị dòng chữ cảnh báo màu đỏ **"Chưa xác định điểm phát đồ ăn"** và **không cho gửi form** cho đến khi họ quét đúng mã QR tại quầy — tránh trường hợp dữ liệu bị thiếu thông tin quán ăn.

---

## 6. Cập Nhật Website Sau Này

Mỗi khi bạn sửa file (ví dụ đổi danh sách quán ăn trong `index.html`), chạy lại:

```bash
cd /Users/dtri/FreeMeals_Website
git add .
git commit -m "Cap nhat danh sach quan an"
git push
```

GitHub Pages sẽ tự động cập nhật website sau khoảng 1 phút — **không cần tạo lại mã QR**.

---

## 7. Xem Dữ Liệu Đã Thu Thập

Toàn bộ dữ liệu người đăng ký nằm trong Google Sheet đã tạo ở Bước 3.1. Tình nguyện viên có thể:
- Mở trực tiếp Google Sheet để xem danh sách.
- Cập nhật cột **Trạng thái** (E) sau khi gọi điện xác minh, ví dụ: `Đã xác minh - Đã cấp thẻ`, `Không liên lạc được`, v.v.
- Cột **Thời gian** (F) tự động ghi lại thời điểm hệ thống nhận được đăng ký, dùng để tham khảo — không cần chỉnh sửa.
- Chia sẻ quyền xem/sửa Sheet cho các tình nguyện viên khác qua nút **Share (Chia sẻ)** ở góc trên bên phải Google Sheet.
