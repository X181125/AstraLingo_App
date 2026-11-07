# Cài AstraLingo trên điện thoại qua Firebase

Hướng dẫn cho Android, cập nhật 05/11/2026. Luồng phù hợp là **Expo EAS build APK → Firebase App Distribution → người thử cài APK**. Firebase Hosting phục vụ bản web; nó không biến web thành APK và không chạy nguyên Docker Compose.

## 1. Chuẩn bị backend truy cập được từ điện thoại

APK vẫn sử dụng Express và PostgreSQL hiện tại, không cần đổi sang Firebase Authentication hoặc Firestore. Firebase App Distribution chỉ phân phối bản cài.

- Đưa backend lên máy chủ có HTTPS. Có thể dùng server chạy Docker/Nginx hiện tại với domain và TLS, hoặc Google Cloud Run trong cùng project Firebase.
- Database phải tồn tại độc lập với container API: dùng PostgreSQL có volume/backup trên server, hoặc PostgreSQL được quản lý như Supabase. Không đặt database trong filesystem tạm của Cloud Run.
- Backend cần `DATABASE_URL`, `JWT_SECRET` riêng, `NODE_ENV=production`, `MAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Dùng secret manager của nền tảng cho mật khẩu/JWT; không đưa vào app mobile.
- Chạy migration một lần trước khi đưa phiên bản mới vào phục vụ: `npm run db:migrate` ở thư mục backend. Seed tùy chọn: `npm run db:seed`; mặc định không tạo tài khoản demo. Sao lưu dữ liệu trước migration trên database đang sử dụng.
- Cấu hình `CORS_ORIGINS` nếu có web client; native không dùng cơ chế CORS của trình duyệt. `TRUST_PROXY_HOPS=1` chỉ đúng với một proxy tin cậy ghi đè header và API không có đường truy cập trực tiếp bỏ qua proxy; không sao chép thiết lập này sang kiến trúc nhiều proxy mà chưa kiểm tra.
- Mở `https://TEN-MIEN-API/api/health` bằng điện thoại dùng 4G/5G, phải báo database connected. Thử đăng ký/đăng nhập và gửi email reset thật trước khi phát bản cài.

Nếu chọn Cloud Run: bật billing cho project (Blaze khi gắn billing với Firebase), triển khai image backend target `runtime`, cấu hình các secret trên dịch vụ và cho phép truy cập HTTP công khai vì app xác thực bằng JWT riêng. Cloud Run cấp `PORT`; backend đã đọc biến này. Thực hiện migration bằng job riêng có quyền tới database. Giới hạn tốc độ hiện dùng bộ nhớ của từng instance; cần bổ sung kho giới hạn dùng chung khi mở rộng nhiều instance. Phần cloud chưa được triển khai trong repo này.

[Firebase Hosting và Cloud Run](https://firebase.google.com/docs/hosting/cloud-run) · [Kết nối PostgreSQL Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)

## 2. Kết nối Expo và build APK

Thực hiện tại **mobile/**, không build từ khung Android `app/` ở root.

```powershell
cd E:\NT118\AstraLingo_App\mobile
npm ci
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` liên kết với project Expo của bạn và lưu `extra.eas.projectId` vào cấu hình app. Nếu CLI yêu cầu sửa thủ công do có `app.config.js`, thêm `extra.eas.projectId` mà CLI cung cấp vào `app.json`; file config hiện tại giữ nguyên các giá trị này.

Đã có `eas.json`: profile **preview** xuất APK cài trực tiếp, profile **production** xuất AAB để phát hành qua Google Play. Không cần Expo Go để chạy APK preview này.

Trong dashboard project Expo → Environment variables, tạo:

| Tên | Giá trị | Environment | Visibility |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | `https://TEN-MIEN-API/api` | preview | Plain text |

Đây là địa chỉ công khai, không phải secret. `EXPO_PUBLIC_*` được đóng vào bundle và người dùng có thể đọc được. Không nhập database password, JWT secret hoặc SMTP password vào đây. Biến ở `mobile/.env` local không thay thế cấu hình environment trên EAS.

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Cho EAS tạo signing keystore nếu đây là bản đầu tiên; giữ cùng package và signing key cho các lần cập nhật. Tải file `.apk` từ liên kết build khi hoàn tất. Khi đổi URL API phải build lại bản cài.

`app.config.js` từ chối build preview/production nếu URL thiếu, dùng HTTP hoặc là địa chỉ local phổ biến. Native release cũng từ chối gọi HTTP/missing URL thay vì âm thầm gọi localhost. Docker web vẫn dùng `/api` qua Nginx.

[Expo: build APK](https://docs.expo.dev/build-reference/apk/) · [Expo: môi trường build](https://docs.expo.dev/eas/environment-variables/manage/)

## 3. Đưa APK lên Firebase App Distribution

1. Mở Firebase Console, tạo/chọn project của bạn.
2. Thêm **Android app**, nhập package chính xác **`com.astralingo.app`** (đã có trong `mobile/app.json`).
3. Mở **App Distribution**, chọn Android app vừa đăng ký và bắt đầu thiết lập.
4. Upload APK đã ký từ EAS. Thêm ghi chú phiên bản và email/nhóm người thử, rồi phát hành cho nhóm đó.
5. Người thử nhận lời mời, đăng nhập tài khoản Google được mời, tải và cài bản thử trên Android. Cho phép cài từ nguồn này nếu Android yêu cầu.

Nếu chỉ dùng App Distribution, Firebase hướng dẫn chỉ cần tạo project và đăng ký app; không cần thêm Firebase SDK hoặc `google-services.json` vào app chỉ để tải APK thủ công. Các dịch vụ khác như Crashlytics/FCM có bước tích hợp riêng.

[Firebase: phân phối APK bằng Console](https://firebase.google.com/docs/app-distribution/android/distribute-console)

## 4. Kiểm tra trên máy thật

- Dùng 4G/5G đăng ký tài khoản mới, tắt/mở app rồi kiểm tra phiên.
- Đăng nhập sai, email trùng, tìm kiếm không có kết quả, lọc trình độ, xem chi tiết và ghi danh.
- Mở lại app: khóa học đã ghi danh vẫn còn; mất mạng có thông báo và có thể thử lại.
- Reset mật khẩu bằng email thật; phiên cũ không dùng được và mật khẩu mới đăng nhập được.
- Firebase phát bản cài không tự đưa database local hoặc tài khoản local lên cloud.

## Trạng thái và giới hạn

Đã chuẩn bị cấu hình và hướng dẫn; chưa liên kết tài khoản Expo/Firebase, chưa tạo APK/IPA, chưa gửi lời mời tester hoặc triển khai backend lên cloud. Các bước này cần project, URL backend và thông tin SMTP của bạn. Build Android cloud tránh yêu cầu cài Android Studio trên máy này. iOS cần quy trình signing Apple và profile phân phối riêng, không cài được APK.
