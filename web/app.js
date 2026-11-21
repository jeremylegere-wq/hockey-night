/* Hockey Night — full-screen NHL hub. Talks only to the local server (server.py). */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const COL = { ANA:["#f47a38","#b9975b"],BOS:["#fcb514","#111"],BUF:["#003087","#fcb514"],CGY:["#c8102e","#f1be48"],CAR:["#cc0000","#111"],CHI:["#cf0a2c","#111"],
  COL:["#6f263d","#236192"],CBJ:["#002654","#ce1126"],DAL:["#006847","#8f8f8c"],DET:["#ce1126","#ddd"],EDM:["#041e42","#fc4c02"],FLA:["#041e42","#c8102e"],
  LAK:["#111","#a2aaad"],MIN:["#154734","#a6192e"],MTL:["#af1e2d","#192168"],NSH:["#041e42","#ffb81c"],NJD:["#ce1126","#111"],NYI:["#00539b","#f47d30"],
  NYR:["#0038a8","#ce1126"],OTT:["#c52032","#c2912c"],PHI:["#f74902","#111"],PIT:["#2b2b2b","#fcb514"],SEA:["#001628","#99d9d9"],SJS:["#006d75","#111"],
  STL:["#002f87","#fcb514"],TBL:["#002868","#fff"],TOR:["#00205b","#fff"],UTA:["#010101","#6cace4"],VAN:["#00205b","#00843d"],VGK:["#b4975a","#333f42"],
  WSH:["#041e42","#c8102e"],WPG:["#041e42","#004c97"] };
const col = a => { const c = COL[a] || ["#1c2a4a", "#00e0ff"]; return `--c1:${c[0]};--c2:${c[1]}`; };
const LIVE = s => s === "LIVE" || s === "CRIT";
const FINAL = s => s === "FINAL" || s === "OFF";
const PNAME = { 1: "1ST", 2: "2ND", 3: "3RD", 4: "OT", 5: "SO" };
const fmtT = (iso, o) => { try { return new Date(iso).toLocaleTimeString([], o || { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };
const fmtD = (iso, o) => { try { return new Date(iso).toLocaleDateString([], o || { weekday: "short", month: "short", day: "numeric" }); } catch (e) { return ""; } };
const get = async u => { const r = await fetch(u, { cache: "no-store" }); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); };

const S = { cfg: { favourite: "MTL", scene_seconds: {} }, scores: null, stand: null, club: null, detail: {}, scenes: [], idx: -1,
  paused: false, prev: {}, tx: null, cycle: 0, t0: 0, dur: 20, prevScore: {}, curId: null, muted: false, soundBlocked: false, team: null, prospects: null };
const fav = () => (S.cfg.favourite || "").toUpperCase();
const secs = k => (S.cfg.scene_seconds || {})[k] || { boxscore: 22, favourite_boxscore: 34, division: 14, wildcard: 16, leaders: 16, preview: 18, transactions: 18, team: 24, prospects: 16 }[k];

/* ---------- helpers ---------- */
function lg(abbr, url, s) {
  const u = url ? url.replace("_light", "_dark") : "";
  return `<span class="lg" style="--s:${s || 34}px"><b>${esc(abbr)}</b>${u ? `<img src="${esc(u)}" alt="" onload="this.parentNode.classList.add('ok')" onerror="this.remove()">` : ""}</span>`;
}
function recOf(x) {   // W-L-OT from standings when the score feed has no record
  if (x.record) return x.record;
  const t = S.stand && S.stand.teams.find(t => t.abbrev === x.abbrev);
  return t ? `${t.w}-${t.l}-${t.otl}` : "";
}
function allGames() { return S.scores ? S.scores.days.flatMap(d => d.games.map(g => ({ ...g, _date: d.date }))) : []; }
function findGame(id) { return allGames().find(g => String(g.id) === String(id)); }
function statusText(g) {
  if (LIVE(g.state) || (g.state === "PRE" && false)) {
    const p = PNAME[g.period] || (g.period ? g.period + "TH" : "");
    return g.intermission ? "INT · " + p : p + " " + (g.clock || "");
  }
  if (FINAL(g.state)) return "FINAL" + (g.ptype === "OT" ? "/OT" : g.ptype === "SO" ? "/SO" : "");
  return fmtT(g.start);
}
const toast = (m, ms) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), ms || 4500); };

/* ---------- scene building ---------- */
function buildScenes() {
  const gs = allGames();
  const cur = S.scores && S.scores.current;
  let pool = gs.filter(g => g._date === cur && (LIVE(g.state) || FINAL(g.state)));
  if (pool.length < 3) pool = pool.concat(gs.filter(g => g._date !== cur && g._date < (cur || "9") && FINAL(g.state)));
  const rank = g => (LIVE(g.state) ? 0 : 1) + ((g.away.abbrev === fav() || g.home.abbrev === fav()) ? -0.5 : 0);
  pool.sort((a, b) => rank(a) - rank(b) || String(b.start).localeCompare(String(a.start)));
  const boxes = pool.map(g => {
    const isFav = g.away.abbrev === fav() || g.home.abbrev === fav();
    return { type: "box", id: g.id, label: g.away.abbrev + "@" + g.home.abbrev, live: LIVE(g.state), secs: isFav ? secs("favourite_boxscore") : secs("boxscore") };
  });
  const st = [{ type: "division", label: "DIVISIONS", secs: secs("division") }, { type: "wildcard", label: "WILD CARD", secs: secs("wildcard") }];
  const out = []; let si = 0;
  const gameDay = S.team && allGames().some(g => g._date === (S.scores && S.scores.current) && (g.away.abbrev === fav() || g.home.abbrev === fav()));
  const teamScene = gameDay ? { type: "team", label: fav() + " GAME DAY", secs: secs("team") } : null;
  boxes.forEach((b, i) => { out.push(b); if (i === 0 && teamScene) out.push(teamScene); if (i % 2 === 1 && S.stand) out.push(st[si++ % 2]); });
  if (!boxes.length && teamScene) out.push(teamScene);
  while (S.stand && si < 2) out.push(st[si++]);
  featureScenes().forEach(f => out.push(f));
  if (!out.length) out.push(st[0]);
  return out;
}
/* one "feature" per cycle: leaders (rotating), game previews on cycle 2, transactions on cycle 5 */
const FEATURES = ["leaders:points", "previews", "prospects", "leaders:goals", "leaders:goalies", "transactions", "prospects", "leaders:assists", "leaders:plusMinus"];
function featureScenes() {
  const f = FEATURES[S.cycle % FEATURES.length];
  if (f === "previews") {
    const gs = allGames().filter(g => !LIVE(g.state) && !FINAL(g.state)), cur = S.scores && S.scores.current;
    const days = [...new Set(gs.map(g => g._date))].filter(d => d >= (cur || "")).sort().slice(0, 2);
    const pool = gs.filter(g => days.includes(g._date)).sort((a, b) => ((b.away.abbrev === fav() || b.home.abbrev === fav()) - (a.away.abbrev === fav() || a.home.abbrev === fav())) || String(a.start).localeCompare(String(b.start))).slice(0, 5);
    if (pool.length) return pool.map(g => ({ type: "preview", id: g.id, label: "PREVIEW " + g.away.abbrev + "@" + g.home.abbrev, secs: (g.away.abbrev === fav() || g.home.abbrev === fav()) ? secs("preview") + 8 : secs("preview") }));
  }
  if (f === "prospects") {
    const n = S.prospects && S.prospects.items ? S.prospects.items.length : 0, per = 6, pages = Math.ceil(n / per);
    if (pages) return Array.from({ length: Math.min(pages, 3) }, (_, i) => ({ type: "prospects", page: i, pages: Math.min(pages, 3), label: "PROSPECTS " + (i + 1) + "/" + Math.min(pages, 3), secs: secs("prospects") }));
  }
  if (f === "transactions" && S.tx && S.tx.items && S.tx.items.length) return [{ type: "transactions", label: "TRANSACTIONS", secs: secs("transactions") }];
  if (!S.leaders) return [];
  const kind = f.startsWith("leaders:") ? f.split(":")[1] : "points";
  return [{ type: "leaders", kind, label: "LEADERS", secs: secs("leaders") }];
}
function refreshScenes() {
  const curKey = S.scenes[S.idx] && (S.scenes[S.idx].id || S.scenes[S.idx].type + (S.scenes[S.idx].kind || "") + (S.scenes[S.idx].page ?? ""));
  S.scenes = buildScenes();
  const ni = S.scenes.findIndex(s => (s.id || s.type + (s.kind || "") + (s.page ?? "")) === curKey);
  if (ni >= 0) S.idx = ni;
  renderTabs();
}
function renderTabs() {
  const n = S.scenes.length, cur = Math.max(0, S.idx), out = [];
  for (let k = -1; k <= 3 && k < n; k++) { const i = (cur + k + n) % n; const sc = S.scenes[i]; if (!sc) continue;
    out.push(`<span class="tab${k === 0 ? " on" : ""}${sc.live ? " live" : ""}">${esc(sc.label)}</span>`); }
  $("#tabs").innerHTML = out.join("") + `<span class="tab" style="background:none">${cur + 1} / ${n}</span>`;
}

