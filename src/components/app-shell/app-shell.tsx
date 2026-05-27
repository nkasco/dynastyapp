import { BarChart3, FlaskConical, Search, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const navItems = [
  { label: "Players", icon: Search },
  { label: "Leagues", icon: Users },
  { label: "Trade Lab", icon: FlaskConical },
  { label: "Reports", icon: BarChart3 },
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border/75 bg-background/88 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-md font-mono text-sm font-semibold">
              DC
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Dynasty Command Center</div>
              <div className="truncate text-xs text-muted-foreground">Private league intelligence</div>
            </div>
          </div>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {navItems.map((item) => (
              <a
                key={item.label}
                href="#"
                className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors"
              >
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
              </a>
            ))}
          </nav>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Local first
          </Badge>
        </div>
      </header>
      <div className="flex min-h-[calc(100dvh-3.5rem)]">{children}</div>
    </div>
  );
}
