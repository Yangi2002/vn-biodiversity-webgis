# WEBGIS Biodiversity

## Giới thiệu

**WEBGIS Biodiversity** là hệ thống WebGIS phục vụ tra cứu, quản lý và hiển thị dữ liệu đa dạng sinh học tại Việt Nam. Dự án tập trung vào việc xây dựng một nền tảng bản đồ trực tuyến cho phép người dùng xem danh sách loài, tra cứu thông tin sinh vật, hiển thị vị trí phân bố trên bản đồ 2D và quản lý dữ liệu loài từ nhiều nguồn khác nhau.

Hệ thống được xây dựng theo mô hình **Frontend – Backend – Database**, sử dụng Angular cho giao diện người dùng, NestJS cho API backend và PostgreSQL/PostGIS để lưu trữ dữ liệu thuộc tính và dữ liệu không gian.

## Mục tiêu dự án

Dự án hướng đến việc xây dựng một hệ thống WebGIS đa dạng sinh học có các chức năng chính sau:

* Tra cứu thông tin động vật, thực vật và côn trùng.
* Hiển thị danh sách loài theo nhóm sinh vật.
* Xem chi tiết từng loài gồm tên Việt Nam, tên khoa học, phân loại sinh học, đặc điểm nhận dạng, sinh học – sinh thái, phân bố và hình ảnh.
* Hiển thị dữ liệu phân bố sinh vật trên bản đồ WebGIS 2D.
* Lọc dữ liệu theo nhóm loài, họ, bộ, lớp, tên khoa học hoặc tên Việt Nam.
* Tích hợp dữ liệu không gian bằng PostgreSQL/PostGIS.
* Chuẩn hóa dữ liệu từ các nguồn như VNCreatures, GBIF và iNaturalist.
* Hỗ trợ mở rộng cho các chức năng nâng cao như quản trị dữ liệu, thống kê, bảo tồn, bản đồ phân bố và phân tích không gian.

## Công nghệ sử dụng

### Frontend

* **Angular** – Framework xây dựng giao diện web.
* **TypeScript** – Ngôn ngữ lập trình chính cho frontend.
* **Leaflet** – Thư viện hiển thị bản đồ tương tác.
* **HTML / CSS / Bootstrap** – Xây dựng giao diện người dùng.
* **OpenStreetMap** – Nền bản đồ raster sử dụng cho WebGIS.

### Backend

* **NestJS** – Framework backend Node.js dùng để xây dựng REST API.
* **TypeScript** – Ngôn ngữ chính cho backend.
* **Prisma ORM** – Kết nối và thao tác với cơ sở dữ liệu PostgreSQL.
* **REST API** – Giao tiếp dữ liệu giữa frontend và backend.

### Database

* **PostgreSQL** – Hệ quản trị cơ sở dữ liệu quan hệ.
* **PostGIS** – Phần mở rộng của PostgreSQL dùng để lưu trữ và truy vấn dữ liệu không gian.
* **JSON / JSONB** – Lưu trữ dữ liệu nguồn, mô tả loài và dữ liệu chưa chuẩn hóa.

## Nguồn dữ liệu tham khảo

Dữ liệu trong dự án có thể được tổng hợp, chuẩn hóa hoặc tham khảo từ các nguồn sau:

### 1. VNCreatures

VNCreatures là nguồn dữ liệu chính tham khảo thông tin sinh vật tại Việt Nam, bao gồm động vật, thực vật và côn trùng.

* Website: https://www.vncreatures.net/
* Trang tra cứu tiếng Anh: https://www.vncreatures.net/e_tracuu.php

Dữ liệu tham khảo có thể bao gồm:

* Tên Việt Nam
* Tên khoa học
* Họ
* Bộ
* Lớp / nhóm
* Đặc điểm nhận dạng
* Sinh học – sinh thái
* Phân bố
* Công dụng
* Hình ảnh minh họa

### 2. GBIF – Global Biodiversity Information Facility

GBIF là hệ thống dữ liệu đa dạng sinh học toàn cầu, cung cấp dữ liệu ghi nhận xuất hiện của loài theo vị trí địa lý.