/* ---------- box score ---------- */
function goalRow(g, away, home) {
  const tag = g.strength === "pp" ? '<span class="tag">PP</span>' : g.strength === "sh" ? '<span class="tag">SH</span>' : g.mod === "empty-net" ? '<span class="tag">EN</span>' : "";
  const a = (g.assists || []).filter(Boolean);
  return `<div class="goal" style="${col(g.team)}"><span class="pt">${esc(String(g.period).toUpperCase())} ${esc(g.time)}</span><span class="ch">${esc(g.team)}</span>` +
    `<span class="who"><b>${esc(g.scorer)}</b>${g.tally ? ` (${g.tally})` : ""}${tag}<i>${a.length ? esc(a.join(", ")) : "unassisted"}</i></span><span class="sc">${g.away}-${g.home}</span></div>`;
}
function skaterTable(side, n) {
  const t = side;
  const sk = t.forwards.concat(t.defense).slice().sort((a, b) => (b.p - a.p) || (b.g - a.g) || (b.sog - a.sog));
  const gl = t.goalies.filter(g => g.starter || (g.toi && g.toi !== "00:00")).slice(0, 2);
  const avail = n - 40 - 24 - 22 - 6;
  const rows = Math.max(8, Math.min(16, Math.floor(avail / 24) - gl.length));
  const rh = Math.min(27, Math.floor(avail / (rows + gl.length)));
  const shown = sk.slice(0, rows);
  const pm = v => (v > 0 ? "+" + v : v);
  return `<div class="pt-box" style="${col(t.abbrev)};--rh:${rh}px"><div class="pt-head">${lg(t.abbrev, t.logo, 28)}<b>${esc(t.name)}</b><span>TOP SKATERS</span></div>` +
    `<div class="pgrid h"><span>#</span><span>PLAYER</span><span>G</span><span>A</span><span>P</span><span>+/-</span><span>S</span><span>H</span><span>B</span><span>PIM</span><span>TOI</span></div>` +
    shown.map(p => `<div class="pgrid r"><span class="no">${p.n ?? ""}</span><span class="nm">${esc(p.name)}</span><span class="g${p.g ? " hot" : ""}">${p.g}</span><span>${p.a}</span><span class="p${p.p >= 2 ? " hot" : ""}">${p.p}</span><span class="dim">${pm(p.pm)}</span><span>${p.sog}</span><span class="dim">${p.hit}</span><span class="dim">${p.blk}</span><span class="dim">${p.pim}</span><span class="dim">${esc(p.toi)}</span></div>`).join("") +
    `<div class="ggrid h"><span>#</span><span>GOALIE</span><span>SA</span><span>SV</span><span>SV%</span><span>GA</span><span>TOI</span></div>` +
    gl.map(g => `<div class="ggrid"><span class="dim">${g.n ?? ""}</span><span class="nm">${esc(g.name)}${g.dec ? ` <span class="tag" style="background:${g.dec === "W" ? "var(--green)" : "var(--red)"}">${esc(g.dec)}</span>` : ""}</span><span>${g.sa ?? ""}</span><span>${g.sv ?? ""}</span><span>${g.svp != null ? g.svp.toFixed(3).replace(/^0/, "") : "-"}</span><span>${g.ga ?? ""}</span><span class="dim">${esc(g.toi || "")}</span></div>`).join("") + `</div>`;
}
function boxHTML(g, d) {
  const A = d && d.away, H = d && d.home;
  const live = LIVE(g.state), fin = FINAL(g.state);
  const as = g.away.score ?? 0, hs = g.home.score ?? 0;
  const per = (d && d.periods) || ["1", "2", "3"];
  const ls = (d && d.linescore) || {};
  const sbp = (d && d.sog_by_period) || {};
  const sogA = (d && A && A.sog != null) ? A.sog : g.away.sog, sogH = (d && H && H.sog != null) ? H.sog : g.home.sog;
  const tv = d && d.tv && d.tv.length ? d.tv.join(" · ") : "";
  const team = (x, side, cls) => `<div class="sb-team ${side} ${cls}" style="${col(x.abbrev)}">${lg(x.abbrev, x.logo, 84)}<div class="nm"><span class="pl">${side === "away" ? "AWAY" : "HOME"}${recOf(x) ? ` <em>${esc(recOf(x))}</em>` : ""}</span><span class="cn"${(x.name || "").length > 9 ? ' style="font-size:36px"' : ""}>${esc(x.name || x.abbrev)}</span></div><div class="sc">${x.score ?? "-"}</div></div>`;
  const wA = fin && as > hs ? "won" : fin ? "lost" : "", wH = fin && hs > as ? "won" : fin ? "lost" : "";
  const goals = (d && d.goals) || [];
  const gshow = goals.length > 5 ? goals.slice(-5) : goals;
  const pens = ((d && d.penalties) || []).slice(-2);
  const stars = ((d && d.stars) || []).slice(0, 3);
  let h = `<div class="sb">${team(g.away, "away", wA)}<div class="sb-mid"><span class="pill${live ? " live" : ""}">${esc(statusText(g))}</span><small>${esc(g.venue || "")}${tv ? "<br>" + esc(tv) : ""}</small></div>${team(g.home, "home", wH)}</div>`;
  h += `<div class="sb-sub"><div class="l">SOG <b>${sogA ?? "-"}</b></div><div class="m">${fin || live ? "" : ""}</div><div class="r">SOG <b>${sogH ?? "-"}</b></div></div>`;
  if (!d) return h + `<div class="err" style="top:200px">LOADING BOX SCORE…</div>`;
  h += `<div class="band">`;
  h += `<div class="box"><h4>Score by period</h4><table class="ls"><tr><th></th>${per.map(p => `<th>${esc(p)}</th>`).join("")}<th>T</th></tr>` +
    [["away", g.away, as], ["home", g.home, hs]].map(([k, x, tot]) => `<tr><td><div class="tmcell">${lg(x.abbrev, x.logo, 28)}${esc(x.abbrev)}</div></td>${per.map(p => `<td>${ls[p] && ls[p][k] != null ? ls[p][k] : "·"}</td>`).join("")}<td class="t">${tot}</td></tr>`).join("") +
    `<tr class="sg"><td>SOG</td>${per.map(p => `<td>${sbp[p] ? sbp[p].away + "-" + sbp[p].home : "·"}</td>`).join("")}<td>${sogA ?? "-"}-${sogH ?? "-"}</td></tr></table></div>`;
  h += `<div class="box"><h4>Scoring</h4>${goals.length ? `<div class="goals">${gshow.map(x => goalRow(x)).join("")}${goals.length > 5 ? `<div class="more">+${goals.length - 5} earlier</div>` : ""}</div>` : '<div class="none">No goals yet</div>'}</div>`;
  h += `<div class="box stars"><h4>Three stars</h4>${stars.length ? stars.map(s => `<div class="star" style="${col(s.team)}"><span class="n">${"★".repeat(s.star || 1)}</span><span class="ch">${esc(s.team)}</span><b>${esc(s.name)}</b>${s.pos ? `<em>${esc(s.pos)}</em>` : ""}</div>`).join("") : `<div class="none" style="padding-top:34px;font-size:19px">Awarded at the final horn</div>`}</div>`;
  h += `</div>`;
  const avail = 800 - 140 - 36 - 190 - 4 - 12 - 4;
  h += `<div class="tables">${A && H ? skaterTable(A, avail) + skaterTable(H, avail) : ""}</div>`;
  return h;
}

