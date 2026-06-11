import { EpisodePlayer } from "@web/components/episode/EpisodePlayer";

// The episode screen: one fetch of GET /api/episode, revealed turn by turn.
// All playthrough state lives in the client island.
export default function Home() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <EpisodePlayer />
    </main>
  );
}
