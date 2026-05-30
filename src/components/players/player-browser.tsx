"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowDownAZ, Filter, Loader2, Search, Shield, SlidersHorizontal, Star, TrendingUp, Users } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlayerListQuery, PlayerSummary } from "@/contracts";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const positionOptions = ["ALL", "QB", "RB", "WR", "TE"];
const ageOptions = [
  { label: "Any age", min: undefined, max: undefined },
  { label: "U25", min: undefined, max: 24.9 },
  { label: "25-29", min: 25, max: 29.9 },
  { label: "30+", min: 30, max: undefined },
];
const sortOptions: Array<{ label: string; value: PlayerListQuery["sort"]; icon: typeof ArrowDownAZ }> = [
  { label: "Production", value: "production", icon: TrendingUp },
  { label: "Rostered", value: "exposure", icon: Users },
  { label: "Name", value: "name", icon: ArrowDownAZ },
  { label: "Age", value: "age", icon: Activity },
];

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Player data did not load.";
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function playerLine(player: PlayerSummary) {
  const stats = player.seasonSummary?.keyStats;

  if (!stats) {
    return "No season line yet";
  }

  if (player.position === "QB") {
    return `${formatNumber(stats.passingYards)} pass yd | ${formatNumber(stats.passingTds)} pass TD`;
  }

  if (player.position === "RB") {
    return `${formatNumber(stats.rushingYards)} rush yd | ${formatNumber(stats.receptions)} rec`;
  }

  if (player.position === "WR" || player.position === "TE") {
    return `${formatNumber(stats.receptions)} rec | ${formatNumber(stats.receivingYards)} rec yd`;
  }

  return `${formatNumber(player.seasonSummary?.fantasyPointsPpr, 1)} PPR`;
}

function trendBars(player: PlayerSummary) {
  const max = Math.max(...player.trend.map((point) => point.fantasyPointsPpr ?? 0), 1);

  return player.trend.map((point, index) => (
    <span
      key={`${player.sleeperPlayerId}-${point.week}-${index}`}
      className="bg-primary/70 block w-2 rounded-sm"
      style={{ height: `${Math.max(16, ((point.fantasyPointsPpr ?? 0) / max) * 42)}px` }}
      title={`Week ${point.week}: ${formatNumber(point.fantasyPointsPpr, 1)} PPR`}
    />
  ));
}

