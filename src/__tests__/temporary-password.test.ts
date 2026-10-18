import assert from "node:assert/strict";
import test from "node:test";
import { generateTemporaryParentPassword } from "../lib/temporaryPassword";

test("temporary parent passwords are easy-to-type eight-digit codes", () => {
  const generated = Array.from({ length: 100 }, generateTemporaryParentPassword);

  for (const password of generated) {
    assert.match(password, /^\d{8}$/);
  }

  assert.ok(new Set(generated).size > 95, "generated codes should not repeat predictably");
});
