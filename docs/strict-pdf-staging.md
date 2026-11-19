# Strict PDF staging importer

Open Students → Importer → PDF — extraction stricte et revue. Upload the register, extract, reconcile the expected count, export the review dossier and compare it manually with the source PDF. Source page links open the local PDF. No PDF is uploaded to public storage. Closing the modal discards its in-memory staging state; export the dossier to retain it.

## Runtime

Vercel builds `api/student_pdf.py` with the root `requirements.txt`. The authenticated Node route signs internal worker requests with the existing server-only `JWT_SECRET`; the worker verifies the timestamp, page and complete PDF hash. No local virtual environment is required on Vercel. Production calls use the public custom domain `www.snapschool.academy` to avoid Vercel SSO on deployment URLs. Preview calls require the standard `VERCEL_AUTOMATION_BYPASS_SECRET` when Deployment Protection is enabled. The worker still requires a valid server signature on either domain. Local development uses `STUDENT_PDF_PYTHON`, defaulting to `tmp/pdf-import-venv/bin/python3`.

## Safety boundaries

Coordinates are fixed to the inspected landscape Tunisian register. Page rotation is applied when selecting characters. Original Unicode, presentation forms and diacritics remain unchanged; registration date is ignored. Missing/invalid cells, duplicate identifiers, changed layouts and count mismatch are surfaced for review. The importer makes no AI calls. Exports identify the review mode as manual and never claim completed verification. Use the original PDF and exported JSON for external comparison.

The Create students and guardians action requires the expected count, explicit review confirmation, with no birth-date requirement. The server re-extracts the source PDF and validates everything again. Empty address and blood type remain empty strings; missing birthdays are stored as NULL and never fabricated. Existing school levels (including preparatory grade 0) must exist before import. Class assignment remains separate.

One serializable transaction locks student identifiers and PDF parent imports, creates or reuses guardians by exact phone and full source name, links all matching siblings to the same parent ID, and creates students. Guardian conflicts and existing student differences abort the transaction. Matching reimports skip existing students. New guardians remain PENDING without passwords. Every created record is read back and checked before commit. No production import was executed during implementation.

## Checks

`node --import tsx src/__tests__/student-pdf-staging.test.ts`

`STUDENT_PDF_PYTHON services/student-pdf-import/extract.py < register.pdf > staging.json`

Keep source PDFs and exported dossiers out of Git and public storage. Local extraction artifacts belong in ignored `tmp/`.
