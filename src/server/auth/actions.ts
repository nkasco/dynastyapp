"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn, signOut } from "@/auth";
import { createInviteCode, registerLocalUser } from "@/server/auth/invites";
import { requireAdmin, requireUser } from "@/server/auth/session";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = signInSchema.extend({
  name: z.string().max(120).optional(),
  inviteCode: z.string().min(4),
});

const inviteSchema = z.object({
  code: z.string().min(4),
  label: z.string().max(120).optional(),
  role: z.enum(["admin", "member"]).default("member"),
  maxUses: z.coerce.number().int().min(1).max(25).default(1),
});

type FormState = string | null | undefined;

export async function signInWithPassword(_previousState: FormState, formData: FormData) {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return "Use a valid email and password.";
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "That login did not match an active local account.";
    }

    throw error;
  }
}

export async function createAccountWithInvite(_previousState: FormState, formData: FormData) {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return "Use a valid invite code, email, and password.";
  }

  try {
    await registerLocalUser(parsed.data);
  } catch (error) {
    return error instanceof Error ? error.message : "That invite could not create an account.";
  }

  redirect("/sign-in?registered=1");
}

export async function signInWithGitHub() {
  await signIn("github", { redirectTo: "/" });
}

export async function signInWithDiscord() {
  await signIn("discord", { redirectTo: "/" });
}

export async function createInvite(_previousState: FormState, formData: FormData) {
  const user = await requireAdmin();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return "Use a code with at least four characters and a valid use count.";
  }

  try {
    await createInviteCode({
      ...parsed.data,
      createdByUserId: user.id,
    });
  } catch (error) {
    return error instanceof Error ? error.message : "That invite could not be created.";
  }

  redirect("/invites?created=1");
}

export async function signOutCurrentUser() {
  await requireUser();
  await signOut({ redirectTo: "/sign-in" });
}