* Website: https://www.gbif.org/
* Occurrence API: https://techdocs.gbif.org/en/openapi/v1/occurrence

Dữ liệu có thể dùng từ GBIF:

* Occurrence key
* Taxon key
* Scientific name
* Latitude / longitude
* Observation date
* Country / locality
* Basis of record
* Media URL
* Dataset source

### 3. iNaturalist

iNaturalist là nền tảng ghi nhận quan sát sinh vật từ cộng đồng, có thể dùng để tham khảo thêm dữ liệu hình ảnh, vị trí quan sát và thông tin loài.

* Website: https://www.inaturalist.org/
* API: https://www.inaturalist.org/api
* API v2 Docs: https://api.inaturalist.org/v2/docs/

Dữ liệu có thể dùng từ iNaturalist:

* Common name
* Scientific name
* Observation location
* Observation date
* Observer
* Quality grade
* Image URL
* Taxon information

### 4. OpenStreetMap

OpenStreetMap được sử dụng làm nền bản đồ raster cho hệ thống WebGIS.

* Website: https://www.openstreetmap.org/
* Tile Usage Policy: https://operations.osmfoundation.org/policies/tiles/

Lưu ý: Khi triển khai thật hoặc có lượng truy cập lớn, không nên lạm dụng tile server mặc định của OpenStreetMap. Nên dùng tile server riêng hoặc dịch vụ bản đồ phù hợp.

### 5. Leaflet

Leaflet được sử dụng để hiển thị bản đồ tương tác, lớp GeoJSON, marker, popup và layer control.

* Website: https://leafletjs.com/
* GeoJSON Docs: https://leafletjs.com/examples/geojson/
* API Reference: https://leafletjs.com/reference.html

### 6. Angular

Angular được sử dụng để xây dựng giao diện frontend của hệ thống.

* Website: https://angular.dev/
* Documentation: https://angular.dev/overview

### 7. NestJS

NestJS được sử dụng để xây dựng backend API.

* Website: https://nestjs.com/
* Documentation: https://docs.nestjs.com/

### 8. PostgreSQL

PostgreSQL được sử dụng để lưu trữ dữ liệu sinh vật, dữ liệu phân loại và dữ liệu hệ thống.

* Website: https://www.postgresql.org/
* Documentation: https://www.postgresql.org/docs/

### 9. PostGIS

PostGIS được dùng để mở rộng PostgreSQL, hỗ trợ lưu trữ và truy vấn dữ liệu không gian như điểm phân bố loài, vùng phân bố và dữ liệu bản đồ.

* Website: https://postgis.net/
* Documentation: https://postgis.net/documentation/

### 10. Prisma ORM

Prisma được sử dụng để kết nối backend NestJS với PostgreSQL một cách type-safe.

* Website: https://www.prisma.io/
* Documentation: https://www.prisma.io/docs

## Chức năng chính

### 1. Trang chủ

Trang chủ giới thiệu tổng quan về hệ thống WebGIS Biodiversity, mục tiêu dự án, dữ liệu sinh vật và các nhóm chức năng chính.

### 2. Tra cứu loài

Người dùng có thể tra cứu sinh vật theo:

* Tên Việt Nam
* Tên khoa học
* Nhóm sinh vật
* Họ
* Bộ
* Lớp
* Từ khóa liên quan

### 3. Danh sách sinh vật

Hệ thống hiển thị danh sách các loài đã được lưu trong cơ sở dữ liệu, có thể phân loại theo:

* Động vật
* Thực vật
* Côn trùng

Mỗi loài có thể hiển thị các thông tin cơ bản như:

* Hình ảnh
* Tên Việt Nam
* Tên khoa học
* Nhóm phân loại
* Trạng thái dữ liệu
* Nguồn dữ liệu

### 4. Trang chi tiết loài

Trang chi tiết loài hiển thị thông tin đầy đủ của từng sinh vật, bao gồm:

* Tên Việt Nam
* Tên Latin / tên khoa học
* Hình ảnh
* Họ
* Bộ
* Lớp / nhóm
* Đặc điểm nhận dạng
* Sinh học – sinh thái
* Phân bố
* Công dụng
* Dữ liệu bản đồ phân bố
* Nguồn dữ liệu tham khảo

