# Data publication review

Date: 2026-11-12. Scope: local v0.1.0 corpus and sampled SFT schemas.
This is a publication-readiness review, not legal authorization.

## Findings

All 24,527 corpus documents are marked authenticated. Only 40 have a nonempty
top-level license or metadata.license field; field presence does not establish
that the license permits the proposed distribution.

Sources: animal_db_vn 10,221; plant_db_vn 8,330; insect_db_vn 2,596;
fungi_db_vn 2,233; algae_db_vn 581; protista_db_vn 491; Crossref 22;
Europe PMC 53. No separate GBIF source_name was counted in these documents.

Sampled documents include verbatim descriptive text and vncreatures.net URLs.
Sampled train-v2-screened-review records copy evidence into approved answers;
approval_basis=automated_source_snapshot and human_reviewed=false.
Approval is a content workflow flag, not a redistribution license.

## Decision

Do not publish corpus, SFT or prediction/review JSONL with source evidence
until source-by-source rights and visibility clearance are documented.
Keep these files local for now, including copies under evaluation folders.
This is not a finding that every record is prohibited: permission is unresolved.

Release metadata, metrics and authored documentation can be tracked separately.
Model ZIP files are configured for Git LFS; tracking does not grant a public
model license. The internal-research release restriction remains in force.
Do not publish the repository or its model assets publicly without that review.

API cache, vector arrays, temporary Kaggle bundles, virtual environments and
credentials remain ignored. Dataset build/quality reports remain local because
they can retain source excerpts and request metadata.

## To clear data later

Record each source's license/permission, attribution, permitted use and permitted
redistribution scope; separate metadata from copyrighted descriptive/full text.
Preserve visibility policy when exporting. Export a dedicated cleared subset;
do not flip approved flags or remove source URLs to claim permission.

No model, API, database operation or automated tests were run for this review.
No files were staged, committed or pushed. Git LFS must be installed/configured
before staging the ZIP/weight files; hosting authorization and LFS quota must
also be checked by the repository owner.
