import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";

const COOKIE_NAME = "inventory_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

const sessionSchema = z.object({
  userId: z.string(),
  username: z.string(),
  role: z.enum(["ADMIN", "VIEWER"]),
  expiresAt: z.number(),
});

export type SessionUser = z.infer<typeof sessionSchema>;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(session: SessionUser) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(value?: string): SessionUser | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const parsed = sessionSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  if (!parsed.success || parsed.data.expiresAt < Date.now()) return null;
  return parsed.data;
}

export async function createSession(input: { userId: string; username: string; role: Role }) {
  const cookieStore = await cookies();
  cookieStore.set(
    COOKIE_NAME,
    encode({
      userId: input.userId,
      username: input.username,
      role: input.role,
      expiresAt: Date.now() + MAX_AGE_SECONDS * 1000,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: MAX_AGE_SECONDS,
      path: "/",
    },
  );
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession() {
  const cookieStore = await cookies();
  return decode(cookieStore.get(COOKIE_NAME)?.value);
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
  return session;
}
