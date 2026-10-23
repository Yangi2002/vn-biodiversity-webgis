CREATE TABLE "species_change_requests" (
    "request_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submitted_by" UUID NOT NULL,
    "source_table" TEXT NOT NULL,
    "species_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_note" TEXT,
    CONSTRAINT "species_change_requests_pkey" PRIMARY KEY ("request_id"),
    CONSTRAINT "species_change_requests_submitter_fkey"
      FOREIGN KEY ("submitted_by") REFERENCES "app_users"("user_id") ON DELETE CASCADE,
    CONSTRAINT "species_change_requests_reviewer_fkey"
      FOREIGN KEY ("reviewed_by") REFERENCES "app_users"("user_id") ON DELETE SET NULL,
    CONSTRAINT "species_change_requests_source_table_check"
      CHECK ("source_table" IN ('animal_db_vn', 'plant_db_vn', 'insect_db_vn')),
    CONSTRAINT "species_change_requests_action_check"
      CHECK ("action_type" IN ('create', 'update', 'import')),
    CONSTRAINT "species_change_requests_status_check"
      CHECK ("status" IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX "idx_species_change_requests_submitter"
  ON "species_change_requests" ("submitted_by", "submitted_at" DESC);
CREATE INDEX "idx_species_change_requests_status"
  ON "species_change_requests" ("status", "submitted_at" DESC);
CREATE INDEX "idx_species_change_requests_species"
  ON "species_change_requests" ("source_table", "species_id");