/* ---------- standings ---------- */
function srow(t, rk, cls) {
  const f = t.abbrev === fav() ? " fav" : "";
  const sk = t.streak || "";
  return `<div class="sgrid ${cls || ""}${f}"><span class="rk">${rk}</span><span class="tm">${lg(t.abbrev, t.logo, 32)}${esc(t.name)}</span><span>${t.gp}</span><span>${t.w}</span><span>${t.l}</span><span>${t.otl}</span>` +
    `<span class="pts">${t.pts}</span><span>${(t.pct != null ? t.pct.toFixed(3) : "").replace(/^0/, "")}</span><span>${t.row ?? ""}</span><span class="${t.diff > 0 ? "up" : t.diff < 0 ? "dn" : ""}">${t.diff > 0 ? "+" + t.diff : t.diff}</span><span class="${sk[0] === "W" ? "up" : sk[0] === "L" ? "dn" : ""}">${esc(sk)}</span></div>`;
}
const SH = `<div class="sgrid h"><span></span><span>TEAM</span><span>GP</span><span>W</span><span>L</span><span>OT</span><span>PTS</span><span>P%</span><span>ROW</span><span>DIFF</span><span>STK</span></div>`;
const T = () => (S.stand ? S.stand.teams : []);
const title = (a, b, c) => `<div class="stand-title"><span>STANDINGS</span><em>${a}</em><small>${b}</small></div>`;
function divisionHTML() {
  const t = T(); const block = d => {
    const L = t.filter(x => x.div === d).sort((a, b) => a.divSeq - b.divSeq);
    return `<div class="st"><div class="st-head">${d}</div>${SH}${L.map((x, i) => srow(x, x.divSeq, x.divSeq <= 3 ? "in" : "") + (i === 2 ? '<div class="cut"></div>' : "")).join("")}</div>`;
  };
  return title("DIVISION", "TOP 3 IN EACH DIVISION QUALIFY") + `<div class="grid2 rows2">${block("Atlantic")}${block("Central")}${block("Metropolitan")}${block("Pacific")}</div>`;
}
function wildcardHTML() {
  const t = T(); const conf = (c, d1, d2) => {
    const lead = d => t.filter(x => x.div === d && x.divSeq <= 3).sort((a, b) => a.divSeq - b.divSeq);
    const wc = t.filter(x => x.conf === c && x.divSeq > 3).sort((a, b) => (a.wc || 99) - (b.wc || 99) || a.confSeq - b.confSeq);
    return `<div class="st"><div class="st-head">${c} Conference</div>${SH}<div class="lbl">${d1.toUpperCase()}</div>${lead(d1).map(x => srow(x, x.divSeq, "in")).join("")}` +
      `<div class="lbl">${d2.toUpperCase()}</div>${lead(d2).map(x => srow(x, x.divSeq, "in")).join("")}<div class="lbl w">WILD CARD</div>` +
      wc.map((x, i) => srow(x, i + 1, i < 2 ? "wc" : "") + (i === 1 ? '<div class="cut"></div>' : "")).join("") + `</div>`;
  };
  return title("WILD CARD", "DIVISION LEADERS + TWO WILD CARDS PER CONFERENCE") + `<div class="grid2">${conf("Eastern", "Atlantic", "Metropolitan")}${conf("Western", "Central", "Pacific")}</div>`;
}
function conferenceHTML() {
  const t = T(); const conf = c => {
    const L = t.filter(x => x.conf === c).sort((a, b) => a.confSeq - b.confSeq);
    return `<div class="st"><div class="st-head">${c} Conference</div>${SH}${L.map((x, i) => srow(x, x.confSeq, x.divSeq <= 3 ? "in" : x.wc && x.wc <= 2 ? "wc" : "") + (i === 7 ? '<div class="cut"></div>' : "")).join("")}</div>`;
  };
  return title("CONFERENCE", "TOP 8 QUALIFY") + `<div class="grid2">${conf("Eastern")}${conf("Western")}</div>`;
}

/* ---------- league leaders ---------- */
const LEAD_ORDER = ["points", "goals", "goalies", "assists", "plusMinus"];
const LEAD_NAME = { points: "POINTS", goals: "GOALS", assists: "ASSISTS", plusMinus: "PLUS / MINUS", wins: "WINS", savePctg: "SAVE %", goalsAgainstAverage: "GOALS AGAINST AVG" };
const fmtV = (c, v) => c === "savePctg" ? Number(v).toFixed(3).replace(/^0/, "") : c === "goalsAgainstAverage" ? Number(v).toFixed(2) : c === "plusMinus" && v > 0 ? "+" + v : v;
function lrow(p, i, c, big) {
  const f = p.abbrev === fav() ? " fav" : "";
  return `<div class="lrow${big ? " big" : ""}${i === 0 ? " first" : ""}${f}" style="${col(p.abbrev)}"><span class="rk">${i + 1}</span>` +
    `<span class="hs">${p.headshot ? `<img src="${esc(p.headshot)}" alt="" onerror="this.remove()">` : ""}</span>` +
    `<span class="who"><b>${esc(p.name)}</b><i>${lg(p.abbrev, p.logo, 24)}${esc(p.abbrev)} · ${esc(p.pos || "")}${p.num != null ? " · #" + p.num : ""}</i></span><span class="val">${fmtV(c, p.value)}</span></div>`;
}
function leadersHTML(sc) {
  const L = S.leaders; if (!L) return `<div class="err">League leaders unavailable</div>`;
  let kind = (sc && sc.kind) || "points";
  if (kind === "goalies") {
    const panel = c => `<div class="st"><div class="st-head">${LEAD_NAME[c]}</div>${((L.goalies || {})[c] || []).map((p, i) => lrow(p, i, c, false)).join("")}</div>`;
    return `<div class="stand-title"><span>LEAGUE LEADERS</span><em>GOALIES</em><small>WINS · SAVE % · GAA</small></div><div class="grid3">${panel("wins")}${panel("savePctg")}${panel("goalsAgainstAverage")}</div>`;
  }
  const rows = (L.skaters || {})[kind] || [];
  if (!rows.length) return `<div class="err">League leaders unavailable</div>`;
  return `<div class="stand-title"><span>LEAGUE LEADERS</span><em>${LEAD_NAME[kind]}</em><small>TOP 10 SKATERS</small></div>` +
    `<div class="grid2"><div class="st"><div class="st-head">${LEAD_NAME[kind]} · 1-5</div>${rows.slice(0, 5).map((p, i) => lrow(p, i, kind, true)).join("")}</div>` +
    `<div class="st"><div class="st-head">${LEAD_NAME[kind]} · 6-10</div>${rows.slice(5, 10).map((p, i) => lrow(p, i + 5, kind, true)).join("")}</div></div>`;
}

