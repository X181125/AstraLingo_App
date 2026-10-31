# AstraLingo

Ứng dụng học ngôn ngữ cho đồ án **NT118 – Lập trình ứng dụng di động**.
Phần 1 triển khai React Native/Expo và Express theo tài liệu mô tả đã thống nhất.

## Docker frontend, backend và PostgreSQL

Đã có Dockerfile multi-stage và Compose cho cả ba phần. Xem [DOCKER.md](DOCKER.md) để chạy bằng `docker compose up --build -d`, kiểm tra persistence, backup và kết nối từ điện thoại. Database Docker riêng với database local bên dưới; không tự di chuyển dữ liệu cũ. Đã build và chạy thực tế bằng Docker Desktop, kiểm tra API qua Nginx và xác nhận tài khoản/ghi danh/JWT còn hoạt động sau restart. Trên máy hiện tại dùng http://localhost:8082 vì cổng 8080 đã được dịch vụ khác sử dụng.

## Chạy thử ngay trên máy này

Dependencies và file `.env` đã được chuẩn bị. Mở terminal tại `E:\NT118\AstraLingo_App`:

```powershell
npm.cmd run dev
```

Lệnh này khởi động PostgreSQL local, áp dụng migration, nạp dữ liệu mẫu, chạy API rồi mở Expo Metro.
Nhấn **w** ở terminal Expo để mở web preview, hoặc truy cập **http://localhost:8081**.
Không cần Docker, tài khoản cloud, Gemini API key hay Supabase để chạy phần 1.
Nếu API/Expo đang chạy sẵn, dùng cửa sổ terminal hiện tại hoặc dừng chúng trước khi chạy lại để tránh trùng cổng.

Tài khoản mẫu:

```text
Email:    demo@astralingo.app
Mật khẩu: Astra@12345
```

Có thể tự đăng ký tài khoản mới. Dữ liệu đăng ký và khóa học đã thêm được lưu sau khi khởi động lại.
Tài khoản mẫu chỉ được seed trong môi trường development, không dùng khi triển khai thật.

## Cài trên máy khác

Yêu cầu Node.js **22.12+ hoặc 24 LTS**, npm và kết nối mạng ở lần cài đầu.

```powershell
cd E:\NT118\AstraLingo_App
npm.cmd run setup
npm.cmd run dev
```

`setup` cài dependency theo lockfile, sinh Prisma Client và tạo `.env` với JWT secret ngẫu nhiên.
Nó giữ nguyên `.env` nếu file đã tồn tại. Không commit `.env`, thư mục database hay hộp thư thử nghiệm.

Nếu muốn chạy riêng hai terminal:

```powershell
# Terminal 1: API và PostgreSQL local
npm.cmd run backend

# Terminal 2: Expo (quét QR trên điện thoại, hoặc nhấn w)
npm.cmd run mobile
```

Hoặc `npm.cmd run web` để khởi động Expo và mở web preview.

## Chạy trên Android/iOS

