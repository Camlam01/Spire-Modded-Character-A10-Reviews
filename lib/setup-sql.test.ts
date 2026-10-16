import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-expect-error: plain JavaScript build script without type declarations
import { bundleSql } from "../scripts/bundle-sql.mjs";

test("supabase/setup.sql matches the migrations (run `npm run db:bundle` if this fails)", () => {
  const onDisk = readFileSync(new URL("../supabase/setup.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.equal(onDisk, bundleSql());
});
