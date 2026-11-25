// KSCORE live data server (Node 18+, no packages). Untested starter: add your own API keys.
//   CRICAPI_KEY   from cricapi.com        FOOTBALL_KEY  from football-data.org
// Run:  CRICAPI_KEY=xxx FOOTBALL_KEY=yyy node kscore-server.js
// Then set  var API = "https://your-server/api/matches"  in kscore.html
const http = require("http");
const CK = process.env.CRICAPI_KEY, FK = process.env.FOOTBALL_KEY;
let cache = { at: 0, data: null };

async function cricket() {
  const r = await fetch(`https://api.cricapi.com/v1/currentMatches?apikey=${CK}&offset=0`);
  const j = await r.json();
  return (j.data || []).map(m => {
    const sc = m.score || [], t = m.teams || ["", ""];
    const line = i => sc[i] ? `${sc[i].r}/${sc[i].w} (${sc[i].o} ov)` : "";
    return {
      sp: "c", ev: m.name, a: t[0], b: t[1], as: line(0), bs: line(1), n: m.status,
      s: m.matchEnded ? "res" : m.matchStarted ? "live" : "next",
      start: m.dateTimeGMT ? Date.parse(m.dateTimeGMT + "Z") : undefined, dur: 600
    };
  });
}

async function football() {
  const r = await fetch("https://api.football-data.org/v4/matches", { headers: { "X-Auth-Token": FK } });
  const j = await r.json();
  return (j.matches || []).map(m => {
    const live = ["IN_PLAY", "PAUSED"].includes(m.status), fin = m.status === "FINISHED";
    const g = x => (m.score && m.score.fullTime && m.score.fullTime[x] != null) ? String(m.score.fullTime[x]) : "";
    return {
      sp: "f", ev: m.competition.name, a: m.homeTeam.name, b: m.awayTeam.name,
      as: live || fin ? g("home") : "", bs: live || fin ? g("away") : "",
      n: m.status, s: fin ? "res" : live ? "live" : "next", start: Date.parse(m.utcDate)
    };
  });
}

http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!req.url.startsWith("/api/matches")) { res.writeHead(404); return res.end(); }
  try {
    if (Date.now() - cache.at > 30000) {          // cache 30 s to save API quota
      const [c, f] = await Promise.all([cricket(), football()]);
      cache = { at: Date.now(), data: { cricket: c, football: f } };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(cache.data));
  } catch (e) { res.writeHead(502); res.end(JSON.stringify({ error: String(e) })); }
}).listen(process.env.PORT || 3000);
