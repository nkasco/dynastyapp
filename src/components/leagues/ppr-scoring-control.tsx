"use client";

import { Check, CircleDashed } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LeagueSummary } from "@/contracts";
import { cn } from "@/lib/utils";

const pprOptions = [
  { label: "0", value: 0 },
  { label: "0.5", value: 0.5 },
  { label: "1", value: 1 },
] as const;

function sourceLabel(source: LeagueSummary["pprScoring"]["source"]) {
  switch (source) {
    case "sleeper":
      return "Detected from Sleeper scoring";
    case "profile":
      return "Saved profile preference";
    case "unknown":
    default:
      return "Scoring needs review";
  }
}

function badgeLabel(scoring: LeagueSummary["pprScoring"]) {
  if (scoring.value == null) {
    return "Set PPR";
  }

  return scoring.label;
}

export function PprScoringControl({
  league,
  disabled,
  onChange,
}: {
  league: LeagueSummary;
  disabled?: boolean;
  onChange?: (value: 0 | 0.5 | 1) => void;
}) {
  const canSet = league.pprScoring.canSetProfilePreference && Boolean(onChange);

  return (
    <div className="grid gap-2 rounded-md border border-border/75 bg-muted/35 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase text-muted-foreground">Scoring</div>
          <div className="text-xs text-muted-foreground">{sourceLabel(league.pprScoring.source)}</div>
        </div>
        <Badge variant={league.pprScoring.source === "unknown" ? "outline" : "secondary"} className="shrink-0 gap-1">
          {league.pprScoring.source === "unknown" ? (
            <CircleDashed className="size-3" aria-hidden="true" />
          ) : (
            <Check className="size-3" aria-hidden="true" />
          )}
          {badgeLabel(league.pprScoring)}
        </Badge>
      </div>

      {canSet ? (
        <div className="flex rounded-md border border-border/75 p-1">
          {pprOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={league.pprScoring.value === option.value ? "default" : "ghost"}
              className={cn("h-8 flex-1 px-2", disabled ? "pointer-events-none opacity-65" : "")}
              disabled={disabled}
              onClick={() => onChange?.(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
