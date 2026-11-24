const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();

export function validateFullName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    return { valid: false, error: "Full name must be between 2 and 80 characters." };
  }
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

export function getPasswordChecklist(password: string) {
  return {
    minLength: password.length >= 8,
    hasAlphabet: /[A-Za-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9\s]/.test(password),
  };
}

export function validateStrongPassword(password: string): {
  valid: boolean;
  error?: string;
} {
  const checks = getPasswordChecklist(password);
  if (!checks.minLength) {
    return { valid: false, error: "Password must be at least 8 characters long." };
  }
  if (!checks.hasAlphabet) {
    return { valid: false, error: "Password must contain at least one letter (A–Z)." };
  }
  if (!checks.hasNumber) {
    return { valid: false, error: "Password must contain at least one number (0–9)." };
  }
  if (!checks.hasSpecial) {
    return {
      valid: false,
      error: "Password must contain at least one special character (e.g., !@#$%^&*).",
    };
  }
  return { valid: true };
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
