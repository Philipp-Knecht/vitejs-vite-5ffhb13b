# Model knowledge

One JSON file per model, named after the catalog id (`vw-golf.json`, see `src/models.ts`). The
format is `CarModelSchema` in `src/types.ts`; `src/catalog.test.ts` validates every file.

Rules for the content:

- Every known weakness names at least one source (ADAC, TÜV-Report, KBA recalls, trade press)
  that states it. No source, no entry.
- Affected engines, gearboxes and years as precisely as the source states them.
- Plain German for laypeople, factual, no ranking of makes.
- Typical prices only with a source that names them.

The web app loads a file only when the model is shown (one chunk per model).
