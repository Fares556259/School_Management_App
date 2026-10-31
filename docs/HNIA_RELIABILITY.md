# Hnia reliability baseline

## Run before a release

```sh
npm run benchmark:hnia:reliability
node --import tsx src/__tests__/hnia-confirmation.test.ts
node --import tsx src/__tests__/hnia-knowledge.test.ts
node --import tsx src/__tests__/hnia-data-accuracy.test.ts
npm run build
```

The reliability benchmark exercises the actual mobile routing, proposal, read, and confirmation code with a mocked provider and synthetic in-memory records. It must not load production records or execute real business writes. It is a regression gate, not an estimate of real-model accuracy or network latency.

The 83 cases cover French, English, Arabic and Tunisian purchase captions; decimal commas; conflicting photo prices; missing/negative/ambiguous amounts; current school reads; sourced school policies; conversational approval attempts; undeclared model tools; unavailable evidence; and proposal editing, cancellation, ownership, concurrent confirmation and replay.

## Action contract

- Every mutation starts as a stored PENDING proposal.
- The card carries a SHA-256 fingerprint of its ID, tool, and exact arguments. This is a stale-review guard; authentication and school/admin authorization are independent server checks.
- Financial dates/months are resolved before the proposal is displayed.
- A confirm request must include the fingerprint of the reviewed card.
- An edit updates the pending proposal and returns a new card; execution requires a subsequent explicit confirmation.
- Claiming execution compares both status and stored JSON arguments atomically.
- Cancellation cannot become execution; completed or failed proposals do not replay.
- Old clients without a reviewed fingerprint receive a fresh pending card and an update instruction, never an automatic execution.

## Knowledge retrieval v1

The initial corpus is active AIKnowledge notes with an admin author, scoped to the current school. It uses bounded lexical retrieval with selected FR/EN/Arabic synonyms and returns up to three excerpts with note IDs, categories and revision dates. Notes are references, not system instructions or authority to mutate data.

The mobile agent no longer inserts the entire notes collection into its system prompt. Explicit policy questions retrieve sources directly. Missing sources produce a clear inability to confirm the school's policy. Source citations remain available when the conversation is reloaded or refreshed.

This version does not ingest PDFs, OCR school archives, or create a vector index. Search examines at most the 200 most recently updated active notes and discloses that limit when reached. A larger document corpus needs an explicit ingestion/versioning workflow and retrieval evaluation before introducing embeddings.

## Remaining validation

Before a broad pilot, run physical Android checks for reviewing an edited proposal, stale cards on two devices, reconnecting after confirmation, and source refresh after a school note is changed. Use a dedicated test school. Offline passes do not certify every live model answer.
