import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { dispatchApprovalEmail } from "@/lib/approval";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const contentId: string | undefined = body?.contentId;

    if (!contentId) {
      return NextResponse.json(
        { error: "'contentId' is required." },
        { status: 400 }
      );
    }

    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    const isCronAuthorized = Boolean(
      cronSecret && authHeader === `Bearer ${cronSecret}`
    );

    let sessionUserId: string | null = null;
    if (!isCronAuthorized) {
      const sessionSupabase = await createSessionClient();
      const {
        data: { user },
      } = await sessionSupabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      sessionUserId = user.id;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Supabase service configuration missing." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: item, error: itemErr } = await supabaseAdmin
      .from("content")
      .select("id, user_id, workflow_id, title, caption, image_url")
      .eq("id", contentId)
      .single();

    if (itemErr || !item) {
      return NextResponse.json(
        { error: "Content item not found." },
        { status: 404 }
      );
    }

    if (sessionUserId && item.user_id !== sessionUserId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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

    const result = await dispatchApprovalEmail({
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
      emailSent: result.sent,
      expiresAt: result.expiresAt,
      reason: result.reason,
    });
  } catch (err) {
    console.error("[POST /api/approvals/send] error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to dispatch approval.",
      },
      { status: 500 }
    );
  }
}
