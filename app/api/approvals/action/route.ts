import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { DEFAULT_TIKTOK_SETTINGS, dispatchApprovalEmail } from "@/lib/approval";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service role configuration.");
  }
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token")?.trim();
    if (!token) {
      return NextResponse.json({ error: "Token is required." }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();
    const { data: item, error } = await supabaseAdmin
      .from("content")
      .select(
        "id, user_id, workflow_id, title, caption, hashtags, image_url, platform, type, status, approval_expires_at, tiktok_settings"
      )
      .eq("approval_token", token)
      .maybeSingle();

    if (error || !item) {
      return NextResponse.json(
        { error: "Invalid or already-used approval token." },
        { status: 404 }
      );
    }

    const isExpired =
      item.approval_expires_at &&
      new Date(item.approval_expires_at).getTime() < Date.now();

    if (isExpired) {
      return NextResponse.json(
        { error: "This approval link has expired (24-hour limit)." },
        { status: 410 }
      );
    }

    let workflowName: string | null = null;
    if (item.workflow_id) {
      const { data: wf } = await supabaseAdmin
        .from("workflows")
        .select("name")
        .eq("id", item.workflow_id)
        .maybeSingle();
      workflowName = wf?.name ?? null;
    }

    return NextResponse.json({
      ok: true,
      item: {
        ...item,
        workflow_name: workflowName,
        tiktok_settings: {
          ...DEFAULT_TIKTOK_SETTINGS,
          ...(item.tiktok_settings || {}),
        },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load approval." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token: string | undefined = body?.token?.trim();
    const action: "approve" | "regenerate" | undefined = body?.action;
    const tiktokSettings = body?.tiktokSettings;

    if (!token || !action) {
      return NextResponse.json(
        { error: "'token' and 'action' ('approve' | 'regenerate') are required." },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();
    const { data: item, error } = await supabaseAdmin
      .from("content")
      .select(
        "id, user_id, workflow_id, title, caption, image_url, status, approval_expires_at"
      )
      .eq("approval_token", token)
      .maybeSingle();

    if (error || !item) {
      return NextResponse.json(
        { error: "Invalid or already-used approval token." },
        { status: 404 }
      );
    }

    const isExpired =
      item.approval_expires_at &&
      new Date(item.approval_expires_at).getTime() < Date.now();

    if (isExpired) {
      return NextResponse.json(
        { error: "This approval link has expired." },
        { status: 410 }
      );
    }

    if (action === "approve") {
      const mergedTikTok = {
        ...DEFAULT_TIKTOK_SETTINGS,
        ...(typeof tiktokSettings === "object" && tiktokSettings ? tiktokSettings : {}),
      };

      const { error: updErr } = await supabaseAdmin
        .from("content")
        .update({
          status: "queued",
          approval_token: null,
          approval_expires_at: null,
          tiktok_settings: mergedTikTok,
        })
        .eq("id", item.id);

      if (updErr) {
        throw new Error(updErr.message);
      }

      return NextResponse.json({
        ok: true,
        action: "approve",
        contentId: item.id,
        status: "queued",
      });
    }

    if (action === "regenerate") {
      let workflowName: string | null = null;
      if (item.workflow_id) {
        const { data: wf } = await supabaseAdmin
          .from("workflows")
          .select("name")
          .eq("id", item.workflow_id)
          .maybeSingle();
        workflowName = wf?.name ?? null;
      }

      const dispatched = await dispatchApprovalEmail({
        supabaseAdmin,
        contentId: item.id,
        userId: item.user_id,
        workflowName,
        title: item.title,
        caption: item.caption,
        previewUrl: item.image_url,
        siteUrl: req.nextUrl.origin,
      });

      return NextResponse.json({
        ok: true,
        action: "regenerate",
        contentId: item.id,
        status: "awaiting_approval",
        emailSent: dispatched.sent,
      });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/approvals/action] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approval action failed." },
      { status: 500 }
    );
  }
}
