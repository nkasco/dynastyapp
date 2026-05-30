"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowDownAZ, Filter, Loader2, Search, Shield, SlidersHorizontal, Star, Trophy, TrendingUp, Users } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PprScoringControl } from "@/components/leagues/ppr-scoring-control";
import type { LeagueSummary, PlayerListQuery, PlayerSummary } from "@/contracts";
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

  return `${formatNumber(player.seasonSummary?.fantasyPoints, 1)} pts`;
}

function trendBars(player: PlayerSummary) {
  const max = Math.max(...player.trend.map((point) => point.fantasyPoints ?? 0), 1);

  return player.trend.map((point, index) => (
    <span
      key={`${player.sleeperPlayerId}-${point.week}-${index}`}
      className="bg-primary/70 block w-2 rounded-sm"
      style={{ height: `${Math.max(16, ((point.fantasyPoints ?? 0) / max) * 42)}px` }}
      title={`Week ${point.week}: ${formatNumber(point.fantasyPoints, 1)} pts`}
    />
  ));
}

function rosterHolder(player: PlayerSummary) {
  return player.rosterExposure.labels[0] ?? null;
}

function draftLine(player: PlayerSummary) {
  if (!player.draftInfo) {
    return "Draft -";
  }

  return `${player.draftInfo.year} NFL | R${player.draftInfo.round} P${player.draftInfo.pick}`;
}

