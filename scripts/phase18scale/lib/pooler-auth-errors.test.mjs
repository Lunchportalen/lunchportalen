import assert from "node:assert/strict";
import { isAuthFailure, isTransientPoolerError } from "./pooler-auth-errors.mjs";

assert.equal(isTransientPoolerError("timeout expired"), true);
assert.equal(isTransientPoolerError("Connection terminated unexpectedly"), true);
assert.equal(isTransientPoolerError("sorry, too many clients already"), true);
assert.equal(isAuthFailure("timeout expired"), false);

assert.equal(isAuthFailure("password authentication failed for user"), true);
assert.equal(isAuthFailure("28P01: password auth failed"), true);
assert.equal(isTransientPoolerError("password authentication failed for user"), false);

console.log("pooler-auth-errors.test.mjs: PASS");
