# Discovery Strategy

The current discovery stack moves away from broad notebook-led publishing and toward a safer hybrid:

- Official pages and known portals are the source of truth.
- Automated scrapers collect high-confidence opportunities into `public/data/opportunities.json`.
- A curation pass builds:
  - `public/data/publishable_opportunities.json` for frontend display
  - `public/data/review_queue.json` for anything that needs manual or multimodal review
- Notebook-style research is treated as secondary evidence, not direct publish input.

## Scripts

- `npm run discover:official`: runs the discovery orchestrator at `scripts/discovery/orchestrator.js`.
- `npm run curate:datasets`: builds the publishable dataset and review queue.
- `npm run review:artifacts -- --limit=5`: inspects the highest-priority review items, discovers PDF/image/document artifacts, and optionally runs Gemini extraction on them.
- `npm run sync`: runs both steps in sequence.

## Review Policy

Records are sent to review when they have any of the following:

- no `dataSource`
- notebook/research provenance
- duplicate normalized name
- broken link
- open-like status with a past deadline

The review queue also includes `reviewPriority` and `artifactReviewRecommended` so we can spend multimodal extraction budget only on the items most likely to yield useful PDF/image evidence.

## NotebookLM Role

NotebookLM is still useful in the current stack, but as a document-analysis assistant for hard PDFs/images after an official source has already been captured. It is not the main backend discovery engine.