function PlayerCard({ player, activeLeague }: { player: PlayerSummary; activeLeague: LeagueSummary | null }) {
  const exposure = player.rosterExposure.rosteredCount;
  const holder = rosterHolder(player);

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
            <div className="text-[10px] uppercase tracking-normal">
              {player.seasonSummary ? `${player.seasonSummary.scoringLabel}/G` : "PTS/G"}
            </div>
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
            <span className="text-muted-foreground">Draft</span>
            <span className="truncate text-right font-medium">{draftLine(player)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md bg-muted/55 px-3 py-2">
            <span className="text-muted-foreground">{activeLeague ? "Held by" : "Exposure"}</span>
            <span className="min-w-0 truncate text-right font-medium">
              {activeLeague
                ? holder ?? "Free agent"
                : exposure > 0
                  ? `${exposure} roster${exposure === 1 ? "" : "s"}`
                  : "Free agent"}
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
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [sort, setSort] = useState<PlayerListQuery["sort"]>("production");
  const [rosteredOnly, setRosteredOnly] = useState(false);
  const [fantasyRelevant, setFantasyRelevant] = useState(false);
  const [injuredOnly, setInjuredOnly] = useState(false);
  const [ageIndex, setAgeIndex] = useState(0);
  const [activeLeagueId, setActiveLeagueId] = useState("");
  const [activeRosterId, setActiveRosterId] = useState("");
  const [activeSeason, setActiveSeason] = useState("");
  const deferredQuery = useDeferredValue(query);
  const ageFilter = ageOptions[ageIndex] ?? ageOptions[0];

  const leaguesQuery = useQuery({
    queryKey: ["leagues", "player-browser"],
    queryFn: () => apiClient.leagues({ page: 1, pageSize: 100, sort: "season", dir: "desc" }),
    retry: false,
  });
  const leagues = leaguesQuery.data?.items ?? [];
  const selectedLeagueId =
    activeLeagueId && leagues.some((league) => league.id === activeLeagueId) ? activeLeagueId : leagues[0]?.id || "";
  const activeLeague = leagues.find((league) => league.id === selectedLeagueId) ?? null;
  const selectedRosterId =
    activeRosterId && activeLeague?.rosters.some((roster) => String(roster.rosterId) === activeRosterId)
      ? activeRosterId
      : "";
  const activeRoster = activeLeague?.rosters.find((roster) => String(roster.rosterId) === selectedRosterId) ?? null;

  const scoringMutation = useMutation({
    mutationFn: ({ leagueId, value }: { leagueId: string; value: 0 | 0.5 | 1 }) =>
      apiClient.updateLeagueSettings(leagueId, { pprScoringPreference: value }),
    onSuccess: async () => {
      toast.success("League scoring saved.");
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
      await queryClient.invalidateQueries({ queryKey: ["players"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const playerQuery = useMemo(
    () => ({
      page: 1,
      pageSize: 36,
      q: deferredQuery,
      leagueId: selectedLeagueId || undefined,
      rosterId: selectedRosterId ? Number(selectedRosterId) : undefined,
      season: activeSeason ? Number(activeSeason) : undefined,
      position: position === "ALL" ? undefined : position,
      sort,
      dir: (sort === "age" || sort === "name" ? "asc" : "desc") as PlayerListQuery["dir"],
      rostered: rosteredOnly || undefined,
      fantasyRelevant: fantasyRelevant || undefined,
      injured: injuredOnly || undefined,
      ageMin: ageFilter.min,
      ageMax: ageFilter.max,
    }),
    [
      ageFilter.max,
      ageFilter.min,
      activeSeason,
      deferredQuery,
      fantasyRelevant,
      injuredOnly,
      position,
      rosteredOnly,
      selectedLeagueId,
      selectedRosterId,
      sort,
    ],
  );

  const playersQuery = useQuery({
    queryKey: ["players", playerQuery],
    queryFn: () => apiClient.players(playerQuery),
    retry: false,
  });
  const players = playersQuery.data?.items ?? [];
  const total = playersQuery.data?.pagination.total ?? 0;
  const availableSeasons = playersQuery.data?.availableSeasons ?? [];
  const selectedSeason = activeSeason || (playersQuery.data?.selectedSeason ? String(playersQuery.data.selectedSeason) : "");
  const activeScoringLabel = playersQuery.data?.scoring.label ?? activeLeague?.pprScoring.label ?? "Full PPR";

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
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/80 bg-card p-2 text-sm shadow-xs sm:grid-cols-5">
          <div className="rounded-md bg-muted/55 px-3 py-2">
            <div className="text-muted-foreground">Showing</div>
            <div className="font-semibold">{players.length}</div>
          </div>
          <div className="rounded-md bg-muted/55 px-3 py-2">
            <div className="text-muted-foreground">Matched</div>
            <div className="font-semibold">{total}</div>
          </div>
          <div className="rounded-md bg-muted/55 px-3 py-2">
            <div className="text-muted-foreground">League</div>
            <div className="max-w-28 truncate font-semibold">{activeLeague?.name ?? "None"}</div>
          </div>
          <div className="rounded-md bg-muted/55 px-3 py-2">
            <div className="text-muted-foreground">Roster</div>
            <div className="max-w-28 truncate font-semibold">{activeRoster?.ownerName ?? "All teams"}</div>
          </div>
          <div className="rounded-md bg-muted/55 px-3 py-2">
            <div className="text-muted-foreground">Season</div>
            <div className="max-w-28 truncate font-semibold">{selectedSeason || "-"}</div>
          </div>
        </div>
      </section>

      {activeLeague ? (
        <section className="grid gap-3 rounded-lg border border-border/80 bg-card p-4 shadow-xs md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] md:items-center">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">League scoring</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Sleeper scoring is used when the league exposes reception points. Set a local profile fallback only when that value is missing.
            </p>
          </div>
          <PprScoringControl
            league={activeLeague}
            disabled={scoringMutation.isPending}
            onChange={(value) => scoringMutation.mutate({ leagueId: activeLeague.id, value })}
          />
        </section>
      ) : null}

      <section className="grid gap-3 rounded-lg border border-border/80 bg-card p-4 shadow-xs">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,0.8fr)_minmax(220px,0.8fr)_minmax(160px,0.55fr)] xl:grid-cols-[minmax(220px,1fr)_minmax(220px,0.8fr)_minmax(220px,0.8fr)_minmax(160px,0.55fr)_auto_auto] xl:items-end">
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
            <Label htmlFor="league-select">League</Label>
            <div className="relative">
              <Trophy className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <select
                id="league-select"
                value={selectedLeagueId}
                onChange={(event) => {
                  setActiveLeagueId(event.target.value);
                  setActiveRosterId("");
                }}
                disabled={leagues.length === 0}
                className={cn(
                  "border-input bg-background ring-offset-background flex h-10 w-full rounded-md border px-9 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50",
                  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                )}
              >
                {leagues.length === 0 ? (
                  <option value="">No linked leagues</option>
                ) : (
                  leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="roster-select">Roster</Label>
            <div className="relative">
              <Users className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <select
                id="roster-select"
                value={selectedRosterId}
                onChange={(event) => setActiveRosterId(event.target.value)}
                disabled={!activeLeague || activeLeague.rosters.length === 0}
                className={cn(
                  "border-input bg-background ring-offset-background flex h-10 w-full rounded-md border px-9 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50",
                  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                )}
              >
                <option value="">All teams</option>
                {activeLeague?.rosters.map((roster) => (
                  <option key={roster.rosterId} value={roster.rosterId}>
                    {roster.ownerName}
                    {roster.isUserRoster ? " (you)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="season-select">Season</Label>
            <select
              id="season-select"
              value={selectedSeason}
              onChange={(event) => setActiveSeason(event.target.value)}
              disabled={availableSeasons.length === 0}
              className={cn(
                "border-input bg-background ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              )}
            >
              {availableSeasons.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
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
            {activeScoringLabel} scoring
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
            <PlayerCard key={player.sleeperPlayerId} player={player} activeLeague={activeLeague} />
          ))}
        </section>
      )}
    </main>
  );
}
