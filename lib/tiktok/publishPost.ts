import { createClient } from "@supabase/supabase-js";

export class PublishTikTokError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PublishTikTokError";
    }
}

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";
const MAX_CHUNK_BYTES = 10 * 1024 * 1024; // 10 MB

function getSupabaseAdminClient() {
    const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new PublishTikTokError(
            "Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY environment variable."
        );
    }

    return createClient(supabaseUrl, serviceRoleKey);
}

function buildCaptionText(input: {
    title?: string | null;
    caption?: string | null;
    hashtags?: string[] | null;
}): string {
    const baseText = (input.caption || input.title || "").trim();
    const tags = Array.isArray(input.hashtags)
        ? input.hashtags
            .map((tag) => tag.trim())
            .filter(Boolean)
            .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
        : [];

    return [baseText, tags.join(" ")]
        .filter(Boolean)
        .join("\n\n")
        .trim()
        .slice(0, 2200);
}

async function queryCreatorInfo(accessToken: string): Promise<string[]> {
    const res = await fetch(`${TIKTOK_API_BASE}/post/publish/creator_info/query/`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({}),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || (data?.error?.code && data.error.code !== "ok")) {
        throw new PublishTikTokError(
            `TikTok creator_info/query failed (${res.status}) [${data?.error?.code || "unknown"}]: ${
                data?.error?.message || JSON.stringify(data)
            }`
        );
    }

    return Array.isArray(data?.data?.privacy_level_options)
        ? data.data.privacy_level_options
        : [];
}

function choosePrivacyLevel(options: string[]): string {
    // Sandbox / unaudited TikTok apps only permit SELF_ONLY posts.
    // Switch priority to PUBLIC_TO_EVERYONE only after Content Posting API approval.
    if (options.includes("SELF_ONLY")) return "SELF_ONLY";
    if (options.includes("MUTUAL_FOLLOW_FRIENDS")) return "MUTUAL_FOLLOW_FRIENDS";
    if (options.includes("FOLLOWER_OF_CREATOR")) return "FOLLOWER_OF_CREATOR";
    if (options.includes("PUBLIC_TO_EVERYONE")) return "PUBLIC_TO_EVERYONE";
    return options[0] || "SELF_ONLY";
}

async function waitForPublishCompletion(
    accessToken: string,
    publishId: string
): Promise<void> {
    let lastStatus = "UNKNOWN";
    let lastPayload: unknown = null;

    for (let attempt = 1; attempt <= 20; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const res = await fetch(`${TIKTOK_API_BASE}/post/publish/status/fetch/`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json; charset=UTF-8",
            },
            body: JSON.stringify({ publish_id: publishId }),
        });

        const data = await res.json().catch(() => ({}));
        lastPayload = data;
        const status = data?.data?.status as string | undefined;
        if (status) lastStatus = status;

        if (status === "PUBLISH_COMPLETE") {
            return;
        }

        if (status === "FAILED") {
            throw new PublishTikTokError(
                `TikTok Direct Post failed (${publishId}) [${data?.data?.fail_reason || "FAILED"}]: ${
                    data?.data?.fail_reason || JSON.stringify(data)
                }`
            );
        }
    }

    throw new PublishTikTokError(
        `TikTok Direct Post timed out (${publishId}) in status ${lastStatus}: ${JSON.stringify(
            lastPayload
        )}`
    );
}

