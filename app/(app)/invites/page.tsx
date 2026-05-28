import { desc } from "drizzle-orm";

import { InviteForm } from "@/components/auth/invite-form";
import { Badge } from "@/components/ui/badge";
import { createInvite } from "@/server/auth/actions";
import { db } from "@/server/db/client";
import { inviteCodes } from "@/server/db/schema";
import { requireAdmin } from "@/server/auth/session";

export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const invites = await db.query.inviteCodes.findMany({
    orderBy: desc(inviteCodes.createdAt),
    limit: 20,
  });

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <header className="grid gap-3">
        <Badge variant="outline" className="w-fit border-accent/35 bg-accent/10 text-accent-foreground">
          Admin
        </Badge>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Invites</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Keep the room small. Create codes for league mates, then watch use counts so stale invites do not linger.
          </p>
        </div>
        {params.created === "1" ? (
          <p className="w-fit rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
            Invite created.
          </p>
        ) : null}
      </header>

      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <InviteForm createInviteAction={createInvite} />
        <div className="rounded-lg border border-border/80 bg-card p-2 shadow-xs">
          {invites.length ? (
            invites.map((invite) => (
              <div key={invite.id} className="grid grid-cols-[1fr_auto] gap-4 rounded-md px-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{invite.label || "Unlabeled invite"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {invite.role} · {invite.useCount}/{invite.maxUses} used
                  </p>
                </div>
                <Badge variant={invite.revokedAt ? "destructive" : "secondary"}>
                  {invite.revokedAt ? "Revoked" : "Active"}
                </Badge>
              </div>
            ))
          ) : (
            <div className="rounded-md bg-muted/50 px-3 py-8 text-center text-sm text-muted-foreground">
              No invites yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
