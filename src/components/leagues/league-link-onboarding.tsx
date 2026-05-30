"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Search, ShieldCheck, Trophy, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PprScoringControl } from "@/components/leagues/ppr-scoring-control";
import {
  leaguePreviewQuerySchema,
  type ImportJobDto,
  type LeagueSummary,
  type LeaguePreview,
  type LeaguePreviewQuery,
} from "@/contracts";
import { apiClient, ApiClientError } from "@/lib/api/client";

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

export function LeagueLinkOnboarding() {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<LeaguePreview | null>(null);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(null);

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

  const scoringMutation = useMutation({
    mutationFn: ({ leagueId, value }: { leagueId: string; value: 0 | 0.5 | 1 }) =>
      apiClient.updateLeagueSettings(leagueId, { pprScoringPreference: value }),
    onSuccess: async () => {
      toast.success("League scoring saved.");
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
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

  const importJob = importJobQuery.data;
  const warnings = useMemo(() => {
    const metadataWarnings = importJob?.metadata?.warnings;
    return Array.isArray(metadataWarnings) ? metadataWarnings.filter((item): item is string => typeof item === "string") : [];
  }, [importJob]);

  const previewBusy = previewMutation.isPending;
  const linkBusy = linkMutation.isPending || importJob?.status === "running" || importJob?.status === "queued";
  const selectedRoster = preview?.rosters.find((roster) => roster.rosterId === selectedRosterId);
  const linkedLeagues = leaguesQuery.data?.items ?? [];

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

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(320px,0.72fr)_minmax(0,1fr)] lg:px-10">
      <section className="space-y-5">
        <div className="space-y-3">
          <Badge variant="outline" className="border-accent/35 bg-accent/10 text-accent-foreground">
            Read-only Sleeper link
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Link a league</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Paste a Sleeper league ID, confirm the league, choose your roster, then import every team for analysis.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-card p-4 shadow-xs">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Imported leagues</h2>
              <p className="text-sm text-muted-foreground">Known leagues stay here after import.</p>
            </div>
            <Trophy className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>

          {leaguesQuery.isPending ? (
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
                <div key={league.id} className="grid gap-3 rounded-md border border-border/75 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{league.name}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="secondary">{league.season}</Badge>
                        <Badge variant="outline">{league.rosterCount} rosters</Badge>
                        {league.status ? <Badge variant="outline">{league.status}</Badge> : null}
                      </div>
                    </div>
                  </div>
                  <PprScoringControl
                    league={league}
                    disabled={scoringMutation.isPending}
                    onChange={(value) => scoringMutation.mutate({ leagueId: league.id, value })}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={previewForm.handleSubmit((values) => previewMutation.mutate(values))}
          className="rounded-lg border border-border/80 bg-card p-4 shadow-xs"
        >
          <div className="grid gap-3">
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
                  {previewBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
                  Preview
                </Button>
              </div>
              {previewForm.formState.errors.sleeperLeagueId ? (
                <p className="text-sm text-destructive">{previewForm.formState.errors.sleeperLeagueId.message}</p>
              ) : null}
            </div>
          </div>
        </form>

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
            </div>
          </div>
        ) : (
          <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-border/90 p-8 text-center">
            <div className="max-w-sm space-y-2">
              <h2 className="text-base font-semibold">No league preview yet</h2>
              <p className="text-sm leading-6 text-muted-foreground">A valid Sleeper league ID will show teams, roster counts, and import readiness here.</p>
            </div>
          </div>
        )}

        {importJob ? (
          <div className="rounded-lg border border-border/80 bg-card p-4 shadow-xs">
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
                  <div key={label} className="flex items-center justify-between gap-4 rounded-md bg-muted/60 px-3 py-2 text-sm">
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
        ) : null}
      </section>
    </main>
  );
}