### 5. Bản đồ WebGIS 2D

Chức năng bản đồ cho phép người dùng xem vị trí phân bố sinh vật trên nền bản đồ.

Các chức năng bản đồ gồm:

* Hiển thị điểm phân bố loài.
* Hiển thị popup thông tin khi click vào marker.
* Lọc marker theo nhóm sinh vật.
* Tìm kiếm loài trên bản đồ.
* Zoom đến vị trí phân bố.
* Bật/tắt các lớp bản đồ.
* Sử dụng nền bản đồ OpenStreetMap.

### 6. Bộ lọc dữ liệu

Hệ thống hỗ trợ lọc dữ liệu theo nhiều tiêu chí:

* Nhóm sinh vật
* Tên loài
* Tên khoa học
* Họ
* Bộ
* Lớp
* Nguồn dữ liệu
* Khu vực phân bố
* Có hoặc không có tọa độ
* Có hoặc không có hình ảnh

### 7. Quản lý dữ liệu

Phần quản lý dữ liệu có thể mở rộng cho admin trong tương lai, bao gồm:

* Thêm loài mới
* Cập nhật thông tin loài
* Xóa dữ liệu sai
* Kiểm tra dữ liệu thiếu
* Chuẩn hóa tên khoa học
* Gắn tọa độ phân bố
* Kiểm tra nguồn dữ liệu

## Mô hình hoạt động hệ thống

Luồng hoạt động tổng quát:

```text
Người dùng
   ↓
Frontend Angular
   ↓
Gửi request API
   ↓
Backend NestJS
   ↓
Prisma ORM
   ↓
PostgreSQL / PostGIS
   ↓
Trả dữ liệu JSON / GeoJSON
   ↓
Frontend hiển thị danh sách, chi tiết loài và bản đồ WebGIS
```

## Kiến trúc hệ thống

```text
WEBGIS-Biodiversity/
│
├── frontend/
│   ├── src/
│   ├── app/
│   ├── components/
│   ├── pages/
│   ├── services/
│   └── models/
│
├── backend/
│   ├── src/
│   ├── modules/
│   ├── controllers/
│   ├── services/
│   ├── prisma/
│   └── models/
│
├── database/
│   ├── schema.sql
│   ├── seed/
│   ├── migrations/
│   └── raw-data/
│
├── docs/
│   ├── diagrams/
│   ├── report/
│   └── screenshots/
│
└── README.md
```

## Gợi ý cấu trúc database

Một số bảng chính có thể sử dụng trong hệ thống:

```text
species
├── id
├── vietnamese_name
├── scientific_name
├── kingdom
├── phylum
├── class_name
├── order_name
├── family_name
├── genus
├── species
├── group_type
├── description
├── ecology
├── distribution
├── usage
├── image_url
├── source
├── source_url
├── created_at
└── updated_at
```

```text
occurrences
├── id
├── species_id
├── latitude
├── longitude
├── observed_date
├── location
├── observer
├── source
├── occurrence_url
├── geom
├── created_at
└── updated_at
```

```text
gbif_occurrence
├── gbif_occurrence_key
├── gbif_taxon_key
├── image_url
├── latitude
├── longitude
├── observed_date
├── location
├── observer
├── quality_grade
├── basis_of_record
├── has_geospatial_issue
├── issues
├── occurrence_url
├── source_payload
├── created_at
└── updated_at
```

## Cài đặt dự án

### 1. Clone repository

```bash
git clone https://github.com/Yangi2002/vn-biodiversity-webgis.git
cd vn-biodiversity-webgis
```

### 2. Cài đặt frontend

```bash
cd frontend
npm install
npm run start
```

Frontend chạy mặc định tại:

```text
http://localhost:4200
```

### 3. Cài đặt backend

```bash
cd backend
npm install
npm run start:dev
```

Backend chạy mặc định tại:

```text
http://localhost:3000
```

### 4. Cấu hình môi trường backend

