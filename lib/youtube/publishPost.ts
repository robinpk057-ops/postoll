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

type YouTubeAccountRow = {
    id: string;
    user_id?: string | null;
    account_id: string;
    account_name: string;
    access_token: string | null;
    refresh_token: string | null;
    token_expires_at: string | null;
};

const ACCOUNT_SELECT_FIELDS =
    "id, user_id, account_id, account_name, access_token, refresh_token, token_expires_at";

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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const code = data?.error ? ` [${data.error}]` : "";
        throw new PublishYouTubeError(
            `YouTube token refresh failed (${res.status})${code}: ${
                data?.error_description || "Failed to refresh YouTube token"
            }`,
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
    access_token: string | null;
    refresh_token: string | null;
    token_expires_at: string | null;
}) {
    const supabase = admin();
    const expiresAt = account.token_expires_at
        ? new Date(account.token_expires_at).getTime()
        : 0;

    if (account.access_token && expiresAt - Date.now() > 2 * 60 * 1000) {
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

function getPrivacyStatus(): "public" | "unlisted" | "private" {
    const configured = (process.env.YOUTUBE_PRIVACY_STATUS || "public")
        .trim()
        .toLowerCase();
    if (
        configured === "public" ||
        configured === "unlisted" ||
        configured === "private"
    ) {
        return configured;
    }
    return "public";
}

export async function publishYouTubeVideo(
    userId: string,
    contentId: string,
    overrideWorkflowId?: string | null,
    overrideAccountId?: string | null
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

    let account: YouTubeAccountRow | null = null;

    // 1. Try overrideAccountId if provided directly and has an access_token or refresh_token
    if (overrideAccountId) {
        const { data } = await supabase
            .from("accounts")
            .select(ACCOUNT_SELECT_FIELDS)
            .eq("id", overrideAccountId)
            .maybeSingle();
        if (data && (data.access_token || data.refresh_token)) {
            account = data;
        }
    }

    // 2. Try workflow_accounts link lookup if account not found yet
    const targetWorkflowId = overrideWorkflowId || content.workflow_id;
    if (!account && targetWorkflowId) {
        const { data: linkData } = await supabase
            .from("workflow_accounts")
            .select("account_id")
            .eq("workflow_id", targetWorkflowId)
            .ilike("platform", "youtube")
            .maybeSingle();

        if (linkData?.account_id) {
            const { data } = await supabase
                .from("accounts")
                .select(ACCOUNT_SELECT_FIELDS)
                .eq("id", linkData.account_id)
                .maybeSingle();
            if (data && (data.access_token || data.refresh_token)) {
                account = data;
            }
        }
    }

    // 3. Fallback to user's most recently updated YouTube account with a token
    if (!account) {
        const { data: userAccounts } = await supabase
            .from("accounts")
            .select(ACCOUNT_SELECT_FIELDS)
            .eq("user_id", userId)
            .ilike("platform", "youtube")
            .order("updated_at", { ascending: false });

        account =
            (userAccounts || []).find(
                (row) => Boolean(row.access_token) || Boolean(row.refresh_token)
            ) || null;
    }

    if (!account || (!account.access_token && !account.refresh_token)) {
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
    const privacyStatus = getPrivacyStatus();

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
                    privacyStatus,
                    selfDeclaredMadeForKids: false,
                },
            }),
            cache: "no-store",
        }
    );

    if (!initRes.ok) {
        const errBody = await initRes.json().catch(() => ({}));
        const reason =
            errBody?.error?.errors?.[0]?.reason || errBody?.error?.status || "";
        const reasonSuffix = reason ? ` [${reason}]` : "";
        console.error("YouTube init upload error:", errBody);
        throw new PublishYouTubeError(
            `YouTube upload init failed (${initRes.status})${reasonSuffix}: ${
                errBody?.error?.message || "YouTube upload init failed"
            }`,
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
        const reason =
            uploadData?.error?.errors?.[0]?.reason ||
            uploadData?.error?.status ||
            "";
        const reasonSuffix = reason ? ` [${reason}]` : "";
        console.error("YouTube upload error:", uploadData);
        throw new PublishYouTubeError(
            `YouTube upload failed (${uploadRes.status})${reasonSuffix}: ${
                uploadData?.error?.message || "YouTube upload failed"
            }`,
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