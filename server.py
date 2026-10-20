#!/usr/bin/env python3
"""NHL Hub local server: serves the full-screen app and proxies/normalises NHL data.
Standard library only.   python3 server.py [--port 8765] [--demo]"""
import argparse, json, mimetypes, os, sys, threading, time, urllib.error, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "web")
try:
    VERSION = open(os.path.join(HERE, "VERSION")).read().strip()
except OSError:
    VERSION = "dev"

def load_env(path):
    """Tiny .env reader (no dependency): KEY=value lines, '#' comments. Real environment variables win."""
    try:
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except OSError:
        pass
load_env(os.path.join(HERE, ".env"))
API = "https://api-web.nhle.com/v1"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) NHL-Hub/" + VERSION, "Accept": "application/json"}
LIVE = ("LIVE", "CRIT")
DONE = ("FINAL", "OFF")

# ---------------------------------------------------------------- cache + fetch
_cache, _lock = {}, threading.Lock()

def fetch(url, timeout=12, headers=None):
    req = urllib.request.Request(url, headers=headers or UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def cached(key, ttl, fn):
    now = time.time()
    with _lock:
        hit = _cache.get(key)
    if hit and now - hit[0] < ttl:
        return hit[1]
    try:
        val = fn()
    except Exception as e:                     # serve stale data if the network hiccups
        if hit:
            print("stale:", key, e, file=sys.stderr)
            return hit[1]
        raise
    with _lock:
        _cache[key] = (now, val)
    return val

def get_json(path):
    return json.loads(fetch(API + path))

def d(v, default=""):
    """NHL names come as {'default': 'x'} or plain strings."""
    if isinstance(v, dict):
        return v.get("default", default)
    return v if v is not None else default

# ---------------------------------------------------------------- normalisers
def team_brief(t):
    return {"abbrev": t.get("abbrev", "?"), "name": d(t.get("name")) or d(t.get("commonName")),
            "logo": t.get("logo", ""), "score": t.get("score"), "sog": t.get("sog"), "record": t.get("record", "")}

def norm_game(g):
    pd = g.get("periodDescriptor") or {}
    clock = g.get("clock") or {}
    return {"id": g.get("id"), "state": g.get("gameState", ""), "start": g.get("startTimeUTC", ""),
            "away": team_brief(g.get("awayTeam", {})), "home": team_brief(g.get("homeTeam", {})),
            "period": pd.get("number"), "ptype": pd.get("periodType", ""),
            "clock": clock.get("timeRemaining", ""), "intermission": bool(clock.get("inIntermission")),
            "venue": d(g.get("venue")), "link": g.get("gameCenterLink", "")}

def scores():
    def build():
        now = get_json("/score/now")
        days = []
        for key in ("prevDate", "currentDate", "nextDate"):
            date = now.get(key)
            if not date:
                continue
            data = now if key == "currentDate" else cached("score:" + date, 120, lambda dt=date: get_json("/score/" + dt))
            days.append({"date": date, "games": [norm_game(g) for g in data.get("games", [])]})
        return {"days": days, "current": now.get("currentDate"), "updated": time.time()}
    return cached("scores", 15, build)

def skater(p):
    return {"id": p.get("playerId"), "n": p.get("sweaterNumber"), "name": d(p.get("name")), "pos": p.get("position", ""),
            "g": p.get("goals", 0), "a": p.get("assists", 0), "p": p.get("points", 0), "pm": p.get("plusMinus", 0),
            "sog": p.get("sog", 0), "hit": p.get("hits", 0), "blk": p.get("blockedShots", 0), "pim": p.get("pim", 0),
            "toi": p.get("toi", ""), "fo": p.get("faceoffWinningPctg"), "ppg": p.get("powerPlayGoals", 0),
            "gv": p.get("giveaways", 0), "tk": p.get("takeaways", 0)}

def goalie(p):
    return {"id": p.get("playerId"), "n": p.get("sweaterNumber"), "name": d(p.get("name")), "sa": p.get("shotsAgainst", 0),
            "sv": p.get("saves", 0), "svp": p.get("savePctg"), "ga": p.get("goalsAgainst", 0), "toi": p.get("toi", ""),
            "dec": p.get("decision", ""), "starter": bool(p.get("starter"))}

def period_label(pd):
    n, t = pd.get("number"), pd.get("periodType", "REG")
    if t == "OT":
        return "OT" if (n or 4) <= 4 else "%dOT" % ((n or 4) - 3)
    if t == "SO":
        return "SO"
    return str(n)

def game_detail(gid):
    box = get_json("/gamecenter/%s/boxscore" % gid)
    state = box.get("gameState", "")
    ttl = 12 if state in LIVE else 600

    def build():
        out = {"id": gid, "state": state, "venue": d(box.get("venue")), "start": box.get("startTimeUTC", ""),
               "period": (box.get("periodDescriptor") or {}).get("number"),
               "ptype": (box.get("periodDescriptor") or {}).get("periodType", ""),
               "last_period_type": (box.get("gameOutcome") or {}).get("lastPeriodType", ""),
               "clock": (box.get("clock") or {}).get("timeRemaining", ""),
               "intermission": bool((box.get("clock") or {}).get("inIntermission")),
               "tv": [b.get("network") for b in box.get("tvBroadcasts", []) if b.get("countryCode") == "US"][:3]}
        teams = {}
        for side in ("awayTeam", "homeTeam"):
            t = box.get(side, {})
            stats = (box.get("playerByGameStats") or {}).get(side, {})
            skaters = [skater(p) for p in stats.get("forwards", []) + stats.get("defense", [])]
            teams[side] = {"id": t.get("id"), "abbrev": t.get("abbrev", "?"), "name": d(t.get("commonName")) or d(t.get("name")),
                           "place": d(t.get("placeName")), "logo": t.get("logo", ""), "score": t.get("score", 0), "sog": t.get("sog", 0),
                           "forwards": [skater(p) for p in stats.get("forwards", [])],
                           "defense": [skater(p) for p in stats.get("defense", [])],
                           "goalies": [goalie(p) for p in stats.get("goalies", [])],
                           "pp": None}
            _ = skaters
        out["away"], out["home"] = teams["awayTeam"], teams["homeTeam"]

        # scoring summary, penalties, three stars from the landing feed
        goals, pens, stars = [], [], []
        try:
            land = get_json("/gamecenter/%s/landing" % gid)
            summ = land.get("summary") or {}
            for blk in summ.get("scoring", []):
                lab = period_label(blk.get("periodDescriptor") or {})
                for g in blk.get("goals", []):
                    goals.append({"period": lab, "time": g.get("timeInPeriod", ""), "team": g.get("teamAbbrev", {}).get("default") if isinstance(g.get("teamAbbrev"), dict) else g.get("teamAbbrev"),
                                  "scorer": d(g.get("name")) or ("%s %s" % (d(g.get("firstName")), d(g.get("lastName")))).strip(),
                                  "tally": g.get("goalsToDate"), "strength": (g.get("strength") or "ev").lower(),
                                  "mod": g.get("goalModifier", ""), "shot": g.get("shotType", ""),
                                  "assists": [d(a.get("name")) for a in g.get("assists", [])],
                                  "away": g.get("awayScore"), "home": g.get("homeScore"), "clip": g.get("highlightClip"),
                                  "url": g.get("highlightClipSharingUrl", "")})
            for blk in summ.get("penalties", []):
                lab = period_label(blk.get("periodDescriptor") or {})
                for p in blk.get("penalties", []):
                    pens.append({"period": lab, "time": p.get("timeInPeriod", ""), "team": p.get("teamAbbrev", {}).get("default") if isinstance(p.get("teamAbbrev"), dict) else p.get("teamAbbrev"),
                                 "player": d(p.get("committedByPlayer")), "type": (p.get("descKey") or p.get("type") or "").replace("-", " "),
                                 "min": p.get("duration")})
            for s in summ.get("threeStars", []):
                stars.append({"star": s.get("star"), "name": d(s.get("name")), "team": s.get("teamAbbrev"), "pos": s.get("position", "")})
        except Exception as e:
            print("landing failed:", gid, e, file=sys.stderr)
        out["goals"], out["penalties"], out["stars"] = goals, pens, stars

        # shots by period from play-by-play (shots on goal + goals)
        try:
            pbp = get_json("/gamecenter/%s/play-by-play" % gid)
            ids = {out["away"]["id"]: "away", out["home"]["id"]: "home"}
            sbp = {}
            for pl in pbp.get("plays", []):
                if pl.get("typeDescKey") in ("shot-on-goal", "goal"):
                    side = ids.get((pl.get("details") or {}).get("eventOwnerTeamId"))
                    if side:
                        lab = period_label(pl.get("periodDescriptor") or {})
                        sbp.setdefault(lab, {"away": 0, "home": 0})[side] += 1
            out["sog_by_period"] = sbp
        except Exception as e:
            print("pbp failed:", gid, e, file=sys.stderr)
            out["sog_by_period"] = {}

        # linescore (goals by period)
        ls = {}
        for g in goals:
            if g["period"] == "SO":
                continue
            side = "away" if g["team"] == out["away"]["abbrev"] else "home"
            ls.setdefault(g["period"], {"away": 0, "home": 0})[side] += 1
        periods = ["1", "2", "3"] + [p for p in ls if p not in ("1", "2", "3")]
        cur = out["period"] or 3
        if out["ptype"] == "OT" or out["last_period_type"] in ("OT", "SO"):
            if "OT" not in periods and not any(p.endswith("OT") for p in periods):
                periods.append("OT")
        if out["last_period_type"] == "SO" or out["ptype"] == "SO":
            periods.append("SO")
        out["periods"] = periods
        out["linescore"] = {p: ls.get(p, {"away": 0, "home": 0}) for p in periods}
        if "SO" in periods:
            out["linescore"]["SO"] = {"away": None, "home": None}
        out["now"] = time.time()
        return out
    return cached("game:%s" % gid, ttl, build)

def standings():
    def build():
        raw = get_json("/standings/now")
        teams = []
        for t in raw.get("standings", []):
            teams.append({"abbrev": d(t.get("teamAbbrev")), "name": d(t.get("teamCommonName")) or d(t.get("teamName")),
                          "logo": t.get("teamLogo", ""), "div": t.get("divisionName", ""), "divAbbrev": t.get("divisionAbbrev", ""),
                          "conf": t.get("conferenceName", ""), "confAbbrev": t.get("conferenceAbbrev", ""),
                          "gp": t.get("gamesPlayed", 0), "w": t.get("wins", 0), "l": t.get("losses", 0), "otl": t.get("otLosses", 0),
                          "pts": t.get("points", 0), "pct": t.get("pointPctg", 0), "row": t.get("regulationPlusOtWins", 0),
                          "gf": t.get("goalFor", 0), "ga": t.get("goalAgainst", 0), "diff": t.get("goalDifferential", 0),
                          "streak": "%s%s" % (t.get("streakCode", ""), t.get("streakCount", "")),
                          "l10": "%s-%s-%s" % (t.get("l10Wins", 0), t.get("l10Losses", 0), t.get("l10OtLosses", 0)),
                          "wc": t.get("wildcardSequence", 0), "divSeq": t.get("divisionSequence", 0),
                          "confSeq": t.get("conferenceSequence", 0), "leagueSeq": t.get("leagueSequence", 0)})
        return {"teams": teams, "updated": time.time()}
    return cached("standings", 240, build)

def club(abbr):
    def build():
        raw = get_json("/club-schedule-season/%s/now" % abbr)
        games = raw.get("games", [])
        def brief(g):
            return {"id": g.get("id"), "date": g.get("gameDate"), "start": g.get("startTimeUTC"), "state": g.get("gameState"),
                    "venue": d(g.get("venue")), "last_period_type": (g.get("gameOutcome") or {}).get("lastPeriodType", ""),
                    "away": {"abbrev": g["awayTeam"].get("abbrev"), "score": g["awayTeam"].get("score"), "logo": g["awayTeam"].get("logo", "")},
                    "home": {"abbrev": g["homeTeam"].get("abbrev"), "score": g["homeTeam"].get("score"), "logo": g["homeTeam"].get("logo", "")}}
        regular = [g for g in games if g.get("gameType") == 2]
        done = [g for g in regular if g.get("gameState") in DONE]
        fut = [g for g in regular if g.get("gameState") in ("FUT", "PRE")]
        return {"abbr": abbr, "last": brief(done[-1]) if done else None, "next": [brief(g) for g in fut[:3]]}
    return cached("club:" + abbr, 300, build)

NEWS_FEEDS = [("Sportsnet", "https://www.sportsnet.ca/hockey/nhl/feed"), ("THN", "https://thehockeynews.com/rss/THNHOME/full"),
              ("Habs EOTP", "https://www.habseyesontheprize.com/feed/"), ("ESPN", "https://www.espn.com/espn/rss/nhl/news")]

def _clean(txt, limit=170):
    import html, re
    t = html.unescape(re.sub(r"<[^>]+>", " ", txt or ""))
    t = re.sub(r"The post .*? appeared first on .*", "", t, flags=re.S)
    t = re.sub(r"(Continue reading|Read more|Read the full).*", "", t, flags=re.S | re.I)
    t = re.sub(r"\s+", " ", t).strip()
    if len(t) <= limit:
        return t
    cut = t[:limit]
    for sep in (". ", "! ", "? "):
        i = cut.rfind(sep)
        if i > 60:
            return cut[:i + 1]
    return cut.rsplit(" ", 1)[0] + "…"

def _parse_feed(raw, name, limit=8, max_age=72 * 3600):
    import xml.etree.ElementTree as ET, email.utils, datetime
    A, C = "{http://www.w3.org/2005/Atom}", "{http://purl.org/rss/1.0/modules/content/}"
    root = ET.fromstring(raw.strip())
    out, now = [], time.time()
    for it in list(root.iter("item")) + list(root.iter(A + "entry")):
        g = lambda tag: it.find(tag) if it.find(tag) is not None else it.find(A + tag)
        t = g("title")
        title = _clean(t.text if t is not None else "", 200)
        pd = it.find("pubDate") if it.find("pubDate") is not None else (it.find(A + "updated") if it.find(A + "updated") is not None else it.find(A + "published"))
        ts = 0
        try:
            ts = email.utils.parsedate_to_datetime(pd.text).timestamp()
        except Exception:
            try:
                ts = datetime.datetime.fromisoformat(pd.text.strip().replace("Z", "+00:00")).timestamp()
            except Exception:
                pass
        body = None
        for tag in ("description", C + "encoded", A + "summary", A + "content"):
            e = it.find(tag)
            if e is not None and (e.text or "").strip():
                body = e.text
                break
        summ = _clean(body, 170)
        if summ.lower().startswith(title.lower()[:40]):
            summ = summ[len(title):].lstrip(" -–:.")
        if title and (not ts or now - ts < max_age):
            out.append({"title": title, "summary": summ if len(summ) > 25 else "", "source": name, "ts": ts})
    out.sort(key=lambda x: -x["ts"])
    return out[:limit]

def news():
    def build():
        feeds = [(f["name"], f["url"]) for f in CONFIG.get("news_feeds", [])] or NEWS_FEEDS
        lists = []
        for name, url in feeds:
            try:
                lists.append(_parse_feed(fetch(url, 10), name))
            except Exception as e:
                print("news feed failed:", name, e, file=sys.stderr)
        items, i = [], 0
        while any(i < len(l) for l in lists):           # round-robin so no single source dominates
            items += [l[i] for l in lists if i < len(l)]
            i += 1
        return {"items": items[:30], "updated": time.time()}
    return cached("news", 600, build)

def _lead(kind, cat, limit=10):
    data = get_json("/%s-stats-leaders/current?categories=%s&limit=%d" % (kind, cat, limit))
    rows = []
    for p in data.get(cat, []):
        fn, ln = d(p.get("firstName")), d(p.get("lastName"))
        rows.append({"id": p.get("id"), "name": (fn[:1] + ". " + ln) if fn else ln, "num": p.get("sweaterNumber"), "abbrev": p.get("teamAbbrev"),
                     "logo": p.get("teamLogo"), "headshot": p.get("headshot"), "pos": p.get("position"), "value": p.get("value")})
    return rows

def leaders():
    def build():
        out = {"skaters": {}, "goalies": {}, "updated": time.time()}
        for cat in ("points", "goals", "assists", "plusMinus"):
            try: out["skaters"][cat] = _lead("skater", cat)
            except Exception as e: print("leaders failed:", cat, e, file=sys.stderr)
        for cat in ("wins", "savePctg", "goalsAgainstAverage"):
            try: out["goalies"][cat] = _lead("goalie", cat, 8)
            except Exception as e: print("leaders failed:", cat, e, file=sys.stderr)
        return out
    return cached("leaders", 300, build)

def videos():
    """Latest uploads from YouTube channel RSS feeds (no API key), limited to the last 24 hours."""
    def build():
        import xml.etree.ElementTree as ET, datetime
        A, Y = "{http://www.w3.org/2005/Atom}", "{http://www.youtube.com/xml/schemas/2015}"
        chans = CONFIG.get("video_channels") or [{"name": "NHL", "id": "UCqFMzb-4AUf6WAIbl132QKA"}]
        hours = CONFIG.get("video_max_age_hours", 24)
        vids = []
        for ch in chans:
            try:
                root = ET.fromstring(fetch("https://www.youtube.com/feeds/videos.xml?channel_id=" + ch["id"], 10).strip())
            except Exception as e:
                print("video feed failed:", ch.get("name"), e, file=sys.stderr)
                continue
            for en in root.iter(A + "entry"):
                vid, pub, ti = en.find(Y + "videoId"), en.find(A + "published"), en.find(A + "title")
                if vid is None or pub is None:
                    continue
                ts = datetime.datetime.fromisoformat(pub.text.strip().replace("Z", "+00:00")).timestamp()
                if time.time() - ts <= hours * 3600:
                    vids.append({"id": vid.text, "title": ti.text if ti is not None else "", "channel": ch.get("name", ""), "ts": ts})
        vids.sort(key=lambda v: -v["ts"])
        vids = vids[:15]
        embed = None
        if vids:
            embed = "https://www.youtube.com/embed/%s?playlist=%s&autoplay=1&mute=1&loop=1&rel=0" % (vids[0]["id"], ",".join(v["id"] for v in vids[1:]) or vids[0]["id"])
        return {"videos": vids, "embed": embed, "hours": hours}
    return cached("videos", 600, build)

BC_ACCT = "6415718365001"

def clip(cid):
    """Resolve an NHL highlight clip id to a plain MP4 via Brightcove's playback API (no ad player)."""
    if not str(cid).isdigit():
        raise ValueError("bad clip id")
    def policy_key():
        cfg = json.loads(fetch("https://players.brightcove.net/%s/default_default/config.json" % BC_ACCT))
        return cfg["video_cloud"]["policy_key"]
    def build():
        for attempt in (0, 1):
            pk = cached("bc-pk", 86400, policy_key)
            try:
                raw = json.loads(fetch("https://edge.api.brightcove.com/playback/v1/accounts/%s/videos/%s" % (BC_ACCT, cid),
                                       headers={**UA, "Accept": "application/json;pk=" + pk}))
                break
            except urllib.error.HTTPError as e:
                if e.code in (401, 403) and attempt == 0:
                    with _lock:
                        _cache.pop("bc-pk", None)
                    continue
                raise
        mp4 = [x for x in raw.get("sources", []) if str(x.get("src", "")).startswith("https") and (x.get("container") == "MP4" or ".mp4" in x.get("src", ""))]
        mp4.sort(key=lambda x: (x.get("height") or 0) <= 720 and (x.get("height") or 0), reverse=True)
        return {"mp4": mp4[0]["src"] if mp4 else None, "poster": raw.get("poster"), "name": raw.get("name"),
                "duration": (raw.get("duration") or 0) / 1000.0}
    return cached("clip:%s" % cid, 1500, build)

STATS = "https://api.nhle.com/stats/rest/en/team/%s?cayenneExp=seasonId=%s%%20and%%20gameTypeId=2"

def team_stats():
    def build():
        y = time.gmtime().tm_year if time.gmtime().tm_mon >= 7 else time.gmtime().tm_year - 1
        sid = "%d%d" % (y, y + 1)
        out = {}
        for kind in ("summary", "percentages"):
            try:
                rows = json.loads(fetch(STATS % (kind, sid))).get("data", [])
            except Exception as e:
                print("team stats failed:", kind, e, file=sys.stderr)
                continue
            for r in rows:
                out.setdefault(r["teamId"], {"name": r.get("teamFullName", "")}).update(r)
        return out
    return cached("teamstats", 900, build)

def preview(gid):
    def build():
        L = get_json("/gamecenter/%s/landing" % gid)
        m = L.get("matchup") or {}
        ts = team_stats()
        stand = {t["abbrev"]: t for t in standings()["teams"]}
        sk_all = (m.get("skaterSeasonStats") or {}).get("skaters", [])
        gl_all = (m.get("goalieSeasonStats") or {}).get("goalies", [])
        gc = m.get("goalieComparison") or {}
        lc = (m.get("skaterComparison") or {}).get("leaders", [])
        def toi(p):
            try:
                a, b = (p.get("avgTimeOnIce") or "0:0").split(":")
                return int(a) * 60 + int(b)
            except Exception:
                return 0
        def person(p):
            return {"name": d(p.get("name")) or ("%s. %s" % (d(p.get("firstName"))[:1], d(p.get("lastName")))), "num": p.get("sweaterNumber"),
                    "pos": p.get("position") or p.get("positionCode"), "gp": p.get("gamesPlayed"), "g": p.get("goals"), "a": p.get("assists"),
                    "p": p.get("points"), "toi": p.get("avgTimeOnIce")}
        sides = {}
        for side in ("away", "home"):
            t = L.get(side + "Team", {})
            ab = t.get("abbrev")
            nm = d(t.get("commonName"))
            tid = t.get("id")
            st = ts.get(tid)
            if not st:
                st = next((v for v in ts.values() if nm and v.get("name", "").endswith(nm)), {})
                tid = st.get("teamId", tid)
            sk = [p for p in sk_all if p.get("teamId") == tid and toi(p)]
            fw = sorted([p for p in sk if p.get("position") in ("C", "L", "R")], key=lambda p: -toi(p))[:12]
            df = sorted([p for p in sk if p.get("position") == "D"], key=lambda p: -toi(p))[:6]
            lines = [[person(p) for p in fw[i:i + 3]] for i in range(0, len(fw), 3)]
            pairs = [[person(p) for p in df[i:i + 2]] for i in range(0, len(df), 2)]
            gl = []
            for g in (gc.get(side + "Team") or {}).get("leaders", [])[:2]:
                gl.append({"name": d(g.get("name")) or ("%s. %s" % (d(g.get("firstName"))[:1], d(g.get("lastName")))), "num": g.get("sweaterNumber"),
                           "record": g.get("record"), "gaa": g.get("gaa"), "svp": g.get("savePctg"), "gp": g.get("gamesPlayed")})
            if not gl:
                for g in sorted([g for g in gl_all if g.get("teamId") == tid and g.get("gamesPlayed")], key=lambda g: -g["gamesPlayed"])[:2]:
                    gl.append({"name": d(g.get("name")), "num": g.get("sweaterNumber"), "record": "%s-%s-%s" % (g.get("wins"), g.get("losses"), g.get("otLosses")),
                               "gaa": g.get("goalsAgainstAvg"), "svp": g.get("savePctg"), "gp": g.get("gamesPlayed")})
            hot = []
            for c in lc[:4]:
                p = c.get(side + "Leader")
                if p:
                    hot.append({"cat": c.get("category"), "name": d(p.get("name")) or ("%s. %s" % (d(p.get("firstName"))[:1], d(p.get("lastName")))), "value": p.get("value"), "num": p.get("sweaterNumber")})
            s2 = stand.get(ab, {})
            sides[side] = {"abbrev": ab, "name": nm, "logo": t.get("logo"), "record": t.get("record"),
                           "stats": {"gp": st.get("gamesPlayed"), "pts": st.get("points"), "ptsPct": st.get("pointPct"), "gf": st.get("goalsForPerGame"), "ga": st.get("goalsAgainstPerGame"),
                                     "pp": st.get("powerPlayPct"), "pk": st.get("penaltyKillPct"), "sf": st.get("shotsForPerGame"), "sa": st.get("shotsAgainstPerGame"),
                                     "fo": st.get("faceoffWinPct"), "sat": st.get("satPct"), "xgf": st.get("goalsForPct"), "pdo": st.get("shootingPlusSavePct5v5"), "zs": st.get("zoneStartPct5v5"),
                                     "rank": s2.get("leagueSeq"), "divSeq": s2.get("divSeq"), "div": s2.get("div"), "streak": s2.get("streak"), "l10": s2.get("l10")},
                           "goalies": gl, "lines": lines, "pairs": pairs, "hot": hot}
        return {"id": gid, "start": L.get("startTimeUTC"), "venue": d(L.get("venue")), "tv": [b.get("network") for b in L.get("tvBroadcasts", []) if b.get("network")][:4],
                "state": L.get("gameState"), "away": sides["away"], "home": sides["home"]}
    return cached("preview:%s" % gid, 600, build)

ESPN_ABBR = {"NJ": "NJD", "TB": "TBL", "SJ": "SJS", "LA": "LAK", "UTAH": "UTA", "WAS": "WSH", "LV": "VGK"}

def transactions():
    def build():
        raw = json.loads(fetch("https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/transactions?limit=80"))
        rows = []
        for t in raw.get("transactions", []):
            tm = t.get("team") or {}
            ab = ESPN_ABBR.get(tm.get("abbreviation"), tm.get("abbreviation"))
            desc = t.get("description", "")
            low = desc.lower()
            kind = ("TRADE" if low.startswith("acquired") or "traded" in low else "SIGNING" if low.startswith("signed") or "contract" in low else
                    "WAIVERS" if "waiver" in low or "claimed" in low or "waived" in low else "IR" if "injured reserve" in low or "placed" in low else
                    "RECALL" if "recalled" in low else "ASSIGNED" if "assigned" in low or "reassigned" in low else "MOVE")
            rows.append({"date": (t.get("date") or "")[:10], "abbrev": ab, "team": tm.get("name") or tm.get("displayName") or "",
                         "logo": "https://assets.nhle.com/logos/nhl/svg/%s_light.svg" % ab if ab else "", "text": desc, "kind": kind})
        rows.sort(key=lambda r: r["date"], reverse=True)
        return {"items": rows[:40], "updated": time.time()}
    return cached("transactions", 900, build)

def embeddable(url):
    """Best-effort check of whether a site allows itself to be shown in an iframe."""
    def probe():
        if url.startswith("/"):
            return {"url": url, "embeddable": True, "reason": "same origin"}
        # only probe hosts you configured (stops this local endpoint being used to fetch arbitrary URLs)
        host = urllib.parse.urlparse(url).hostname or ""
        allowed = {urllib.parse.urlparse(v.get("url", "")).hostname for v in CONFIG.get("video_sources", [])} | {"www.youtube.com"}
        if urllib.parse.urlparse(url).scheme != "https" or host not in allowed:
            return {"url": url, "embeddable": False, "reason": "host not in config.json video_sources"}
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA["User-Agent"], "Accept": "text/html"})
            with urllib.request.urlopen(req, timeout=10) as r:
                xfo = (r.headers.get("X-Frame-Options") or "").lower()
                csp = (r.headers.get("Content-Security-Policy") or "").lower()
        except urllib.error.HTTPError as e:
            xfo, csp = (e.headers.get("X-Frame-Options") or "").lower(), (e.headers.get("Content-Security-Policy") or "").lower()
            if e.code >= 400 and not (xfo or csp):
                return {"url": url, "embeddable": False, "reason": "HTTP %d" % e.code}
        except Exception as e:
            return {"url": url, "embeddable": False, "reason": str(e)[:80]}
        if xfo in ("deny", "sameorigin") or xfo.startswith("allow-from"):
            return {"url": url, "embeddable": False, "reason": "X-Frame-Options: " + xfo}
        if "frame-ancestors" in csp:
            part = csp.split("frame-ancestors", 1)[1].split(";", 1)[0]
            if "*" not in part and "localhost" not in part and "http:" not in part:
                return {"url": url, "embeddable": False, "reason": "CSP frame-ancestors" + part}
        return {"url": url, "embeddable": True, "reason": "no framing block found"}
    return cached("embed:" + url, 6 * 3600, probe)

