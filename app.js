const STANDINGS_URL =
  "https://site.web.api.espn.com/apis/v2/sports/soccer/fifa.world/standings?region=us&lang=en&contentorigin=espn&type=0&level=2&sort=rank:asc";
const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260627&limit=200";
const SNAPSHOT_URL = "./data/worldcup-2026.json";

const GROUP_H = "Group H";
const URUGUAY = "Uruguay";
const URU = "URU";
const QUALIFYING_THIRD_COUNT = 8;
const AUTO_REFRESH_MS = 3 * 60 * 60 * 1000;

const state = {
  groups: [],
  events: [],
  projectedMatches: new Map(),
};

const $ = (id) => document.getElementById(id);

function stat(entry, name) {
  return Number(entry.stats?.find((item) => item.name === name)?.value ?? 0);
}

function normalizeEntry(entry, groupName) {
  const row = {
    groupName,
    team: entry.team.displayName,
    abbr: entry.team.abbreviation,
    logo: entry.team.logos?.[0]?.href ?? "",
    played: stat(entry, "gamesPlayed"),
    wins: stat(entry, "wins"),
    draws: stat(entry, "ties"),
    losses: stat(entry, "losses"),
    gf: stat(entry, "pointsFor"),
    ga: stat(entry, "pointsAgainst"),
    gd: stat(entry, "pointDifferential"),
    pts: stat(entry, "points"),
  };
  return row;
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    return (
      b.pts - a.pts ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.ga - b.ga ||
      a.team.localeCompare(b.team)
    );
  });
}

function parseGroups(data) {
  return data.children.map((group) => ({
    name: group.name,
    rows: sortRows(
      group.standings.entries.map((entry) => normalizeEntry(entry, group.name)),
    ),
  }));
}

function parseEvents(data) {
  return data.events
    .map((event) => {
      const competition = event.competitions?.[0];
      const competitors = competition?.competitors ?? [];
      const home = competitors.find((team) => team.homeAway === "home") ?? competitors[0];
      const away = competitors.find((team) => team.homeAway === "away") ?? competitors[1];
      return {
        id: event.id,
        name: event.name,
        date: event.date,
        status: event.status?.type,
        completed: Boolean(event.status?.type?.completed),
        detail: event.status?.type?.shortDetail ?? "",
        home: teamFromCompetitor(home),
        away: teamFromCompetitor(away),
      };
    })
    .filter((event) => event.home && event.away);
}

function teamFromCompetitor(competitor) {
  if (!competitor) return null;
  return {
    name: competitor.team.displayName,
    abbr: competitor.team.abbreviation,
    logo: competitor.team.logo || competitor.team.logos?.[0]?.href || "",
    score: Number(competitor.score ?? 0),
  };
}