- Mã ứng dụng nằm trong **mobile/**. Thư mục **app/** ở root và các file Gradle là khung Android native ban đầu, được giữ nguyên; không dùng khung đó để chạy bản Expo này.
- Dùng điện thoại cùng Wi-Fi với máy tính. Tắt kết nối VPN nếu nó khiến Expo chọn nhầm địa chỉ mạng.
- Dự án cố định **Expo SDK 54**, React Native 0.81.5 và React 19.1 theo Word. Cần Expo Go tương thích SDK 54; bản Expo Go mới nhất có thể không hỗ trợ SDK cũ.
- Android: lấy Expo Go SDK phù hợp tại [expo.dev/go](https://expo.dev/go?sdkVersion=54&platform=android&device=true), hoặc tạo development build.
- Nếu dùng emulator Android, chạy `npm.cmd --prefix mobile run android` sau khi mở emulator.
- iPhone nếu Expo Go hiện tại không hỗ trợ SDK 54: cần development build phù hợp; build iOS local yêu cầu macOS/Xcode. Web preview trên Windows vẫn dùng được.
- API tự nhận địa chỉ máy từ Expo. Nếu không kết nối được, đặt `EXPO_PUBLIC_API_URL=http://<IPv4-Wi-Fi-của-máy>:4000/api` trong `mobile/.env`, rồi khởi động lại Expo. Android emulator có thể dùng `http://10.0.2.2:4000/api`.
- Cho phép Node.js qua firewall trên **mạng riêng** nếu Windows hỏi khi thử từ điện thoại. Không cần mở database ra mạng.

## Các luồng đã thực hiện

1. **Đăng ký:** tên, email, mật khẩu, xác nhận mật khẩu; kiểm tra lỗi, email trùng và đăng nhập sau đăng ký.
2. **Đăng nhập:** hiện/ẩn mật khẩu, thông báo lỗi, trạng thái đang gửi; khôi phục phiên khi mở lại app.
3. **Quên mật khẩu:** yêu cầu mã qua email, nhập mã 6 chữ số, mật khẩu mới, xác nhận; mã hết hạn sau 10 phút, tối đa 5 lần sai, chỉ dùng một lần. Đổi mật khẩu làm vô hiệu các JWT cũ.
4. **Home:** chào theo tài khoản, tìm kiếm có debounce, danh mục kỹ năng, lọc trình độ, kết quả trống, tải lại khi lỗi, kéo để làm mới.
5. **Khóa học:** chi tiết, danh sách bài giới thiệu và thêm vào lộ trình; lưu riêng theo tài khoản.
6. **Hồ sơ tối thiểu:** xem tài khoản, khóa học đã thêm và đăng xuất.

Có 5 danh mục, 5 khóa học và 20 bài giới thiệu làm dữ liệu mẫu. Không giả lập điểm số hoặc tiến độ học.
Các tab **Study** và **Dictionary** ghi rõ đang chờ triển khai. Thực hành bốn kỹ năng, Flashcard, AI, media Supabase, onboarding 7 bước và sửa hồ sơ chưa thuộc bản này.

## Thử quên mật khẩu

Mặc định `MAIL_MODE=console` trong `backend/.env`, chỉ dùng development:

1. Nhấn **Quên mật khẩu?**, nhập email đã đăng ký và gửi mã.
2. Xem mã trong terminal backend, hoặc dòng cuối file `backend/.local/mailbox.jsonl`:

```powershell
Get-Content backend/.local/mailbox.jsonl -Tail 1
```

3. Nhập mã, mật khẩu mới và xác nhận. Đăng nhập bằng mật khẩu mới.
4. Nếu cần gửi lại mã, đợi ít nhất 60 giây. Mã cũ bị thay thế khi phát mã mới.

API không trả mã về cho người gọi và trả cùng một thông báo cho email tồn tại/không tồn tại.
Muốn gửi email thật: đặt `MAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` rồi restart backend.
Không tự động gửi email thật khi chưa cấu hình SMTP. Hộp thư local chứa mã thử nghiệm, không đưa lên Git.

## Kiến trúc và dữ liệu

```text
mobile/                    Expo Router, React Native, TypeScript
  app/login.tsx            Đăng nhập
  app/register.tsx         Đăng ký
  app/forgot-password.tsx  Yêu cầu mã và đổi mật khẩu
  app/(tabs)/home.tsx      Home, tìm kiếm, lọc
  app/course/[id].tsx      Chi tiết và thêm khóa học
  components/              UI dùng chung, hình minh họa SVG
  src/                     API client, auth context, types, theme
backend/                   Express 5, TypeScript
  src/app.ts               REST routes, xác thực, Zod và xử lý lỗi
  src/mail.ts              Gửi mã qua SMTP hoặc hộp thư local
  prisma/schema.prisma     User, PasswordReset, Category, Course, ContentItem, Enrollment
  prisma/migrations/       Migration PostgreSQL
  prisma/seed-data.ts       Dữ liệu mẫu
  scripts/local.ts         Database local + migration + seed + API
  test/api.test.ts         Integration tests với database độc lập
scripts/                   Cài đặt và chạy cả dự án
```

Database local sử dụng **Prisma Dev / PGlite**, một môi trường PostgreSQL tương thích dành cho phát triển, không phải SQLite của ứng dụng. Prisma truy cập qua giao thức PostgreSQL. Dữ liệu local được Prisma lưu trong thư mục ứng dụng của người dùng, không trong repo. Cổng: API 4000, Expo 8081, Prisma local 51213–51215. Đây không phải cấu hình database cho production; local chỉ xử lý một kết nối tại một thời điểm.

Backend dùng bcrypt (cost 12), JWT HS256 có issuer/audience và tokenVersion, validation Zod, Helmet và giới hạn tốc độ. Native lưu JWT bằng **Expo Secure Store**; web preview dùng **sessionStorage**, đóng tab sẽ mất phiên. JWT có hạn 7 ngày; chưa triển khai refresh token. Email verification chưa thuộc phần này.

## Dùng PostgreSQL riêng

Sửa `backend/.env` với `DATABASE_URL` của database riêng (và JWT_SECRET riêng), rồi:

```powershell
cd backend
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

Khi triển khai thật, đặt `NODE_ENV=production`, cấu hình SMTP và danh sách `CORS_ORIGINS` đúng địa chỉ frontend, dùng HTTPS cho API. `dev:local` từ chối chạy ở production.

## API

| Method | Đường dẫn | Nội dung |
|---|---|---|
| GET | `/api/health` | Kiểm tra API/database |
| POST | `/api/auth/register` | `{ name, email, password }` |
| POST | `/api/auth/login` | `{ email, password }` |
| GET | `/api/auth/me` | Tài khoản hiện tại, yêu cầu Bearer JWT |
| POST | `/api/auth/forgot-password` | `{ email }` |
| POST | `/api/auth/reset-password` | `{ email, code, password }` |
| GET | `/api/categories` | Danh mục và số khóa học |
| GET | `/api/courses` | `q`, `category`, `level`, `language`, `page`, `limit` |
| GET | `/api/courses/:id` | Chi tiết và các ContentItem đã xuất bản |
| POST | `/api/courses/:id/enroll` | Thêm vào lộ trình; yêu cầu JWT; gọi lại không tạo trùng |
| GET | `/api/me/enrollments` | Lộ trình của tài khoản, yêu cầu JWT |

Response thành công: `{ success: true, data: ... }`. Lỗi: `{ error: { status, message } }`.

## Kiểm tra

```powershell
npm.cmd run check
npm.cmd test
npm.cmd --prefix mobile run export:web
```

Integration tests tạo database stateless riêng trên cổng 15313–15315, không xóa/sửa dữ liệu dev.
Tests bao gồm validation, email trùng, đăng nhập sai, JWT, tìm kiếm/lọc, phân quyền lộ trình, mã reset hết hạn/sai/dùng lại và thu hồi phiên cũ.

## Tài liệu kỹ thuật

- [Expo Router](https://docs.expo.dev/router/installation/)
- [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/)
- [Prisma local PostgreSQL](https://www.prisma.io/docs/local-development/postgres)

Các package được khóa bằng package-lock.json. Không nâng major Expo/Prisma tự động nếu chưa kiểm tra tương thích.
