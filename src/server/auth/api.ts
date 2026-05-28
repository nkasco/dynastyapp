import "server-only";

import { auth } from "@/auth";
import { ApiError } from "@/server/api/errors";

export async function requireApiUser() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ApiError("UNAUTHORIZED", "Sign in to use this API.");
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    role: session.user.role ?? "member",
  };
}

export async function requireApiAdmin() {
  const user = await requireApiUser();

  if (user.role !== "admin") {
    throw new ApiError("FORBIDDEN", "Admin access is required.");
  }

  return user;
}
