# AI05: review of flagged validation cases

Scope: 138 saved validation predictions, not the sealed test partition. This is
an evidence-to-answer review, not independent scientific verification of the
underlying source. `metrics.json` contains reproducible input hashes and
mechanical metrics; `review-cases.jsonl` contains the original case details.

## Observations

- Base / pilot / v2 correct abstentions: 4/20, 0/20, 19/20. V2 has no missing or
  out-of-range citation numbers on the saved validation predictions.
- The one clear wrong-entity failure is row 120: the question asks about Phù
  dung, but the cited evidence concerns Sẻ thông họng vàng. V2 answers with
  the bird's distribution. A numbered citation does not make this grounded.
- Row 73 is a bad reference and bad evidence excerpt: the answer to a Re bạc
  description is website navigation and author text. Neither an exact match
  nor a close paraphrase would indicate biodiversity knowledge. Exclude or
  relabel this example before interpreting factuality.
- Rows 63, 73, 105, 106 and 129 contain website boilerplate in the evidence.
  The v2 answer copies that boilerplate in row 73; the other four answers do
  not visibly repeat it, but the source text still needs cleaning.
- Twelve `species_value` answers differ from the reference (rows 15, 19, 24,
  26, 34, 43, 47, 53, 56, 59, 70 and 79). Most select a different supported
  clause from the same evidence, often omitting a more specific use or threat.
  This is principally answer completeness / reference selection, not evidence
  of fabrication. Rows 43 and 59 include medicinal claims in the source;
  source presence alone is not independent validation of those claims.
- Twelve conservation answers differ from the reference (rows 101, 102, 103,
  105, 107, 108, 110, 111, 113, 116, 117 and 118). Most answer from the cited
  document but omit the stated threat. Row 117 selects a different status and
  action that are also present in the evidence. Repeated, generic conservation
  prose across species and any status codes require source-level review.
- Row 84 is a near-equivalent wording difference. Row 85 is a label-quality
  problem: both reference and v2 mostly give specimen collection metadata
  although the question asks for identifying characteristics.

## Interpretation

The v2 adapter clearly improves abstention and mechanical citation behavior
on this validation set. Exact-reference matching (91/138) is only a wording
proxy; it is not factual accuracy, groundedness, or citation correctness.
The review above covers flagged cases, not independent fact checking of every
one of the 138 predictions. A final research claim still needs reviewed
factuality/citation verdicts and a held-out test partition.

## Case-level adjudication against the supplied evidence

`Pass` means the response addresses the question and is supported by the
supplied excerpt; it does **not** certify the source as scientifically current.
`Partial` means the response uses the correct source but omits a material part
of the requested answer. `Fail` means it answers from the wrong entity or does
not answer the requested facet. `Source issue` means the evidence or reference
itself needs correction before scoring the model.

| Rows | Verdict | Reason |
| --- | --- | --- |
| 15, 19, 26, 47, 53, 56, 70, 79 | Partial | Scientific/aesthetic value is supported, but the specific research or conservation use is omitted. |
| 24 | Partial | A supported aesthetic value is given, while the cited food/use value is omitted. |
| 34 | Partial | Protection need is supported, but it does not convey the cited ornamental trade/use. |
| 43 | Pass with source caveat | The shorter answer is supported; the reference adds medicinal claims that require independent verification. |
| 59 | Partial with source caveat | The answer selects other uses from the same excerpt; medical efficacy should not be certified from this source alone. |
| 63 | Pass; source issue | Answer uses the species description, not the website boilerplate. Clean the evidence. |
| 73 | Source issue / exclude | Both reference and model answer reproduce website navigation instead of a Re bạc description. |
| 84 | Pass | Near-equivalent ecology wording, supported by the excerpt. |
| 85 | Fail; label issue | The question asks for identifying traits; model and reference focus on collection metadata instead. |
| 101, 102, 103, 107, 108, 110, 111, 113, 116, 118 | Partial | Status and action are supported, but a concrete threat in the source is omitted. |
| 105 | Partial; source issue | Same omitted-threat pattern; evidence also includes website boilerplate. |
| 106 | Pass; source issue | Answer is supported and does not repeat boilerplate; source cleanup is still needed. |
| 117 | Pass | Different status/action than the reference, but both are present in the same evidence. |
| 120 | Fail | Wrong species: Phù dung question answered from Sẻ thông họng vàng evidence. |
| 129 | Pass; source issue | Correctly abstains from evidence about another species; evidence contains boilerplate. |

These verdicts cover the 31 flagged rows only. They should not be extrapolated
to the other 107 rows. Rows 73 and 85 should not be counted as ordinary model
errors without fixing the reference/evidence first.
