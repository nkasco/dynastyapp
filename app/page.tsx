import { Activity, ArrowUpRight, Database, LockKeyhole, Moon, RefreshCw, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const foundationItems = [
  {
    title: "Private boundary",
    detail: "UI calls internal APIs only; server modules will own auth, imports, persistence, and analytics.",
    icon: LockKeyhole,
  },
  {
    title: "Local-first data",
    detail: "SQLite is pointed at ./data/dynasty.db for development, ready for a mounted volume later.",
    icon: Database,
  },
  {
    title: "Observable imports",
    detail: "Nightly refresh settings are validated now so ingestion can grow without surprise config drift.",
    icon: RefreshCw,
  },
];

const signalRows = [
  ["Runtime", "Next.js 16 App Router"],
  ["Interface", "Tailwind 4 + shadcn/new-york tokens"],
  ["Client state", "TanStack Query ready"],
  ["Forms", "React Hook Form + Zod ready"],
  ["Charts", "Recharts + shadcn chart primitives ready"],
];

export default function Home() {
  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-5 py-6 sm:px-8 lg:px-10">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:items-end">
          <div className="space-y-6">
            <Badge variant="outline" className="border-accent/35 bg-accent/10 text-accent-foreground">
              App foundation online
            </Badge>
            <div className="max-w-3xl space-y-4">
              <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Dynasty Command Center
              </h1>
              <p className="text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
                A calm, dense home base for linking leagues, reading player context, and turning messy roster data into the next move.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="gap-2">
                Open the board
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Button>
              <Button variant="secondary" className="gap-2">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Read-only sources
              </Button>
            </div>
          </div>

          <div className="border-border/80 bg-card/75 shadow-xs grid gap-1 rounded-lg border p-2">
            {signalRows.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[118px_1fr] items-center rounded-md px-3 py-2.5 text-sm"
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-card-foreground">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {foundationItems.map((item) => (
            <article key={item.title} className="border-border/80 bg-card/75 rounded-lg border p-4 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-md">
                  <item.icon className="size-4" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-card-foreground">{item.title}</h2>
                  <p className="text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="text-accent size-4" aria-hidden="true" />
              Phase 1 status
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              The shell is intentionally quiet for now: enough structure to prove the app boots, enough visual language to avoid generic dashboard sprawl, and no fake analytics before imports exist.
            </p>
          </div>
          <div className="grid gap-2 rounded-lg border border-dashed border-border/90 p-3 text-sm">
            <div className="flex items-center justify-between gap-4 rounded-md bg-muted/55 px-3 py-2">
              <span className="text-muted-foreground">Next milestone</span>
              <span className="font-medium">Drizzle schema and migrations</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md bg-muted/55 px-3 py-2">
              <span className="text-muted-foreground">Refresh target</span>
              <span className="font-medium">1:00 AM America/New_York</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md bg-muted/55 px-3 py-2">
              <span className="text-muted-foreground">Theme</span>
              <span className="inline-flex items-center gap-2 font-medium">
                <Moon className="size-4" aria-hidden="true" />
                System aware
              </span>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
