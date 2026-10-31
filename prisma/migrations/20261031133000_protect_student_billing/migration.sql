-- Billing is served only through authenticated, school-scoped server endpoints.
ALTER TABLE "StudentServiceAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentCharge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentChargePayment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "StudentServiceAssignment", "StudentCharge", "StudentChargePayment" FROM PUBLIC, anon, authenticated;
