# Docker Deployment

## 1. Chuẩn bị env

Tạo file `.env.docker` từ `.env.docker.example`, sau đó đổi các giá trị `change_me` theo máy/server của anh.

Không commit `.env.docker` vì file này chứa mật khẩu database và secret đăng nhập.

## 2. Chuẩn bị database

Nếu database đã có sẵn trên PostgreSQL ngoài Docker, chỉ cần trỏ `DATABASE_URL` trong `.env.docker` tới database đó.

Nếu muốn Docker tự import dump lần đầu, đặt file `.sql`, `.sql.gz` hoặc `.sh` vào:

```text
vn-biodiversity-webgis-DB/docker-init/
```

PostgreSQL chỉ chạy các file init này khi volume database còn trống.

## 3. Build và chạy

```bash
docker compose --env-file .env.docker up --build
```

Sau khi chạy:

- Frontend: `http://localhost:4200`
- Backend API: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

## 4. Seed tài khoản admin

Sau khi database đã có schema:

```bash
docker compose --env-file .env.docker exec api node dist/src/scripts/seed-admin-user.js
```

## 5. Dừng hệ thống

```bash
docker compose down
```

Muốn xóa cả volume database local:

```bash
docker compose down -v
```
