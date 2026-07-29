# Portable Docker Package

## Đóng gói trên máy hiện tại

Chạy tại thư mục gốc project:

```powershell
.\scripts\docker-package.ps1
```

Kết quả nằm trong:

```text
docker-package/
```

Folder này gồm:

- `docker-compose.yml`: compose chạy bằng Docker images đã đóng gói sẵn.
- `.env.docker.example`: env mẫu, không chứa mật khẩu thật của project.
- `images/vn-biodiversity-webgis-images.tar`: image PostgreSQL, API và UI.
- `vn-biodiversity-webgis-DB/docker-init`: SQL dump dùng để import DB lần đầu.
- `docker-load.ps1`: script load images trên máy khác.

Nếu chỉ muốn đóng gói image, không copy database dump:

```powershell
.\scripts\docker-package.ps1 -SkipDatabase
```

## Chạy trên laptop hoặc máy khác

Copy toàn bộ folder `docker-package/` sang máy mới, mở PowerShell trong folder đó:

```powershell
Copy-Item .env.docker.example .env.docker
.\docker-load.ps1
docker compose --env-file .env.docker up
```

Nếu đổi `POSTGRES_PASSWORD` trong `.env.docker`, nhớ đổi cùng password trong `DATABASE_URL`.

Ví dụ:

```text
POSTGRES_PASSWORD=123
DATABASE_URL=postgresql://postgres:123@db:5432/vn_biodiversity?schema=public
```

## Kiểm tra sau khi chạy

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:4200/api/health
```

Kết quả đúng:

```text
api database
ok  ok
```
