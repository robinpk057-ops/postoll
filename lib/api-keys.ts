import { createHash, randomBytes } from "crypto";

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `pk_live_${randomBytes(24).toString("hex")}`;
  const prefix = raw.slice(0, 12);
  const hash = hashApiKey(raw);
  return { raw, prefix, hash };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}