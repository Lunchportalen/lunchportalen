import assert from "node:assert/strict";

import {
  assertCiSanityNoProductionWrite,
  assertCiSanityNonProductionDataset,
  assertCiSanityReadOnly,
  hasSanityWriteTokenInEnv,
  isProductionSanityDataset,
} from "./assert-ci-sanity-env.mjs";

function withEnv(patch, fn) {
  const snapshot = { ...process.env };
  Object.assign(process.env, patch);
  try {
    fn();
  } finally {
    process.env = snapshot;
  }
}

assert.equal(isProductionSanityDataset("production"), true);
assert.equal(isProductionSanityDataset("staging"), false);

withEnv(
  {
    NEXT_PUBLIC_SANITY_DATASET: "production",
    SANITY_WRITE_TOKEN: "tok",
    SANITY_API_TOKEN: "",
    SANITY_TOKEN: "",
  },
  () => {
    assert.throws(() => assertCiSanityNoProductionWrite(), /production.*write blocked/i);
  },
);

withEnv(
  {
    NEXT_PUBLIC_SANITY_DATASET: "staging",
    SANITY_WRITE_TOKEN: "tok",
    SANITY_API_TOKEN: "",
    SANITY_TOKEN: "",
  },
  () => {
    assertCiSanityNoProductionWrite();
    assert.equal(hasSanityWriteTokenInEnv(), true);
  },
);

withEnv(
  {
    NEXT_PUBLIC_SANITY_DATASET: "production",
    SANITY_WRITE_TOKEN: "",
    SANITY_API_TOKEN: "",
    SANITY_TOKEN: "",
  },
  () => {
    assertCiSanityNoProductionWrite();
  },
);

withEnv({ NEXT_PUBLIC_SANITY_DATASET: "production" }, () => {
  assert.throws(() => assertCiSanityNonProductionDataset(), /refuse production/i);
});

withEnv(
  {
    NEXT_PUBLIC_SANITY_DATASET: "staging",
    SANITY_WRITE_TOKEN: "tok",
  },
  () => {
    assert.throws(() => assertCiSanityReadOnly(), /read-only.*write token/i);
  },
);

withEnv(
  {
    NEXT_PUBLIC_SANITY_DATASET: "staging",
    SANITY_WRITE_TOKEN: "",
    SANITY_API_TOKEN: "",
    SANITY_TOKEN: "",
  },
  () => {
    assertCiSanityReadOnly();
  },
);

console.log(JSON.stringify({ ok: true, module: "assert-ci-sanity-env" }));
