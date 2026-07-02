# Backend setup plan

Tai lieu nay dung de chot kien truc backend truoc khi code. Hien tai chua scaffold module, chua tao Prisma schema, chua viet API logic.

Project backend hien tai la NestJS, nen cau truc nen theo module cua Nest thay vi Express thuong nhu `routes/controllers/server.js`.

## Ket luan kien truc

- `vn-biodiversity-webgis-API` la noi chay NestJS API va noi dung Prisma Client.
- `vn-biodiversity-webgis-DB` nen giu vai tro database workspace: SQL dump, sample data, notes, ERD, migration backup, script import/export.
- Prisma nen dat trong API tai `vn-biodiversity-webgis-API/prisma/schema.prisma`, vi API la ung dung truc tiep query database.
- Khong nen de API import code tu crawler cu. Crawler cu co the o folder rieng va chi cung cap du lieu vao database.
- Backend API can xem dinh danh species la cap `sourceTable + speciesId`, vi du lieu goc tach trong 3 bang `animal_db_vn`, `plant_db_vn`, `insect_db_vn`.

## De xuat lien ket API va DB

```text
vn-biodiversity-webgis
|-- vn-biodiversity-webgis-API
|   |-- prisma
|   |   |-- schema.prisma
|   |   `-- migrations
|   `-- src
|-- vn-biodiversity-webgis-DB
|   |-- dumps
|   |-- samples
|   |-- diagrams
|   |-- scripts
|   `-- notes
`-- crawler-cu-hoac-tools-khac
```

`DB` va `API` co the dat cung workspace/repo cha de de bao tri. Nhung runtime API khong nen phu thuoc truc tiep vao file trong `DB`; API chi ket noi qua `DATABASE_URL`.

## Prisma nen dung the nao

Nen dung mot Prisma schema chinh cho API:

```text
vn-biodiversity-webgis-API
`-- prisma
    |-- schema.prisma
    `-- migrations
```

Trong `schema.prisma`, model se map toi bang co san bang `@@map` va `@map`.

Vi database da co schema SQL rieng, cach lam phu hop la:

1. Import database SQL vao PostgreSQL/PostGIS.
2. Cai Prisma trong API.
3. Cau hinh `DATABASE_URL` trong `.env`.
4. Chay introspection de Prisma doc bang co san.
5. Chinh lai ten model cho de doc nhung van map dung bang goc.

Khong nen chia nhieu Prisma schema ngay tu dau. Nen bat dau bang mot schema duy nhat, roi chia domain o tang NestJS module/service.

## Bang du lieu chinh can map

| Domain | Bang/view lien quan |
| --- | --- |
| Species source | `animal_db_vn`, `plant_db_vn`, `insect_db_vn` |
| Species images | `species_images` |
| Taxonomy | `taxa`, `taxon_names`, `taxon_closure`, `species_taxonomy`, `gbif_taxonomy_cache` |
| Occurrence/WebGIS | `gbif_occurrences`, `species_gbif_occurrence_matches`, view `species_with_gbif_occurrences` |
| Conservation | `conservation_terms`, `species_conservation_terms` |
| Dictionary/keyword | `site_keywords`, `species_keyword_links`, `taxon_names` |

## Cau truc backend de xuat theo NestJS

```text
src
|-- app.module.ts
|-- main.ts
|
|-- config
|   |-- database.config.ts
|   `-- app.config.ts
|
|-- prisma
|   |-- prisma.module.ts
|   `-- prisma.service.ts
|
|-- common
|   |-- dto
|   |   |-- pagination-query.dto.ts
|   |   `-- source-table-param.dto.ts
|   |-- utils
|   |   |-- geojson.util.ts
|   |   |-- normalize-text.util.ts
|   |   `-- pagination.util.ts
|   `-- types
|       |-- source-table.type.ts
|       `-- geojson.type.ts
|
|-- species
|   |-- dto
|   |   |-- species-query.dto.ts
|   |   `-- species-detail-param.dto.ts
|   |-- species.controller.ts
|   |-- species.module.ts
|   |-- species.service.ts
|   `-- species.repository.ts
|
|-- taxonomy
|   |-- dto
|   |   `-- taxonomy-query.dto.ts
|   |-- taxonomy.controller.ts
|   |-- taxonomy.module.ts
|   |-- taxonomy.service.ts
|   `-- taxonomy.repository.ts
|
|-- occurrence
|   |-- dto
|   |   `-- occurrence-query.dto.ts
|   |-- occurrence.controller.ts
|   |-- occurrence.module.ts
|   |-- occurrence.service.ts
|   `-- occurrence.repository.ts
|
|-- conservation
|   |-- dto
|   |   `-- conservation-query.dto.ts
|   |-- conservation.controller.ts
|   |-- conservation.module.ts
|   |-- conservation.service.ts
|   `-- conservation.repository.ts
|
|-- search
|   |-- dto
|   |   `-- search-query.dto.ts
|   |-- search.controller.ts
|   |-- search.module.ts
|   |-- search.service.ts
|   `-- search.repository.ts
|
`-- stats
    |-- stats.controller.ts
    |-- stats.module.ts
    |-- stats.service.ts
    `-- stats.repository.ts
```