/* ---------- game previews ---------- */
const P = {
  pct: v => v == null ? "–" : (v * 100).toFixed(1) + "%", f2: v => v == null ? "–" : Number(v).toFixed(2), f1: v => v == null ? "–" : Number(v).toFixed(1),
  pdo: v => v == null ? "–" : (v * 100).toFixed(1), pp: v => v == null ? "–" : Number(v).toFixed(3).replace(/^0/, ""), int: v => v == null ? "–" : v, txt: v => v || "–" };
function cmpRow(label, a, h, fmt, lowerBetter, numeric = true) {
  let cls = ["", ""], wa = 50;
  if (numeric && a != null && h != null && a !== h) {
    const better = lowerBetter ? a < h : a > h; cls = better ? ["b", ""] : ["", "b"];
    const A = lowerBetter ? 1 / (a || .0001) : a, H = lowerBetter ? 1 / (h || .0001) : h; wa = Math.max(20, Math.min(80, 100 * A / (A + H)));
  }
  return `<div class="cmp"><span class="v ${cls[0]}">${fmt(a)}</span><div class="mid"><em>${label}</em>${numeric ? `<div class="bar"><i style="width:${wa}%"></i><b style="width:${100 - wa}%"></b></div>` : ""}</div><span class="v r ${cls[1]}">${fmt(h)}</span></div>`;
}
function lineupPanel(t) {
  const nm = p => `<span>${esc(p.name)}</span>`;
  const gl = (t.goalies || []).map((g, i) => `<div class="lg-g"><span class="tagx">${i ? "BACKUP" : "LIKELY G"}</span><b>${g.num != null ? "#" + g.num + " " : ""}${esc(g.name)}</b><em>${esc(g.record || "")} · ${g.gaa != null ? Number(g.gaa).toFixed(2) : "–"} GAA · ${g.svp != null ? Number(g.svp).toFixed(3).replace(/^0/, "") : "–"}</em></div>`).join("");
  const hot = (t.hot || []).slice(0, 3).map(h => `<div class="hotp"><em>${esc(String(h.cat).toUpperCase())} · L5</em><b>${esc(h.name)}</b><span>${h.value}</span></div>`).join("");
  return `<div class="lp" style="${col(t.abbrev)}"><div class="lp-h">${lg(t.abbrev, t.logo, 34)}<b>${esc(t.name)}</b><span>PROJECTED LINES</span></div>` +
    (t.lines || []).slice(0, 4).map((l, i) => `<div class="ln"><i>F${i + 1}</i>${l.map(nm).join("")}</div>`).join("") +
    (t.pairs || []).slice(0, 3).map((l, i) => `<div class="ln d"><i>D${i + 1}</i>${l.map(nm).join("")}</div>`).join("") + gl + (hot ? `<div class="hots">${hot}</div>` : "") + `</div>`;
}
function previewHTML(g, d) {
  const A = d.away, H = d.home, a = A.stats || {}, h = H.stats || {};
  const tvs = (d.tv || []).join(" · ");
  const team = (x, side) => `<div class="sb-team ${side}" style="${col(x.abbrev)}">${lg(x.abbrev, x.logo, 84)}<div class="nm"><span class="pl">${side === "away" ? "AWAY" : "HOME"}</span><span class="cn"${(x.name || "").length > 9 ? ' style="font-size:36px"' : ""}>${esc(x.name)}</span></div><div class="sc" style="font-size:38px;min-width:0">${esc(x.record || "")}</div></div>`;
  let s = `<div class="sb">${team(A, "away")}<div class="sb-mid"><span class="pill">${esc(fmtT(d.start || g.start))}</span><small>${esc(fmtD(d.start || g.start))}<br>${esc(d.venue || "")}${tvs ? "<br>" + esc(tvs) : ""}</small></div>${team(H, "home")}</div>`;
  s += `<div class="sb-sub"><div class="l">${a.rank ? "#" + a.rank + " overall · " : ""}${esc(a.div || "")} ${a.divSeq ? "#" + a.divSeq : ""}</div><div class="m">GAME PREVIEW</div><div class="r">${esc(h.div || "")} ${h.divSeq ? "#" + h.divSeq : ""}${h.rank ? " · #" + h.rank + " overall" : ""}</div></div>`;
  const gA = (A.goalies || [])[0], gH = (H.goalies || [])[0];
  s += `<div class="pv-body">${lineupPanel(A)}<div class="pv-mid"><div class="gm"><span>${gA ? esc(gA.name) : "–"}<em>${gA ? esc(gA.record || "") + " · " + (gA.svp != null ? Number(gA.svp).toFixed(3).replace(/^0/, "") : "–") : ""}</em></span><b>GOALIE MATCHUP</b><span class="r">${gH ? esc(gH.name) : "–"}<em>${gH ? esc(gH.record || "") + " · " + (gH.svp != null ? Number(gH.svp).toFixed(3).replace(/^0/, "") : "–") : ""}</em></span></div>` +
    cmpRow("POINTS %", a.ptsPct, h.ptsPct, P.pp) + cmpRow("GOALS FOR / GP", a.gf, h.gf, P.f2) + cmpRow("GOALS AGAINST / GP", a.ga, h.ga, P.f2, true) +
    cmpRow("POWER PLAY", a.pp, h.pp, P.pct) + cmpRow("PENALTY KILL", a.pk, h.pk, P.pct) + cmpRow("SHOTS FOR / GP", a.sf, h.sf, P.f1) + cmpRow("SHOTS AGAINST / GP", a.sa, h.sa, P.f1, true) +
    cmpRow("FACEOFF %", a.fo, h.fo, P.pct) + cmpRow("SHOT ATTEMPTS % · 5v5", a.sat, h.sat, P.pct) + cmpRow("PDO · 5v5", a.pdo, h.pdo, P.pdo) +
    cmpRow("LAST 10", a.l10, h.l10, P.txt, false, false) + cmpRow("STREAK", a.streak, h.streak, P.txt, false, false) + `</div>${lineupPanel(H)}</div>`;
  return s;
}

