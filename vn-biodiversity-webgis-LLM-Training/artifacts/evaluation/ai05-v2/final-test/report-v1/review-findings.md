# VietBio-3B v0.2: held-out test review

Input: `test-inference-input.jsonl` (100 locked test examples), oracle relevant
documents, the same prompt and evidence for base and v2. `metrics.json` records
file hashes. This review compares answers with supplied evidence; it does not
independently verify the scientific currency of every source.

## Results

| Mechanical check | Base | V2 |
| --- | ---: | ---: |
| Answers without a citation | 43/100 | 2/100 |
| Answers citing an unavailable number | 1/100 | 0/100 |

All 100 selected test examples are `should_abstain: false`. This test therefore
does not retest wrong-species abstention; the separate 20-case validation set
measured 19/20 correct refusals for v2.

## Answer-and-evidence review

- **Clear task failure, row 47:** The question asks how *Gryon ameraris* is
  identified. The only evidence is a holotype specimen and collection date;
  v2 repeats that metadata as an identification answer. The evidence cannot
  answer the requested facet, so a grounded assistant should abstain.
- **Truncation, rows 31 and 81:** Both v2 answers stop mid-phrase before a
  citation. The 180-token generation cap is a plausible cause; the test output
  alone cannot prove whether the cap or the model caused the stop. Row 81 also
  copies unrelated habitat, conservation, and use fields into a distribution
  answer.
- **Poorly scoped answer, row 63:** The answer to a distribution question
  copies a long multi-field source block, including unrelated ecology and
  conservation fields, before the distribution details.
- **Source text defects:** Row 49 copies broken character encoding and footer
  text. Rows 1, 52, 55, 58, 72 and 93 retain source typos or field labels.
  These are data-quality failures exposed by extractive generation, not proof
  that the cited facts are scientifically wrong.
- **Low-information descriptions:** Several `species_description` source
  sections contain only name/family/order. V2 repeats this taxonomy as a
  general description (for example rows 3, 4, 12, 18, 21, 25, 35, 37, 42, 59,
  65, 68, 75, 83, 92, 96 and 100). This is source-supported but not a useful
  descriptive answer. Row 14 gives only taxonomy despite a longer source.
- **Conservation-source caveat:** Some sources include historical Red Book
  labels such as 1996 classifications (rows 9, 16, 29, 50 and 62). The test
  does not verify a current IUCN or national status. Do not present these
  excerpts as up-to-date conservation assessments without a dated source.
- **Example of reduced fabrication, row 100:** The base adds morphology and
  habitat absent from the supplied *Halimeda discoidea* excerpt; v2 limits
  itself to the supplied family/order. This is an observed case, not a
  quantified hallucination rate.

## Conclusion and limits

V2 substantially improves mechanical citation behavior and is generally more
extractive on this oracle-evidence test. It is not error-free: row 47 is a
clear facet failure, rows 31/81 are incomplete, and several outputs preserve
bad or sparse source text. A citation `[1]` only points to a supplied block; it
does not establish claim-level support or external scientific validity.

This is a generator-only final test. The existing retrieval comparison is on
validation (dense Recall@5 0.968, hybrid 0.880, hybrid+reranker 0.954 over
500 examples). Do not combine those validation scores with this test to claim
an end-to-end test result. The v2 adapter archive and both metric files are
preserved locally under `artifacts/`.
