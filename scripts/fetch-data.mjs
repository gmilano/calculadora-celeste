import { mkdir, writeFile } from "node:fs/promises";

const STANDINGS_URL =
  "https://site.web.api.espn.com/apis/v2/sports/soccer/fifa.world/standings?region=us&lang=en&contentorigin=espn&type=0&level=2&sort=rank:asc";
const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260627&limit=200";

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.json();
}

const [standings, scoreboard] = await Promise.all([
  getJson(STANDINGS_URL),
  getJson(SCOREBOARD_URL),
]);

const snapshot = {
  fetchedAt: new Date().toISOString(),
  source: "github-action",
  standings,
  scoreboard,
};

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../data/worldcup-2026.json", import.meta.url),
  `${JSON.stringify(snapshot, null, 2)}\n`,
);

console.log(`Wrote data/worldcup-2026.json at ${snapshot.fetchedAt}`);
