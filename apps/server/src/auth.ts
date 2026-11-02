import { jwtVerify } from "jose";
import { randomUUID } from "node:crypto";

export interface AuthUser {
  userId: string;
  name: string;
  guest: boolean;
}

/**
 * Accepts either a Supabase access token (options.token, verified with SUPABASE_JWT_SECRET)
 * or a guest ({guestName, guestId?}). Never trust chips/ids sent by the client.
 */
export async function authenticate(opts: any): Promise<AuthUser> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (opts?.token && secret) {
    try {
      const { payload } = await jwtVerify(opts.token, new TextEncoder().encode(secret));
      const meta: any = (payload as any).user_metadata ?? {};
      return {
        userId: String(payload.sub),
        name: String(meta.full_name ?? meta.name ?? (payload as any).email ?? "Player").slice(0, 20),
        guest: false,
      };
    } catch {
      throw new Error("invalid token");
    }
  }
  const name = String(opts?.guestName ?? "Khách").trim().slice(0, 20) || "Khách";
  const gid = typeof opts?.guestId === "string" && /^[a-zA-Z0-9-]{8,40}$/.test(opts.guestId) ? opts.guestId : randomUUID();
  return { userId: `guest:${gid}`, name, guest: true };
}
