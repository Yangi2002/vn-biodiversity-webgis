# VN Biodiversity WebGIS

VN Biodiversity WebGIS là hệ thống tra cứu, phân loại, hiển thị bản đồ phân bố và thống kê dữ liệu đa dạng sinh học Việt Nam. Dự án được xây dựng theo kiến trúc Frontend - Backend - Database, tập trung vào 4 nhóm dữ liệu chính: hồ sơ loài, taxonomy, occurrence/WebGIS và bảo tồn.

## Trạng Thái Hiện Tại

Dự án đã hoàn thành nền tảng Sprint 1, Sprint 2 và Sprint 3:

- Sprint 1: Setup project, kết nối Angular - NestJS - PostgreSQL/Prisma, tạo trang chủ và nền tảng species dictionary.
- Sprint 2: Hoàn thiện danh mục loài, trang chi tiết loài, taxonomy, keyword reference, thư viện ảnh và VN Red List cơ bản.
- Sprint 3: Mở rộng thành WebGIS biodiversity platform với occurrence map, species detail map, statistics dashboard và conservation layer.

## Chức Năng Chính

### Trang Chủ

- Giới thiệu tổng quan hệ thống.
- Tra cứu nhanh loài.
- Điều hướng đến danh mục loài, taxonomy, WebGIS, thống kê và danh sách đỏ.
- Hiển thị các chỉ số tổng quan của hệ thống.

### Danh Mục Loài

- Hiển thị dữ liệu loài từ 3 bảng gốc: động vật, thực vật và côn trùng.
- Tìm kiếm theo tên Việt Nam, tên khoa học, họ, bộ, lớp/nhóm.
- Lọc theo nhóm sinh vật và taxonomy cơ bản.
- Pagination và card loài có ảnh đại diện.
- Mở sang trang chi tiết loài.

### Trang Chi Tiết Loài

- Hiển thị tên Việt Nam, tên khoa học, mã loài, lớp/nhóm, bộ, họ.
- Hiển thị title block và các nội dung mô tả theo record gốc.
- Hiển thị thư viện ảnh và ảnh chính từ metadata ảnh nếu có.
- Hiển thị cây phân loại taxonomy.
- Hiển thị keyword reference với popup nội dung tham chiếu.
- Hiển thị thông tin VN Red List nếu loài có hồ sơ bảo tồn.
- Hiển thị bản đồ occurrence riêng của từng loài.

### Taxonomy

- Tìm kiếm taxon theo tên khoa học hoặc tên Việt Nam.
- Lọc theo rank: root, giới, ngành, lớp, bộ, họ, chi, loài.
- Hiển thị thumbnail đại diện nếu có.
- Mở danh sách loài liên quan theo taxonomy.
- Kết nối taxonomy path với trang chi tiết loài.

### WebGIS

- Tích hợp Leaflet và OpenStreetMap.
- Hiển thị occurrence grid theo vùng/cell thay vì render toàn bộ điểm riêng lẻ.
- Hỗ trợ layer raster/vector:
  - OpenStreetMap
  - Satellite
  - Light map
  - Occurrence grid
  - Vietnam provinces GeoJSON
- Lọc theo nhóm sinh vật, năm bắt đầu, năm kết thúc và kích thước grid.
- Panel tổng quan hoặc panel cell đang chọn.
- Popup/tooltip vùng, tỉnh và số occurrence.
- Hiển thị loài đại diện và taxonomy nổi bật trong cell.

### Species Detail Map

- Hiển thị occurrence riêng của loài trong trang chi tiết.
- Dùng marker/pinpoint thay vì grid.
- Có clustering nhẹ khi nhiều điểm occurrence.
- Popup marker ngắn gọn: tên loài, ngày ghi nhận, vùng/locality và link nguồn.
- Panel chi tiết có:
  - Tọa độ
  - Ngày ghi nhận
  - Observer
  - Basis of record
  - Region/locality
  - GADM theo level
  - Ảnh occurrence nếu có
- Filter theo năm, vùng/tỉnh, basis of record và trạng thái có ảnh.

### Statistics Dashboard

- Tổng quan số loài, occurrence, vùng ghi nhận và occurrence có ảnh.
- Lọc thống kê theo nhóm sinh vật, năm, basis of record và ảnh occurrence.
- Biểu đồ tỷ lệ nhóm sinh vật.
- Biểu đồ occurrence theo năm.
- Biểu đồ dạng ghi nhận.
- Thống kê vùng ghi nhận nổi bật.
- Thống kê taxonomy sâu theo lớp, bộ, họ, chi.
- Timeline occurrence theo tỉnh/vùng.
- Export CSV phục vụ báo cáo.

### Danh Sách Đỏ Việt Nam