Tạo file `.env` trong thư mục backend:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/webgis_biodiversity?schema=public"
PORT=3000
```

### 5. Khởi tạo Prisma

```bash
npx prisma generate
npx prisma migrate dev
```

### 6. Bật PostGIS trong PostgreSQL

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Kiểm tra PostGIS:

```sql
SELECT PostGIS_Version();
```

## API dự kiến

### Species API

```text
GET    /api/species
GET    /api/species/:id
POST   /api/species
PATCH  /api/species/:id
DELETE /api/species/:id
```

### Occurrence API

```text
GET    /api/occurrences
GET    /api/occurrences/species/:speciesId
POST   /api/occurrences
DELETE /api/occurrences/:id
```

### Map API

```text
GET /api/map/species-points
GET /api/map/species-geojson
GET /api/map/filter?group=animal
```

## Định dạng GeoJSON trả về cho bản đồ

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [106.6297, 10.8231]
      },
      "properties": {
        "species_id": "animal_001",
        "vietnamese_name": "Ví dụ loài",
        "scientific_name": "Species example",
        "group_type": "animal",
        "source": "VNCreatures"
      }
    }
  ]
}
```

## Trạng thái phát triển

* [x] Xây dựng ý tưởng hệ thống WebGIS Biodiversity.
* [x] Thu thập dữ liệu sinh vật từ VNCreatures.
* [x] Chuẩn bị dữ liệu động vật, thực vật và côn trùng.
* [x] Thiết kế hướng lưu trữ PostgreSQL/PostGIS.
* [x] Xây dựng frontend bằng Angular.
* [x] Xây dựng backend bằng NestJS.
* [ ] Chuẩn hóa toàn bộ dữ liệu loài.
* [ ] Tích hợp bản đồ phân bố bằng Leaflet.
* [ ] Tích hợp dữ liệu GBIF/iNaturalist.
* [ ] Hoàn thiện chức năng lọc và tìm kiếm nâng cao.
* [ ] Xây dựng trang quản trị dữ liệu.
* [ ] Triển khai hệ thống.

## Hướng phát triển tiếp theo

Trong tương lai, hệ thống có thể mở rộng thêm:

* Chức năng đăng nhập cho admin.
* Dashboard thống kê số lượng loài.
* Bản đồ heatmap phân bố sinh vật.
* Tích hợp dữ liệu bảo tồn như Sách Đỏ Việt Nam hoặc IUCN.
* Tìm kiếm nâng cao theo phân loại sinh học.
* Chuẩn hóa tên khoa học với GBIF Backbone Taxonomy.
* Upload dữ liệu Excel/CSV.
* Xuất dữ liệu ra CSV/JSON/GeoJSON.
* Quản lý hình ảnh loài.
* Tích hợp GeoServer cho WMS/WFS.
* Phân quyền người dùng: người xem, admin, nhà nghiên cứu.

## Lưu ý về dữ liệu

Dữ liệu trong dự án được sử dụng cho mục đích học tập, nghiên cứu và xây dựng hệ thống thử nghiệm. Khi sử dụng dữ liệu từ các nguồn bên ngoài, cần ghi rõ nguồn tham khảo và tuân thủ điều khoản sử dụng của từng website hoặc API.

Đối với dữ liệu từ VNCreatures, cần ghi nguồn rõ ràng vì đây là nguồn tham khảo chính về thông tin sinh vật Việt Nam.

Đối với OpenStreetMap, cần tuân thủ chính sách sử dụng tile server, đặc biệt nếu triển khai hệ thống công khai hoặc có lượng truy cập lớn.

## Tác giả

Dự án được thực hiện bởi:

**Thiện Chính Dương**

Mục tiêu: xây dựng hệ thống WebGIS hỗ trợ tra cứu và hiển thị dữ liệu đa dạng sinh học Việt Nam.

## License

Dự án này được xây dựng cho mục đích học tập và nghiên cứu.

Nếu sử dụng dữ liệu, hình ảnh hoặc API từ bên thứ ba, vui lòng kiểm tra license và điều khoản sử dụng của từng nguồn trước khi triển khai chính thức.