# ---------------------------------------------------------------- HTTP
CONFIG = json.load(open(os.path.join(HERE, "config.json")))
if os.environ.get("NHL_HUB_PORT", "").isdigit():
    CONFIG["port"] = int(os.environ["NHL_HUB_PORT"])
if os.environ.get("NHL_HUB_FAVOURITE"):
    CONFIG["favourite"] = os.environ["NHL_HUB_FAVOURITE"].strip().upper()
DEMO = False

class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def log_message(self, *a):
        pass

    def send(self, code, body, ctype="application/json", cache="no-store"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        p = u.path
        try:
            if p.startswith("/api/"):
                return self.api(p, urllib.parse.parse_qs(u.query))
            rel = "index.html" if p in ("/", "") else p.lstrip("/")
            full = os.path.realpath(os.path.join(WEB, rel))
            if not full.startswith(os.path.realpath(WEB)) or not os.path.isfile(full):
                return self.send(404, {"error": "not found"})
            ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
            if ctype.startswith("text/") or ctype in ("application/javascript",):
                ctype += "; charset=utf-8"
            return self.send(200, open(full, "rb").read(), ctype)
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as e:
            print("error:", p, repr(e), file=sys.stderr)
            try:
                self.send(502, {"error": str(e)})
            except Exception:
                pass

    def api(self, p, q):
        src = DemoData if DEMO else sys.modules[__name__]
        if p == "/api/config":
            cfg = dict(CONFIG)
            if DEMO:
                cfg["video_sources"] = [{"name": "DEMO CLIP", "url": "/demo-video.html"}]
                pass
            cfg["demo"] = DEMO
            cfg["version"] = VERSION
            return self.send(200, cfg)
        if p == "/api/scores":
            return self.send(200, src.scores())
        if p == "/api/standings":
            return self.send(200, src.standings())
        if p.startswith("/api/game/"):
            return self.send(200, src.game_detail(p.rsplit("/", 1)[1]))
        if p.startswith("/api/club/"):
            return self.send(200, src.club(p.rsplit("/", 1)[1].upper()))
        if p == "/api/leaders":
            return self.send(200, src.leaders())
        if p == "/api/videos":
            return self.send(200, src.videos())
        if p.startswith("/api/clip/"):
            if DEMO:
                demo = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "demo-clip.webm")
                return self.send(200, {"mp4": "/demo-clip.webm" if os.path.exists(demo) else None, "poster": None})
            return self.send(200, clip(p.rsplit("/", 1)[1]))
        if p.startswith("/api/preview/"):
            return self.send(200, src.preview(p.rsplit("/", 1)[1]))
        if p == "/api/transactions":
            return self.send(200, src.transactions())
        if p == "/api/news":
            return self.send(200, src.news())
        if p == "/api/embed":
            url = (q.get("url") or [""])[0]
            return self.send(200, embeddable(url))
        return self.send(404, {"error": "unknown endpoint"})

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=CONFIG.get("port", 8765))
    ap.add_argument("--demo", action="store_true", help="serve built-in sample data (no internet needed)")
    a = ap.parse_args()
    if a.demo:
        DEMO = True
        sys.path.insert(0, HERE)
        import demo as DemoData
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), H)
    print("NHL Hub on http://127.0.0.1:%d%s" % (a.port, "  [DEMO DATA]" if DEMO else ""), flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
