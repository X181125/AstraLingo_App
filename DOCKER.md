# Chạy AstraLingo bằng Docker

Stack gồm frontend Expo Web trên Nginx, backend Express và PostgreSQL 17. Container `migrate` chạy một lần để áp dụng migration và seed học liệu trước khi API khởi động. Không cần cài Node/npm nếu đã có Docker và tự chuẩn bị `.env`.

## Khởi động

Yêu cầu Docker Desktop đang chạy với Linux containers và Docker Compose v2.
Đã build và chạy stack bằng Docker Desktop Linux containers ngày 31/10/2026. Trên máy hiện tại, root `.env` đặt `WEB_PORT=8082` và CORS tương ứng vì cổng 8080 bị AgentService sử dụng. Mở http://localhost:8082; template cho máy mới vẫn mặc định 8080.

```powershell
cd E:\NT118\AstraLingo_App
node scripts/docker-setup.mjs
docker compose up --build -d
docker compose ps -a
```

Script tạo `.env` ở root với password PostgreSQL và JWT secret ngẫu nhiên. File này khác `backend/.env` dùng cho chế độ chạy bằng npm. Không ghi đè nếu đã tồn tại.

Mở **http://localhost:8080**. Đăng ký tài khoản mới để thử. Theo mặc định Docker không tạo tài khoản demo. Nếu muốn, đặt `SEED_DEMO=true` trong root `.env` rồi chạy lại `docker compose run --rm migrate` trong môi trường development.

Chỉ cổng frontend được công khai; `/api/...` được Nginx chuyển tới backend nội bộ. PostgreSQL và API không mở cổng riêng ra host. Refresh trực tiếp `/home`, `/login`, `/course/...` được xử lý bởi SPA fallback.

## Quên mật khẩu

Mặc định Compose là môi trường kiểm thử `NODE_ENV=development`, `MAIL_MODE=console`. Sau khi yêu cầu mã:

```powershell
docker compose logs --tail 50 backend
```

Mã nằm trong log hoặc `/app/.local/mailbox.jsonl` trong container. Hộp thư có volume riêng `local_mail`.

Gửi mail thật: cấu hình SMTP trong root `.env`, rồi `docker compose up -d backend`. Khi đổi sang `NODE_ENV=production`, bắt buộc `MAIL_MODE=smtp` và thông tin SMTP hợp lệ. Chạy production cần bổ sung HTTPS và cấu hình domain/CORS; file Compose mặc định phục vụ thử nghiệm, chưa tự cấu hình chứng chỉ.

## Lưu dữ liệu và khởi động lại

- PostgreSQL dùng named volume `postgres_data`. Restart, rebuild image, hoặc `docker compose down` rồi `up` giữ volume.
- Không chạy `docker compose down -v` hoặc xóa volume nếu cần giữ dữ liệu: `-v` sẽ xóa database.
- Database Docker là database riêng, **không tự nhập tài khoản từ Prisma Dev/PGlite cũ**. Dữ liệu local cũ vẫn được giữ nguyên.
- Seed chạy idempotent cho học liệu mẫu. Nó không xóa tài khoản/lộ trình, nhưng cập nhật lại nội dung 5 khóa học mẫu về dữ liệu seed. Dữ liệu người học không bị reset.
- Password PostgreSQL trong `.env` cần giữ ổn định. Đổi biến này không đổi password của database đã khởi tạo trong volume.

```powershell
# Kiểm tra API qua Nginx và các route web
# Máy hiện tại dùng cổng 8082; đổi lại 8080 nếu dùng template mặc định
$env:TEST_BASE_URL="http://localhost:8082"
node scripts/docker-smoke.mjs

# Tạo tài khoản thử, thêm khóa học, restart rồi kiểm tra dữ liệu và JWT
node scripts/docker-smoke.mjs --restart

# Dừng và bật lại, không xóa dữ liệu
docker compose down
docker compose up -d
```

Smoke test tạo tài khoản `docker-smoke-...@example.test` và giữ lại để kiểm tra; không xóa dữ liệu có sẵn. Nếu đổi `WEB_PORT`, đặt `TEST_BASE_URL` tương ứng trước khi chạy test.

