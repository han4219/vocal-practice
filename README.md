# Voca · Khu vườn từ vựng của bạn

Ứng dụng React + Vite + Tailwind CSS + Lucide React, chạy hoàn toàn phía trình duyệt và sẵn sàng triển khai lên GitHub Pages bằng `gh-pages`.

## 1. Cài đặt và chạy trên máy

Yêu cầu **Node.js 22.12+** (khuyên dùng Node 22 LTS), npm và Git. File `.nvmrc` đã chọn Node 22. Node mặc định trên máy có thể là phiên bản 18; hãy chuyển phiên bản trước khi cài.

```bash
cd "/Users/dabeeovina/Documents/voca practice"

# Nếu dùng nvm:
nvm install
nvm use

npm install
npm run dev
```

Mở địa chỉ Local mà Vite in ra (mặc định `http://127.0.0.1:5173`). Dừng bằng `Ctrl+C`. Thư mục có khoảng trắng nên luôn đặt đường dẫn trong dấu ngoặc kép.

```bash
npm test          # Kiểm tra dữ liệu, lịch ôn, câu hỏi và nhập bản sao lưu
npm run build    # Tạo bản production trong dist/
npm run preview  # Xem thử bản production, mặc định cổng 4173
```

Sau khi đã có `package-lock.json`, có thể dùng `npm ci` cho các lần cài sạch hoặc CI.

## 2. Các chức năng đã có

- Dashboard với mục tiêu học 5 / 10 / 15 / 20 từ, chuỗi ngày học và bộ từ theo khóa học nguồn.
- Flashcard lật hai mặt: từ, IPA, nghĩa, ví dụ và bản dịch. Tự đánh giá “Chưa nhớ” / “Mình nhớ rồi”.
- Phát âm từ hoặc cả câu bằng `window.speechSynthesis`, chọn ưu tiên Anh Mỹ / Anh Anh và tốc độ đọc.
- Trắc nghiệm chọn nghĩa, điền từ vào câu và bài luyện kết hợp. Câu có từ biến hình hoặc không chứa nguyên cụm từ chuyển sang viết từ dựa vào nghĩa; không cắt dở một phần từ.
- Khóa đáp án sau khi trả lời, hiển thị lời giải và ví dụ. Tổng kết phiên học, luyện lại riêng các từ chưa nhớ.
- Đánh dấu thủ công “Đã thuộc” / “Đang học” trong hộp xem chi tiết từ; thao tác này cũng cập nhật lịch ôn và hoạt động hôm nay.
- Sổ từ vựng có tìm kiếm EN/VI, lọc theo khóa, trạng thái, từ yêu thích và từ đến hạn; phân trang 24 mục để tránh dựng hàng ngàn thẻ cùng lúc.
- Lịch ôn 5 cấp: 10 phút → 1 ngày → 3 ngày → 7 ngày → 21 ngày. Trả lời đúng tăng một cấp, sai quay lại cấp 1, cấp 5 tương ứng “Đã thuộc”. Từ đã thuộc vẫn có lịch ôn tiếp theo.
- Tiến độ, từ yêu thích, mục tiêu, giọng đọc và lịch sử học lưu trong `localStorage` (khóa `voca-garden-v1`).
- Biểu đồ 7 ngày, phân bố 5 tầng ghi nhớ, xuất/nhập tiến độ dưới dạng JSON.
- Responsive cho desktop/mobile, hỗ trợ điều hướng bàn phím, giảm chuyển động theo thiết lập của hệ điều hành và thông báo khi không lưu được dữ liệu.

Bàn phím trong flashcard khi không đặt tiêu điểm vào nút/ô nhập: `Space` để lật, `1` chưa nhớ, `2` nhớ rồi, `→` tiếp tục sau đánh giá. Có nút thao tác đầy đủ trên điện thoại. `Esc` đóng hộp xem từ hoặc menu.

Mỗi phiên lấy tối đa số từ bằng mục tiêu ngày, ưu tiên từ đến hạn, tiếp đến từ mới, rồi từ đã học. Số từ trong mục tiêu mỗi ngày là **số mục từ khác nhau đã ôn**, không cộng lặp khi ôn nhiều lần cùng một từ. Chuỗi ngày học dùng ngày theo giờ địa phương của thiết bị.

## 3. Dữ liệu thật từ Google Sheets

