# Frontend file map

Ban thiet ke nay dua tren luu do `vncreaturebiodiversitySystem.drawio` va schema trong `vngissql.sql`.
Muc tieu hien tai la tao khung file/folder de code sau, chua gan logic vao app.

## Nguyen tac chinh

- Dinh danh loai phai gom `source_table + species_id`, vi du lieu goc tach theo `animal_db_vn`, `plant_db_vn`, `insect_db_vn`.
- Trang danh sach, tim kiem, loc taxonomy, loc bao ton va ban do deu dung chung query species.
- Ban do doc du lieu tu `gbif_occurrences` thong qua `species_gbif_occurrence_matches`, sau nay nen transform sang GeoJSON o service/mapper.
- Component chi lo hien thi; services lo goi API; models/dto lo kieu du lieu; state store lo giu filter, page, selected species/occurrence.

## Pages

```text
src/app/pages
|-- home
|   |-- home.page.ts
|   |-- home.page.html
|   `-- home.page.css
|-- species-list
|   |-- species-list.page.ts
|   |-- species-list.page.html
|   `-- species-list.page.css
|-- species-detail
|   |-- species-detail.page.ts
|   |-- species-detail.page.html
|   `-- species-detail.page.css
|-- map
|   |-- map.page.ts
|   |-- map.page.html
|   `-- map.page.css
`-- search
    |-- search.page.ts
    |-- search.page.html
    `-- search.page.css
```

## Shared layout

```text
src/app/core
|-- api
|   |-- api-endpoints.ts
|   `-- http-api.service.ts
|-- config
|   `-- app-environment.model.ts
`-- layout
    |-- app-shell
    |   |-- app-shell.component.ts
    |   |-- app-shell.component.html
    |   `-- app-shell.component.css
    `-- navbar
        |-- navbar.component.ts
        |-- navbar.component.html
        `-- navbar.component.css
```

## Data access

```text
src/app/data-access
|-- models
|   |-- species.model.ts
|   |-- source-table.model.ts
|   |-- taxonomy.model.ts
|   |-- occurrence.model.ts
|   |-- conservation.model.ts
|   |-- keyword.model.ts
|   `-- geojson.model.ts
|-- dto
|   |-- species-query.dto.ts
|   |-- occurrence-query.dto.ts
|   `-- search-query.dto.ts
|-- mappers
|   |-- species.mapper.ts
|   |-- taxonomy.mapper.ts
|   `-- occurrence.mapper.ts
`-- services
    |-- species.service.ts
    |-- taxonomy.service.ts
    |-- occurrence.service.ts
    |-- conservation.service.ts
    `-- keyword.service.ts
```

## Feature components

```text
src/app/features
|-- species
|   |-- components
|   |   |-- species-card
|   |   |-- species-grid
|   |   |-- species-gallery
|   |   `-- species-profile
|   `-- state
|       |-- species-list.store.ts
|       `-- species-detail.store.ts
|-- filters
|   |-- components
|   |   |-- filter-sidebar
|   |   |-- taxonomy-filter
|   |   |-- conservation-filter
|   |   |-- source-table-filter
|   |   `-- keyword-filter
|   `-- state
|       `-- species-filter.store.ts
`-- map
    |-- components
    |   |-- map-view
    |   |-- map-toolbar
    |   |-- occurrence-popup
    |   `-- occurrence-layer-control
    `-- state
        |-- map.store.ts
        `-- occurrence-layer.store.ts
```

## Shared components and utils

```text
src/app/shared
|-- components
|   |-- loading-state
|   |-- empty-state
|   |-- error-state
|   |-- pagination
|   `-- search-box
`-- utils
    |-- normalize-text.util.ts
    |-- species-key.util.ts
    `-- geojson.util.ts
```

## Mapping voi bang du lieu

| UI area | File nhan chinh | Bang/view lien quan |
| --- | --- | --- |
| Danh sach loai | `species.service.ts`, `species-card` | `animal_db_vn`, `plant_db_vn`, `insect_db_vn`, `species_images` |
| Chi tiet loai | `species-detail.page`, `species-profile`, `species-gallery` | bang source theo `source_table`, `species_taxonomy`, `species_images`, `species_conservation_terms`, `species_keyword_links` |
| Tim kiem dictionary | `search.page`, `search-box`, `keyword.service.ts` | `taxon_names`, `site_keywords`, `species_keyword_links`, cac cot ten Viet Nam/Latin |
| Loc taxonomy | `taxonomy-filter`, `taxonomy.service.ts` | `taxa`, `taxon_closure`, `taxon_names`, `species_taxonomy`, `gbif_taxonomy_cache` |
| Loc bao ton | `conservation-filter`, `conservation.service.ts` | `conservation_terms`, `species_conservation_terms` |
| Loc nhom nguon | `source-table-filter` | `animal_db_vn`, `plant_db_vn`, `insect_db_vn` |
| Ban do WebGIS | `map.page`, `map-view`, `occurrence.service.ts`, `occurrence.mapper.ts` | `gbif_occurrences`, `species_gbif_occurrence_matches`, view `species_with_gbif_occurrences` |
| Popup diem quan sat | `occurrence-popup` | `gbif_occurrences` va thong tin species match |

## Routes du kien

```text
/                  -> home
/species           -> species-list
/species/:sourceTable/:speciesId -> species-detail
/map               -> map
/search            -> search
```

`sourceTable` nen nhan cac gia tri: `animal_db_vn`, `plant_db_vn`, `insect_db_vn`.
