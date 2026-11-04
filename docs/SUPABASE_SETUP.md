# Kết nối Supabase để đồng bộ kết quả học

Website vẫn dùng React/Vite và GitHub Pages. Supabase cung cấp PostgreSQL, Auth và API; không cần dựng backend riêng hay đưa mật khẩu database vào website.

## Vì sao chọn Supabase?

| Lựa chọn | Đánh giá cho dự án này |
| --- | --- |
| Supabase / PostgreSQL | Phù hợp: có đăng nhập, bảng lưu từng lượt học, transaction chống ghi trùng, RLS phân quyền theo người dùng; thuận tiện truy vấn thống kê về sau. |
| Firebase Auth / Firestore | Cũng phù hợp, đồng bộ và offline tốt; mô hình document cần tổ chức riêng tiến độ và các lượt học, có giới hạn kích thước document. |
| MongoDB Atlas | Phù hợp nếu đã có backend; không nhúng connection string/quyền database vào website tĩnh. Cần thêm API và hệ thống xác thực. |

Nguồn: [Supabase Auth](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Firebase limits](https://firebase.google.com/docs/firestore/quotas), [MongoDB App Services deprecation](https://www.mongodb.com/docs/app-services-deprecation/).

## 1. Tạo project

1. Mở [Supabase Dashboard](https://supabase.com/dashboard), đăng nhập và tạo project mới, ví dụ `vocal-practice`.
2. Chọn khu vực gần người dùng (ví dụ Singapore nếu khả dụng).
3. Đặt và tự giữ mật khẩu database. Ứng dụng web này **không cần mật khẩu đó**.
4. Đợi project khởi tạo xong. Xem hạn mức, khả năng tạm dừng project và mức dùng thực tế trong dashboard của gói bạn chọn.

## 2. Tạo bảng và phân quyền

1. Mở **SQL Editor → New query**.
2. Dán toàn bộ tệp `supabase/migrations/001_learning.sql` của dự án.
3. Nhấn **Run** bằng tài khoản chủ project.
4. Xác nhận có bảng `voca_profiles`, `voca_events` và hàm `voca_apply_operation` trong schema `public`.

Script tạo RLS: mỗi tài khoản chỉ đọc bản ghi có `user_id` của chính mình. Client không được cập nhật/xóa bảng trực tiếp; mọi thay đổi đi qua hàm transaction xác định UID từ phiên đăng nhập. Khóa UUID của mỗi thao tác đảm bảo gửi lại sau lỗi mạng không cộng trùng lượt học. Có thể chạy lại script mà không xóa dữ liệu cũ.

**Không mở policy cho tất cả người dùng và không dùng service_role trong frontend.**

## 3. Bật đăng nhập

Trong **Authentication → Providers / Sign In**, bật **Email** và đăng nhập bằng mật khẩu.

Trong **Authentication → URL Configuration**:

- Site URL: `https://han4219.github.io/vocal-practice/`
- Redirect URLs: thêm đúng URL trên và URL local mà bạn sử dụng, ví dụ `http://127.0.0.1:5173/`.
- Nếu chạy bản thử ở cổng khác, thêm URL đó trong lúc thử rồi xóa sau khi không còn cần.

Giao diện có đăng ký, đăng nhập, gửi lại liên kết đặt mật khẩu và đổi mật khẩu sau khi bấm liên kết recovery. Khi bật xác nhận email, người dùng cần xác nhận trước khi đăng nhập.

Dịch vụ email mặc định của Supabase có giới hạn và hạn chế người nhận; để dùng rộng rãi, cấu hình **Custom SMTP** theo [hướng dẫn chính thức](https://supabase.com/docs/guides/auth/auth-smtp). Khi thử cá nhân, có thể tạo/xác nhận tài khoản thử trong Dashboard → Authentication → Users, rồi đăng nhập bằng tài khoản đó; không cần tắt xác nhận email cho toàn hệ thống.

## 4. Lấy hai thông tin cấu hình

Từ **Connect / Project settings → API / API Keys**, lấy:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
```

Publishable key là khóa dành cho frontend; dữ liệu riêng được bảo vệ bằng Auth + RLS. Với project cũ, khóa `anon` cũng được SDK hỗ trợ; ưu tiên Publishable key mới.

Bạn chỉ cần gửi **Project URL** và **Publishable key** để tôi nối ứng dụng. Không gửi database password, secret key hoặc service_role key.

Tài liệu: [API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## 5. Cấu hình local, kiểm tra và deploy

Trong thư mục dự án, sao chép `.env.example` thành `.env.local`, điền hai giá trị trên rồi chạy lại:

```bash
nvm use
npm install
npm run dev
```

`.env.local` được bỏ qua bởi Git. Giá trị có tiền tố `VITE_` được đưa vào bản build và sẽ đọc được từ trình duyệt, vì vậy chỉ dùng Publishable key tại đây.

Thử luồng này trước khi deploy:

1. Học một từ khi chưa đăng nhập.
2. Đăng nhập tài khoản thử, nhấn **Đưa tiến độ có sẵn lên tài khoản** một lần.
3. Học thêm, kiểm tra dòng **Đã đồng bộ** và bảng `voca_events` có lượt trả lời.
4. Mở trình duyệt/thiết bị khác, đăng nhập cùng tài khoản; tiến độ phải khớp mà không xuất/nhập JSON.
5. Ngắt mạng, trả lời một câu, tải lại khi vẫn đang ở trang đã tải được; bản lưu/outbox phải còn. Kết nối mạng lại, đảm bảo lượt đó chỉ xuất hiện một lần trên database.
6. Tài khoản B không được đọc tiến độ tài khoản A. Các kiểm thử PostgreSQL tự động cũng đã kiểm tra trường hợp này.

Bản website chưa có service worker: không cam kết tải mới toàn bộ website khi hoàn toàn offline. “Offline” ở đây là tiếp tục học trên trang đã mở và giữ các thao tác chưa gửi.

```bash
npm test
npm run build
npm run deploy
```

`npm run deploy` vẫn build tại máy rồi push `dist` lên `gh-pages`. File `.env.local` cần tồn tại ở máy thực hiện build. Khi chuyển sang CI, cung cấp các biến tương ứng trong môi trường build. Vẫn dùng Pages → Deploy from a branch → gh-pages → /(root).

Nếu hai biến chưa được điền, website vẫn hoạt động ở chế độ lưu trên máy và thông báo rõ chức năng đám mây chưa cấu hình.

## Mô hình lưu và đồng bộ

- `voca_profiles`: trạng thái học hiện tại, lịch ôn, mục tiêu, từ yêu thích, tiến độ từng từ/nhóm và tối đa 100 lượt gần nhất để hiển thị nhanh. Tiến độ nhóm tính từ ID từng từ, không cần ghi một tổng nhóm độc lập.
- `voca_events`: lưu **mọi thao tác mới**, gồm mỗi lượt trả lời, kết quả đúng/sai, nội dung đã nhập, chế độ, gợi ý, lượt làm lại, phiên học, nhóm và ngày địa phương. Không tự xóa lịch sử cũ. Giao diện tiến độ chỉ hiện 20 lượt gần nhất; toàn bộ vẫn có trong bảng này.
- Database khóa bản ghi tiến độ của một tài khoản trong transaction khi áp dụng thao tác; các thiết bị không ghi đè cả snapshot của nhau.
- Client giữ từng thao tác chưa gửi trong một khóa localStorage riêng theo tài khoản + UUID. Đóng/mở lại trang không mất hàng đợi; lỗi mạng hoặc lỗi database hiển thị trạng thái chờ, không báo “Đã đồng bộ” giả.
- Khi online, các thao tác được gửi tự động. Tải lại từ server sau khi gửi, khi cửa sổ lấy focus, mỗi 30 giây và qua Realtime khi bật được. Realtime không hoạt động thì polling vẫn hoạt động.
- Đăng xuất không xóa hàng đợi đang chờ; tài khoản khác dùng bộ cache riêng. Đồng bộ cần Internet và phiên đăng nhập hợp lệ.
- Dữ liệu local trước bản nâng cấp chỉ có thống kê tổng hợp. Nút chuyển dữ liệu giữ các tổng đó bằng phép gộp lấy giá trị lớn hơn, không cộng lại cùng bản sao lưu. Không thể tái tạo các câu trả lời từng lượt mà bản cũ chưa từng lưu.
- Nút làm lại và gợi ý đều giữ lịch sử, nhưng câu đúng sau gợi ý/làm lại ngay không tăng cấp ghi nhớ liên tục. Chỉ xem flashcard/đi tới/lùi ghi “Đã xem”, chưa tính “Đã học”.
- Hiện snapshot mỗi người dùng giới hạn 8 MB trong hàm để đồng nhất với giới hạn nhập backup. Lịch sử đầy đủ nằm riêng trong `voca_events`; với quy mô lớn hơn có thể tách tiếp snapshot thành các bảng từng từ/ngày.

Kiểm thử database dùng PostgreSQL trong bộ nhớ qua PGlite; không kết nối hoặc thay đổi database production. Luồng đăng nhập/email/realtime của Supabase thật vẫn cần chạy kiểm tra sau khi có project và cấu hình.
