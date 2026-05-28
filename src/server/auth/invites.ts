import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { inviteCodes, inviteRedemptions, localCredentials, users } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/passwords";

export type InviteRole = "admin" | "member";

export function hashInviteCode(code: string) {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function findUsableInvite(code: string) {
  const codeHash = hashInviteCode(code);
  const now = new Date();

  return db.query.inviteCodes.findFirst({
    where: and(
      eq(inviteCodes.codeHash, codeHash),
      isNull(inviteCodes.revokedAt),
      or(isNull(inviteCodes.expiresAt), gt(inviteCodes.expiresAt, now)),
      lt(inviteCodes.useCount, inviteCodes.maxUses),
    ),
  });
}

export async function registerLocalUser(input: {
  email: string;
  password: string;
  name?: string;
  inviteCode: string;
}) {
  const email = normalizeEmail(input.email);
  const invite = await findUsableInvite(input.inviteCode);

  if (!invite) {
    throw new Error("That invite code is expired, revoked, or already used.");
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    throw new Error("That email already has an account.");
  }

  const userId = randomUUID();
  const now = new Date();
  const passwordHash = await hashPassword(input.password);

  await db.insert(users).values({
    id: userId,
    email,
    name: input.name?.trim() || null,
    role: invite.role,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(localCredentials).values({
    userId,
    passwordHash,
    passwordAlgorithm: "argon2id",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(inviteRedemptions).values({
    id: randomUUID(),
    inviteCodeId: invite.id,
    userId,
    redeemedAt: now,
  });

  await db
    .update(inviteCodes)
    .set({
      useCount: sql`${inviteCodes.useCount} + 1`,
      updatedAt: now,
    })
    .where(eq(inviteCodes.id, invite.id));

  return { id: userId, email, name: input.name?.trim() || null, role: invite.role };
}

export async function createInviteCode(input: {
  code: string;
  label?: string;
  role: InviteRole;
  maxUses: number;
  createdByUserId: string;
}) {
  const now = new Date();

  await db.insert(inviteCodes).values({
    id: randomUUID(),
    codeHash: hashInviteCode(input.code),
    label: input.label?.trim() || null,
    role: input.role,
    maxUses: input.maxUses,
    useCount: 0,
    createdByUserId: input.createdByUserId,
    createdAt: now,
    updatedAt: now,
  });
}

