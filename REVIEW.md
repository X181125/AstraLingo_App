# Review Auth, Home và vận hành — 05/11/2026

Phạm vi: mã nguồn Expo/Express/Prisma, database, script local, Docker, dependency và chuẩn bị phân phối Android. Không triển khai thêm các module học tập ngoài Auth/Home. Branch sửa: `fix/auth-home-review`.

## Các vấn đề đã sửa

| Mức | Vấn đề và tác động | Cách sửa / bằng chứng |
|---|---|---|
| Cao | Login nhận mật khẩu dài hơn 72 byte; bcrypt bỏ phần dư nên một chuỗi khác vẫn đăng nhập được. | Áp giới hạn byte cho login. Test với 36 ký tự `é` + phần dư trước sửa trả 200, sau sửa trả 400; mật khẩu đúng vẫn thành công. |
| Cao | Gửi yêu cầu reset đồng thời có thể vượt kiểm tra cooldown đọc-rồi-ghi, thay thế mã vừa gửi. | Claim cửa sổ gửi lại bằng một câu SQL `INSERT ... ON CONFLICT ... WHERE` nguyên tử, dùng parameter binding. Test PostgreSQL thật: 4 request chỉ gửi 1 mã, 2 lần dùng cùng mã chỉ 1 lần thành công. |
| Vừa | GET `/auth/me` tiêu thụ chung quota đăng nhập, người dùng mở app nhiều lần có thể bị khóa đăng nhập. | Chỉ áp bộ giới hạn Auth lên các endpoint thay đổi/tạo phiên. Test 35 lần khôi phục phiên rồi login vẫn thành công. |
| Vừa | Dữ liệu tài khoản/ghi danh chưa chỉ thị cấm cache, có nguy cơ dữ liệu cá nhân bị giữ ở browser/proxy khi triển khai. | API trả `Cache-Control: no-store`; test kiểm tra header. |
| Vừa | Backend chỉ lọc tiếng Anh ở danh sách nhưng detail/ghi danh/count vẫn nhận ngôn ngữ khác. | Lọc nhất quán detail, enrollment, category counts. Test chèn khóa ngoại ngữ khác vào schema test rồi xác nhận không truy cập/ghi danh được. |
| Vừa | Request khôi phục phiên cũ hoặc 401 cũ có thể ghi đè/đăng xuất phiên mới. | Version cho phiên, hàng đợi ghi SecureStore/sessionStorage, chỉ hết hạn đúng token gây lỗi; bỏ qua kết quả request của màn hình đã rời đi. |
| Vừa | Đổi URL khóa học rồi tải thất bại vẫn giữ dữ liệu khóa cũ; ghi danh đang chạy có thể cập nhật màn hình khóa mới. | Xóa dữ liệu khi ID đổi và kiểm tra version request trước cập nhật kết quả ghi danh. |
| Vừa | API client gọi `response.json()` trực tiếp, nhầm HTML lỗi Nginx thành mất Wi-Fi. | Giữ HTTP status cho lỗi HTML, kiểm tra envelope thành công, hủy request có chủ đích không bị đổi thành lỗi mạng. Có test client. |
| Vừa | APK release có thể âm thầm trỏ localhost/HTTP khi thiếu biến môi trường. | Profile EAS preview APK/production AAB, chặn cấu hình preview/production thiếu HTTPS, client native release cũng từ chối URL không phù hợp. Có test cấu hình build. |
| Thấp | Home dừng ở 50 khóa nhưng hiển thị tổng lớn hơn, không có cách xem phần còn lại. | Phân trang 12 khóa và nút xem thêm; reset khi đổi bộ lọc/làm mới, bỏ kết quả request đã hủy. |
| Vừa | Windows Docker/WSL giữ dải 512xx khiến database local không khởi động được. | Chuyển mặc định Prisma Dev sang 15213–15215; có `LOCAL_DB_PORT` để đổi cả cụm cổng, giữ nguyên tên database stateful. |
| Vừa | Nodemailer 7 có các advisory; SMTP 587 chưa bắt buộc STARTTLS. | Nâng Nodemailer 10.3.1, bắt buộc TLS, gửi người nhận dạng address object. Chưa kiểm chứng gửi SMTP thật. |

## Kiểm chứng

