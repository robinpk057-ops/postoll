import "server-only";

import { createServiceRoleClient } from "@/lib/security/guards";

export async function claimWebhookEvent(params: {
  provider: string;
  eventId: string;
  eventType: string;
  payloadSummary?: Record<string, unknown>;
}): Promise<{ alreadyProcessed: boolean; recorded: boolean; error?: string }> {
  const adminDb = createServiceRoleClient();
  if (!adminDb) {
    console.error("[claimWebhookEvent] Service role client unavailable (check SUPABASE_SERVICE_ROLE_KEY)");
    return {
      alreadyProcessed: false,
      recorded: false,
      error: "Service role client unavailable",
    };
  }

  const { error } = await adminDb.from("payment_webhook_events").insert({
    provider: params.provider,
    event_id: params.eventId,
    event_type: params.eventType,
    status: "processing",
    processed_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") {
      return { alreadyProcessed: true, recorded: false };
    }
    console.error("[claimWebhookEvent] Failed to insert webhook event:", error);
    return { alreadyProcessed: false, recorded: false, error: error.message };
  }

  return { alreadyProcessed: false, recorded: true };
}