const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const CSV_PATH = 'D:/Duong/VNCreaturesDatabase/output_wp/Species_WP_New.csv';
const WP_OUTPUT_ROOT = 'D:/Duong/VNCreaturesDatabase/output_wp';
const SOURCE_TABLES = ['animal_db_vn', 'plant_db_vn', 'insect_db_vn'];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
      row.push(current);
      if (row.some((value) => value !== '')) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }

  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, ''));
  return rows.map((columns) => Object.fromEntries(headers.map((header, index) => [header, columns[index] ?? ''])));
}

function normalizeVietnamese(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeLatin(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function basename(value) {
  return path.basename(String(value || '').split('#')[0].split('?')[0]).toLowerCase();
}

function mimeFromFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') {
    return 'image/png';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  return 'image/jpeg';
}

function jpegSize(buffer) {
  let index = 2;
  while (index + 9 < buffer.length) {
    if (buffer[index] !== 0xff) {
      index += 1;
      continue;
    }

    const marker = buffer[index + 1];
    const length = buffer.readUInt16BE(index + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(index + 5),
        width: buffer.readUInt16BE(index + 7),
      };
    }
    index += 2 + length;
  }

  return { width: null, height: null };
}

async function main() {
  const csvRows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const existingRows = (
    await client.query(`
      SELECT
        source_table,
        species_id,
        image_order,
        source_image_url,
        imagepath,
        image_local_path,
        showpic_url,
        source_payload ->> 'source_type' AS source_type
      FROM species_showpic_metadata
    `)
  ).rows;

  const existingWpFilenames = new Map();
  const maxOrders = new Map();

  for (const existing of existingRows) {
    const key = `${existing.source_table}|${existing.species_id}`;
    maxOrders.set(key, Math.max(maxOrders.get(key) || 0, Number(existing.image_order) || 0));

    if (existing.source_type !== 'wordpress_species_gallery') {
      continue;
    }

    const filenames = existingWpFilenames.get(key) || new Set();
    for (const candidate of [
      existing.source_image_url,
      existing.imagepath,
      existing.image_local_path,
      existing.showpic_url,
    ]) {
      const name = basename(candidate);
      if (name) {
        filenames.add(name);
      }
    }
    existingWpFilenames.set(key, filenames);
  }

  let inserted = 0;
  let skippedWp = 0;
  let missingFile = 0;

  for (const sourceTable of SOURCE_TABLES) {
    const localSpecies = (await client.query(`SELECT species_id, ten_viet_nam, ten_latin FROM ${sourceTable}`)).rows;
    const byLatin = new Map();
    const byVietnamese = new Map();

    for (const species of localSpecies) {
      const latin = normalizeLatin(species.ten_latin);
      if (latin && latin !== 'chua co ten') {
        byLatin.set(latin, [...(byLatin.get(latin) || []), species]);
      }

      const vietnamese = normalizeVietnamese(species.ten_viet_nam);
      if (vietnamese) {
        byVietnamese.set(vietnamese, [...(byVietnamese.get(vietnamese) || []), species]);
      }
    }

    const wordpressRows = csvRows.filter(
      (row) => row.source_table === sourceTable && row.hinh && (row.source_post_url || row.detail_url),
    );

    for (const wordpressRow of wordpressRows) {
      const matchedSpecies = new Map();
      for (const species of byLatin.get(normalizeLatin(wordpressRow.ten_latin)) || []) {
        matchedSpecies.set(species.species_id, species);
      }
      for (const species of byVietnamese.get(normalizeVietnamese(wordpressRow.ten_viet_nam)) || []) {
        matchedSpecies.set(species.species_id, species);
      }

      for (const species of matchedSpecies.values()) {
        const key = `${sourceTable}|${species.species_id}`;
        const filenames = existingWpFilenames.get(key) || new Set();

        for (const relativeImagePath of wordpressRow.hinh.split(';').map((item) => item.trim()).filter(Boolean)) {
          const filename = basename(relativeImagePath);
          if (filenames.has(filename)) {
            skippedWp += 1;
            continue;
          }

          const localImagePath = path.resolve(WP_OUTPUT_ROOT, relativeImagePath.replaceAll('/', path.sep));
          if (!fs.existsSync(localImagePath)) {
            missingFile += 1;
            continue;
          }

          const imageData = fs.readFileSync(localImagePath);
          const imageMimeType = mimeFromFile(localImagePath);
          let dimensions = { width: null, height: null };
          try {
            if (imageMimeType === 'image/jpeg') {
              dimensions = jpegSize(imageData);
            }
          } catch {
            dimensions = { width: null, height: null };
          }

          const nextOrder = (maxOrders.get(key) || 0) + 1;
          maxOrders.set(key, nextOrder);

          const foreignKeys = {
            animal_species_id: sourceTable === 'animal_db_vn' ? species.species_id : null,
            plant_species_id: sourceTable === 'plant_db_vn' ? species.species_id : null,
            insect_species_id: sourceTable === 'insect_db_vn' ? species.species_id : null,
          };
          const sourcePostUrl = wordpressRow.source_post_url || wordpressRow.detail_url;
          const sourcePayload = {
            source_type: 'wordpress_species_gallery',
            source_csv_id: wordpressRow.species_id,
            source_post_url: sourcePostUrl,
            source_slug: wordpressRow.source_slug || null,
            source_hinh: relativeImagePath,
            imported_by: 'codex_bulk_append_wp_csv',
          };

          await client.query(
            `
              INSERT INTO species_showpic_metadata (
                source_table,
                species_id,
                image_order,
                showpic_url,
                source_image_url,
                thumbnail_url,
                imagepath,
                image_local_path,
                image_mime_type,
                image_data,
                image_file_size,
                image_width,
                image_height,
                vietname,
                latinname,
                author,
                page_title,
                caption_text,
                fetch_status,
                error_message,
                source_payload,
                fetched_at,
                updated_at,
                animal_species_id,
                plant_species_id,
                insect_species_id
              )
              VALUES (
                $1, $2, $3, $4, NULL, NULL, $5, $6, $7, $8, $9, $10, $11,
                $12, $13, $14, $15, NULL, 'ok', NULL, $16::jsonb, now(), now(),
                $17, $18, $19
              )
              ON CONFLICT (source_table, species_id, showpic_url) DO NOTHING
            `,
            [
              sourceTable,
              species.species_id,
              nextOrder,
              `${sourcePostUrl}#${relativeImagePath}`,
              relativeImagePath,
              relativeImagePath,
              imageMimeType,
              imageData,
              imageData.length,
              dimensions.width,
              dimensions.height,
              wordpressRow.ten_viet_nam || species.ten_viet_nam,
              wordpressRow.ten_latin || species.ten_latin,
              wordpressRow.xac_dinh_boi || null,
              wordpressRow.ten_viet_nam || null,
              JSON.stringify(sourcePayload),
              foreignKeys.animal_species_id,
              foreignKeys.plant_species_id,
              foreignKeys.insect_species_id,
            ],
          );

          filenames.add(filename);
          existingWpFilenames.set(key, filenames);
          inserted += 1;
          if (inserted % 250 === 0) {
            console.log(`inserted ${inserted}`);
          }
        }
      }
    }
  }

  console.log({ inserted, skippedWp, missingFile });
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