function renderTable(rows, compact = false) {
  const columns = compact
    ? ["P", "DG", "Pts"]
    : ["PJ", "G", "E", "P", "GF", "GC", "DG", "Pts"];

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Equipo</th>
            ${columns.map((column) => `<th>${column}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const cells = compact
                ? [row.played, signed(row.gd), row.pts]
                : [
                    row.played,
                    row.wins,
                    row.draws,
                    row.losses,
                    row.gf,
                    row.ga,
                    signed(row.gd),
                    row.pts,
                  ];
              return `
                <tr class="${row.abbr === URU ? "highlight" : ""}">
                  <td>
                    <span class="team-cell">
                      ${row.logo ? `<img src="${row.logo}" alt="" loading="lazy" />` : ""}
                      <span>${row.team}</span>
                    </span>
                  </td>
                  ${cells.map((cell) => `<td>${cell}</td>`).join("")}
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function renderStatus(rows, projected = false) {
  const ordered = sortRows(rows);
  const uruguayIndex = ordered.findIndex((row) => row.abbr === URU);
  const uruguay = ordered[uruguayIndex];
  const rank = uruguayIndex + 1;
  const thirdRank = thirdPlaceRows(replaceGroup(state.groups, GROUP_H, ordered)).findIndex(
    (row) => row.abbr === URU,
  );

  let title = "Uruguay no aparece en la tabla";
  let note = "Revisá la fuente de datos.";
  let tone = "bad";

  if (rank <= 2) {
    title = `Uruguay esta ${rank}. Clasifica directo.`;
    note = projected
      ? "Con este escenario, no hace falta mirar tantos grupos: top 2 y adentro."
      : "Ahora mismo el camino directo sigue vivo por posicion de grupo.";
    tone = "good";
  } else if (rank === 3 && thirdRank >= 0 && thirdRank < QUALIFYING_THIRD_COUNT) {
    title = `Uruguay esta 3. y entra como mejor tercero.`;
    note = `Ocupa el puesto ${thirdRank + 1} entre los terceros. Entran 8 de 12.`;
    tone = "warn";
  } else if (rank === 3) {
    title = "Uruguay esta 3., pero afuera por terceros.";
    note = "Precisa mejorar puntos/diferencia o que otros terceros aflojen.";
    tone = "bad";
  } else {
    title = "Uruguay esta 4. y queda eliminado.";
    note = "Aca no hay calculadora que aguante: hay que cambiar el resultado.";
    tone = "bad";
  }

  return { title, note, tone, uruguay, rank };
}

function replaceGroup(groups, groupName, rows) {
  return groups.map((group) => (group.name === groupName ? { ...group, rows } : group));
}

function renderCurrent() {
  const groupH = state.groups.find((group) => group.name === GROUP_H);
  if (!groupH) return;

  const status = renderStatus(groupH.rows);
  $("uruguayStatus").className = `status-card ${status.tone}`;
  $("uruguayStatus").innerHTML = `
    <div class="status-kicker">Grupo H</div>
    <div class="status-title">${status.title}</div>
    <p class="status-note">${status.note}</p>
  `;
  $("groupHMini").innerHTML = renderTable(groupH.rows, true);
  $("groups").innerHTML = state.groups
    .map(
      (group) => `
        <article class="group-card">
          <h3>${group.name}</h3>
          ${renderTable(group.rows, true)}
        </article>
      `,
    )
    .join("");
  renderThirdRanking(state.groups);
  renderMatches();
}

function thirdPlaceRows(groups) {
  return sortRows(
    groups
      .map((group) => group.rows[2])
      .filter(Boolean)
      .map((row) => ({ ...row })),
  );
}

function renderThirdRanking(groups) {
  $("thirdRanking").innerHTML = thirdPlaceRows(groups)
    .map((row, index) => {
      const safe = index < QUALIFYING_THIRD_COUNT;
      return `
        <article class="third-card ${safe ? "safe" : "danger"} ${row.abbr === URU ? "highlight" : ""}">
          <div class="third-rank">#${index + 1} de terceros · ${safe ? "adentro" : "afuera"}</div>
          <div class="third-team">
            ${row.logo ? `<img src="${row.logo}" alt="" loading="lazy" />` : ""}
            <span>${row.team}</span>
          </div>
          <div class="third-meta">${row.groupName} · ${row.pts} pts · DG ${signed(row.gd)} · GF ${row.gf}</div>
        </article>
      `;
    })
    .join("");
}

function renderMatches() {
  const focus = state.events.filter((event) => {
    const teams = [event.home.abbr, event.away.abbr, event.home.name, event.away.name];
    return (
      teams.includes(URU) ||
      teams.includes("Spain") ||
      teams.includes("Cape Verde") ||
      teams.includes("Saudi Arabia")
    );
  });

  $("matches").innerHTML = focus
    .map((event) => {
      const date = new Intl.DateTimeFormat("es-UY", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(event.date));
      const score = event.completed
        ? `${event.away.score} - ${event.home.score}`
        : event.detail || "Pendiente";
      return `
        <article class="match-card">
          <div class="match-date">${date}</div>
          <div class="match-line">
            <span>${event.away.name}</span>
            <span class="match-score">${score}</span>
            <span>${event.home.name}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function pendingGroupHMatches() {
  return state.events.filter((event) => {
    if (event.completed) return false;
    const names = [event.home.name, event.away.name];
    return names.some((name) => ["Uruguay", "Spain", "Cape Verde", "Saudi Arabia"].includes(name));
  });
}

function renderScenarioControls() {
  const pending = pendingGroupHMatches();
  state.projectedMatches = new Map(
    pending.map((event) => [
      event.id,
      {
        homeScore: event.home.score || 0,
        awayScore: event.away.score || 0,
      },
    ]),
  );

  $("scenarioControls").innerHTML = pending.length
    ? pending
        .map(
          (event) => `
            <article class="control-card">
              <div class="control-title">
                <span>${event.away.name} vs ${event.home.name}</span>
                <span>${new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "short" }).format(
                  new Date(event.date),
                )}</span>
              </div>
              <div class="score-row">
                <label for="${event.id}-away">${event.away.name}</label>
                <input id="${event.id}-away" type="number" min="0" max="20" value="0" data-event="${event.id}" data-side="awayScore" />
              </div>
              <div class="score-row">
                <label for="${event.id}-home">${event.home.name}</label>
                <input id="${event.id}-home" type="number" min="0" max="20" value="0" data-event="${event.id}" data-side="homeScore" />
              </div>
            </article>
          `,
        )
        .join("")
    : `<article class="control-card">No quedan partidos pendientes en el Grupo H.</article>`;

  $("scenarioControls").addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const current = state.projectedMatches.get(input.dataset.event);
    current[input.dataset.side] = Math.max(0, Number(input.value || 0));
    calculateScenario();
  });

  calculateScenario();
}

function calculateScenario() {
  const groupH = state.groups.find((group) => group.name === GROUP_H);
  if (!groupH) return;

  const rows = new Map(groupH.rows.map((row) => [row.name ?? row.team, { ...row }]));
  for (const event of pendingGroupHMatches()) {
    const projection = state.projectedMatches.get(event.id);
    if (!projection) continue;
    applyResult(rows.get(event.home.name), rows.get(event.away.name), projection.homeScore, projection.awayScore);
  }

  const projectedRows = sortRows([...rows.values()]);
  const status = renderStatus(projectedRows, true);
  $("scenarioVerdict").className = `verdict-card ${status.tone}`;
  $("scenarioVerdict").innerHTML = `
    <h3>${status.title}</h3>
    <p>${status.note}</p>
  `;
  $("projectedGroup").innerHTML = `
    <h3>Grupo H proyectado</h3>
    ${renderTable(projectedRows)}
  `;
}

function applyResult(home, away, homeScore, awayScore) {
  if (!home || !away) return;
  home.played += 1;
  away.played += 1;
  home.gf += homeScore;
  home.ga += awayScore;
  away.gf += awayScore;
  away.ga += homeScore;
  home.gd = home.gf - home.ga;
  away.gd = away.gf - away.ga;

  if (homeScore > awayScore) {
    home.wins += 1;
    home.pts += 3;
    away.losses += 1;
  } else if (homeScore < awayScore) {
    away.wins += 1;
    away.pts += 3;
    home.losses += 1;
  } else {
    home.draws += 1;
    away.draws += 1;
    home.pts += 1;
    away.pts += 1;
  }
}

async function loadData() {
  $("refreshBtn").disabled = true;
  try {
    const data = await fetchData();
    state.groups = parseGroups(data.standings);
    state.events = parseEvents(data.scoreboard);
    renderCurrent();
    renderScenarioControls();
    $("lastUpdated").textContent = formatUpdateLabel(data.fetchedAt, data.source);
  } catch (error) {
    $("uruguayStatus").className = "status-card error";
    $("uruguayStatus").textContent =
      "No pude cargar datos en vivo. Probá actualizar en unos segundos.";
    console.error(error);
  } finally {
    $("refreshBtn").disabled = false;
  }
}

async function fetchData() {
  try {
    const [standings, scoreboard] = await Promise.all([
      fetch(STANDINGS_URL, { cache: "no-store" }).then(assertJson),
      fetch(SCOREBOARD_URL, { cache: "no-store" }).then(assertJson),
    ]);
    return {
      source: "vivo",
      fetchedAt: new Date().toISOString(),
      standings,
      scoreboard,
    };
  } catch (error) {
    console.warn("Live data failed, using scheduled snapshot", error);
    const snapshot = await fetch(SNAPSHOT_URL, { cache: "no-store" }).then(assertJson);
    return {
      ...snapshot,
      source: "snapshot 3h",
    };
  }
}

function assertJson(response) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.url}`);
  }
  return response.json();
}

function formatUpdateLabel(fetchedAt, source) {
  const date = fetchedAt ? new Date(fetchedAt) : new Date();
  const time = new Intl.DateTimeFormat("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${time} · ${source}`;
}

$("refreshBtn").addEventListener("click", loadData);
loadData();
window.setInterval(loadData, AUTO_REFRESH_MS);