- Viết test trước sửa đã tái hiện lỗi bcrypt, thiếu no-store và truy cập detail ngoại ngữ khác. Không coi test chỉ chạy thành công là đủ chứng minh không còn lỗi.
- 8 test integration backend chạy với PostgreSQL 17 thật trong container riêng; mỗi lượt dùng schema ngẫu nhiên và dọn đúng schema đó. Không đụng dữ liệu ứng dụng đang dùng.
- 4/4 test mobile đạt: xử lý HTML lỗi, URL release, authorization/cancellation và guard EAS bảo toàn projectId. 8/8 test backend cũng đạt khi chạy lại trên Prisma Dev/PGlite.
- TypeScript backend/mobile, build backend, Expo dependency compatibility và export bundle Android.
- Build Docker frontend/backend, migration, Nginx config và smoke test API/persistence đều đạt; tài khoản, ghi danh và JWT còn hoạt động sau restart. CI mới thêm chưa được GitHub chạy khi chưa push.
- Giao diện web đã thử bằng tài khoản kiểm thử: login → Home → tìm kiếm trống → xóa bộ lọc → chi tiết → ghi danh → Profile → reload, vẫn giữ phiên và khóa học.
- Tài khoản UI `ui-review-20261105@example.test` là dữ liệu kiểm thử local. Không dùng tài khoản đó ở production.

## Chưa thể kết luận sẵn sàng production

- Audit ngày 05/11/2026 sau cập nhật: backend còn 4 mục high trong chuỗi Prisma/config (`effect`, `deepmerge-ts`); mobile còn 18 mục (5 high, 12 moderate, 1 low), gồm cả Expo build tools và `query-string`/`decode-uri-component` có thể nằm trong bundle. Không bỏ qua các mục này chỉ vì app đang chạy được.
- Đã chạy cập nhật không vượt major; không dùng `npm audit fix --force` vì đề xuất đổi major Prisma/Expo làm thay đổi runtime/schema/build. Cần một lượt nâng SDK/ORM có kiểm thử tương thích trước phát hành công khai. Audit là cảnh báo dependency, không tự chứng minh đường khai thác trong app.
- Rate limit đang ở bộ nhớ từng process; restart xóa quota, nhiều instance không dùng chung bộ đếm. Cooldown và giới hạn số lần sai mã reset được lưu ở PostgreSQL. Cần kho rate limit dùng chung nếu chạy nhiều instance.
- Forgot-password trả cùng nội dung cho email tồn tại/không tồn tại, nhưng thời gian SMTP có thể tiết lộ khác biệt. Cần queue gửi mail để giảm side-channel nếu triển khai công khai ở mức rủi ro cao hơn.
- Chưa có refresh token; logout xóa token trên thiết bị, không thu hồi JWT đã bị sao chép. Reset mật khẩu thu hồi các JWT cũ. Đây là giới hạn cần cân nhắc, không tuyên bố logout thu hồi toàn bộ phiên server.
- Seed vẫn cập nhật nội dung mẫu khi chạy lại; chưa có CMS/luồng chỉnh sửa học liệu để giữ dữ liệu biên tập.
- Chưa có test thao tác Android/iOS thật, stress test, scan image, kiểm thử SMTP provider hoặc APK đã ký. Export bundle Android không tương đương build APK thành công.
- File `app.ts` vẫn gom nhiều endpoint; phù hợp phạm vi hiện tại nhưng nên tách module khi bổ sung nghiệp vụ. Không refactor toàn bộ chỉ để giảm số dòng hoặc thay đổi phong cách code.

## Có cần các công cụ trong đoạn thảo luận không?

Cần review theo nghiệp vụ, test lỗi/biên/quyền truy cập/đồng thời và người học tự hiểu các thay đổi. Không cần cài EasyMerge, Greptile, SonarQube hay một skill bên ngoài chỉ vì được quảng cáo trong bình luận. CI trong `.github/workflows/checks.yml` đã chuẩn bị typecheck, test với PostgreSQL thật và Docker smoke test; branch protection vẫn cần cấu hình trên GitHub nếu muốn bắt buộc CI trước merge.

AI review hữu ích nhưng không thay thế việc kiểm tra độc lập. Mỗi phát hiện ở trên gắn với hành vi cụ thể, bản sửa hoặc giới hạn kiểm chứng, không cam kết “code không còn lỗi”. Hướng dẫn mobile nằm trong [FIREBASE-MOBILE.md](FIREBASE-MOBILE.md).
