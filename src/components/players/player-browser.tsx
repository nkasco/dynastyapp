"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Loader2,
  Search,
  Shield,
  SlidersHorizontal,
  Star,
  Trophy,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LeagueSummary, PlayerListQuery, PlayerSummary } from "@/contracts";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const pageSize = 36;
const positionOptions = ["ALL", "QB", "RB", "WR", "TE", "FLEX"];
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

const nflTeamColors: Record<string, { background: string; border: string; text: string }> = {
  ARI: { background: "#97233F", border: "#FFB612", text: "#FFFFFF" },
  ATL: { background: "#A71930", border: "#A5ACAF", text: "#FFFFFF" },
  BAL: { background: "#241773", border: "#9E7C0C", text: "#FFFFFF" },
  BUF: { background: "#00338D", border: "#C60C30", text: "#FFFFFF" },
  CAR: { background: "#0085CA", border: "#101820", text: "#FFFFFF" },
  CHI: { background: "#0B162A", border: "#C83803", text: "#FFFFFF" },
  CIN: { background: "#FB4F14", border: "#000000", text: "#111111" },
  CLE: { background: "#311D00", border: "#FF3C00", text: "#FFFFFF" },
  DAL: { background: "#003594", border: "#869397", text: "#FFFFFF" },
  DEN: { background: "#FB4F14", border: "#002244", text: "#111111" },
  DET: { background: "#0076B6", border: "#B0B7BC", text: "#FFFFFF" },
  GB: { background: "#203731", border: "#FFB612", text: "#FFFFFF" },
  HOU: { background: "#03202F", border: "#A71930", text: "#FFFFFF" },
  IND: { background: "#002C5F", border: "#A2AAAD", text: "#FFFFFF" },
  JAX: { background: "#006778", border: "#D7A22A", text: "#FFFFFF" },
  KC: { background: "#E31837", border: "#FFB81C", text: "#FFFFFF" },
  LAC: { background: "#0080C6", border: "#FFC20E", text: "#FFFFFF" },
  LAR: { background: "#003594", border: "#FFA300", text: "#FFFFFF" },
  LV: { background: "#000000", border: "#A5ACAF", text: "#FFFFFF" },
  MIA: { background: "#008E97", border: "#FC4C02", text: "#FFFFFF" },
  MIN: { background: "#4F2683", border: "#FFC62F", text: "#FFFFFF" },
  NE: { background: "#002244", border: "#C60C30", text: "#FFFFFF" },
  NO: { background: "#D3BC8D", border: "#101820", text: "#111111" },
  NYG: { background: "#0B2265", border: "#A71930", text: "#FFFFFF" },
  NYJ: { background: "#125740", border: "#FFFFFF", text: "#FFFFFF" },
  PHI: { background: "#004C54", border: "#A5ACAF", text: "#FFFFFF" },
  PIT: { background: "#FFB612", border: "#101820", text: "#111111" },
  SEA: { background: "#002244", border: "#69BE28", text: "#FFFFFF" },
  SF: { background: "#AA0000", border: "#B3995D", text: "#FFFFFF" },
  TB: { background: "#D50A0A", border: "#FF7900", text: "#FFFFFF" },
  TEN: { background: "#4B92DB", border: "#C8102E", text: "#FFFFFF" },
  WAS: { background: "#5A1414", border: "#FFB612", text: "#FFFFFF" },
};

type PlayerBrowserInitialQuery = {
  leagueId?: string;
  rosterId?: string;
  rostered?: boolean;
};

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

