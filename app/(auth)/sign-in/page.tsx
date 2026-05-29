import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { auth } from "@/auth";
import { AuthForms } from "@/components/auth/auth-forms";
import { Badge } from "@/components/ui/badge";
import { env } from "@/env";
import {
  createAccountWithInvite,
  signInWithDiscord,
  signInWithGitHub,
  signInWithPassword,
} from "@/server/auth/actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  const params = await searchParams;

  return (
    <main className="min-h-dvh bg-background px-5 py-8 sm:px-8">
      <div className="mx-auto grid w-full max-w-5xl gap-8">
        <header className="grid gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <LockKeyhole className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold">Dynalytics</p>
              <p className="text-xs text-muted-foreground">Private league intelligence</p>
            </div>
          </div>
          <div className="max-w-2xl space-y-3">
            <Badge variant="outline" className="w-fit border-accent/35 bg-accent/10 text-accent-foreground">
              Invite gated
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sign in before the trade window closes.</h1>
            <p className="text-sm leading-6 text-muted-foreground sm:text-base">
              Local accounts are invite-only. GitHub and Discord can create a member account when the provider returns an email.
            </p>
          </div>
        </header>

        <AuthForms
          githubEnabled={Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET)}
          discordEnabled={Boolean(env.AUTH_DISCORD_ID && env.AUTH_DISCORD_SECRET)}
          localEnabled={env.LOCAL_AUTH_ENABLED}
          registered={params.registered === "1"}
          createAccountWithInviteAction={createAccountWithInvite}
          signInWithDiscordAction={signInWithDiscord}
          signInWithGitHubAction={signInWithGitHub}
          signInWithPasswordAction={signInWithPassword}
        />
      </div>
    </main>
  );
}
