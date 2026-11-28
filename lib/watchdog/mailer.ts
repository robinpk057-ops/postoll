import type { WatchdogIncidentDraft } from "./types";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeForEmail(input: string): string {
  return input
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(/\b(re|sk|ghp|eyJ)[A-Za-z0-9\-._]{12,}\b/g, "[REDACTED_KEY]")
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[REDACTED_DB_URL]");
}

export interface SendAlertResult {
  sent: boolean;
  skippedReason?: string;
  emailId?: string;
}

export async function sendWatchdogAlertEmail(
  incident: WatchdogIncidentDraft,
  options?: { occurrenceCount?: number; idempotencyBucket?: string }
): Promise<SendAlertResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const toEmail = process.env.WATCHDOG_ALERT_EMAIL?.trim();
  const fromEmail =
    process.env.WATCHDOG_FROM_EMAIL?.trim() || "Postoll Watchdog <onboarding@resend.dev>";

  if (!apiKey || !toEmail) {
    return {
      sent: false,
      skippedReason: "RESEND_API_KEY or WATCHDOG_ALERT_EMAIL not configured",
    };
  }

  const safeTitle = escapeHtml(sanitizeForEmail(incident.title));
  const safeSummary = escapeHtml(sanitizeForEmail(incident.summary));
  const safeAction = escapeHtml(sanitizeForEmail(incident.recommendedAction));
  const safeCategory = escapeHtml(incident.category);
  const safeSource = escapeHtml(incident.source);
  const safeRoute = incident.affectedRouteOrFeature
    ? escapeHtml(sanitizeForEmail(incident.affectedRouteOrFeature))
    : "N/A";
  const count = options?.occurrenceCount ?? 1;

  const hourBucket =
    options?.idempotencyBucket || new Date().toISOString().slice(0, 13);
  const rawKey = `watchdog/${incident.fingerprint}/${hourBucket}`;
  const idempotencyKey = rawKey.slice(0, 250);

  const badgeColor =
    incident.severity === "critical"
      ? "#dc2626"
      : incident.severity === "warning"
        ? "#d97706"
        : "#2563eb";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111827; border: 1px solid #e5e7eb; border-radius: 8px;">
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; background: ${badgeColor}; color: #ffffff; font-weight: 600; font-size: 12px; padding: 4px 10px; border-radius: 999px; text-transform: uppercase;">
          ${escapeHtml(incident.severity)}
        </span>
        <span style="margin-left: 8px; color: #6b7280; font-size: 13px;">
          ${safeCategory} &bull; ${safeSource} &bull; Occurrences: ${count}
        </span>
      </div>
      <h2 style="margin: 0 0 12px; font-size: 18px; color: #111827;">${safeTitle}</h2>
      <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: #374151;">${safeSummary}</p>
      <div style="background: #f9fafb; border-left: 4px solid ${badgeColor}; padding: 12px 14px; margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 600; color: #4b5563; margin-bottom: 4px;">RECOMMENDED ACTION</div>
        <div style="font-size: 14px; color: #111827;">${safeAction}</div>
      </div>
      <div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 12px;">
        Affected Area: <strong>${safeRoute}</strong><br/>
        Fingerprint: <code>${escapeHtml(incident.fingerprint)}</code><br/>
        Recorded at: ${new Date().toISOString()}
      </div>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: `[Postoll ${incident.severity.toUpperCase()}] ${sanitizeForEmail(incident.title)}`,
        html,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        sent: false,
        skippedReason: `Resend HTTP ${res.status}: ${data?.message || "send failed"}`,
      };
    }

    return { sent: true, emailId: data?.id };
  } catch (err) {
    return {
      sent: false,
      skippedReason: err instanceof Error ? err.message : "Unknown mailer error",
    };
  }
}
