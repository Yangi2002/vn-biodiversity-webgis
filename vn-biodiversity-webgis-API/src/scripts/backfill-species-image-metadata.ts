import 'dotenv/config';
import { Client } from 'pg';
import { readImageDimensions } from '../species/utils/image-metadata.util';

interface ImageRow {
  image_id: string;
  image_data: Buffer;
}

const BATCH_SIZE = 200;

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const client = new Client({ connectionString });
  await client.connect();

  let updated = 0;
  let skipped = 0;

  try {
    for (;;) {
      const { rows } = await client.query<ImageRow>(
        `
          SELECT image_id, image_data
          FROM species_images
          WHERE width IS NULL
             OR height IS NULL
          ORDER BY image_id ASC
          LIMIT $1
        `,
        [BATCH_SIZE],
      );

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        const dimensions = readImageDimensions(row.image_data);

        if (!dimensions) {
          await client.query(
            `
              UPDATE species_images
              SET width = 0,
                  height = 0
              WHERE image_id = $1
            `,
            [row.image_id],
          );

          skipped += 1;
          continue;
        }

        await client.query(
          `
            UPDATE species_images
            SET width = $1,
                height = $2
            WHERE image_id = $3
          `,
          [dimensions.width, dimensions.height, row.image_id],
        );

        updated += 1;
      }

      if ((updated + skipped) % 1000 === 0 || rows.length < BATCH_SIZE) {
        console.log(`Backfilled ${updated} images, marked ${skipped} unreadable images.`);
      }
    }
  } finally {
    await client.end();
  }

  console.log(`Done. Updated ${updated} images, marked ${skipped} unreadable images.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
