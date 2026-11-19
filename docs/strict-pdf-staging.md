# Strict PDF staging importer

Open Students → Importer → PDF — extraction stricte et revue. Upload the register, extract, reconcile the expected count, run the AI audit and export the review dossier. Source page links open the local PDF. No PDF is uploaded to public storage. Closing the modal discards its in-memory staging state; export the dossier to retain it.

## Runtime

Vercel builds `api/student_pdf.py` with the root `requirements.txt`. The authenticated Node route signs internal worker requests with the existing server-only `JWT_SECRET`; the worker verifies the timestamp, page and complete PDF hash. No local virtual environment is required on Vercel. Deployment Protection, when enabled, requires the standard `VERCEL_AUTOMATION_BYPASS_SECRET` for server-to-server calls. Local development uses `STUDENT_PDF_PYTHON`, defaulting to `tmp/pdf-import-venv/bin/python3`.

## Safety boundaries

Coordinates are fixed to the inspected landscape Tunisian register. Page rotation is applied when selecting characters. Original Unicode, presentation forms and diacritics remain unchanged; registration date is ignored. Missing/invalid cells, duplicate identifiers, changed layouts, count mismatch and incomplete AI coverage block review completion. AI receives rendered page images and extracted cells solely for comparison; it cannot alter extraction. Audit responses must reference the same document hash and cover every cell exactly once. Audit can resume after a failed page. Its use consumes the existing administrator AI quota.

The screen is staging-only and has no commit endpoint. Birth dates, address and blood type required by the current Student schema are absent from this register. These must be resolved before any future transactional import. Guardian names are kept whole rather than guessing their split. Exact class assignment is a separate workflow.

## Checks

`node --import tsx src/__tests__/student-pdf-staging.test.ts`

`STUDENT_PDF_PYTHON services/student-pdf-import/extract.py < register.pdf > staging.json`

Keep source PDFs and exported dossiers out of Git and public storage. Local extraction artifacts belong in ignored `tmp/`.
