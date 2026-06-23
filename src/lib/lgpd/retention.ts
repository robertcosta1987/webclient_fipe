// lib/lgpd/retention.ts — retention policy as data (Art. 15/16). Pure (no DB / no
// server-only) so the windows and the generated SQL are unit-testable. The actual
// purge is run by scripts/lgpd-retention.ts (cron/Function), dry-run by default.
//
// Windows below are the CONFIRMED business policy (OPEN_DECISIONS #2): 1 ano para
// logs/consultas, 2 anos para contas inativas. Override por ambiente com
// LGPD_RETENTION_*_DAYS, sem mudar código.

export type RetentionConfig = {
  apiLogPiiDays: number;      // anonymize plate/IP/UA/geo in api_request_logs after N days
  consultationDays: number;   // delete consultation rows (plate data) after N days
  inactiveAccountDays: number; // disable+anonymize accounts inactive for N days (opt-in)
};

export const DEFAULT_RETENTION: RetentionConfig = {
  apiLogPiiDays: 365,        // 1 ano (confirmado)
  consultationDays: 365,     // 1 ano (confirmado)
  inactiveAccountDays: 730,  // 2 anos (confirmado)
};

function intEnv(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

export function loadRetention(env: Record<string, string | undefined> = {}): RetentionConfig {
  return {
    apiLogPiiDays: intEnv(env.LGPD_RETENTION_APILOG_DAYS, DEFAULT_RETENTION.apiLogPiiDays),
    consultationDays: intEnv(env.LGPD_RETENTION_CONSULT_DAYS, DEFAULT_RETENTION.consultationDays),
    inactiveAccountDays: intEnv(env.LGPD_RETENTION_INACTIVE_DAYS, DEFAULT_RETENTION.inactiveAccountDays),
  };
}

/** Cutoff timestamp: rows older than this are past their window. */
export function cutoffIso(days: number, now: Date): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export type RetentionTask = {
  key: string;
  label: string;
  days: number;
  /** Opt-in tasks (e.g. account anonymization) are skipped unless explicitly requested. */
  optIn: boolean;
  /** Counts rows that WOULD be affected (dry-run). Bound param: @cutoff. */
  countSql: string;
  /** Applies the retention action. Bound param: @cutoff. Idempotent. */
  applySql: string;
};

const LOG_PII_PRESENT =
  "(placa IS NOT NULL OR ip IS NOT NULL OR user_agent IS NOT NULL OR country IS NOT NULL OR city IS NOT NULL)";

/** Build the retention task list from a config. Every statement is parameterized
 *  on @cutoff (no date is ever string-interpolated) and owner-agnostic. */
export function retentionTasks(cfg: RetentionConfig): RetentionTask[] {
  const consult = (table: string): Pick<RetentionTask, "countSql" | "applySql"> => ({
    countSql: `SELECT COUNT(*) AS n FROM ${table} WHERE consulted_at < @cutoff`,
    applySql: `DELETE FROM ${table} WHERE consulted_at < @cutoff`,
  });
  return [
    {
      key: "apilog_pii", label: "Anonimizar PII de api_request_logs", days: cfg.apiLogPiiDays, optIn: false,
      countSql: `SELECT COUNT(*) AS n FROM api_request_logs WHERE created_at < @cutoff AND ${LOG_PII_PRESENT}`,
      applySql: `UPDATE api_request_logs SET placa=NULL, ip=NULL, user_agent=NULL, country=NULL, city=NULL WHERE created_at < @cutoff AND ${LOG_PII_PRESENT}`,
    },
    { key: "consult_checktudo", label: "Excluir consultas CheckTudo antigas", days: cfg.consultationDays, optIn: false, ...consult("checktudo_consultas") },
    { key: "consult_infocar", label: "Excluir consultas Infocar antigas", days: cfg.consultationDays, optIn: false, ...consult("infocar_consultas") },
    { key: "consult_kbb", label: "Excluir consultas KBB antigas", days: cfg.consultationDays, optIn: false, ...consult("kbb_consultas") },
    {
      key: "inactive_accounts", label: "Desativar+anonimizar contas inativas", days: cfg.inactiveAccountDays, optIn: true,
      countSql: `SELECT COUNT(*) AS n FROM users WHERE status='active' AND last_login_at IS NOT NULL AND last_login_at < @cutoff`,
      applySql: `UPDATE users SET email=CONCAT('anon-', CAST(id AS NVARCHAR(40)), '@anonimizado.invalid'), name=NULL, status='disabled', api_key_hash=NULL, api_key_prefix=NULL, must_change_password=1 WHERE status='active' AND last_login_at IS NOT NULL AND last_login_at < @cutoff`,
    },
  ];
}
