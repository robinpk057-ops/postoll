export type IncidentSource = "watchdog_probe" | "gemini_audit" | "robo_escalation";
export type IncidentSeverity = "info" | "warning" | "critical";
export type IncidentCategory =
  | "publishing"
  | "ai_generation"
  | "oauth_token"
  | "quota_limit"
  | "billing_credits"
  | "security"
  | "frontend_route";

export interface WatchdogIncidentDraft {
  fingerprint: string;
  source: IncidentSource;
  severity: IncidentSeverity;
  category: IncidentCategory;
  title: string;
  summary: string;
  recommendedAction: string;
  affectedRouteOrFeature?: string;
  affectedUserId?: string | null;
}

export interface WatchdogIncidentRecord extends WatchdogIncidentDraft {
  id: string;
  occurrenceCount: number;
  status: "open" | "acknowledged" | "resolved";
  emailSentAt?: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export interface WatchdogRunReport {
  ok: boolean;
  checkedAt: string;
  durationMs: number;
  checksRun: string[];
  detectedCount: number;
  emailedCount: number;
  incidents: WatchdogIncidentDraft[];
  aiTriageSummary?: string | null;
  warnings: string[];
}