function PlayerCard({ player }: { player: PlayerSummary }) {
  const exposure = player.rosterExposure.rosteredCount;

  return (
    <article className="grid min-h-[218px] content-between rounded-lg border border-border/80 bg-card p-4 shadow-xs">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-base font-semibold text-card-foreground">{player.fullName}</h2>
              {player.badges.includes("production") ? <Star className="size-4 shrink-0 text-chart-4" aria-hidden="true" /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{player.position ?? "UNK"}</Badge>
              <span>{player.team ?? "FA"}</span>
              <span>{player.age != null ? `${formatNumber(player.age, 1)} yrs` : "age -"}</span>
              {player.status ? <span>{player.status}</span> : null}
            </div>
          </div>
          <div className="rounded-md bg-primary/10 px-2.5 py-1.5 text-right text-primary">
            <div className="text-lg font-semibold">{formatNumber(player.seasonSummary?.fantasyPointsPerGame, 1)}</div>
            <div className="text-[10px] uppercase tracking-normal">PPR/G</div>
          </div>
        </div>

        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-4 rounded-md bg-muted/55 px-3 py-2">
            <span className="text-muted-foreground">Season</span>
            <span className="font-medium">{player.seasonSummary?.season ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md bg-muted/55 px-3 py-2">
            <span className="text-muted-foreground">Line</span>
            <span className="truncate text-right font-medium">{playerLine(player)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md bg-muted/55 px-3 py-2">
            <span className="text-muted-foreground">Exposure</span>
            <span className="font-medium">
              {exposure > 0 ? `${exposure} roster${exposure === 1 ? "" : "s"}` : "Free agent"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {player.badges.slice(0, 3).map((badge) => (
            <Badge key={badge} variant="outline" className="max-w-28 truncate">
              {badge}
            </Badge>
          ))}
        </div>
        <div className="flex h-12 shrink-0 items-end gap-1" aria-label="Recent PPR trend">
          {player.trend.length > 0 ? trendBars(player) : <span className="text-xs text-muted-foreground">No trend</span>}
        </div>
      </div>
    </article>
  );
}

export function PlayerBrowser() {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [sort, setSort] = useState<PlayerListQuery["sort"]>("production");
  const [rosteredOnly, setRosteredOnly] = useState(false);
  const [fantasyRelevant, setFantasyRelevant] = useState(false);
  const [injuredOnly, setInjuredOnly] = useState(false);
  const [ageIndex, setAgeIndex] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const ageFilter = ageOptions[ageIndex] ?? ageOptions[0];

  const playerQuery = useMemo(
    () => ({
      page: 1,
      pageSize: 36,
      q: deferredQuery,
      position: position === "ALL" ? undefined : position,
      sort,
      dir: (sort === "age" || sort === "name" ? "asc" : "desc") as PlayerListQuery["dir"],
      rostered: rosteredOnly || undefined,
      fantasyRelevant: fantasyRelevant || undefined,
      injured: injuredOnly || undefined,
      ageMin: ageFilter.min,
      ageMax: ageFilter.max,
    }),
    [ageFilter.max, ageFilter.min, deferredQuery, fantasyRelevant, injuredOnly, position, rosteredOnly, sort],
  );

  const playersQuery = useQuery({
    queryKey: ["players", playerQuery],
    queryFn: () => apiClient.players(playerQuery),
    retry: false,
  });
  const players = playersQuery.data?.items ?? [];
  const total = playersQuery.data?.pagination.total ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-5 py-6 sm:px-8 lg:px-10">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-3">
          <Badge variant="outline" className="border-accent/35 bg-accent/10 text-accent-foreground">
            Player browser
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Players</h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Search imported players, scan production, and see roster exposure across linked leagues.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/80 bg-card p-2 text-sm shadow-xs sm:grid-cols-4">
          <div className="rounded-md bg-muted/55 px-3 py-2">
            <div className="text-muted-foreground">Showing</div>
            <div className="font-semibold">{players.length}</div>
          </div>
          <div className="rounded-md bg-muted/55 px-3 py-2">
            <div className="text-muted-foreground">Matched</div>
            <div className="font-semibold">{total}</div>
          </div>
          <div className="rounded-md bg-muted/55 px-3 py-2">
            <div className="text-muted-foreground">Mode</div>
            <div className="font-semibold">{fantasyRelevant ? "Fantasy" : "All"}</div>
          </div>
          <div className="rounded-md bg-muted/55 px-3 py-2">
            <div className="text-muted-foreground">Sort</div>
            <div className="font-semibold capitalize">{sort}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-border/80 bg-card p-4 shadow-xs">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto] lg:items-end">
          <div className="grid gap-2">
            <Label htmlFor="player-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="player-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Player name"
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Position</Label>
            <div className="flex flex-wrap gap-1 rounded-md border border-border/75 p-1">
              {positionOptions.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={position === option ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setPosition(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Sort</Label>
            <div className="flex flex-wrap gap-1 rounded-md border border-border/75 p-1">
              {sortOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={sort === option.value ? "default" : "ghost"}
                  size="sm"
                  className="h-8 gap-1.5 px-3"
                  onClick={() => setSort(option.value)}
                >
                  <option.icon className="size-3.5" aria-hidden="true" />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
          <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/75 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={fantasyRelevant}
              onChange={(event) => setFantasyRelevant(event.target.checked)}
              className="size-4 accent-primary"
            />
            Fantasy positions
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/75 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={rosteredOnly}
              onChange={(event) => setRosteredOnly(event.target.checked)}
              className="size-4 accent-primary"
            />
            Rostered only
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/75 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={injuredOnly}
              onChange={(event) => setInjuredOnly(event.target.checked)}
              className="size-4 accent-primary"
            />
            Injury/status
          </label>
          <div className="flex flex-wrap gap-1 rounded-md border border-border/75 p-1">
            {ageOptions.map((option, index) => (
              <Button
                key={option.label}
                type="button"
                variant={ageIndex === index ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3"
                onClick={() => setAgeIndex(index)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <Shield className="size-4" aria-hidden="true" />
            Sleeper remains read-only
          </div>
        </div>
      </section>

      {playersQuery.isPending ? (
        <section className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-border/90">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading players
          </div>
        </section>
      ) : playersQuery.isError ? (
        <section className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-destructive/50 p-8 text-center">
          <div className="max-w-md space-y-3">
            <SlidersHorizontal className="mx-auto size-6 text-destructive" aria-hidden="true" />
            <h2 className="text-base font-semibold">Players did not load</h2>
            <p className="text-sm leading-6 text-muted-foreground">{errorMessage(playersQuery.error)}</p>
          </div>
        </section>
      ) : players.length === 0 ? (
        <section className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-border/90 p-8 text-center">
          <div className="max-w-md space-y-3">
            <Search className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-semibold">No matching players</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Try a broader search, clear roster-only, or import Sleeper players before scanning the board.
            </p>
          </div>
        </section>
      ) : (
        <section
          className={cn(
            "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
            playersQuery.isFetching ? "opacity-75 transition-opacity" : "opacity-100 transition-opacity",
          )}
        >
          {players.map((player) => (
            <PlayerCard key={player.sleeperPlayerId} player={player} />
          ))}
        </section>
      )}
    </main>
  );
}
