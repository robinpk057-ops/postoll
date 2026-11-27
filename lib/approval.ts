import crypto from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SITE =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://postoll.vercel.app";

export interface TikTokApprovalSettings {
  privacy_level: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";
  allow_comment: boolean;
  allow_duet: boolean;
  allow_stitch: boolean;
  commercial_content: boolean;
  brand_organic: boolean;
  brand_content: boolean;
}

export const DEFAULT_TIKTOK_SETTINGS: TikTokApprovalSettings = {
  privacy_level: "PUBLIC_TO_EVERYONE",
  allow_comment: true,
  allow_duet: true,
  allow_stitch: true,
  commercial_content: false,
  brand_organic: false,
  brand_content: false,
};

export function generateApprovalToken(): {
  token: string;
  expiresAt: string;
} {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return { token, expiresAt };
}

export async function dispatchApprovalEmail(params: {
  supabaseAdmin: SupabaseClient;
  contentId: string;
  userId: string;
  workflowName?: string | null;
  title?: string | null;
  caption?: string | null;
  previewUrl?: string | null;
  siteUrl?: string;
}): Promise<{ sent: boolean; token: string; expiresAt: string; reason?: string }> {
  const { token, expiresAt } = generateApprovalToken();

  const { error: updateErr } = await params.supabaseAdmin
    .from("content")
    .update({
      status: "awaiting_approval",
      approval_token: token,
      approval_expires_at: expiresAt,
    })
    .eq("id", params.contentId);

  if (updateErr) {
    throw new Error(`Failed to store approval token: ${updateErr.message}`);
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return {
      sent: false,
      token,
      expiresAt,
      reason: "RESEND_API_KEY not configured; token saved.",
    };
  }

  let recipientEmail: string | null = null;
  try {
    const { data: userData } = await params.supabaseAdmin.auth.admin.getUserById(
      params.userId
    );
    recipientEmail = userData?.user?.email ?? null;
  } catch (err) {
    console.warn("Could not fetch user email for approval dispatch:", err);
  }

  if (!recipientEmail) {
    return {
      sent: false,
      token,
      expiresAt,
      reason: "No recipient email found for user.",
    };
  }

  const baseUrl = (params.siteUrl || DEFAULT_SITE).replace(/\/+$/, "");
  const approveUrl = `${baseUrl}/approve/${token}`;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL || "Postoll Approvals <approvals@postoll.app>";

  const safeTitle = (params.title || "Scheduled Content Draft").replace(/</g, "&lt;");
  const safeCaption = (params.caption || "").replace(/</g, "&lt;");
  const safeWorkflow = (params.workflowName || "Postoll Workflow").replace(/</g, "&lt;");

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipientEmail],
      subject: `Approve content for ${safeWorkflow}: ${safeTitle}`,
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111827;">
          <p style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #7c5cff; margin: 0 0 8px;">Postoll Content Approval</p>
          <h2 style="margin: 0 0 12px; font-size: 20px;">${safeTitle}</h2>
          <p style="margin: 0 0 12px; font-size: 14px; color: #4b5563;">Workflow: <strong>${safeWorkflow}</strong></p>
          ${safeCaption ? `<div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; font-size: 14px; white-space: pre-line; margin-bottom: 16px;">${safeCaption}</div>` : ""}
          ${params.previewUrl ? `<p style="font-size: 13px; margin: 0 0 16px;"><a href="${params.previewUrl}" style="color: #7c5cff;">View Media Preview</a></p>` : ""}
          <a href="${approveUrl}" style="display: inline-block; background: #7c5cff; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 20px; border-radius: 10px;">Review &amp; Approve Content</a>
          <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">This one-time link expires in 24 hours (${new Date(expiresAt).toLocaleString()}).</p>
        </div>
      `,
    }),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text().catch(() => "");
    console.error("Resend approval email error:", emailRes.status, errText);
    return {
      sent: false,
      token,
      expiresAt,
      reason: `Resend failed (${emailRes.status})`,
    };
  }

  return { sent: true, token, expiresAt };
}