function teamTagStyle(team: string | null) {
  const colors = team ? nflTeamColors[team] : null;

  if (!colors) {
    return undefined;
  }

  return {
    backgroundColor: colors.background,
    borderColor: colors.border,
    color: colors.text,
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${colors.border} 65%, transparent)`,
  };
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

function positionTone(position: string | null) {
  switch (position) {
    case "QB":
      return {
        rail: "bg-chart-5",
        badge: "border-chart-5/35 bg-chart-5/15 text-foreground",
        glow: "from-chart-5/12",
        bar: "bg-chart-5",
      };
    case "RB":
      return {
        rail: "bg-chart-3",
        badge: "border-chart-3/35 bg-chart-3/15 text-foreground",
        glow: "from-chart-3/12",
        bar: "bg-chart-3",
      };
    case "WR":
      return {
        rail: "bg-primary",
        badge: "border-primary/35 bg-primary/15 text-primary",
        glow: "from-primary/12",
        bar: "bg-primary",
      };
    case "TE":
      return {
        rail: "bg-chart-4",
        badge: "border-chart-4/40 bg-chart-4/15 text-foreground",
        glow: "from-chart-4/14",
        bar: "bg-chart-4",
      };
    default:
      return {
        rail: "bg-muted-foreground",
        badge: "border-border bg-muted/70 text-foreground",
        glow: "from-muted/40",
        bar: "bg-muted-foreground",
      };
  }
}

function statusTone(status: string | null) {
  if (!status) {
    return "border-border/70 bg-muted/45 text-muted-foreground";
  }

  const normalized = status.toLowerCase();

  if (normalized.includes("active")) {
    return "border-accent/35 bg-accent/10 text-accent";
  }

  if (normalized.includes("injured") || normalized.includes("ir") || normalized.includes("out")) {
    return "border-destructive/35 bg-destructive/10 text-destructive";
  }

  return "border-chart-4/35 bg-chart-4/10 text-foreground";
}

function visibleStatus(status: string | null) {
  return status && !status.toLowerCase().includes("active") ? status : null;
}

function trendAverage(player: PlayerSummary) {
  if (player.trend.length === 0) {
    return null;
  }

  const total = player.trend.reduce((sum, point) => sum + (point.fantasyPoints ?? 0), 0);
  return total / player.trend.length;
}

function trendBars(player: PlayerSummary, barClassName: string) {
  const max = Math.max(...player.trend.map((point) => point.fantasyPoints ?? 0), 1);

  return player.trend.map((point, index) => (
    <span
      key={`${player.sleeperPlayerId}-${point.week}-${index}`}
      className={cn("block w-2 rounded-sm shadow-xs", barClassName)}
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

function playerInitials(player: PlayerSummary) {
  const first = player.firstName?.[0] ?? player.fullName[0] ?? "?";
  const last = player.lastName?.[0] ?? player.fullName.split(/\s+/)[1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

function watchlistIds(payload: { items: Array<{ sleeperPlayerId: string }> } | null | undefined) {
  if (!payload) {
    return new Set<string>();
  }

  return new Set(payload.items.map((item) => item.sleeperPlayerId));
}

function pageWindow(currentPage: number, pageCount: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(pageCount, start + 4);
  const adjustedStart = Math.max(1, end - 4);
  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
}

function PlayerHeadshot({ player, accentClassName }: { player: PlayerSummary; accentClassName: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = player.imageUrl;
  const showImage = Boolean(imageUrl && failedUrl !== imageUrl);

  return (
    <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/45 shadow-xs">
      {imageUrl && showImage ? (
        <Image
          src={imageUrl}
          alt={`${player.fullName} headshot`}
          width={64}
          height={64}
          unoptimized
          className="size-full object-cover object-top"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <div className="grid size-full place-items-center bg-muted/55 text-sm font-semibold text-muted-foreground">
          {playerInitials(player)}
        </div>
      )}
      <div className={cn("absolute inset-x-0 bottom-0 h-1", accentClassName)} aria-hidden="true" />
    </div>
  );
}

function PlayerCard({
  player,
  activeLeague,
  isWatched,
  watchlistDisabled,
  onOpen,
  onToggleWatchlist,
}: {
  player: PlayerSummary;
  activeLeague: LeagueSummary | null;
  isWatched: boolean;
  watchlistDisabled: boolean;
  onOpen: (player: PlayerSummary) => void;
  onToggleWatchlist: (player: PlayerSummary) => void;
}) {
  const exposure = player.rosterExposure.rosteredCount;
  const holder = rosterHolder(player);
  const tone = positionTone(player.position);
  const average = trendAverage(player);
  const games = player.seasonSummary?.games;
  const totalPoints = player.seasonSummary?.fantasyPoints;
  const status = visibleStatus(player.status);

  return (
    <article
      className={cn(
        "group relative grid min-h-[282px] overflow-hidden rounded-lg border border-border/80 bg-card p-4 text-left shadow-xs transition-[border-color,box-shadow,transform]",
        "hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md",
      )}
      data-player-card={player.sleeperPlayerId}
    >
      <button
        type="button"
        className="absolute inset-0 z-10 cursor-pointer rounded-lg outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        aria-label={`Open ${player.fullName} player card`}
        onClick={() => onOpen(player)}
      />
      <div className={cn("absolute inset-x-0 top-0 h-1", tone.rail)} aria-hidden="true" />
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-80", tone.glow)} aria-hidden="true" />

      <div className="relative grid h-full content-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <PlayerHeadshot player={player} accentClassName={tone.rail} />
            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 items-start gap-2">
                <h2 className="truncate text-base font-semibold leading-6 text-card-foreground">{player.fullName}</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={watchlistDisabled}
                  aria-pressed={isWatched}
                  aria-label={`${isWatched ? "Remove" : "Add"} ${player.fullName} ${isWatched ? "from" : "to"} league watchlist`}
                  data-watchlist-player={player.sleeperPlayerId}
                  className={cn(
                    "relative z-20 -mr-1 -mt-1 size-7 shrink-0 text-muted-foreground hover:text-primary",
                    isWatched ? "text-primary" : null,
                  )}
                  onClick={() => onToggleWatchlist(player)}
                >
                  <Star className={cn("size-4", isWatched ? "fill-current" : null)} aria-hidden="true" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="outline" className={cn("h-6 border font-semibold", tone.badge)}>
                  {player.position ?? "UNK"}
                </Badge>
                <Badge
                  variant="outline"
                  className="h-6 border font-semibold"
                  style={teamTagStyle(player.team)}
                >
                  {player.team ?? "FA"}
                </Badge>
                <Badge variant="outline" className="h-6 border-border/70 bg-muted/45 text-muted-foreground">
                  {player.age != null ? `${formatNumber(player.age, 1)} yrs` : "age -"}
                </Badge>
                {status ? (
                  <Badge variant="outline" className={cn("h-6 border", statusTone(status))}>
                    {status}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <div className="shrink-0 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-right text-primary">
            <div className="text-xl font-semibold leading-none">{formatNumber(player.seasonSummary?.fantasyPointsPerGame, 1)} pts</div>
            <div className="mt-1 inline-flex items-center justify-end gap-1 text-[10px] font-medium uppercase tracking-normal">
              <Shield className="size-3" aria-hidden="true" />
              {player.seasonSummary?.scoringLabel ?? "PTS/G"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border border-border/55 bg-muted/35 px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Season</div>
            <div className="mt-1 font-semibold">
              {player.seasonSummary?.season ?? "-"}
              {games != null ? <span className="font-normal text-muted-foreground"> | {games} games</span> : null}
            </div>
          </div>
          <div className="rounded-md border border-border/55 bg-muted/35 px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
              {activeLeague ? "Held by" : "Exposure"}
            </div>
            <div className="mt-1 truncate font-semibold">
              {activeLeague
                ? holder ?? "Free agent"
                : exposure > 0
                  ? `${exposure} roster${exposure === 1 ? "" : "s"}`
                  : "Free agent"}
            </div>
          </div>
          <div className="col-span-2 rounded-md border border-border/55 bg-muted/35 px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Season line</div>
                <div className="mt-1 truncate font-semibold">{playerLine(player)}</div>
              </div>
              <Activity className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
          <div className="col-span-2 flex items-center justify-between gap-3 rounded-md border border-border/55 bg-muted/35 px-3 py-2">
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Draft profile</div>
              <div className="mt-1 truncate font-semibold">{draftLine(player)}</div>
            </div>
            <Shield className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>

        <div className="flex items-end justify-between gap-4 border-t border-border/70 pt-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-normal">Recent form</span>
              {average != null ? <span>{formatNumber(average, 1)} avg over last {player.trend.length} weeks</span> : <span>Unavailable</span>}
              {totalPoints != null ? <span>{formatNumber(totalPoints, 1)} season pts</span> : null}
            </div>
          </div>
          <div className="flex h-12 shrink-0 items-end gap-1" aria-label="Recent fantasy trend">
            {player.trend.length > 0 ? trendBars(player, tone.bar) : <span className="text-xs text-muted-foreground">No trend</span>}
          </div>
        </div>
      </div>
    </article>
  );
}

function PlayerOverlay({ player, activeLeague, onClose }: { player: PlayerSummary; activeLeague: LeagueSummary | null; onClose: () => void }) {
  const [tab, setTab] = useState<"trend" | "season" | "context">("trend");
  const tone = positionTone(player.position);
  const maxTrend = Math.max(...player.trend.map((point) => point.fantasyPoints ?? 0), 1);
  const stats = player.seasonSummary?.keyStats;

  return (
    <div className="fixed inset-0 z-50 bg-background/70 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label={`${player.fullName} player card`}>
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Close player overlay" onClick={onClose} />
      <section className="relative mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-xl border-2 border-border bg-card shadow-2xl">
        <div className={cn("h-1.5 shrink-0", tone.rail)} aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 border-b border-border/80 p-4 sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <PlayerHeadshot player={player} accentClassName={tone.rail} />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">{player.fullName}</h2>
                <Badge variant="outline" className={cn("h-6 border font-semibold", tone.badge)}>
                  {player.position ?? "UNK"}
                </Badge>
                <Badge variant="outline" className="h-6 border font-semibold" style={teamTagStyle(player.team)}>
                  {player.team ?? "FA"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {activeLeague ? `${activeLeague.name} context` : "All linked leagues"} | {draftLine(player)}
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close player card">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap gap-1 rounded-md border border-border/75 p-1">
              {[
                { key: "trend", label: "Trend" },
                { key: "season", label: "Season" },
                { key: "context", label: "League" },
              ].map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant={tab === item.key ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setTab(item.key as typeof tab)}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            {tab === "trend" ? (
              <div className="rounded-lg border border-border/80 bg-background/45 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Recent weekly shape</h3>
                    <p className="text-sm text-muted-foreground">Fantasy points from the imported trend window.</p>
                  </div>
                  <BarChart3 className="size-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="flex h-64 items-end gap-2 overflow-x-auto border-b border-border/80 pb-3">
                  {player.trend.length > 0 ? (
                    player.trend.map((point, index) => (
                      <div key={`${player.sleeperPlayerId}-overlay-${point.week}-${index}`} className="flex min-w-12 flex-1 flex-col items-center gap-2">
                        <div className="flex h-52 w-full items-end justify-center">
                          <div
                            className={cn("w-full max-w-12 rounded-t-md", tone.bar)}
                            style={{ height: `${Math.max(8, ((point.fantasyPoints ?? 0) / maxTrend) * 100)}%` }}
                            title={`Week ${point.week}: ${formatNumber(point.fantasyPoints, 1)} pts`}
                          />
                        </div>
                        <div className="text-xs font-medium text-muted-foreground">W{point.week}</div>
                        <div className="text-xs font-semibold">{formatNumber(point.fantasyPoints, 1)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="grid h-full w-full place-items-center text-sm text-muted-foreground">No weekly trend loaded.</div>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "season" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Fantasy points", formatNumber(player.seasonSummary?.fantasyPoints, 1)],
                  ["Points per game", formatNumber(player.seasonSummary?.fantasyPointsPerGame, 1)],
                  ["Games", player.seasonSummary?.games ?? "-"],
                  ["Season", player.seasonSummary?.season ?? "-"],
                  ["Passing", `${formatNumber(stats?.passingYards)} yd | ${formatNumber(stats?.passingTds)} TD`],
                  ["Rushing", `${formatNumber(stats?.rushingYards)} yd | ${formatNumber(stats?.rushingTds)} TD`],
                  ["Receiving", `${formatNumber(stats?.receptions)} rec | ${formatNumber(stats?.receivingYards)} yd`],
                  ["Receiving TD", formatNumber(stats?.receivingTds)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-border/70 bg-background/45 px-3 py-3">
                    <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">{label}</div>
                    <div className="mt-1 text-base font-semibold">{value}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === "context" ? (
              <div className="overflow-hidden rounded-lg border border-border/80 bg-background/45">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ["League view", activeLeague?.name ?? "All linked leagues"],
                      ["Roster holder", activeLeague ? rosterHolder(player) ?? "Free agent" : `${player.rosterExposure.rosteredCount} roster${player.rosterExposure.rosteredCount === 1 ? "" : "s"}`],
                      ["Exposure labels", player.rosterExposure.labels.length > 0 ? player.rosterExposure.labels.join(", ") : "None"],
                      ["Status", visibleStatus(player.status) ?? "Active"],
                      ["Source updated", player.sourceUpdatedAt ?? player.updatedAt],
                    ].map(([label, value]) => (
                      <tr key={label} className="border-b border-border/70 last:border-0">
                        <th className="w-40 px-3 py-3 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</th>
                        <td className="px-3 py-3 font-medium">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          <aside className="space-y-3">
            <div className="rounded-lg border border-primary/25 bg-primary/10 p-4 text-primary">
              <div className="text-[11px] font-medium uppercase tracking-normal">Current score</div>
              <div className="mt-2 text-3xl font-semibold">{formatNumber(player.seasonSummary?.fantasyPointsPerGame, 1)}</div>
              <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-normal">
                <Shield className="size-3.5" aria-hidden="true" />
                {player.seasonSummary?.scoringLabel ?? "PTS/G"}
              </div>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/45 p-4">
              <h3 className="font-semibold">Snapshot</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Age</span><span className="font-medium">{player.age != null ? `${formatNumber(player.age, 1)} yrs` : "-"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Season line</span><span className="max-w-48 truncate font-medium">{playerLine(player)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Trend avg</span><span className="font-medium">{formatNumber(trendAverage(player), 1)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Badges</span><span className="max-w-48 truncate font-medium">{player.badges.length > 0 ? player.badges.join(", ") : "None"}</span></div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

export function PlayerBrowser({ initialQuery }: { initialQuery?: PlayerBrowserInitialQuery }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [sort, setSort] = useState<PlayerListQuery["sort"]>("production");
  const [sortDir, setSortDir] = useState<PlayerListQuery["dir"]>("desc");
  const [page, setPage] = useState(1);
  const [rosteredOnly, setRosteredOnly] = useState(() => initialQuery?.rostered ?? false);
  const [injuredOnly, setInjuredOnly] = useState(false);
  const [ageIndex, setAgeIndex] = useState(0);
  const [activeLeagueId, setActiveLeagueId] = useState(() => initialQuery?.leagueId ?? "");
  const [activeRosterId, setActiveRosterId] = useState(() => initialQuery?.rosterId ?? "");
  const [activeSeason, setActiveSeason] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSummary | null>(null);
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

  const leagueRosterRefreshQuery = useQuery({
    queryKey: ["sleeper-league-refresh", "player-browser", selectedLeagueId],
    queryFn: async () => {
      const job = await apiClient.queueSleeperImport({ leagueId: selectedLeagueId, scope: "league" });
      await apiClient.runQueuedImports();
      return job;
    },
    enabled: Boolean(selectedLeagueId),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const watchlistQuery = useQuery({
    queryKey: ["watchlist", selectedLeagueId],
    queryFn: async () => {
      if (!selectedLeagueId) {
        return new Set<string>();
      }

      return watchlistIds(await apiClient.watchlist(selectedLeagueId));
    },
    enabled: Boolean(selectedLeagueId),
    retry: false,
  });

  const watchlistMutation = useMutation({
    mutationFn: async ({ leagueId, sleeperPlayerId, watched }: { leagueId: string; sleeperPlayerId: string; watched: boolean }) => {
      if (watched) {
        await apiClient.removeWatchlistPlayer({ leagueId, sleeperPlayerId });
        return;
      }

      await apiClient.addWatchlistPlayer({ leagueId, sleeperPlayerId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["watchlist", selectedLeagueId] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const playerQuery = useMemo(
    () => ({
      page,
      pageSize,
      q: deferredQuery,
      leagueId: selectedLeagueId || undefined,
      rosterId: selectedRosterId ? Number(selectedRosterId) : undefined,
      season: activeSeason ? Number(activeSeason) : undefined,
      position: position === "ALL" ? undefined : position,
      sort,
      dir: sortDir,
      rostered: rosteredOnly || undefined,
      injured: injuredOnly || undefined,
      ageMin: ageFilter.min,
      ageMax: ageFilter.max,
    }),
    [
      ageFilter.max,
      ageFilter.min,
      activeSeason,
      deferredQuery,
      injuredOnly,
      page,
      position,
      rosteredOnly,
      selectedLeagueId,
      selectedRosterId,
      sort,
      sortDir,
    ],
  );

  const playersQuery = useQuery({
    queryKey: ["players", playerQuery],
    queryFn: () => apiClient.players(playerQuery),
    retry: false,
  });

  useEffect(() => {
    if (leagueRosterRefreshQuery.isSuccess) {
      void queryClient.invalidateQueries({ queryKey: ["leagues"] });
      void queryClient.invalidateQueries({ queryKey: ["players"] });
    }
  }, [leagueRosterRefreshQuery.isSuccess, leagueRosterRefreshQuery.dataUpdatedAt, queryClient]);

  useEffect(() => {
    if (!selectedPlayer) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedPlayer(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [selectedPlayer]);

  const rawPlayers = playersQuery.data?.items ?? [];
  const players = rawPlayers;
  const total = playersQuery.data?.pagination.total ?? 0;
  const pageCount = playersQuery.data?.pagination.pageCount ?? 0;
  const availableSeasons = playersQuery.data?.availableSeasons ?? [];
  const selectedSeason = activeSeason || (playersQuery.data?.selectedSeason ? String(playersQuery.data.selectedSeason) : "");
  const watchlist = watchlistQuery.data ?? new Set<string>();
  const visibleStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const visibleEnd = Math.min(page * pageSize, total);

  const resetPage = () => setPage(1);

  const toggleWatchlist = (player: PlayerSummary) => {
    if (!selectedLeagueId) {
      toast.error("Select a league before editing the watchlist.");
      return;
    }

    watchlistMutation.mutate({
      leagueId: selectedLeagueId,
      sleeperPlayerId: player.sleeperPlayerId,
      watched: watchlist.has(player.sleeperPlayerId),
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-5 py-6 sm:px-8 lg:px-10">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-3">
          <Badge variant="outline" className="border-primary/35 bg-primary/10 text-primary">
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

      <section className="grid gap-3 rounded-lg border border-border/80 bg-card p-4 shadow-xs">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,0.8fr)_minmax(220px,0.8fr)_minmax(160px,0.55fr)] lg:items-end">
          <div className="grid gap-2">
            <Label htmlFor="player-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="player-search"
                value={query}
                onChange={(event) => {
                  resetPage();
                  setQuery(event.target.value);
                }}
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
                  resetPage();
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
                onChange={(event) => {
                  resetPage();
                  setActiveRosterId(event.target.value);
                }}
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
              onChange={(event) => {
                resetPage();
                setActiveSeason(event.target.value);
              }}
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
        </div>

        <div className="flex flex-col gap-3 border-t border-border/70 pt-3 xl:flex-row xl:items-end xl:justify-between">
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
                  onClick={() => {
                    resetPage();
                    setPosition(option);
                  }}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Sort</Label>
            <div className="flex flex-wrap items-center gap-1 rounded-md border border-border/75 p-1">
              {sortOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={sort === option.value ? "default" : "ghost"}
                  size="sm"
                  className="h-8 gap-1.5 px-3"
                  onClick={() => {
                    resetPage();
                    if (sort === option.value) {
                      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
                    } else {
                      setSort(option.value);
                      setSortDir(option.value === "age" || option.value === "name" ? "asc" : "desc");
                    }
                  }}
                >
                  <option.icon className="size-3.5" aria-hidden="true" />
                  {option.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-3"
                onClick={() => {
                  resetPage();
                  setSortDir((current) => (current === "asc" ? "desc" : "asc"));
                }}
                aria-label={`Sort ${sortDir === "asc" ? "ascending" : "descending"}. Click to toggle.`}
              >
                {sortDir === "asc" ? <ArrowUp className="size-3.5" aria-hidden="true" /> : <ArrowDown className="size-3.5" aria-hidden="true" />}
                {sortDir === "asc" ? "Asc" : "Desc"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/75 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={rosteredOnly}
                onChange={(event) => {
                  resetPage();
                  setRosteredOnly(event.target.checked);
                }}
                className="size-4 accent-primary"
              />
              Rostered
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/75 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={injuredOnly}
                onChange={(event) => {
                  resetPage();
                  setInjuredOnly(event.target.checked);
                }}
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
                  onClick={() => {
                    resetPage();
                    setAgeIndex(index);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
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
        <>
          <section
            className={cn(
              "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
              playersQuery.isFetching ? "opacity-75 transition-opacity" : "opacity-100 transition-opacity",
            )}
          >
            {players.map((player) => (
              <PlayerCard
                key={player.sleeperPlayerId}
                player={player}
                activeLeague={activeLeague}
                isWatched={watchlist.has(player.sleeperPlayerId)}
                watchlistDisabled={!selectedLeagueId || watchlistMutation.isPending}
                onOpen={setSelectedPlayer}
                onToggleWatchlist={toggleWatchlist}
              />
            ))}
          </section>

          {pageCount > 1 ? (
            <nav className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between" aria-label="Player pagination">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{visibleStart}-{visibleEnd}</span> of{" "}
                <span className="font-medium text-foreground">{total}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Button type="button" variant="outline" size="icon" className="size-9" disabled={page <= 1} onClick={() => setPage(1)} aria-label="First page">
                  <ChevronsLeft className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                {pageWindow(page, pageCount).map((pageNumber) => (
                  <Button
                    key={pageNumber}
                    type="button"
                    variant={page === pageNumber ? "default" : "outline"}
                    size="sm"
                    className="h-9 min-w-9 px-3"
                    onClick={() => setPage(pageNumber)}
                    aria-current={page === pageNumber ? "page" : undefined}
                  >
                    {pageNumber}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
                <Button type="button" variant="outline" size="icon" className="size-9" disabled={page >= pageCount} onClick={() => setPage(pageCount)} aria-label="Last page">
                  <ChevronsRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </nav>
          ) : null}
        </>
      )}
      {selectedPlayer ? <PlayerOverlay player={selectedPlayer} activeLeague={activeLeague} onClose={() => setSelectedPlayer(null)} /> : null}
    </main>
  );
}