/* ---------- transactions ---------- */
const TXC = { TRADE: "#ffb020", SIGNING: "#2ee59d", WAIVERS: "#ff7a45", IR: "#ff2d55", RECALL: "#4a8cff", ASSIGNED: "#8794b6", MOVE: "#8794b6" };
function transactionsHTML() {
  const all = ((S.tx && S.tx.items) || []);
  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  let items = all.filter(t => t.date >= cutoff); if (items.length < 6) items = all;
  items = items.slice(0, 16);
  const row = t => `<div class="tx"><span class="k" style="background:${TXC[t.kind] || "#8794b6"}">${esc(t.kind)}</span><span class="tm">${lg(t.abbrev || "", t.logo, 34)}${esc(t.abbrev || "")}</span><span class="t">${esc(t.text)}</span><span class="d">${esc(fmtD(t.date + "T12:00:00", { month: "short", day: "numeric" }).toUpperCase())}</span></div>`;
  const half = Math.ceil(items.length / 2);
  return `<div class="stand-title"><span>LEAGUE</span><em>TRANSACTIONS</em><small>TRADES · SIGNINGS · WAIVERS · INJURED RESERVE</small></div><div class="grid2"><div class="st">${items.slice(0, half).map(row).join("")}</div><div class="st">${items.slice(half).map(row).join("")}</div></div>`;
}

/* ---------- favourite team game day ---------- */
const RFMT = { pct: P.pct, f2: P.f2, f1: P.f1, pdo: P.pdo, pp: P.pp };
function rankClass(r, of) { const q = r / of; return q <= 0.25 ? "top" : q <= 0.5 ? "up" : q <= 0.75 ? "mid" : "low"; }
const ord = n => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
function teamHTML() {
  const T = S.team, st = T.standing || {}, g = allGames().find(g => g._date === S.scores.current && (g.away.abbrev === fav() || g.home.abbrev === fav()));
  const opp = g ? (g.away.abbrev === fav() ? g.home : g.away) : null, home = g && g.home.abbrev === fav();
  const status = g ? (LIVE(g.state) ? statusText(g) + " · " + (g.away.abbrev + " " + (g.away.score ?? 0) + "-" + (g.home.score ?? 0) + " " + g.home.abbrev) : FINAL(g.state) ? statusText(g) + " · " + g.away.abbrev + " " + g.away.score + "-" + g.home.score + " " + g.home.abbrev : "TODAY " + fmtT(g.start)) : "";
  let h = `<div class="th" style="${col(T.abbrev)}">${lg(T.abbrev, T.logo, 96)}<div class="nm"><small>GAME DAY</small><b>${esc((T.name || T.abbrev).toUpperCase())}</b></div>` +
    `<div class="rec"><b>${st.w ?? "-"}-${st.l ?? "-"}-${st.otl ?? "-"}</b><small>${st.pts ?? "-"} PTS · ${esc(st.div || "")} #${st.divSeq ?? "-"} · ${ord(st.leagueSeq || 0)} OVERALL</small></div>` +
    `<div class="gm2">${opp ? `${home ? "VS" : "AT"} ${lg(opp.abbrev, opp.logo, 54)}<b>${esc(opp.abbrev)}</b>` : ""}<small>${esc(status)}</small></div></div>`;
  h += `<div class="tb">`;
  h += `<div class="st tbox"><div class="st-head">TEAM · LEAGUE RANK</div>` + (T.ranks || []).map(r => `<div class="rk2 ${rankClass(r.rank, r.of)}"><span class="l">${esc(r.label)}</span><span class="v">${RFMT[r.fmt](r.value)}</span><span class="bar"><i style="width:${Math.max(6, 100 * (r.of + 1 - r.rank) / r.of)}%"></i></span><span class="r">${ord(r.rank)}</span></div>`).join("") + `</div>`;
  h += `<div class="st tbox"><div class="st-head">GOALTENDING</div>` + (T.goalies || []).map((q, i) => `<div class="gcard"><div class="gn"><span>${i ? "BACKUP" : "STARTER"}</span><b>${esc(q.name)}</b></div>` +
    `<div class="gs"><div><em>RECORD</em>${q.w}-${q.l}-${q.otl}</div><div><em>GAA</em>${P.f2(q.gaa)}</div><div><em>SV%</em>${q.svp != null ? Number(q.svp).toFixed(3).replace(/^0/, "") : "–"}</div><div><em>SA</em>${q.sa ?? "–"}</div><div><em>SO</em>${q.so ?? 0}</div></div></div>`).join("") + `</div>`;
  h += `<div class="st tbox"><div class="st-head">SKATERS</div><div class="sk h"><span></span><span>PLAYER</span><span>GP</span><span>G</span><span>A</span><span>P</span><span>+/-</span><span>S</span><span>TOI</span></div>` +
    (T.skaters || []).slice(0, 12).map(p => `<div class="sk"><span class="dim">${esc(p.pos || "")}</span><span class="nm">${esc(p.name)}</span><span>${p.gp}</span><span class="${p.g ? "hotn" : ""}">${p.g}</span><span>${p.a}</span><span class="hotp2">${p.p}</span><span class="dim">${p.pm > 0 ? "+" + p.pm : p.pm}</span><span>${p.sog}</span><span class="dim">${esc(p.toi)}</span></div>`).join("") + `</div></div>`;
  return h;
}

/* ---------- prospect watch ---------- */
const ageOf = b => b ? Math.floor((Date.now() - new Date(b).getTime()) / 31557600000) : "";
const inch = v => v ? Math.floor(v / 12) + "'" + (v % 12) + '"' : "";
function prospectsHTML(sc) {
  const all = (S.prospects && S.prospects.items) || [], per = 6, items = all.slice(sc.page * per, sc.page * per + per);
  const card = p => {
    const s = p.stats, isG = p.pos === "G", ini = p.name.split(" ").map(x => x[0]).join("").slice(0, 2);
    return `<div class="pc${p.rank ? " ranked" : ""}"><div class="pc-top"><span class="ph">${p.headshot ? `<img src="${esc(p.headshot)}" alt="" onerror="this.remove()">` : ""}<b>${esc(ini)}</b></span>` +
      `<div class="pi"><b>${esc(p.name)}</b><i>${esc(p.pos || "")}${p.shoots ? " · " + esc(p.shoots) : ""} · ${ageOf(p.born)} · ${inch(p.ht)} ${p.wt ? p.wt + " lb" : ""}</i><i>${esc(p.draft ? "DRAFTED " + p.draft : "UNDRAFTED")}${p.country ? " · " + esc(p.country) : ""}</i></div>` +
      (p.rank ? `<span class="rank">#${p.rank}${p.grade ? `<small>${esc(p.grade)}</small>` : ""}</span>` : "") + `</div>` +
      `<div class="pl2">${esc(p.league || "")}${p.team ? " · " + esc(p.team) : ""}</div>` +
      (s ? (isG ? `<div class="ps"><div><em>GP</em>${s.gp}</div><div><em>W</em>${s.w ?? "–"}</div><div><em>GAA</em>${s.gaa != null ? Number(s.gaa).toFixed(2) : "–"}</div><div><em>SV%</em>${s.svp != null ? Number(s.svp).toFixed(3).replace(/^0/, "") : "–"}</div></div>`
        : `<div class="ps"><div><em>GP</em>${s.gp}</div><div><em>G</em>${s.g}</div><div><em>A</em>${s.a}</div><div><em>P</em><b>${s.p}</b></div><div><em>P/GP</em>${s.gp ? (s.p / s.gp).toFixed(2) : "–"}</div></div>`) : `<div class="ps none2">No current-season stats</div>`) +
      ((p.chips || []).length ? `<div class="rks">${p.chips.map(c => `<span class="${c.scope}">${esc(c.src)} <b>${c.scope === "league" ? "TOP 50 #" : "#"}${c.rank}</b></span>`).join("")}</div>` : "") + (p.note ? `<div class="pn">${esc(p.note)}</div>` : "") + `</div>`;
  };
  return `<div class="stand-title"><span>PROSPECT</span><em>WATCH</em><small>${esc((S.team && S.team.name || fav()).toUpperCase())} · PAGE ${sc.page + 1} OF ${sc.pages}${(S.prospects && S.prospects.sources || []).length ? " · RANKS: " + S.prospects.sources.map(x => esc(x.id)).join(" · ") : ""}</small></div><div class="pgrid2">${items.map(card).join("")}</div>`;
}

