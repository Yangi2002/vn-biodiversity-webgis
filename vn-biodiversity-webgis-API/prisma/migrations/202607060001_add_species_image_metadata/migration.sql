ALTER TABLE species_images
ADD COLUMN IF NOT EXISTS width integer,
ADD COLUMN IF NOT EXISTS height integer;

CREATE INDEX IF NOT EXISTS idx_species_images_quality
ON species_images (
  source_table,
  species_id,
  width DESC NULLS LAST,
  height DESC NULLS LAST,
  image_order ASC
);
