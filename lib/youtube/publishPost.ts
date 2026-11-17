import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export class PublishYouTubeError extends Error {
    status: number;
    details?: unknown;

    constructor(message: string, status = 400, details?: unknown) {
        super(message);
        this.name = "PublishYouTubeError";
        this.status = status;
        this.details = details;
    }
}

function admin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new PublishYouTubeError("Supabase admin env missing", 500);
    }
    return createSupabaseClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

async function refreshAccessToken(refreshToken: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new PublishYouTubeError("Google OAuth env missing", 500);
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
        cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new PublishYouTubeError(
            data.error_description || "Failed to refresh YouTube token",
            401,
            data
        );
    }

    return {
        accessToken: data.access_token as string,
        expiresIn: Number(data.expires_in || 3600),
    };
}

async function getValidAccessToken(account: {
    id: string;
    access_token: string;
    refresh_token: string | null;
    token_expires_at: string | null;
}) {
    const supabase = admin();
    const expiresAt = account.token_expires_at
        ? new Date(account.token_expires_at).getTime()
        : 0;

    if (expiresAt - Date.now() > 2 * 60 * 1000 && account.access_token) {
        return account.access_token;
    }

    if (!account.refresh_token) {
        throw new PublishYouTubeError(
            "YouTube token expired and no refresh_token. Reconnect the account.",
            401
        );
    }

    const { accessToken, expiresIn } = await refreshAccessToken(
        account.refresh_token
    );

    await supabase
        .from("accounts")
        .update({
            access_token: accessToken,
            token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

    return accessToken;
}

export async function publishYouTubeVideo(
    userId: string, 
    contentId: string, 
    overrideWorkflowId?: string | null
) {
    const supabase = admin();

    const { data: content, error: contentError } = await supabase
        .from("content")
        .select(
            "id, user_id, workflow_id, type, caption, image_url, status, platform"
        )
        .eq("id", contentId)
        .eq("user_id", userId)
        .maybeSingle();

    if (contentError || !content) {
        throw new PublishYouTubeError("Content not found.", 404);
    }

    if (!content.image_url || !content.image_url.startsWith("http")) {
        throw new PublishYouTubeError(
            "Content has no public video URL (image_url).",
            400
        );
    }

    const targetWorkflowId = overrideWorkflowId || content.workflow_id;

    let account: {
        id: string;
        account_id: string;
        account_name: string;
        access_token: string;
        refresh_token: string | null;
        token_expires_at: string | null;
    } | null = null;

    if (targetWorkflowId) {
        const { data: linkData } = await supabase
            .from("workflow_accounts")
            .select("account_id")
            .eq("workflow_id", targetWorkflowId)
            .ilike("platform", "youtube")
            .maybeSingle();

        if (linkData?.account_id) {
            const { data } = await supabase
                .from("accounts")
                .select(
                    "id, account_id, account_name, access_token, refresh_token, token_expires_at"
                )
                .eq("id", linkData.account_id)
                .maybeSingle();
            account = data;
        }
    }

    if (!account) {
        const { data } = await supabase
            .from("accounts")
            .select(
                "id, account_id, account_name, access_token, refresh_token, token_expires_at"
            )
            .eq("user_id", userId)
            .ilike("platform", "youtube")
            .limit(1)
            .maybeSingle();
        account = data;
    }

    if (!account?.access_token) {
        throw new PublishYouTubeError("No connected YouTube account.", 400);
    }

    const accessToken = await getValidAccessToken(account);

    const mediaRes = await fetch(content.image_url, { cache: "no-store" });
    if (!mediaRes.ok) {
        throw new PublishYouTubeError(
            `Could not download video from image_url (${mediaRes.status}).`,
            400
        );
    }

    const contentType = mediaRes.headers.get("content-type") || "video/mp4";
    const videoBuffer = Buffer.from(await mediaRes.arrayBuffer());

    const title =
        (content.caption || "Postoll upload").slice(0, 90) || "Postoll upload";
    const description = content.caption || "";

    const initRes = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Length": String(videoBuffer.length),
                "X-Upload-Content-Type": contentType,
            },
            body: JSON.stringify({
                snippet: {
                    title,
                    description,
                    categoryId: "22",
                },
                status: {
                    privacyStatus: "public",
                    selfDeclaredMadeForKids: false,
                },
            }),
            cache: "no-store",
        }
    );

    if (!initRes.ok) {
        const errBody = await initRes.json().catch(() => ({}));
        console.error("YouTube init upload error:", errBody);
        throw new PublishYouTubeError(
            errBody?.error?.message || "YouTube upload init failed",
            400,
            errBody
        );
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) {
        throw new PublishYouTubeError("YouTube did not return upload URL", 400);
    }

    const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": contentType,
            "Content-Length": String(videoBuffer.length),
        },
        body: videoBuffer,
        cache: "no-store",
    });

    const uploadData = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok) {
        console.error("YouTube upload error:", uploadData);
        throw new PublishYouTubeError(
            uploadData?.error?.message || "YouTube upload failed",
            400,
            uploadData
        );
    }

    const videoId = uploadData?.id as string | undefined;

    return {
        success: true as const,
        platform: "youtube" as const,
        contentId: content.id,
        account: {
            id: account.id,
            account_id: account.account_id,
            account_name: account.account_name,
        },
        publication: {
            video_id: videoId || null,
            url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
        },
    };
}