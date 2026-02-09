# Offboard Checklist - Quản lý nghỉ việc

Ứng dụng quản lý Offboard checklist khi có nhân sự nghỉ việc: tạo ticket, theo dõi checklist, xem chi tiết và tải file Excel.

## Cấu trúc dự án

- **frontend/** – React (Vite), giao diện quản lý
- **backend/** – Node.js + Express, API + PostgreSQL

## Yêu cầu

- Node.js 18+
- PostgreSQL (chạy trực tiếp hoặc qua Docker)

## Chạy dự án

### 1. Chạy toàn bộ bằng Docker (DB + Backend + Frontend)

Ở thư mục gốc dự án:

```bash
docker-compose up -d --build
```

- **Frontend:** http://localhost:3000  
- **Backend API:** http://localhost:4000  
- **PostgreSQL:** localhost:5432 (database `offboard_checklist`, user `postgres`, password `password`)

**Chỉ chạy database** (khi dev backend + frontend bằng `npm run dev` trên máy):

```bash
docker-compose up -d db
```

Giữ container `db` chạy khi bạn chạy `npm run dev` cho backend/frontend. Nếu tắt Docker (hoặc chỉ tắt `db`), backend sẽ không kết nối được DB và `npm run db:init` sẽ báo ECONNREFUSED. Khi DB bị ngắt giữa chừng, backend đã được cấu hình để không crash (chỉ log lỗi); khởi động lại DB rồi gửi request lại là được.

PostgreSQL chạy tại `localhost:5432`, khớp với `backend/.env.example`.

Nếu dùng PostgreSQL cài sẵn trên máy, tạo database:

```sql
CREATE DATABASE offboard_checklist;
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Sửa .env: DATABASE_URL nếu cần (user/password/port)
npm install
npm run db:init
npm run dev
```

API chạy tại: http://localhost:4000

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Giao diện chạy tại: http://localhost:3000 (proxy `/api` sang backend).

## Chức năng

- **Header:** Nút "Tạo ticket Offboard" mở form nhập: Họ và tên nhân viên, ID, Email, Vị trí, Manager, Ngày làm việc cuối cùng, Trạng thái, Người tạo.
- **Danh sách ticket:** Cột Ticket (tên), Ngày tạo, Người tạo, Trạng thái, Thời gian hoàn thành, Xem chi tiết, Tải .xlsx.
- **Chi tiết ticket:** Thông tin nhân viên + bảng checklist (Bàn giao công việc, Backup & lưu trữ dữ liệu, …) với Trạng thái, Ngày hoàn tất, Evidence/Ghi chú; có thể sửa từng dòng và tải file Excel.

Trạng thái: Chưa thực hiện | Đang thực hiện | Hoàn thành.
