# AstraLingo Reform

Reform chạy toàn bộ giao diện và backend của bản 18084 để kiểm thử cùng repo AstraLingo. Các màn hình của bản đó gọi đúng API contract đi kèm, gồm tài khoản, nội dung học, Reading, Listening, Speaking, Writing, từ điển, Flashcard, Online Exam và Mini Quiz. Cần có thư mục bản 18084 đã tích hợp trên máy để chạy.

Từ thư mục gốc của repo, với Docker Desktop đang chạy:

```powershell
npm.cmd run reform -- stage "E:/NT118/AstraLingo_App_Fork/integrations/language-learning"
npm.cmd run reform
```

Tham số đường dẫn có thể bỏ qua khi bản 18084 nằm trong repo AstraLingo_App_Fork cùng cấp. Sau lệnh stage, bản sao nằm tại integrations/language-learning-reform. Tên thư mục này được Git bỏ qua. Lệnh stage tạo mật khẩu DB và JWT mới, đồng thời bỏ qua các file cấu hình môi trường, dữ liệu kết xuất và thư mục build.

Mở [AstraLingo Reform](http://localhost:18086). Có thể đăng ký mới hoặc đăng nhập bằng tài khoản mẫu `preview@astralingo.test` với mật khẩu `AstraPreview!2026`.

```powershell
npm.cmd run reform -- status
npm.cmd run reform -- stop
```

Docker dùng dự án và volume PostgreSQL riêng. Lệnh stop giữ dữ liệu. Tài khoản, khóa học và lượt làm bài hiện có ở hệ thống chính cần một kế hoạch chuyển dữ liệu riêng trước khi chuyển người dùng. Những luồng AI và upload dùng GEMINI_API_KEY, GEMINI_SPEAKING_MODEL, SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY từ dịch vụ của nhóm. Đặt các biến cần thiết trong integrations/language-learning-reform/.env.reform ở máy chạy.

Repo công khai cung cấp công cụ tích hợp. Hai ZIP và bản hợp nhất chứa mã từ các ZIP được lưu cục bộ theo quyền sử dụng của nhóm.
