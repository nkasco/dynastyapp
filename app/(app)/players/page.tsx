import { PlayerBrowser } from "@/components/players/player-browser";

type PlayersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlayersPage({ searchParams }: PlayersPageProps) {
  const params = await searchParams;

  return (
    <PlayerBrowser
      initialQuery={{
        leagueId: firstParam(params.leagueId),
        rosterId: firstParam(params.rosterId),
        rostered: firstParam(params.rostered) === "true",
      }}
    />
  );
}
