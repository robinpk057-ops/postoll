const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();

export function validateFullName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    return { valid: false, error: "Full name must be between 2 and 80 characters." };
  }
  // Allows letters (including accented/Unicode letters), spaces, apostrophes, hyphens, and periods
  if (!/^[\p{L}\s.'-]+$/u.test(trimmed)) {
    return {
      valid: false,
      error: "Full name can only contain letters, spaces, periods, apostrophes, and hyphens.",
    };
  }
  return { valid: true };
}

export function validateEmailAddress(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return { valid: false, error: "Please enter a valid email address." };
  }
  return { valid: true };
}

export function validateInstagramUsername(username: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = username.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9._]{3,30}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error:
        "Username must be 3–30 characters using only lowercase letters, numbers, periods (.), or underscores (_).",
    };
  }
  if (/^\.|\.$|\.\./.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Username cannot start or end with a period or contain consecutive periods (..).",
    };
  }
  return { valid: true, normalized };
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const current = RATE_BUCKETS.get(key);

  if (!current || current.resetAt <= now) {
    RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getClientIp(headersList: Headers): string {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headersList.get("x-real-ip")?.trim() || "unknown-ip";
}