## Neu viet theo Express thi tuong ung nhu sau

Vi du ban dua:

```text
routes/species.routes.js
controllers/species.controller.js
services/species.service.js
models/species.model.js
utils/geojson.js
server.js
```

Tuong ung NestJS:

```text
species/species.controller.ts
species/species.service.ts
species/species.repository.ts
prisma/schema.prisma
common/utils/geojson.util.ts
main.ts
```

`routes` trong NestJS nam o decorator cua controller, vi vay khong can folder `routes` rieng.

## API endpoints du kien

```text
GET /species
GET /species/:sourceTable/:speciesId

GET /search

GET /taxonomy/tree
GET /taxonomy/:taxonId/species

GET /occurrences
GET /occurrences/geojson
GET /species/:sourceTable/:speciesId/occurrences

GET /conservation/terms
GET /conservation/species

GET /stats/overview
```

## Mapping theo flow drawio

| Flow | Module backend |
| --- | --- |
| Hien thi danh sach loai | `species` |
| Tim kiem dictionary | `search` |
| Loc taxonomy | `taxonomy` + `species` |
| Loc bao ton | `conservation` + `species` |
| Ban do WebGIS | `occurrence` |
| Chi tiet loai | `species` tong hop source table, taxonomy, image, occurrence, conservation, keyword |
| Thong ke home/intro | `stats` |

## Vai tro repository/service

- `controller`: nhan request, doc params/query, tra response.
- `service`: xu ly use case, ghep du lieu nhieu repository, validate rule nghiep vu.
- `repository`: noi duy nhat goi Prisma query.
- `dto`: kieu query/params/body cho API.
- `common/utils`: ham dung chung nhu normalize keyword, build pagination, convert GeoJSON.

## Luu y quan trong voi du lieu hien tai

### 1. Source table la bat buoc

Khong nen tao endpoint chi co:

```text
GET /species/:speciesId
```

Nen dung:

```text
GET /species/:sourceTable/:speciesId
```

Vi `species_id` den tu 3 bang nguon khac nhau.

### 2. Occurrence can loc toa do hop le

Bang `gbif_occurrences` co `latitude`, `longitude`. Module `occurrence` nen co ham rieng de bo qua hoac danh dau ban ghi thieu toa do truoc khi tao GeoJSON.

### 3. Search nen gom keyword va taxonomy name

Dictionary search nen doc:

- ten Viet Nam / ten Latin trong 3 bang source
- `taxon_names`
- `site_keywords`
- `species_keyword_links`

### 4. Conservation nen tach term va species relation

`conservation_terms` la tu dien trang thai/term. `species_conservation_terms` la bang gan loai voi term.

## Sprint setup de xuat

### Sprint 1 backend setup

- Cai Prisma vao API.
- Tao `.env` cho `DATABASE_URL`.
- Tao `prisma/schema.prisma`.
- Introspect database hien co.
- Tao `prisma.service.ts` va `prisma.module.ts`.
- Chua viet endpoint phuc tap.

### Sprint 2 species + search

- Tao `species` module.
- Tao `search` module.
- Lam list/detail/search theo `sourceTable + speciesId`.

### Sprint 3 taxonomy + conservation

- Tao filter taxonomy.
- Tao filter conservation.

### Sprint 4 occurrence + GeoJSON

- Tao occurrence endpoints.
- Tao `/occurrences/geojson`.
- Phuc vu trang map WebGIS.

### Sprint 5 stats cho home

- Tong hop so loai, so occurrence, so term bao ton, so keyword.
- Phuc vu home/intro cua frontend.

## Cau tra loi ngan gon cho viec tach DB va API

Nen tach `DB` va `API`, nhung Prisma schema nen nam trong `API`.

`DB` giu database artifacts va sample. `API` giu code truy van, Prisma Client, service, controller. Crawler cu co the tiep tuc nam folder rieng, chi can cung ghi vao cung PostgreSQL database hoac xuat SQL/CSV vao folder `DB`.