/* ---------- scene engine ---------- */
async function ensurePreview(id) {
  if (S.prev[id] && Date.now() - S.prev[id].at < 600000) return;
  try { const d = await get("/api/preview/" + id); S.prev[id] = d; S.prev[id].at = Date.now(); } catch (e) { console.warn(e); }
}
async function ensureDetail(id, force) {
  const g = findGame(id); if (!g) return null;
  const old = S.detail[id];
  if (old && !force && Date.now() - old.at < (LIVE(g.state) ? 10000 : 600000)) return old.d;
  try { const d = await get("/api/game/" + id); S.detail[id] = { d, at: Date.now() }; return d; } catch (e) { return old ? old.d : null; }
}
function sceneHTML(sc) {
  if (sc.type === "preview") { const e = S.prev[sc.id]; return e ? previewHTML(findGame(sc.id), e) : `<div class="err">LOADING PREVIEW…</div>`; }
  if (sc.type === "box") { const g = findGame(sc.id); if (!g) return `<div class="err">Game not found</div>`; const e = S.detail[sc.id]; return boxHTML(g, e && e.d); }
  if (!S.stand) return `<div class="err">Standings unavailable<small>Waiting for data from the NHL…</small></div>`;
  return { division: divisionHTML, wildcard: wildcardHTML, leaders: leadersHTML, transactions: transactionsHTML, team: teamHTML, prospects: prospectsHTML }[sc.type](sc);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GAP = 3;   // extra seconds on every scene to cover the transition
async function show(i, instant) {
  if (!S.scenes.length) return;
  if (S.busy) { S.pending = i; return; }
  S.busy = true;
  try {
    if (S.idx >= 0 && i >= S.scenes.length) { S.cycle++; S.scenes = buildScenes(); i = 0; }   // wrapped around = new cycle
    S.idx = ((i % S.scenes.length) + S.scenes.length) % S.scenes.length;
    const sc = S.scenes[S.idx]; S.curId = sc.id || sc.type;
    S.t0 = performance.now(); S.dur = (sc.secs + GAP) * 1000; renderTabs();   // reset timer first so tick() can't re-enter
    const host = $("#scene");
    const work = sc.type === "box" ? ensureDetail(sc.id) : sc.type === "preview" ? ensurePreview(sc.id) : Promise.resolve();
    const olds = [...host.querySelectorAll(".scene")];
    if (olds.length && !instant) { olds.forEach(o => o.classList.add("leave")); await Promise.all([sleep(420), work]); } else await work;
    host.querySelectorAll(".scene").forEach(o => o.remove());
    const el = document.createElement("div"); el.className = "scene" + (instant ? " noanim" : ""); el.innerHTML = sceneHTML(sc);
    host.appendChild(el);
    S.t0 = performance.now();
  } finally {
    S.busy = false;
    if (S.pending != null) { const n = S.pending; S.pending = null; show(n); }
  }
}
function redraw() {   // re-render current scene in place after data refresh
  const sc = S.scenes[S.idx]; if (!sc) return;
  const el = $("#scene").lastElementChild; if (!el) return;
  el.innerHTML = sceneHTML(sc); el.classList.add("noanim");
}
function tick(now) {
  if (!S.paused && S.scenes.length) {
    const p = Math.min(1, (now - S.t0) / S.dur);
    $("#progress i").style.width = (p * 100) + "%";
    if (p >= 1) show(S.idx + 1);
  } else if (S.paused) S.t0 += 16;
  requestAnimationFrame(tick);
}

/* ---------- ticker ---------- */
const TK = {};   // scrollers: id -> {pos, half, speed}
function setTrack(id, html, speed) {
  const tr = $("#" + id), st = TK[id] || (TK[id] = { pos: 0, half: 1, speed });
  tr.innerHTML = html + html; st.half = tr.scrollWidth / 2 || 1;
  const view = tr.parentNode.clientWidth;
  if (html && st.half < view) { const n = Math.ceil(view / st.half) + 1; tr.innerHTML = html.repeat(n * 2); st.half = tr.scrollWidth / (n * 2); st.copies = n; }
  st.pos %= st.half;
}
function buildTicker() {
  if (!S.scores) return;
  const cur = S.scores.current; let html = "";
  S.scores.days.forEach(day => {
    if (!day.games.length) return;
    const label = day.date === cur ? "TODAY" : fmtD(day.date + "T12:00:00", { weekday: "short" }).toUpperCase();
    html += `<div class="tk-day">${label}<small>${fmtD(day.date + "T12:00:00", { month: "short", day: "numeric" }).toUpperCase()}</small></div>`;
    const order = g => LIVE(g.state) ? 0 : FINAL(g.state) ? 1 : 2;
    day.games.slice().sort((a, b) => order(a) - order(b)).forEach(g => {
      const live = LIVE(g.state), fin = FINAL(g.state), fut = !live && !fin;
      const isF = g.away.abbrev === fav() || g.home.abbrev === fav();
      const wa = fin && g.away.score > g.home.score, wh = fin && g.home.score > g.away.score;
      const row = (x, lose) => `<div class="tk-r${lose ? " lose" : ""}">${lg(x.abbrev, x.logo, 24)}<span>${esc(x.abbrev)}</span><b>${fut ? "" : x.score ?? ""}</b></div>`;
      html += `<div class="tk-g${live ? " live" : ""}${fut ? " fut" : ""}${isF ? " fav" : ""}"><div class="tk-s"><span>${esc(statusText(g))}</span><span>${live ? "● LIVE" : fut ? "UP NEXT" : ""}</span></div>${row(g.away, fin && wh)}${row(g.home, fin && wa)}</div>`;
    });
  });
  setTrack("tk-track", html || `<div class="tk-day">NO GAMES YET</div>`, 70);
}
function buildGoals() {
  const items = [];
  const cur = S.scores && S.scores.current;
  let gs = allGames().filter(g => g._date === cur && (LIVE(g.state) || FINAL(g.state)));
  if (!gs.some(g => S.detail[g.id] && (S.detail[g.id].d.goals || []).length)) gs = allGames().filter(g => LIVE(g.state) || FINAL(g.state));
  gs.forEach(g => { const e = S.detail[g.id]; if (e && e.d.goals) e.d.goals.forEach(x => items.push({ g, x, k: String(g.start) + String(x.period).padStart(2, "0") + x.time })); });
  items.sort((a, b) => b.k.localeCompare(a.k));
  setTrack("goal-track", items.slice(0, 24).map(({ g, x }) => {
    const a = (x.assists || []).filter(Boolean), tag = x.strength === "pp" ? " PP" : x.strength === "sh" ? " SH" : "";
    return `<span class="gl" style="${col(x.team)}"><span class="ch">${esc(x.team)}</span><span>${esc(x.scorer)}${tag}</span><em>${a.length ? esc(a.join(", ")) : "unassisted"}</em><span class="sc">${g.away.abbrev} ${x.away}-${x.home} ${g.home.abbrev}</span><i>${esc(String(x.period).toUpperCase())} ${esc(x.time)}</i></span>`;
  }).join("") || `<span class="gl"><em>Goals will appear here as they are scored</em></span>`, 60);
  updateReels(items);
}
const ago = ts => { if (!ts) return ""; const h = Math.round((Date.now() / 1000 - ts) / 3600); return h < 1 ? "just now" : h < 24 ? h + "h ago" : Math.round(h / 24) + "d ago"; };
function buildNews() {
  const items = (S.news && S.news.items) || [];
  setTrack("news-track", items.map(n => `<span class="nw"><b>${esc(n.source.toUpperCase())}</b><strong>${esc(n.title)}</strong>${n.summary ? `<em>${esc(n.summary)}</em>` : ""}<i>${ago(n.ts)}</i></span>`).join("") || `<span class="nw">News headlines will appear here</span>`, 55);
}
let lastT = 0;
function tkLoop(t) {
  const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
  if (!S.paused) for (const id in TK) { const st = TK[id]; st.pos = (st.pos + st.speed * dt) % st.half; $("#" + id).style.transform = `translateX(${-st.pos}px)`; }
  requestAnimationFrame(tkLoop);
}

/* ---------- side: club, feed, video ---------- */
function renderClub() {
  const c = S.club, host = $("#club-card"); if (!c) { host.innerHTML = ""; return; }
  const me = fav();
  const l = c.last, n = (c.next || [])[0];
  let h = `<div class="club-h">${esc(me)} · TEAM WATCH</div><div class="cg">`;
  if (l) {
    const home = l.home.abbrev === me, mine = home ? l.home.score : l.away.score, theirs = home ? l.away.score : l.home.score, opp = home ? l.away : l.home;
    const w = mine > theirs;
    h += `<div><small>LAST</small><div class="mt">${lg(opp.abbrev, opp.logo, 28)}<span class="${w ? "win" : "loss"}">${w ? "W" : "L"} ${mine}-${theirs}</span><span class="v">${l.last_period_type === "OT" ? "OT" : l.last_period_type === "SO" ? "SO" : ""}</span></div><div class="tm2">${home ? "vs" : "@"} ${esc(opp.abbrev)} · ${esc(fmtD(l.start))}</div></div>`;
  } else h += `<div><small>LAST</small><div class="mt">—</div></div>`;
  if (n) {
    const home = n.home.abbrev === me, opp = home ? n.away : n.home;
    h += `<div><small>NEXT</small><div class="mt">${lg(opp.abbrev, opp.logo, 28)}<span>${home ? "vs" : "@"} ${esc(opp.abbrev)}</span></div><div class="tm2">${esc(fmtD(n.start))} · ${esc(fmtT(n.start))}</div></div>`;
  } else h += `<div><small>NEXT</small><div class="mt">—</div></div>`;
  host.innerHTML = h + "</div>";
}
/* ---------- goal reels: story-style, game by game, plain MP4 clips ---------- */
const REEL = { games: [], gi: 0, ci: 0, key: null, newest: null, timer: null, token: 0 };
const reelKey = (g, x) => g.id + "|" + x.clip;
function updateReels(items) {
  const by = new Map();
  items.filter(it => it.x.clip).forEach(it => { if (!by.has(it.g.id)) by.set(it.g.id, { g: it.g, clips: [] }); by.get(it.g.id).clips.push(it); });
  const games = [...by.values()];
  games.forEach(G => G.clips.sort((a, b) => a.k.localeCompare(b.k)));     // goals in the order they happened
  games.sort((a, b) => (LIVE(b.g.state) - LIVE(a.g.state)) || String(b.g.start).localeCompare(String(a.g.start)));
  REEL.games = games;
  $("#reel-count").textContent = games.length ? games.reduce((n, G) => n + G.clips.length, 0) + " CLIPS" : "";
  if (!games.length) { if (!REEL.key) $("#reels-box").innerHTML = `<div class="novid"><b>GOAL REELS</b>Goal highlight clips will play here once goals have been scored</div>`; return; }
  const newest = items.filter(it => it.x.clip).map(it => ({ it, s: it.k })).sort((a, b) => b.s.localeCompare(a.s))[0].it;
  const nk = reelKey(newest.g, newest.x);
  const fresh = REEL.newest && REEL.newest !== nk && LIVE(newest.g.state);
  REEL.newest = nk;
  if (!REEL.key || fresh) { const gi = games.findIndex(G => G.g.id === newest.g.id); playReel(gi < 0 ? 0 : gi, fresh ? games[gi].clips.length - 1 : 0); return; }
  // keep position stable if lists shifted
  for (let gi = 0; gi < games.length; gi++) { const ci = games[gi].clips.findIndex(c => reelKey(c.g, c.x) === REEL.key); if (ci >= 0) { REEL.gi = gi; REEL.ci = ci; return; } }
}
function nextReel() {
  const G = REEL.games[REEL.gi]; if (!G) return playReel(0, 0);
  if (REEL.ci + 1 < G.clips.length) playReel(REEL.gi, REEL.ci + 1); else playReel((REEL.gi + 1) % REEL.games.length, 0);
}
async function playReel(gi, ci) {
  clearTimeout(REEL.timer); const my = ++REEL.token;
  const G = REEL.games[gi]; if (!G) return;
  const { g, x } = G.clips[ci]; REEL.gi = gi; REEL.ci = ci; REEL.key = reelKey(g, x);
  const a = (x.assists || []).filter(Boolean);
  const segs = G.clips.map((_, i) => `<i class="${i < ci ? "done" : ""}"><b id="seg${i}" style="width:${i < ci ? 100 : 0}%"></b></i>`).join("");
  const fit = S.cfg.reel_fit === "contain" ? "contain" : "cover";
  let media = `<div class="reel-wait">LOADING CLIP…</div>`;
  const render = m => { $("#reels-box").innerHTML = `<div class="reel-v ${fit}">${m}<div class="reel-top"><div class="segs">${segs}</div>` +
    `<div class="reel-g">${lg(g.away.abbrev, g.away.logo, 30)}<b>${g.away.abbrev} ${g.away.score ?? ""}</b><em>—</em><b>${g.home.score ?? ""} ${g.home.abbrev}</b>${lg(g.home.abbrev, g.home.logo, 30)}<span>${esc(statusText(g))}</span></div></div>` +
    `<div class="reel-bot" style="${col(x.team)}"><span class="ch">${esc(x.team)} GOAL</span><b>${esc(x.scorer)}${x.tally ? ` (${x.tally})` : ""}</b><i>${a.length ? esc(a.join(", ")) : "unassisted"} · ${esc(String(x.period).toUpperCase())} ${esc(x.time)}</i></div></div>`; };
  render(media);
  let info = null; try { info = await get("/api/clip/" + x.clip); } catch (e) { }
  if (my !== REEL.token) return;
  if (info && info.mp4) {
    render(`<video id="reel-vid" src="${esc(info.mp4)}" ${info.poster ? `poster="${esc(info.poster)}"` : ""} playsinline></video>`);
    const v = $("#reel-vid"), seg = () => $("#seg" + ci);
    v.addEventListener("timeupdate", () => { if (v.duration && seg()) seg().style.width = (100 * v.currentTime / v.duration) + "%"; });
    v.addEventListener("ended", () => { if (my === REEL.token) nextReel(); });
    v.addEventListener("error", () => { if (my === REEL.token) nextReel(); });
    v.muted = S.muted;
    const pr = v.play();   // with sound if allowed; if the browser blocks it, fall back to muted and wait for a click
    if (pr) pr.catch(() => { if (!S.muted) { v.muted = true; S.soundBlocked = true; applySound(); v.play().catch(() => {}); } });
    applySound();
    REEL.timer = setTimeout(() => { if (my === REEL.token) nextReel(); }, 60000);   // safety net
  } else {   // could not resolve: fall back to the NHL's own embedded player for this clip, timed
    const t = S.cfg.goal_player_url || "https://players.brightcove.net/6415718365001/EXtG1xJ7H_default/index.html?videoId={id}&autoplay=true&muted=true";
    render(`<iframe src="${esc(t.replace("{id}", x.clip))}" allow="autoplay; encrypted-media; fullscreen"></iframe>`);
    REEL.timer = setTimeout(() => { if (my === REEL.token) nextReel(); }, (S.cfg.reel_seconds || 24) * 1000);
  }
}
/* ---------- sound ---------- */
try { S.muted = localStorage.getItem("nhlhub.muted") === "1"; } catch (e) { }
function applySound() {
  const v = $("#reel-vid"); if (v) v.muted = S.muted;
  const b = $("#mute-btn"); if (b) { b.textContent = S.muted ? "MUTED" : (S.soundBlocked ? "CLICK FOR SOUND" : "SOUND ON"); b.classList.toggle("off", S.muted || S.soundBlocked); }
}
function setMuted(m) {
  S.muted = m; S.soundBlocked = false;
  try { localStorage.setItem("nhlhub.muted", m ? "1" : "0"); } catch (e) { }
  applySound(); const v = $("#reel-vid"); if (v && !m) v.play().catch(() => { v.muted = true; S.soundBlocked = true; applySound(); });
  toast(m ? "SOUND OFF" : "SOUND ON", 1200);
}

/* ---------- polling ---------- */
async function pollScores() {
  try {
    const sc = await get("/api/scores");
    const prev = S.prevScore, next = {};
    allGames().length; S.scores = sc;
    allGames().forEach(g => {
      const k = (g.away.score ?? 0) + "-" + (g.home.score ?? 0); next[g.id] = k;
      if (LIVE(g.state) && prev[g.id] && prev[g.id] !== k && S.firstLoad) {
        toast(`GOAL · ${g.away.abbrev} ${g.away.score} — ${g.home.score} ${g.home.abbrev}`);
        S.jump = g.id;
      }
    });
    S.prevScore = next; S.firstLoad = true;
    await Promise.all(allGames().filter(g => LIVE(g.state)).map(g => ensureDetail(g.id, true)));
    await Promise.all(allGames().filter(g => FINAL(g.state) && g._date === sc.current).map(g => ensureDetail(g.id)));
    buildTicker(); buildGoals();
    const had = S.scenes.length; refreshScenes();
    if (!had) await show(0, true);
    else if (S.jump) { const i = S.scenes.findIndex(s => s.id == S.jump); S.jump = null; if (i >= 0 && !S.paused) show(i); else redraw(); }
    else redraw();
  } catch (e) { console.warn(e); if (!S.scenes.length) $("#scene").innerHTML = `<div class="err">Can't reach the NHL feed<small>${esc(e.message)} — retrying…</small></div>`; }
}
async function pollLeaders() { try { S.leaders = await get("/api/leaders"); } catch (e) { console.warn(e); } try { S.tx = await get("/api/transactions"); } catch (e) { console.warn(e); } try { S.prospects = await get("/api/prospects/" + fav()); } catch (e) { console.warn(e); } refreshScenes(); }
async function pollNews() { try { S.news = await get("/api/news"); buildNews(); } catch (e) { console.warn(e); } }
async function pollSlow() {
  try { S.stand = await get("/api/standings"); } catch (e) { console.warn(e); }
  try { S.club = await get("/api/club/" + fav()); renderClub(); } catch (e) { console.warn(e); }
  try { S.team = await get("/api/team/" + fav()); } catch (e) { console.warn(e); }
  refreshScenes();
}

/* ---------- chrome ---------- */
function fit() { const s = Math.min(innerWidth / 1920, innerHeight / 1080); $("#stage").style.transform = `translate(-50%,-50%) scale(${s})`; }
function clock() { const d = new Date(); $("#clock").innerHTML = `${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}<small>${d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }).toUpperCase()}</small>`; }
let idleT; function wake() { document.body.classList.remove("idle"); clearTimeout(idleT); idleT = setTimeout(() => document.body.classList.add("idle"), 3000); }
document.addEventListener("click", e => {
  if (e.target.id === "mute-btn") { if (S.soundBlocked && !S.muted) { S.soundBlocked = false; const v = $("#reel-vid"); if (v) { v.muted = false; v.play().catch(() => {}); } applySound(); } else setMuted(!S.muted); }
  else if (S.soundBlocked && !S.muted) { S.soundBlocked = false; const v = $("#reel-vid"); if (v) { v.muted = false; v.play().catch(() => {}); } applySound(); }
});
addEventListener("resize", fit); addEventListener("mousemove", wake);
addEventListener("keydown", e => {
  if (e.key === "ArrowRight") show(S.idx + 1);
  else if (e.key === "ArrowLeft") show(S.idx - 1);
  else if (e.key === " ") { e.preventDefault(); S.paused = !S.paused; toast(S.paused ? "PAUSED" : "RESUMED", 1500); }
  else if (/^m$/i.test(e.key)) setMuted(!S.muted);
  else if (/^r$/i.test(e.key)) { toast("REFRESHING…", 1500); pollScores(); pollSlow(); }
  else if (/^f$/i.test(e.key)) { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
});

(async function main() {
  fit(); clock(); wake(); setInterval(clock, 15000);
  try { S.cfg = await get("/api/config"); } catch (e) { }
  try { if (localStorage.getItem("nhlhub.muted") === null) S.muted = !!S.cfg.reel_muted; } catch (e) { }
  applySound();
  $("#demo-flag").textContent = (S.cfg.demo ? "DEMO DATA · " : "") + (S.cfg.version ? "v" + S.cfg.version : "");
  requestAnimationFrame(t => { lastT = t; tick(t); tkLoop(t); });
  await pollSlow(); await pollScores();
  pollNews(); setInterval(pollNews, 600000); pollLeaders(); setInterval(pollLeaders, 300000); setInterval(pollScores, 15000); setInterval(pollSlow, 120000);
  const q = new URLSearchParams(location.search);   // debug: ?scene=N&pause=1
  if (q.has("scene")) { await show(+q.get("scene"), true); }
  if (q.get("pause")) S.paused = true;
  window.__hub = { S, show, redraw, refreshScenes, buildScenes };
})();