export async function publishTikTokVideo(
    userId: string,
    contentId: string,
    _workflowId?: string | null,
    accountId?: string | null
): Promise<{ publishId: string; privacyLevel: string }> {
    const supabase = getSupabaseAdminClient();

    const { data: contentRow, error: contentError } = await supabase
        .from("content")
        .select("id, title, idea, caption, hashtags, image_url")
        .eq("id", contentId)
        .eq("user_id", userId)
        .single();

    if (contentError || !contentRow) {
        throw new PublishTikTokError(
            `Content item ${contentId} not found for user ${userId}.`
        );
    }

    const videoUrl = contentRow.image_url?.trim();
    if (!videoUrl) {
        throw new PublishTikTokError(
            `Content item ${contentId} has no media/video URL.`
        );
    }

    const { data: accountRows, error: accountError } = await supabase
        .from("accounts")
        .select("id, account_id, access_token")
        .eq("user_id", userId)
        .eq("platform", "tiktok");

    const accountRow = accountId
        ? accountRows?.find(
            (row) => row.id === accountId || row.account_id === accountId
        ) ?? accountRows?.[0]
        : accountRows?.[0];

    if (accountError || !accountRow?.access_token) {
        throw new PublishTikTokError(
            "Connected TikTok account or access token not found. Please reconnect TikTok on /accounts."
        );
    }

    const accessToken = accountRow.access_token as string;

    const mediaRes = await fetch(videoUrl);
    if (!mediaRes.ok) {
        throw new PublishTikTokError(
            `Failed to download video (${mediaRes.status}): ${videoUrl}`
        );
    }

    const videoBuffer = Buffer.from(await mediaRes.arrayBuffer());
    const videoSize = videoBuffer.byteLength;
    if (videoSize === 0) {
        throw new PublishTikTokError("Downloaded video file is empty.");
    }

    let privacyOptions: string[] = [];
    try {
        privacyOptions = await queryCreatorInfo(accessToken);
    } catch {
        privacyOptions = ["SELF_ONLY"];
    }
    const privacyLevel = choosePrivacyLevel(privacyOptions);

    const chunkSize =
        videoSize <= MAX_CHUNK_BYTES ? videoSize : MAX_CHUNK_BYTES;
    const totalChunkCount = Math.ceil(videoSize / chunkSize);

    const title = buildCaptionText({
        title: contentRow.title,
        caption: contentRow.caption || contentRow.idea,
        hashtags: contentRow.hashtags,
    });

    const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
            post_info: {
                title,
                privacy_level: privacyLevel,
                disable_duet: false,
                disable_comment: false,
                disable_stitch: false,
            },
            source_info: {
                source: "FILE_UPLOAD",
                video_size: videoSize,
                chunk_size: chunkSize,
                total_chunk_count: totalChunkCount,
            },
        }),
    });

    const initJson = await initRes.json().catch(() => ({}));

    if (!initRes.ok || (initJson?.error?.code && initJson.error.code !== "ok")) {
        throw new PublishTikTokError(
            `TikTok Direct Post init failed (${initRes.status}) [${initJson?.error?.code || "unknown"}]: ${
                initJson?.error?.message || JSON.stringify(initJson)
            }`
        );
    }

    const publishId: string | undefined = initJson?.data?.publish_id;
    const uploadUrl: string | undefined = initJson?.data?.upload_url;

    if (!publishId || !uploadUrl) {
        throw new PublishTikTokError(
            `TikTok Direct Post response missing publish_id or upload_url: ${JSON.stringify(
                initJson
            )}`
        );
    }

    for (let i = 0; i < totalChunkCount; i++) {
        const start = i * chunkSize;
        const isLast = i === totalChunkCount - 1;
        const end = isLast ? videoSize - 1 : start + chunkSize - 1;
        const chunk = videoBuffer.subarray(start, end + 1);

        const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": "video/mp4",
                "Content-Length": String(chunk.byteLength),
                "Content-Range": `bytes ${start}-${end}/${videoSize}`,
            },
            body: chunk,
        });

        if (!uploadRes.ok && uploadRes.status !== 201 && uploadRes.status !== 206) {
            const errText = await uploadRes.text().catch(() => "");
            throw new PublishTikTokError(
                `TikTok chunk ${i + 1}/${totalChunkCount} upload failed (${uploadRes.status}): ${errText}`
            );
        }
    }

    await waitForPublishCompletion(accessToken, publishId);

    return { publishId, privacyLevel };
}