- Hiển thị danh sách loài có hồ sơ VN Red List.
- Hiển thị mức nguy cơ, tiêu chí, năm công bố, người đánh giá và người đóng góp nếu có.
- Label mức nguy cơ lấy từ dữ liệu, không hardcode.
- Search/filter danh sách đỏ.
- Mở trang chi tiết loài và nguồn VN Red List.
- Kết nối thông tin bảo tồn vào species detail.

## Kiến Trúc Thư Mục

```text
vn-biodiversity-webgis/
|-- vn-biodiversity-webgis-UI/
|   |-- src/
|   |   |-- app/
|   |   |   |-- pages/
|   |   |   |-- shared/
|   |   |   |-- data-access/
|   |   |   `-- app.routes.ts
|   |   |-- public/
|   |   `-- styles.css
|   `-- package.json
|
|-- vn-biodiversity-webgis-API/
|   |-- src/
|   |   |-- species/
|   |   |-- taxonomy/
|   |   |-- occurrence/
|   |   |-- stats/
|   |   |-- conservation/
|   |   |-- prisma/
|   |   `-- main.ts
|   |-- prisma/
|   `-- package.json
|
`-- README.md
```

## Kiến Trúc Hoạt Động

```text
User
  -> Angular UI
  -> Data access service
  -> NestJS REST API
  -> Service layer
  -> Repository layer
  -> Prisma
  -> PostgreSQL/PostGIS
  -> JSON/GeoJSON response
  -> UI render card, dashboard, map, popup
```

## Backend Modules

### Species

- Danh sách loài.
- Trang chi tiết loài.
- Ảnh loài và showpic metadata.
- Taxonomy path theo từng loài.
- Keyword reference trong nội dung chi tiết.
- Thông tin VN Red List gắn với hồ sơ loài.

### Taxonomy

- Tìm kiếm taxon.
- Lọc theo rank.
- Đếm số loài con.
- Lấy ảnh đại diện theo taxon.
- Mở danh sách loài liên quan.

### Occurrence

- WebGIS overview grid.
- Cell detail.
- Species occurrence map.
- Region/locality/GADM từ source payload.
- Filter và sampling marker.

### Stats

- Summary dashboard.
- Group ratio.
- Temporal trend.
- Spatial ranking.
- Data quality.
- Data source.
- Taxonomy depth.
- Region timeline.
- CSV export.

### Conservation

- VN Red List list page.
- Summary category.
- Search/filter.
- Link hồ sơ bảo tồn vào species detail.

## Frontend Pages

- `/` - Trang chủ
- `/species-list` - Danh mục loài
- `/species/:sourceTable/:speciesId` - Chi tiết loài
- `/taxonomy` - Phân loại sinh học
- `/map` - Bản đồ WebGIS
- `/statistics` - Thống kê
- `/endangered-species` - Danh sách đỏ Việt Nam

## Cách Chạy Dự Án

### Backend

```bash
cd vn-biodiversity-webgis-API
npm install
npm run start:dev
```

Backend mặc định chạy tại:

```text
http://localhost:3000
```

### Frontend

```bash
cd vn-biodiversity-webgis-UI
npm install
npm start
```

Frontend mặc định chạy tại:

```text
http://localhost:4200
```

## Lưu Ý Cấu Hình Bảo Mật

- Không ghi database connection string trong README.
- Không commit file cấu hình local có chứa credential.
- Cấu hình kết nối database và API URL được quản lý riêng trong môi trường local/deploy.
- Khi chia sẻ tài liệu, chỉ mô tả cách vận hành, không đưa mật khẩu, user, host nội bộ hoặc connection string thật.

## Nguồn Tham Chiếu

- VNCreatures: https://www.vncreatures.net/
- GBIF: https://www.gbif.org/
- iNaturalist: https://www.inaturalist.org/
- VN Red List: https://vnredlist.vast.vn/
- Leaflet: https://leafletjs.com/
- OpenStreetMap: https://www.openstreetmap.org/
- Angular: https://angular.dev/
- NestJS: https://nestjs.com/
- Prisma: https://www.prisma.io/
- PostgreSQL: https://www.postgresql.org/
- PostGIS: https://postgis.net/

## Ghi Chú Kỹ Thuật

- Hệ thống đã build và chạy được ở mức Sprint 3.
- Angular có thể còn warning về CSS/bundle budget trong môi trường development, nhưng không phải lỗi runtime.
- API WebGIS, statistics và species detail map đã có cache/tối ưu cơ bản.
- Nếu dữ liệu occurrence tăng lớn hơn, có thể nâng cấp bằng materialized view hoặc precomputed grid table.
- VN Red List hiện dùng dữ liệu đã có trong hệ thống; IUCN hoặc nguồn bảo tồn khác sẽ để cho Sprint 4/giai đoạn sau.
