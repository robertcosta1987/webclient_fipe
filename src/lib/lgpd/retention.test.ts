import { test } from "node:test";
import assert from "node:assert/strict";
import { cutoffIso, loadRetention, retentionTasks, DEFAULT_RETENTION } from "./retention";

test("loadRetention uses defaults and honours positive integer env overrides", () => {
  assert.deepEqual(loadRetention({}), DEFAULT_RETENTION);
  const cfg = loadRetention({ LGPD_RETENTION_CONSULT_DAYS: "90", LGPD_RETENTION_APILOG_DAYS: "x", LGPD_RETENTION_INACTIVE_DAYS: "-5" });
  assert.equal(cfg.consultationDays, 90);                       // valid override
  assert.equal(cfg.apiLogPiiDays, DEFAULT_RETENTION.apiLogPiiDays);     // non-numeric ignored
  assert.equal(cfg.inactiveAccountDays, DEFAULT_RETENTION.inactiveAccountDays); // non-positive ignored
});

test("cutoffIso subtracts whole days from now", () => {
  const now = new Date("2026-06-23T00:00:00.000Z");
  assert.equal(cutoffIso(1, now), "2026-06-22T00:00:00.000Z");
  assert.equal(cutoffIso(365, now), new Date(now.getTime() - 365 * 86400000).toISOString());
});

test("every retention task is parameterized on @cutoff with no interpolated dates", () => {
  const tasks = retentionTasks(DEFAULT_RETENTION);
  assert.ok(tasks.length >= 4);
  for (const t of tasks) {
    for (const q of [t.countSql, t.applySql]) {
      assert.ok(q.includes("@cutoff"), `${t.key} must bind @cutoff`);
      // No ISO date literal interpolated into the SQL (would indicate string-built dates).
      assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(q), `${t.key} must not embed a date literal`);
    }
    assert.match(t.applySql, /^(DELETE|UPDATE)\b/, `${t.key} apply must be DELETE/UPDATE`);
  }
});

test("account anonymization is opt-in; log/consultation tasks are default", () => {
  const tasks = retentionTasks(DEFAULT_RETENTION);
  const optIn = tasks.filter((t) => t.optIn).map((t) => t.key);
  assert.deepEqual(optIn, ["inactive_accounts"]);
  // PII anonymization keeps the row (UPDATE). Cached consults are the data-enrichment
  // MOAT: NEVER deleted — they are de-identified (owner_id → NULL), vehicle payload kept.
  assert.match(tasks.find((t) => t.key === "apilog_pii")!.applySql, /^UPDATE api_request_logs SET/);
  for (const key of ["consult_checktudo", "consult_infocar", "consult_kbb"]) {
    const t = tasks.find((x) => x.key === key)!;
    assert.match(t.applySql, /^UPDATE \w+_consultas SET owner_id = NULL WHERE consulted_at < @cutoff AND owner_id IS NOT NULL$/, `${key} must de-identify, not delete`);
    assert.doesNotMatch(t.applySql, /DELETE/, `${key} must never DELETE (MOAT)`);
  }
});
