"use client";

import { Github, KeyRound, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormAction = (previousState: string | null | undefined, formData: FormData) => Promise<string | null | undefined>;
type ProviderAction = () => Promise<void>;

type AuthFormsProps = {
  githubEnabled: boolean;
  discordEnabled: boolean;
  localEnabled: boolean;
  registered: boolean;
  createAccountWithInviteAction: FormAction;
  signInWithDiscordAction: ProviderAction;
  signInWithGitHubAction: ProviderAction;
  signInWithPasswordAction: FormAction;
};

export function AuthForms({
  createAccountWithInviteAction,
  discordEnabled,
  githubEnabled,
  localEnabled,
  registered,
  signInWithDiscordAction,
  signInWithGitHubAction,
  signInWithPasswordAction,
}: AuthFormsProps) {
  const [signInError, signInAction, signingIn] = useActionState(signInWithPasswordAction, null);
  const [registerError, registerAction, registering] = useActionState(createAccountWithInviteAction, null);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-border/80 bg-card p-5 shadow-xs">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Sign in</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">For league mates already on the board.</p>
          </div>
          <KeyRound className="text-primary size-5" aria-hidden="true" />
        </div>

        {registered ? (
          <p className="mb-4 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
            Account created. Sign in when ready.
          </p>
        ) : null}

        {localEnabled ? (
          <form action={signInAction} className="grid gap-4">
            <Field id="signin-email" label="Email" name="email" type="email" autoComplete="email" />
            <Field
              id="signin-password"
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
            />
            {signInError ? <p className="text-sm text-destructive">{signInError}</p> : null}
            <Button disabled={signingIn} className="w-full gap-2">
              <Mail className="size-4" aria-hidden="true" />
              {signingIn ? "Checking..." : "Sign in with email"}
            </Button>
          </form>
        ) : (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">Local sign-in is disabled.</p>
        )}

        <div className="mt-5 grid gap-2">
          {githubEnabled ? <ProviderButton action={signInWithGitHubAction} label="Continue with GitHub" icon="github" /> : null}
          {discordEnabled ? <ProviderButton action={signInWithDiscordAction} label="Continue with Discord" icon="discord" /> : null}
        </div>
      </section>

      <section className="rounded-lg border border-border/80 bg-card p-5 shadow-xs">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Join with invite</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Invite codes keep this private by default.</p>
          </div>
          <ShieldCheck className="text-accent size-5" aria-hidden="true" />
        </div>

        {localEnabled ? (
          <form action={registerAction} className="grid gap-4">
            <Field id="invite-code" label="Invite code" name="inviteCode" autoComplete="one-time-code" />
            <Field id="register-name" label="Name" name="name" autoComplete="name" />
            <Field id="register-email" label="Email" name="email" type="email" autoComplete="email" />
            <Field
              id="register-password"
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
            />
            {registerError ? <p className="text-sm text-destructive">{registerError}</p> : null}
            <Button disabled={registering} variant="secondary" className="w-full">
              {registering ? "Creating account..." : "Create account"}
            </Button>
          </form>
        ) : (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">Invite registration is disabled.</p>
        )}
      </section>
    </div>
  );
}

function Field(props: React.ComponentProps<typeof Input> & { label: string; id: string }) {
  const { label, id, ...inputProps } = props;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} required {...inputProps} />
    </div>
  );
}

function ProviderButton({
  action,
  label,
  icon,
}: {
  action: () => Promise<void>;
  label: string;
  icon: "github" | "discord";
}) {
  return (
    <form action={action}>
      <Button type="submit" variant="outline" className="w-full gap-2">
        {icon === "github" ? <Github className="size-4" aria-hidden="true" /> : <MessageCircle className="size-4" aria-hidden="true" />}
        {label}
      </Button>
    </form>
  );
}
