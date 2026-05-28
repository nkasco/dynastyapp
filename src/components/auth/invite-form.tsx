"use client";

import { TicketPlus } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InviteAction = (previousState: string | null | undefined, formData: FormData) => Promise<string | null | undefined>;

export function InviteForm({ createInviteAction }: { createInviteAction: InviteAction }) {
  const [error, action, pending] = useActionState(createInviteAction, null);

  return (
    <form action={action} className="grid gap-4 rounded-lg border border-border/80 bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Create friend invite</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Codes are stored as hashes; share the plain code once.</p>
        </div>
        <TicketPlus className="text-accent size-5" aria-hidden="true" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="invite-code">Code</Label>
        <Input id="invite-code" name="code" required minLength={4} autoComplete="off" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="invite-label">Label</Label>
        <Input id="invite-label" name="label" placeholder="May waiver run" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            name="role"
            defaultValue="member"
            className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invite-uses">Max uses</Label>
          <Input id="invite-uses" name="maxUses" type="number" min={1} max={25} defaultValue={1} required />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button disabled={pending} className="gap-2">
        <TicketPlus className="size-4" aria-hidden="true" />
        {pending ? "Creating..." : "Create invite"}
      </Button>
    </form>
  );
}
