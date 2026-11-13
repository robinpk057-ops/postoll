import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { hashApiKey } from "@/lib/api-keys";

export const maxDuration = 60;

type IngestBody = {
    video_url?: string;
    image_url?: string;
    caption?: string | null;
    scheduled_at?: string | null; // ISO string
    workflow_id?: string | null;
    platform?: string;
};

function getAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createAdmin(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export async function POST(req: Request) {
    try {
        const auth = req.headers.get("authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

        if (!token || !token.startsWith("pk_live_")) {
            return NextResponse.json({ error: "Missing or invalid API key" }, { status: 401 });
        }

        const admin = getAdmin();
        const keyHash = hashApiKey(token);
        const prefix = token.slice(0, 12);

        const { data: keyRow, error: keyError } = await admin
            .from("api_keys")
            .select("id, user_id, revoked_at")
            .eq("key_prefix", prefix)
            .eq("key_hash", keyHash)
            .maybeSingle();

        if (keyError || !keyRow || keyRow.revoked_at) {
            return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
        }

        const userId = keyRow.user_id as string;

        await admin
            .from("api_keys")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", keyRow.id);

        const body = (await req.json()) as IngestBody;
        const mediaUrl = (body.video_url || body.image_url || "").trim();
        const caption = body.caption?.trim() || null;
        const scheduledAt = body.scheduled_at?.trim() || null;
        const workflowId = body.workflow_id || null;
        const platform = (body.platform || "instagram").toLowerCase();

        if (!mediaUrl || !mediaUrl.startsWith("http")) {
            return NextResponse.json(
                { error: "video_url or image_url (public http URL) is required" },
                { status: 400 }
            );
        }

        const isVideo =
            Boolean(body.video_url) ||
            /\.(mp4|mov|webm)(\?|$)/i.test(mediaUrl);

        // Optional: verify workflow belongs to this user
        if (workflowId) {
            const { data: wf } = await admin
                .from("workflows")
                .select("id")
                .eq("id", workflowId)
                .eq("user_id", userId)
                .maybeSingle();

            if (!wf) {
                return NextResponse.json({ error: "workflow_id not found" }, { status: 400 });
            }
        }

        const { data: content, error: contentError } = await admin
            .from("content")
            .insert({
                user_id: userId,
                workflow_id: workflowId,
                type: isVideo ? "reel" : "post",
                platform,
                image_url: mediaUrl,
                caption,
                hashtags: [],
                status: "queued",
            })
            .select("id, status, type, image_url")
            .single();

        if (contentError || !content) {
            return NextResponse.json(
                { error: contentError?.message || "Failed to create content" },
                { status: 500 }
            );
        }

        // If you use calendar_posts, also insert a row when scheduled_at is set
        if (scheduledAt) {
            const when = new Date(scheduledAt);
            if (!Number.isNaN(when.getTime())) {
                const dateStr = when.toISOString().slice(0, 10);
                const timeStr = when.toISOString().slice(11, 19);

                // Only if calendar_posts table exists in your project
                try {
                    await admin.from("calendar_posts").insert({
                        user_id: userId,
                        scheduled_date: dateStr,
                        scheduled_time: timeStr,
                        timezone: "UTC",
                        media_url: mediaUrl,
                        caption,
                        status: "queued",
                        account_id: null,
                    });
                } catch {
                    // calendar_posts optional — ignore if table/columns differ
                }
            }
        }

        return NextResponse.json({
            success: true,
            contentId: content.id,
            status: content.status,
            type: content.type,
            scheduled_at: scheduledAt,
        });
    } catch (err) {
        console.error("ingest webhook error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Ingest failed" },
            { status: 500 }
        );
    }
}