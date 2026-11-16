BEGIN;

ALTER TABLE "StudentServiceAssignment"
  DROP CONSTRAINT "StudentServiceAssignment_kind_check",
  ADD CONSTRAINT "StudentServiceAssignment_kind_check"
    CHECK (kind IN ('TRANSPORT', 'GARDE') OR kind ~ '^CUSTOM_[a-z0-9]{20,32}$');

ALTER TABLE "StudentCharge"
  DROP CONSTRAINT "StudentCharge_kind_check",
  ADD CONSTRAINT "StudentCharge_kind_check"
    CHECK (kind IN ('REGISTRATION', 'TRANSPORT', 'GARDE') OR kind ~ '^CUSTOM_[a-z0-9]{20,32}$');

COMMIT;