Nguồn: [Vocabulary cần nhớ — tab Từ vựng, gid=0](https://docs.google.com/spreadsheets/d/18AO8DQRxVdA8ORhFcFTVzIcLVdtPvGmxxdciKQ7TLvc/edit?gid=0).

Ảnh chụp ban đầu ngày 04/11/2026 có:

- **7.646 mục từ/nghĩa**, tương ứng **5.231 cách viết khác nhau**. Một từ nhiều nghĩa được giữ thành các mục riêng, không xóa nhầm nghĩa khác.
- **25 cụm từ mới**, chủ đề thói quen và sinh hoạt hằng ngày, đã kiểm tra không trùng cách viết với nguồn.
- Tổng cộng **7.671 flashcard**, gồm 14 khóa nguồn và một bộ mở rộng “Nhịp sống mỗi ngày”. Một mục có thể thuộc nhiều khóa nên tổng số từ ở các khóa có thể lớn hơn tổng kho.
- Tất cả mục nguồn hiện có IPA, nghĩa và ví dụ: không có trường bắt buộc nào cần bịa dữ liệu để lấp chỗ trống. IPA và ví dụ nguồn được bảo toàn; đây là kiểm tra đủ trường, không phải kiểm chứng ngôn ngữ toàn bộ 7.646 mục.

Dữ liệu được đóng gói cùng bản build, tải một lần từ tệp JSON cùng website. **Không cần quyền truy cập Google Sheets hoặc khóa API để học.** Không có truy vấn Google Sheets trong thời gian học. CSV gốc, đường dẫn audio nguồn và bản dịch được giữ lại để đối chiếu; nút nghe mặc định dùng Web Speech API thay vì audio eVSTEP có thể yêu cầu đăng nhập.

Cấu trúc mỗi mục:

```js
{
  id, word, ipa, pos, meaning, meaningLanguage, example, translation,
  courses, source, sourceRow, audio, enrichedFields
}
```

ID được băm từ từ + nghĩa + loại từ, nên thứ tự dòng thay đổi không làm mất liên kết tiến độ. Sửa nghĩa hoặc loại từ làm ID thay đổi và được xem như một mục mới.

### Cập nhật từ bảng sau này

Cho phép đọc bảng bằng đường liên kết, rồi chạy:

```bash
npm run sync:vocab
npm test
npm run build
npm run deploy
```

Script chỉ **đọc** tab `Từ vựng`, không chỉnh sửa Google Sheets. Script kiểm tra header, cập nhật bản chụp và tự bỏ qua cụm từ bổ sung nếu đã xuất hiện trong nguồn mới. Có thể tái tạo dữ liệu từ CSV đã lưu mà không tải lại:

```bash
npm run sync:vocab -- --offline
```

Nếu bản cập nhật thiếu IPA, định nghĩa hoặc ví dụ, script thử bổ sung trường còn thiếu bằng [Free Dictionary API](https://dictionaryapi.dev/). Định nghĩa bổ sung từ API là **tiếng Anh**, được đánh dấu `meaningLanguage: "en"` và `enrichedFields`; không giả là bản dịch tiếng Việt. Các cụm từ không tra được hoặc ví dụ không có sẽ được ghi vào `src/data/enrichment-needed.json`; script dừng, giữ nguyên bộ dữ liệu đang hoạt động để người biên tập bổ sung chính xác. API công khai không bảo đảm có đủ dữ liệu cho mọi cụm từ.

Nếu gặp HTTP 401/403 hoặc tải thất bại, bản dữ liệu đã đóng gói vẫn hoạt động; mở quyền xem bảng và thử lại. Chạy script bằng Node 22, không chạy trong trình duyệt. Nếu thay đổi số dòng hoặc số từ bổ sung, cập nhật các số kỳ vọng trong `tests/learning.test.js` sau khi kiểm tra thay đổi.

## 4. Deploy GitHub Pages bằng npm run deploy

Chưa tạo repository hoặc đẩy dữ liệu lên GitHub tự động. Làm các bước dưới đây bằng tài khoản của bạn.

### Bước 1 — Tạo repository

Trên GitHub tạo repository mới, ví dụ `voca-practice`, để trống (không thêm README nếu bạn sẽ dùng các lệnh dưới). Repository public có thể dùng GitHub Pages với gói miễn phí. Thay `YOUR_USERNAME` và `YOUR_REPOSITORY` bằng giá trị thật trong các lệnh tiếp theo.

### Bước 2 — Đưa mã nguồn lên nhánh main

```bash
cd "/Users/dabeeovina/Documents/voca practice"
git init
git branch -M main
git add .
git commit -m "Initialize Voca vocabulary practice app"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Nếu đã có Git repository/remote, không chạy lại `git remote add`; kiểm tra `git remote -v` và dùng remote của bạn. Đăng nhập GitHub bằng Git credential manager hoặc SSH trước khi push; không đặt token vào mã nguồn hoặc `.env` có tiền tố `VITE_`.

### Bước 3 — Cấu hình đường dẫn

`vite.config.js` đã đặt `base: './'`. Đường dẫn tương đối này chạy được tại cả:

- `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`
- `https://YOUR_USERNAME.github.io/` hoặc tên miền riêng.

Nếu muốn base tường minh theo [hướng dẫn Vite](https://vite.dev/guide/static-deploy.html#github-pages), sao chép `.env.example` thành `.env`, đặt:

```dotenv
VITE_BASE_PATH=/YOUR_REPOSITORY/
```

Dùng `/` nếu là repository `YOUR_USERNAME.github.io` hoặc tên miền riêng. Không dùng đường dẫn thư mục trên máy làm `base`. Dùng hash cho điều hướng (`#library`, `#practice`…), nên tải lại trang không gây lỗi 404 trên GitHub Pages.

### Bước 4 — Deploy

```bash
npm run deploy
```

Lệnh này tự chạy test, build và dùng `gh-pages` xuất bản **nội dung thư mục dist** lên nhánh `gh-pages` của remote `origin`. `--nojekyll` tạo `.nojekyll` cho website tĩnh. Cần có commit ban đầu và remote hợp lệ trước khi chạy.

### Bước 5 — Bật Pages trong repository

Vào **Settings → Pages → Build and deployment**:

1. Source: **Deploy from a branch**.
2. Branch: **gh-pages**.
3. Folder: **/ (root)**.
4. Save, đợi GitHub báo triển khai thành công, rồi mở địa chỉ Pages do GitHub cung cấp.

Cấu hình này dành cho package `gh-pages`; không chọn GitHub Actions làm nguồn Pages cho cách triển khai này. Các lần sau sửa code/dữ liệu thì commit/push mã nguồn và chạy lại `npm run deploy`.

### Lỗi thường gặp

- `npm run deploy` báo thiếu remote: thêm hoặc sửa `origin`, kiểm tra bằng `git remote -v`.
- Lỗi đăng nhập/push: kiểm tra quyền ghi repository và Git authentication; thử push nhánh `main` trước.
- Trang trắng, 404 asset: kiểm tra base, build lại và deploy lại; mở URL có dấu `/` cuối cùng và xem tab Network/Console.
- Không có nhánh `gh-pages`: lệnh deploy chưa thành công; đừng chọn nhánh `main` chứa mã nguồn Vite làm nguồn website.
- Dữ liệu quá trình học từ localhost không xuất hiện trên Pages: localStorage gắn với từng origin. Dùng **Tùy chỉnh → Xuất tiến độ**, sang website Pages rồi **Nhập bản sao lưu**.

## 5. Cấu trúc dự án

```text
voca practice/
├── public/favicon.svg
├── src/
│   ├── assets/garden.svg          # Minh họa SVG gốc, không cần dịch vụ ảnh
│   ├── components/
│   │   ├── Dashboard.jsx          # Mục tiêu ngày, bộ từ, lịch ôn
│   │   ├── StudySession.jsx       # Flashcard, quiz, kết quả, luyện lại
│   │   ├── Library.jsx            # Tìm kiếm, lọc, phân trang
│   │   ├── Practice.jsx           # Chọn dạng bài và bộ từ
│   │   ├── Progress.jsx           # Lịch sử, 5 tầng ghi nhớ
│   │   ├── Settings.jsx           # Giọng đọc, mục tiêu, sao lưu
│   │   └── UI.jsx                 # Thẻ chi tiết, nút nghe, thanh tiến độ
│   ├── data/
│   │   ├── source.csv             # Bản chụp dữ liệu gốc
│   │   ├── additions.json         # 25 cụm từ biên soạn thêm
│   │   ├── vocabulary.json        # Kho từ đã chuẩn hóa
│   │   ├── metadata.json          # Nguồn và số lượng
│   │   └── catalog.js             # Tải dữ liệu, danh mục khóa học
│   ├── hooks/                    # useProgress, useSpeech
│   ├── lib/learning.js            # Lịch ôn, câu hỏi, xác thực sao lưu
│   ├── App.jsx
│   ├── main.jsx                  # Màn hình tải và thử lại khi lỗi
│   └── styles.css
├── scripts/sync-vocabulary.mjs
├── tests/learning.test.js
├── .env.example
├── .nvmrc
├── .gitignore
├── index.html
├── vite.config.js
├── package.json
└── package-lock.json
```

## 6. Phạm vi và lưu ý sử dụng

- Không cần backend, tài khoản hay cơ sở dữ liệu. Tiến độ lưu theo trình duyệt, không tự đồng bộ giữa thiết bị hoặc tab. Nên xuất bản sao lưu định kỳ.
- Phát âm phụ thuộc hỗ trợ Web Speech, giọng tiếng Anh của hệ điều hành và có thể cần Internet. Việc phát âm đã nối API và xử lý lỗi, nhưng giọng thực tế cần nghe trên thiết bị của bạn.
- Không có thông báo đẩy hay nhắc lịch khi đã đóng website. Lịch đến hạn cập nhật mỗi 30 giây khi ứng dụng đang mở.
- Tệp dữ liệu nguồn và bản build sẽ đọc được công khai khi đưa repository/website lên public. Chỉ đưa dữ liệu bạn được phép sử dụng vào repository.
- Fonts tải từ Google Fonts; có phông hệ thống dự phòng. SVG, mã và dữ liệu đều nằm trong dự án. Website chưa cài service worker nên không cam kết mở offline hoàn toàn.
- Giao diện và phương pháp ôn lấy cảm hứng từ [Mochi Web](https://learn.mochidemy.com/learn/1) và [5 cấp độ ghi nhớ](https://mochidemy.com/blog/mochimochi-web/); thiết kế, minh họa và lịch ôn đơn giản của dự án này được xây riêng, không sao chép tài nguyên hay thuật toán của Mochi.