## Backup PostgreSQL

```powershell
# Tạo dump trong container rồi chép ra host, tránh lỗi encoding của PowerShell
docker compose exec postgres pg_dump -U astralingo -d astralingo -Fc -f /tmp/astralingo.dump
docker compose cp postgres:/tmp/astralingo.dump ./astralingo.dump
```

Giữ file dump ngoài Git. Việc restore nên làm vào database riêng trước khi quyết định thay thế dữ liệu đang dùng.

## Điện thoại

- Thử bản web: mở `http://<IP-Wi-Fi-máy-tính>:8080` trên điện thoại cùng mạng.
- Expo native/APK: dùng `EXPO_PUBLIC_API_URL=http://<IP-Wi-Fi-máy-tính>:8080/api` ở `mobile/.env` rồi khởi động lại Expo/build lại. Dùng HTTPS khi build bản phát hành.
- Không dùng hostname `backend`/`postgres` trong app điện thoại; các hostname đó chỉ dùng trong mạng Docker.
- Image frontend chứa bản **web**; APK/iOS vẫn phải build bằng Expo/EAS riêng.

## Chẩn đoán

```powershell
docker compose logs --tail 100 migrate backend frontend postgres
docker compose exec frontend nginx -t
docker compose exec postgres pg_isready -U astralingo -d astralingo
```

`migrate` có trạng thái Exited (0) là bình thường. Nếu migration thất bại, API chưa được phép chạy. Cổng 8080 đang dùng: đổi `WEB_PORT` và `CORS_ORIGINS` trong root `.env` rồi `docker compose up -d`.

## Cấu trúc build

- Backend multi-stage: stage build chạy TypeScript/Prisma generate; stage migrate giữ Prisma CLI; runtime chỉ giữ dependency production và chạy bằng user `node`.
- Frontend multi-stage: Expo export web với API `/api`, Nginx phục vụ tệp tĩnh và reverse proxy. `.env` local không được gửi vào build context.
- `.dockerignore` loại node_modules, secret, dữ liệu và bundle cũ.
- `TRUST_PROXY_HOPS=1` chỉ dùng vì API được đặt sau một Nginx và không publish trực tiếp. Nginx ghi đè header IP do client gửi lên.

## Kết quả rà soát và giới hạn

- Đã kiểm tra TypeScript backend/mobile, build backend, export Expo Web với API `/api`, và parse YAML cùng anchor môi trường. Đã chạy thêm `docker compose config --quiet`, build cả ba image ứng dụng, migration/seed, kiểm tra Nginx và smoke test qua proxy.
- Bộ kiểm thử API kiểm tra đăng ký/đăng nhập, quyền truy cập, tìm kiếm/lọc, ghi danh, đổi mật khẩu và thu hồi JWT; bổ sung kiểm tra JSON lỗi/quá lớn và giới hạn theo IP sau proxy.
- `npm audit --omit=dev` ngày 31/10/2026 báo backend 5 mục mức high (chuỗi Prisma/config và Nodemailer); mobile 31 mục (5 high, 25 moderate, 1 low), gồm nhiều thư viện thuộc công cụ build Expo. Chưa thực hiện nâng major Prisma/Expo/Nodemailer trong thay đổi Docker này; cần xử lý và kiểm thử tương thích trước triển khai production. Số mục audit không đồng nghĩa số lỗ hổng có thể khai thác trong ứng dụng.
- Image frontend chỉ chứa tệp web và Nginx, không chứa node_modules của Expo. Chưa scan image hoặc xác nhận SMTP gửi thư thật.
- Đã chạy thành công `docker-smoke.mjs --restart` với `TEST_BASE_URL=http://localhost:8082`: route web, đăng ký, lọc khóa học, ghi danh; sau restart PostgreSQL/API/Nginx, tài khoản, ghi danh và JWT vẫn hoạt động. Đây là kiểm tra HTTP/API, chưa phải kiểm thử thao tác giao diện trên điện thoại.

Tham khảo: https://docs.docker.com/compose/how-tos/startup-order/
