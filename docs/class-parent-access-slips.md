# Class parent access slips

Open Classes → class → Accès parents · Fiches A4. The administrator can view children, linked guardians, phone numbers and access status, then explicitly prepare class credentials and print six cut-out slips per A4 page, one per child.

Credentials are eight digits derived by HMAC with the server-only PARENT_SLIP_SECRET (or existing JWT_SECRET) and the school and parent IDs. Each parent therefore receives the same code for all siblings and reprints across classes. Parent password storage remains bcrypt hashes; slip codes are only returned to authenticated school administrators and held in page memory. Codes never enter URLs or logs. Rotating the derivation secret invalidates reproducibility; existing password hashes remain untouched and require administrative reset before new slips can be issued.

Only parents without passwords are assigned a password and activated. A parent already using the generated credential can reprint it. Personal passwords are not overwritten or revealed; such slips direct the family to administration. Suspended/rejected parents are not activated. All children remain linked to their existing parent IDs. Preparing slips changes account access; printing alone does not.

The mobile app's existing phone → password flow accepts the generated code as its password. Its persistent MobileRateLimit table must be installed using the repository migration before account preparation proceeds. No account generation, activation or mobile login was performed in production while implementing this feature.

Verification performed locally: sibling code equality, stable reprints, school scoping, eight-digit shape, bcrypt compatibility, TypeScript and targeted lint. A4 browser print layout still requires a real print-preview check.
