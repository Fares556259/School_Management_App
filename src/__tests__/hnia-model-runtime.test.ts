import assert from "node:assert/strict";
import {
  getAvailableModels,
  getHniaModelTimeoutMs,
  getMobileHniaModels,
  isRetryableModelError,
  markModelFailure,
  markModelSuccess,
  resetModelHealthForTests,
} from "../lib/agent/modelRuntime";

resetModelHealthForTests();

assert.deepEqual(getMobileHniaModels({} as NodeJS.ProcessEnv), [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
]);
assert.deepEqual(getMobileHniaModels({ ...process.env, HNIA_MOBILE_MODEL: "gemini-3.8-flash" }), [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
]);
assert.equal(getHniaModelTimeoutMs({ ...process.env, HNIA_MODEL_TIMEOUT_MS: "100" }), 5_000);
assert.equal(getHniaModelTimeoutMs({ ...process.env, HNIA_MODEL_TIMEOUT_MS: "90000" }), 45_000);
assert.equal(isRetryableModelError({ status: 429 }), true);
assert.equal(isRetryableModelError({ status: 400 }), false);
assert.equal(isRetryableModelError(new Error("network timeout")), true);

markModelFailure("primary", 1_000, 60_000);
assert.deepEqual(getAvailableModels(["primary", "fallback"], 2_000), ["fallback"]);
markModelSuccess("primary");
assert.deepEqual(getAvailableModels(["primary", "fallback"], 2_000), ["primary", "fallback"]);

console.log("Hnia model runtime tests passed");
