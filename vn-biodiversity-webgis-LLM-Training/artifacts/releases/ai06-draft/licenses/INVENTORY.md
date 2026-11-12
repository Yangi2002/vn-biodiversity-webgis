# License inventory: STAC_BOT-1.0

Recorded 2026-11-12. Internal research draft; not a legal clearance.

| Component | Evidence | Status |
| --- | --- | --- |
| Qwen2.5-3B-Instruct | [Official license](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct/raw/main/LICENSE), copied to QWEN-RESEARCH-LICENSE.txt | Research license; copy and NOTICE archived. Downloaded from main, not tied to recovered training revision. |
| Unsloth quantized base checkpoint | adapter_config.json names unsloth/Qwen2.5-3B-Instruct-unsloth-bnb-4bit | Exact historical checkpoint revision and accompanying notices pending. Do not substitute a permissive library license for the model license. |
| LoRA adapter | STAC_BOT-1.0.zip, unchanged v2 weights | Derivative; no blanket MIT/Apache grant made. |
| BGE-M3 | [Official model card](https://huggingface.co/BAAI/bge-m3/raw/main/README.md) declares MIT | Weights not bundled; exact revision/license notice review pending before redistribution. |
| Reranker | BAAI/bge-reranker-v2-m3 | Disabled in default profile; not bundled. License review pending if distributed. |
| Corpus/API material | PostgreSQL, GBIF, Crossref, Europe PMC | Not bundled. Review individual record/content licenses; API access does not itself grant redistribution rights. |
| Python dependencies | environment/pip-freeze.txt | Inventory only, not a redistributed runtime. Review notices when assembling a runtime image. |

The Qwen terms limit the grant to research/evaluation non-commercial use and
require requesting a license for commercial use. Keep the original agreement
and attribution with any permitted distribution. Branding does not replace
these obligations. No permission to publish datasets is inferred here.

Remaining: recover training checkpoint provenance, confirm release scope,
review derivative/data rights, and assemble any additional notices required
by the components actually distributed. The notice bundle remains incomplete
for a public release.
