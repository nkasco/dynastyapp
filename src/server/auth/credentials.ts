import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { localCredentials, users } from "@/server/db/schema";
import { normalizeEmail } from "@/server/auth/invites";
import { verifyPassword } from "@/server/auth/passwords";

export async function authorizeLocalCredentials(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    with: {
      localCredential: true,
    },
  });

  if (!user?.localCredential) {
    return null;
  }

  const verified = await verifyPassword(user.localCredential.passwordHash, password);
  if (!verified) {
    return null;
  }

  await db
    .update(localCredentials)
    .set({ updatedAt: new Date() })
    .where(eq(localCredentials.userId, user.id));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
  };
}

