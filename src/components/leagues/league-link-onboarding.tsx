"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ChevronDown, ExternalLink, Loader2, RefreshCw, Search, ShieldCheck, Trash2, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  leaguePreviewQuerySchema,
  type ImportJobDto,
  type LeagueSummary,
  type LeaguePreview,
  type LeaguePreviewQuery,
} from "@/contracts";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went sideways while linking this league.";
}

function statusTone(status: ImportJobDto["status"]) {
  switch (status) {
    case "succeeded":
      return "text-accent";
    case "failed":
      return "text-destructive";
    case "partial":
      return "text-chart-4";
    case "running":
      return "text-primary";
    case "queued":
    default:
      return "text-muted-foreground";
  }
}

function formatRefreshTimestamp(value: string | null) {
  if (!value) {
    return "Never refreshed";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function ImportStatusPanel({ importJob, warnings }: { importJob: ImportJobDto; warnings: string[] }) {
  return (
    <div className="rounded-md border border-border/80 bg-muted/35 p-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Import status</h2>
          <p className={`mt-1 text-sm font-medium ${statusTone(importJob.status)}`}>{importJob.status}</p>
        </div>
        {importJob.status === "succeeded" ? (
          <CheckCircle2 className="size-5 text-accent" aria-hidden="true" />
        ) : importJob.status === "failed" || importJob.status === "partial" ? (
          <AlertCircle className="size-5 text-destructive" aria-hidden="true" />
        ) : (
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
        )}
      </div>

      {importJob.counts ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {Object.entries(importJob.counts).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 rounded-md bg-background/60 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      ) : null}

      {importJob.error ? <p className="mt-3 text-sm text-destructive">{importJob.error}</p> : null}

      {warnings.length > 0 ? (
        <div className="mt-3 rounded-md border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-sm text-foreground">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LeagueLinkOnboarding() {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<LeaguePreview | null>(null);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [refreshJobId, setRefreshJobId] = useState<string | null>(null);
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [leaguesOpen, setLeaguesOpen] = useState(true);
  const [addLeagueOpen, setAddLeagueOpen] = useState(false);

  const previewForm = useForm<LeaguePreviewQuery>({
    resolver: zodResolver(leaguePreviewQuerySchema),
    defaultValues: { sleeperLeagueId: "" },
  });

  const leaguesQuery = useQuery({
    queryKey: ["leagues", "league-overview"],
    queryFn: () => apiClient.leagues({ page: 1, pageSize: 100, sort: "season", dir: "desc" }),
    retry: false,
  });

  const previewMutation = useMutation({
    mutationFn: apiClient.leaguePreview,
    onSuccess: (data) => {
      setPreview(data);
      setImportJobId(null);
      setSelectedRosterId(data.rosters[0]?.rosterId ?? null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const linkMutation = useMutation({
    mutationFn: apiClient.linkLeague,
    onSuccess: async (data) => {
      setImportJobId(data.importJobId);
      toast.success("League link queued. Starting import.");
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
      void apiClient.runQueuedImports().catch((error: unknown) => toast.error(errorMessage(error)));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteLeague,
    onSuccess: async () => {
      toast.success("League removed from your command center.");
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const refreshLeagueMutation = useMutation({
    mutationFn: async (league: LeagueSummary) => {
      const job = await apiClient.queueSleeperImport({ leagueId: league.id, scope: "league" });
      setRefreshJobId(job.id);
      await apiClient.runQueuedImports();
      return job;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
      await queryClient.invalidateQueries({ queryKey: ["players"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const importJobQuery = useQuery({
    queryKey: ["import-job", importJobId],
    queryFn: () => apiClient.importJob(importJobId ?? ""),
    enabled: Boolean(importJobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 1500 : false;
    },
  });

  const refreshJobQuery = useQuery({
    queryKey: ["import-job", refreshJobId],
    queryFn: () => apiClient.importJob(refreshJobId ?? ""),
    enabled: Boolean(refreshJobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 1500 : false;
    },
  });

  const importJob = importJobQuery.data;
  const refreshJob = refreshJobQuery.data;
  const warnings = useMemo(() => {
    const metadataWarnings = importJob?.metadata?.warnings;
    return Array.isArray(metadataWarnings) ? metadataWarnings.filter((item): item is string => typeof item === "string") : [];
  }, [importJob]);

  const previewBusy = previewMutation.isPending;
  const linkBusy = linkMutation.isPending || importJob?.status === "running" || importJob?.status === "queued";
  const refreshBusy = refreshLeagueMutation.isPending || refreshJob?.status === "queued" || refreshJob?.status === "running";
  const selectedRoster = preview?.rosters.find((roster) => roster.rosterId === selectedRosterId);
  const linkedLeagues = leaguesQuery.data?.items ?? [];
  const activeLeagueId =
    leaguesOpen && selectedLeagueId && linkedLeagues.some((league) => league.id === selectedLeagueId)
      ? selectedLeagueId
      : leaguesOpen
        ? linkedLeagues[0]?.id || ""
        : "";
  const activeLeague = linkedLeagues.find((league) => league.id === activeLeagueId) ?? null;
  const addSectionOpen = addLeagueOpen || (!leaguesQuery.isPending && linkedLeagues.length === 0);

  function linkSelectedRoster() {
    if (!preview || !selectedRosterId) {
      toast.error("Select your roster before linking the league.");
      return;
    }

    linkMutation.mutate({
      sleeperLeagueId: preview.sleeperLeagueId,
      rosterId: selectedRosterId,
    });
  }

  function deleteLeague(league: LeagueSummary) {
    const confirmed = window.confirm(
      `Remove ${league.name}? This removes the local league link and imported league context from Dynalytics when no one else has it linked. Sleeper will not be changed.`,
    );

    if (!confirmed) {
      return;
    }

    deleteMutation.mutate(league.id);
  }

  function rosterPlayersHref(league: LeagueSummary, rosterId: number) {
    const params = new URLSearchParams({
      leagueId: league.id,
      rosterId: String(rosterId),
      rostered: "true",
    });

    return `/players?${params.toString()}`;
  }

  function previewLeague(values: LeaguePreviewQuery) {
    setAddLeagueOpen(true);
    setLeaguesOpen(false);
    setSelectedLeagueId("");
    previewMutation.mutate(values);
  }

  function selectLeague(league: LeagueSummary) {
    setLeaguesOpen(true);
    setSelectedLeagueId(league.id);
    setAddLeagueOpen(false);
    setPreview(null);
    refreshLeagueMutation.mutate(league);
  }

  function toggleLinkedLeagues() {
    setLeaguesOpen((open) => {
      const nextOpen = !open;

      if (nextOpen) {
        setAddLeagueOpen(false);
        setPreview(null);
      }

      return nextOpen;
    });
  }

  function toggleAddLeague() {
    const nextOpen = !addSectionOpen;

    setAddLeagueOpen(nextOpen);
    if (nextOpen) {
      setLeaguesOpen(false);
      setSelectedLeagueId("");
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(360px,0.82fr)_minmax(0,1fr)] lg:px-10">
      <section className="space-y-5">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Leagues</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Select a linked league, inspect its teams, or add another Sleeper league without leaving the command center.
          </p>
        </div>

        <div className="rounded-lg border border-border/80 bg-card p-4 shadow-xs">
          <button
            type="button"
            onClick={toggleLinkedLeagues}
            className="mb-4 flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={leaguesOpen}
          >
            <div>
              <h2 className="text-sm font-semibold">Linked leagues</h2>
              <p className="text-sm text-muted-foreground">Choose the league whose rosters you want to inspect.</p>
            </div>
            <ChevronDown
              className={cn("size-4 text-muted-foreground transition-transform", leaguesOpen ? "rotate-180" : "")}
              aria-hidden="true"
            />
          </button>

          {!leaguesOpen ? null : leaguesQuery.isPending ? (
            <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading leagues
            </div>
          ) : leaguesQuery.isError ? (
            <p className="rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage(leaguesQuery.error)}
            </p>
          ) : linkedLeagues.length === 0 ? (
            <p className="rounded-md border border-dashed border-border/90 px-3 py-6 text-center text-sm text-muted-foreground">
              No imported leagues yet. Preview a Sleeper league below to link the first one.
            </p>
          ) : (
            <div className="grid gap-3">
              {linkedLeagues.map((league: LeagueSummary) => (
                <div
                  key={league.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectLeague(league)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectLeague(league);
                    }
                  }}
                  className={cn(
                    "grid cursor-pointer gap-3 rounded-md border p-3 text-left transition-colors",
                    activeLeagueId === league.id ? "border-primary/55 bg-primary/5" : "border-border/75 hover:border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{league.name}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="secondary">{league.season}</Badge>
                        <Badge variant="outline">{league.rosterCount} rosters</Badge>
                        {league.status ? (
                          <Badge variant="outline" className="border-accent/35 bg-accent/10 text-accent">
                            {league.status}
                          </Badge>
                        ) : null}
                        <Badge
                          variant={league.pprScoring.source === "unknown" ? "outline" : "secondary"}
                          className={
                            league.pprScoring.source === "unknown"
                              ? "border-chart-4/45 bg-chart-4/10 text-foreground"
                              : "bg-primary/15 text-primary"
                          }
                        >
                          {league.pprScoring.label}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 gap-2 px-2 text-muted-foreground hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteLeague(league);
                      }}
                    >
                      {deleteMutation.isPending && deleteMutation.variables === league.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="size-4" aria-hidden="true" />
                      )}
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border/80 bg-card p-4 shadow-xs">
          <button
            type="button"
            onClick={toggleAddLeague}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={addSectionOpen}
          >
            <div>
              <h2 className="text-sm font-semibold">Add a league</h2>
              <p className="text-sm text-muted-foreground">Preview a Sleeper league and import every team.</p>
            </div>
            <ChevronDown
              className={cn("size-4 text-muted-foreground transition-transform", addSectionOpen ? "rotate-180" : "")}
              aria-hidden="true"
            />
          </button>

          {addSectionOpen ? (
            <form onSubmit={previewForm.handleSubmit(previewLeague)} className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="sleeperLeagueId">Sleeper league ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="sleeperLeagueId"
                    placeholder="1048299171234567890"
                    autoComplete="off"
                    {...previewForm.register("sleeperLeagueId")}
                  />
                  <Button type="submit" className="gap-2" disabled={previewBusy}>
                    {previewBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Search className="size-4" aria-hidden="true" />
                    )}
                    Preview
                  </Button>
                </div>
                {previewForm.formState.errors.sleeperLeagueId ? (
                  <p className="text-sm text-destructive">{previewForm.formState.errors.sleeperLeagueId.message}</p>
                ) : null}
              </div>
            </form>
          ) : null}
        </div>

        <div className="rounded-lg border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Local mapping only</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                The selected roster is saved in Dynalytics so league pages and trade context know which team is yours.
                Sleeper remains a read-only source.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid content-start gap-4">
        {activeLeague ? (
          <div className="rounded-lg border border-border/80 bg-card p-4 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{activeLeague.name}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{activeLeague.season}</Badge>
                  <Badge variant="outline">{activeLeague.rosterCount} rosters</Badge>
                  {activeLeague.status ? (
                    <Badge variant="outline" className="border-accent/35 bg-accent/10 text-accent">
                      {activeLeague.status}
                    </Badge>
                  ) : null}
                  <Badge
                    variant={activeLeague.pprScoring.source === "unknown" ? "outline" : "secondary"}
                    className={
                      activeLeague.pprScoring.source === "unknown"
                        ? "border-chart-4/45 bg-chart-4/10 text-foreground"
                        : "bg-primary/15 text-primary"
                    }
                  >
                    {activeLeague.pprScoring.label}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    League data refreshed: <span className="text-foreground">{formatRefreshTimestamp(activeLeague.importedAt)}</span>
                  </span>
                  {refreshBusy ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                      <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
                      Updating league data
                    </span>
                  ) : refreshJob ? (
                    <span className={cn("text-xs font-medium", statusTone(refreshJob.status))}>
                      {refreshJob.status}
                    </span>
                  ) : null}
                </div>
              </div>
              <Trophy className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>

            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">League members</h3>
                <span className="text-xs text-muted-foreground">{activeLeague.rosters.length} teams</span>
              </div>
              <div className="grid gap-2">
                {activeLeague.rosters.map((roster, index) => (
                  <div
                    key={roster.rosterId}
                    className="grid gap-3 rounded-md border border-border/75 px-3 py-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div
                      className={cn(
                        "grid size-9 place-items-center rounded-md border text-sm font-semibold shadow-xs",
                        roster.isUserRoster
                          ? "border-primary/45 bg-primary/20 text-primary"
                          : "border-accent/35 bg-accent/10 text-accent",
                      )}
                      aria-label={`League member ${index + 1}`}
                    >
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{roster.ownerName}</span>
                        {roster.isUserRoster ? <Badge className="bg-primary/15 text-primary">Your team</Badge> : null}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{roster.playerCount} players</span>
                      </div>
                    </div>
                    <Button asChild type="button" variant="outline" size="sm" className="gap-2">
                      <Link href={rosterPlayersHref(activeLeague, roster.rosterId)}>
                        View roster
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : addSectionOpen ? null : (
          <div className="grid min-h-[240px] place-items-center rounded-lg border border-dashed border-border/90 p-8 text-center">
            <div className="max-w-sm space-y-2">
              <h2 className="text-base font-semibold">No league selected</h2>
              <p className="text-sm leading-6 text-muted-foreground">Link a league to inspect members and roster shortcuts.</p>
            </div>
          </div>
        )}

        {preview ? (
          <div className="rounded-lg border border-border/80 bg-card p-4 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
              <div>
                <h2 className="text-xl font-semibold">{preview.name}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{preview.season}</Badge>
                  <Badge variant="outline">{preview.rosterCount} rosters</Badge>
                  {preview.status ? <Badge variant="outline">{preview.status}</Badge> : null}
                </div>
              </div>
              <Users className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <Label>Your roster</Label>
                {preview.rosters.map((roster) => (
                  <label
                    key={roster.rosterId}
                    className="grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-border/75 px-3 py-2 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="radio"
                      value={roster.rosterId}
                      checked={selectedRosterId === roster.rosterId}
                      onChange={() => setSelectedRosterId(roster.rosterId)}
                      className="size-4 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{roster.ownerName}</span>
                      <span className="text-muted-foreground">Roster {roster.rosterId}</span>
                    </span>
                    <span className="text-right text-xs text-muted-foreground">
                      {roster.playerCount} players
                      <br />
                      {roster.starterCount} starters
                    </span>
                  </label>
                ))}
                {selectedRoster ? (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedRoster.ownerName} on roster {selectedRoster.rosterId}.
                  </p>
                ) : null}
              </div>

              <Button type="button" onClick={linkSelectedRoster} className="w-full gap-2" disabled={linkBusy}>
                {linkBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
                Link and import league
              </Button>

              {importJob ? (
                <ImportStatusPanel importJob={importJob} warnings={warnings} />
              ) : (
                <p className="rounded-md border border-dashed border-border/80 px-3 py-2 text-sm text-muted-foreground">
                  Import progress will appear here after you link the league.
                </p>
              )}
            </div>
          </div>
        ) : addSectionOpen ? (
          <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-border/90 p-8 text-center">
            <div className="max-w-sm space-y-2">
              <h2 className="text-base font-semibold">No league preview yet</h2>
              <p className="text-sm leading-6 text-muted-foreground">A valid Sleeper league ID will show teams, roster counts, and import readiness here.</p>
            </div>
          </div>
        ) : null}

      </section>
    </main>
  );
}
