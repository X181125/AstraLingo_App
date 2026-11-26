# AstraLingo

Ứng dụng học tiếng Anh của nhóm NT118. Frontend dùng React Native, Expo Router và TypeScript. API Express dùng Prisma để lưu tài khoản, bài làm và tiến độ vào PostgreSQL. Giao diện và dữ liệu khởi động nằm trong repo.

## Chạy từ bản clone mới

Trong lúc PR #8 đang mở, chọn branch `feature/online-exam-mini-quiz`. Cần Git, Node.js 22.12+ và Docker Desktop hoặc Docker Engine có Compose.

```sh
git clone --branch feature/online-exam-mini-quiz https://github.com/X181125/AstraLingo_App.git
cd AstraLingo_App
node scripts/docker-setup.mjs
docker compose up --build -d --wait
```

Mở [AstraLingo trên máy](http://localhost:8080), đăng ký rồi chọn mục tiêu hoặc bấm **Để sau**. Compose tự tạo database, chạy migration và nạp khóa học, bài luyện. Mật khẩu PostgreSQL và khóa phiên được tạo riêng cho mỗi bản cài. Để đổi cổng web, sửa `WEB_PORT` và `CORS_ORIGINS` trong `.env` trước khi chạy Compose. Dữ liệu nằm trong volume PostgreSQL và được giữ khi khởi động lại.

## Các luồng học

| Màn hình | Có thể làm gì |
|---|---|
| Tài khoản | Đăng ký, đăng nhập, đổi mật khẩu bằng mã email, khôi phục và làm mới phiên. Thiết lập mục tiêu, trình độ, giao diện và thời lượng học. |
| Home | Tìm kiếm, lọc theo kỹ năng và trình độ, mở chi tiết khóa, ghi danh rồi vào bài luyện. Mục Top Mentor dùng nhân vật minh họa để dẫn tới khóa học theo kỹ năng. |
| Học tập | Khám phá bài công khai, tạo và sửa bài cá nhân, soạn câu hỏi, xuất bản, sao chép và báo cáo. |
| Reading và Listening | Đọc đoạn văn hoặc nghe audio, mở transcript, nghe chậm, đánh dấu, lưu từ, trả lời câu hỏi và xem giải thích. Bài nghe chỉ có transcript có thể dùng giọng đọc trên thiết bị. |
| Speaking và Writing | Ghi và nghe lại bài nói, soạn bài viết, lưu nháp, nộp bài và xem lịch sử. Bật Gemini để nhận góp ý theo tiêu chí. |
| Online Exam | Tám đề luyện SAT Reading and Writing số 4–11, mỗi đề 66 câu và hai module. Làm bài theo đồng hồ, lưu lựa chọn và xem số câu đúng cùng lịch sử. Điểm hiển thị là điểm thô. Mở đề gốc của College Board cần mạng. |
| Mini Quiz | Chọn chủ đề để bắt đầu, trả lời, nộp và xem điểm. Bộ câu hỏi và audio dự phòng đi cùng repo để dùng khi nhà cung cấp tạm ngừng. |
| Dictionary | Tra và duyệt từ tiếng Anh, xem nghĩa, ví dụ nếu có và lưu vào danh sách cá nhân. WordNet 3.0 cung cấp 147.306 mục tiếng Anh đã chuẩn hóa với nghĩa tiếng Anh. Một số mục phổ biến có nghĩa tiếng Việt. |
| Flashcards | Tạo bộ thẻ, thêm và sửa thẻ, sao chép bộ công khai, lật thẻ và tự đánh giá. Ngày ôn tiếp theo được lưu riêng cho người học. |
| Hồ sơ | Xem khóa đã ghi danh, chuỗi ngày học, số lượt làm và kết quả theo kỹ năng. Đổi thông tin tài khoản và quản lý dữ liệu cá nhân. |

### Dịch vụ tùy chọn

- Để gửi mã đặt lại mật khẩu qua email thật, đặt `MAIL_MODE=smtp` cùng các biến `SMTP_*` và `MAIL_FROM`. Khi chạy thử với `MAIL_MODE=console`, đọc mã trong hộp thư phát triển bằng `docker compose exec backend tail -n 1 .local/mailbox.jsonl`.
- Đặt `GEMINI_API_KEY` và `GEMINI_MODEL` để chấm nói/viết, giải thích theo ngữ cảnh, tạo bài/từ vựng và nhận diện từ qua ảnh.
- Bản cài mặc định lưu bản ghi âm trong PostgreSQL. Có thể cấu hình bucket riêng trên Supabase Storage, hoặc bật đăng nhập mạng xã hội qua Supabase Auth bằng các biến trong [.env.docker.example](.env.docker.example).
- Áp dụng thay đổi biến môi trường bằng `docker compose up -d`. Khi đưa lên máy chủ, dùng HTTPS và đặt đúng origin của frontend.

### API

Frontend và backend dùng chung hợp đồng được kiểm thử trong [backend/test/api.test.ts](backend/test/api.test.ts). Các nhóm API gồm `/api/auth`, `/api/account`, `/api/courses`, `/api/study`, `/api/learn` và `/api/exams`. API tài nguyên cho ứng dụng di động còn có `/api/users/me`, `/api/user-levels`, `/api/content-categories`, `/api/content-items`, `/api/words`, `/api/flashcard-decks`, `/api/flashcards` và `/api/flashcard-progress`. API yêu cầu phiên nhận JWT bằng header `Authorization: Bearer <token>`. Kiểm tra kết nối database tại [API health](http://localhost:8080/api/health).

### Phát triển trên thiết bị

```sh
npm run setup
npm run dev
```

Trên Windows có thể dùng `npm.cmd`. Chạy Expo Go tương thích SDK 54 hoặc development build trên điện thoại cùng mạng với máy chạy API. Nếu cần, đặt `EXPO_PUBLIC_API_URL=http://<IP-LAN>:4000/api` trong `mobile/.env`. [Hướng dẫn Docker](DOCKER.md) · [Phân phối Android qua Firebase](FIREBASE-MOBILE.md).

### Kiểm thử

```sh
npm run check
npm test
node scripts/docker-smoke.mjs --restart
```

Hai lệnh đầu chạy sau `npm run setup`. Lệnh cuối chạy với Compose đang hoạt động và kiểm tra dữ liệu sau restart. `TEST_BASE_URL` chọn địa chỉ web để chạy kiểm thử.

### Nguồn học liệu

- Đề và lời giải SAT được mở tại [College Board](https://satsuite.collegeboard.org/practice/practice-tests/paper).
- Mini Quiz sử dụng [The Trivia API](https://thetriviaapi.com/) (CC BY-NC 4.0), [AI2 SciQ](https://huggingface.co/datasets/allenai/sciq) (CC BY-NC 3.0) và [Free Dictionary API](https://dictionaryapi.dev/). Audio có thông tin nguồn và giấy phép trên màn hình làm bài.
- Dữ liệu từ điển từ [Princeton WordNet](https://wordnet.princeton.edu/) được đóng gói cùng [giấy phép của Princeton](backend/resources/wordnet/LICENSE).
