# STAC_BOT-1.0 / 1.0.0

Released 2026-11-12 for internal research. AI06 artifact packaging complete.

- Evaluated sft-v2 adapter and tokenizer retained unchanged.
- Model card, environment snapshots, license text/notice and AI05 reports included.
- Dense retrieval is the selected default; hybrid/reranker remain research options.
- Base weights, corpus, database, credentials and executable service are not bundled.
- Historical training revision is unknown; this limits exact reproducibility.
- Runtime profile is declarative and still needs AI07 implementation/verification.
- Docker is optional: AI07 may use a Python process and existing NestJS directly.
- No model inference, training, server, migration or automated tests were run for packaging.

SHA256SUMS.json covers payload files, excluding itself. The adjacent release
ZIP SHA-256 file covers the complete archive. Preserve the original draft.
Public/commercial release and dataset redistribution are not authorized by this package.
