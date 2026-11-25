import "server-only";

import { createServiceRoleClient } from "@/lib/security/guards";

export async function claimWebhookEvent(params: {
  provider: string;
  eventId: string;
  eventType: string;
  payloadSummary?: Record<string, unknown>;
}): Promise<{ alreadyProcessed: boolean; recorded: boolean }> {
  const adminDb = createServiceRoleClient();
  if (!adminDb) {
    return { alreadyProcessed: false, recorded: false };
  }

  const { error } = await adminDb.from("payment_webhook_events").insert({
    provider: params.provider,
    event_id: params.eventId,
    event_type: params.eventType,
    status: "processing",
    payload_summary: params.payloadSummary ?? {},
  });

  if (error) {
    // Postgres unique violation code is 23505
    if (error.code === "23505") {
      return { alreadyProcessed: true, recorded: false };
    }
    return { alreadyProcessed: false, recorded: false };
  }

  return { alreadyProcessed: false, recorded: true };
}
