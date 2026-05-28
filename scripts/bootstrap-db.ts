import "dotenv/config";

import { createHash, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { hashPassword } from "@/server/auth/passwords";
import { appSettings, inviteCodes, localCredentials, users } from "@/server/db/schema";

const now = () => new Date();

function hashInviteCode(code: string) {
  return createHash("sha256").update(code.trim()).digest("hex");
}

async function bootstrapAdmin() {
  const email = process.env.FIRST_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.FIRST_ADMIN_PASSWORD?.trim();
  const passwordHash = process.env.FIRST_ADMIN_PASSWORD_HASH?.trim() ?? (password ? await hashPassword(password) : undefined);
  const name = process.env.FIRST_ADMIN_NAME?.trim() || "League Admin";

  if (!email) {
    return { created: false, reason: "FIRST_ADMIN_EMAIL not set" };
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  const userId = existing?.id ?? randomUUID();

  if (!existing) {
    await db.insert(users).values({
      id: userId,
      email,
      name,
      role: "admin",
      createdAt: now(),
      updatedAt: now(),
    });
  } else if (existing.role !== "admin") {
    await db.update(users).set({ role: "admin", updatedAt: now() }).where(eq(users.id, existing.id));
  }

  if (passwordHash) {
    await db
      .insert(localCredentials)
      .values({
        userId,
        passwordHash,
        passwordAlgorithm: "argon2id",
        createdAt: now(),
        updatedAt: now(),
      })
      .onConflictDoUpdate({
        target: localCredentials.userId,
        set: {
          passwordHash,
          passwordAlgorithm: "argon2id",
          updatedAt: now(),
        },
      });
  }

  return { created: !existing, email, hasPasswordHash: Boolean(passwordHash) };
}

async function bootstrapInvites() {
  const codes = (process.env.BOOTSTRAP_INVITE_CODES ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);

  const results: Array<{ code: string; created: boolean }> = [];

  for (const code of codes) {
    const codeHash = hashInviteCode(code);
    const existing = await db.query.inviteCodes.findFirst({ where: eq(inviteCodes.codeHash, codeHash) });

    if (!existing) {
      await db.insert(inviteCodes).values({
        id: randomUUID(),
        codeHash,
        label: "Development invite",
        role: "member",
        createdAt: now(),
        updatedAt: now(),
      });
    }

    results.push({ code, created: !existing });
  }

  return results;
}

async function main() {
  await db
    .insert(appSettings)
    .values({
      key: "schema_policy",
      value: {
        migrationsRequired: true,
        note: "All schema changes must be captured by drizzle-kit migrations.",
      },
      updatedAt: now(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: {
          migrationsRequired: true,
          note: "All schema changes must be captured by drizzle-kit migrations.",
        },
        updatedAt: now(),
      },
    });

  const admin = await bootstrapAdmin();
  const invites = await bootstrapInvites();

  console.log(
    JSON.stringify(
      {
        ok: true,
        admin,
        inviteCodes: invites,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
