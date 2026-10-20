"""Built-in sample data for `server.py --demo` (offline preview). Player names are generic placeholders."""
import random, time

DIVS = {
    ("Eastern", "E", "Atlantic", "A"): ["BOS", "BUF", "DET", "FLA", "MTL", "OTT", "TBL", "TOR"],
    ("Eastern", "E", "Metropolitan", "M"): ["CAR", "CBJ", "NJD", "NYI", "NYR", "PHI", "PIT", "WSH"],
    ("Western", "W", "Central", "C"): ["CHI", "COL", "DAL", "MIN", "NSH", "STL", "UTA", "WPG"],
    ("Western", "W", "Pacific", "P"): ["ANA", "CGY", "EDM", "LAK", "SJS", "SEA", "VAN", "VGK"],
}
NAMES = {"ANA": "Ducks", "BOS": "Bruins", "BUF": "Sabres", "CGY": "Flames", "CAR": "Hurricanes", "CHI": "Blackhawks",
         "COL": "Avalanche", "CBJ": "Blue Jackets", "DAL": "Stars", "DET": "Red Wings", "EDM": "Oilers", "FLA": "Panthers",
         "LAK": "Kings", "MIN": "Wild", "MTL": "Canadiens", "NSH": "Predators", "NJD": "Devils", "NYI": "Islanders",
         "NYR": "Rangers", "OTT": "Senators", "PHI": "Flyers", "PIT": "Penguins", "SEA": "Kraken", "SJS": "Sharks",
         "STL": "Blues", "TBL": "Lightning", "TOR": "Maple Leafs", "UTA": "Mammoth", "VAN": "Canucks", "VGK": "Golden Knights",
         "WSH": "Capitals", "WPG": "Jets"}

def logo(a):
    return "https://assets.nhle.com/logos/nhl/svg/%s_light.svg" % a

def standings():
    rnd = random.Random(7)
    teams = []
    for (conf, ca, div, da), abbrs in DIVS.items():
        for a in abbrs:
            gp = rnd.randint(8, 10)
            w = rnd.randint(2, gp - 1)
            otl = rnd.randint(0, min(3, gp - w))
            l = gp - w - otl
            gf = rnd.randint(20, 44)
            ga = rnd.randint(20, 44)
            teams.append({"abbrev": a, "name": NAMES[a], "logo": logo(a), "div": div, "divAbbrev": da, "conf": conf, "confAbbrev": ca,
                          "gp": gp, "w": w, "l": l, "otl": otl, "pts": 2 * w + otl, "pct": round((2 * w + otl) / (2 * gp), 3),
                          "row": max(0, w - rnd.randint(0, 2)), "gf": gf, "ga": ga, "diff": gf - ga,
                          "streak": rnd.choice("WL") + str(rnd.randint(1, 4)),
                          "l10": "%d-%d-%d" % (min(w, 7), min(l, 3), min(otl, 2)), "wc": 0, "divSeq": 0, "confSeq": 0, "leagueSeq": 0})
    key = lambda t: (-t["pts"], -t["row"], -t["diff"])
    for t in teams:
        pass
    for div in {t["div"] for t in teams}:
        for i, t in enumerate(sorted([t for t in teams if t["div"] == div], key=key), 1):
            t["divSeq"] = i
    for conf in ("Eastern", "Western"):
        ct = sorted([t for t in teams if t["conf"] == conf], key=key)
        for i, t in enumerate(ct, 1):
            t["confSeq"] = i
        rest = [t for t in ct if t["divSeq"] > 3]
        for i, t in enumerate(rest, 1):
            t["wc"] = i
    for i, t in enumerate(sorted(teams, key=key), 1):
        t["leagueSeq"] = i
    return {"teams": teams, "updated": time.time()}

def tb(a, score, sog=None, record=""):
    return {"abbrev": a, "name": NAMES[a], "logo": logo(a), "score": score, "sog": sog, "record": record}

def gm(gid, away, home, state, start, **kw):
    g = {"id": gid, "state": state, "start": start, "away": away, "home": home, "period": None, "ptype": "", "clock": "",
         "intermission": False, "venue": "Demo Arena", "link": ""}
    g.update(kw)
    return g

GAMES = {
    "2026020135": gm("2026020135", tb("BUF", 3, 38, "3-3-1"), tb("MTL", 4, 17, "3-2-1"), "OFF", "2026-10-18T23:00:00Z", period=4, ptype="SO"),
    "2026020136": gm("2026020136", tb("CAR", 2, 24, "5-3-0"), tb("CGY", 3, 29, "4-4-1"), "OFF", "2026-10-18T21:00:00Z", period=3, ptype="REG"),
    "2026020138": gm("2026020138", tb("COL", 2, 22, "5-2-1"), tb("PHI", 1, 19, "1-6-3"), "LIVE", "2026-10-19T23:00:00Z", period=2, ptype="REG", clock="07:41"),
    "2026020137": gm("2026020137", tb("ANA", None, None, "4-3-0"), tb("NYR", None, None, "6-3-1"), "FUT", "2026-10-19T23:00:00Z"),
    "2026020139": gm("2026020139", tb("SJS", None, None, "4-3-1"), tb("TOR", None, None, "3-4-2"), "FUT", "2026-10-20T00:30:00Z"),
    "2026020140": gm("2026020140", tb("PIT", None, None, "3-5-1"), tb("UTA", None, None, "6-3-0"), "FUT", "2026-10-20T02:00:00Z"),
    "2026020141": gm("2026020141", tb("SJS", None, None, "4-3-1"), tb("MTL", None, None, "3-2-1"), "FUT", "2026-10-20T23:00:00Z"),
}
DAYS = [("2026-10-18", ["2026020135", "2026020136"]), ("2026-10-19", ["2026020138", "2026020137", "2026020139", "2026020140"]), ("2026-10-20", ["2026020141"])]

def scores():
    return {"days": [{"date": d, "games": [GAMES[i] for i in ids]} for d, ids in DAYS], "current": "2026-10-19", "updated": time.time()}

_SUR = ["Archer", "Beaulieu", "Novak", "Larsen", "Okafor", "Tremblay", "Koval", "Murray", "Reyes", "Haas", "Dufour", "Lindqvist",
        "Pavlik", "Sato", "Brandt", "Costa", "Ivanov", "Walsh", "Greer", "Moreau", "Kline", "Petrov", "Nash", "Ellis"]

def roster(abbr, seed, final):
    rnd = random.Random(seed)
    names = _SUR[:]
    rnd.shuffle(names)
    def sk(i, pos):
        g, a = (rnd.choice([0, 0, 0, 1, 1, 2]) if final else rnd.choice([0, 0, 0, 0, 1])), rnd.choice([0, 0, 0, 1, 1, 2])
        m, s = rnd.randint(9, 22), rnd.randint(0, 59)
        return {"id": seed * 100 + i, "n": rnd.randint(2, 97), "name": "%s. %s" % (chr(65 + rnd.randint(0, 25)), names[i % len(names)]),
                "pos": pos, "g": g, "a": a, "p": g + a, "pm": rnd.randint(-2, 2), "sog": rnd.randint(0, 6), "hit": rnd.randint(0, 5),
                "blk": rnd.randint(0, 4), "pim": rnd.choice([0, 0, 0, 2]), "toi": "%02d:%02d" % (m, s),
                "fo": round(rnd.random(), 3) if pos == "C" else None, "ppg": 0, "gv": rnd.randint(0, 3), "tk": rnd.randint(0, 3)}
    fw = [sk(i, ("C", "L", "R")[i % 3]) for i in range(12)]
    df = [sk(12 + i, "D") for i in range(6)]
    return fw, df

def goalie_line(seed, sa, ga, name):
    sv = sa - ga
    return {"id": seed, "n": 30, "name": name, "sa": sa, "sv": sv, "svp": round(sv / sa, 3) if sa else None, "ga": ga, "toi": "60:00",
            "dec": "W", "starter": True}

def team_side(g, key, seed, ga_opp, sa):
    t = g[key]
    fw, df = roster(t["abbrev"], seed, g["state"] != "LIVE")
    return {"id": seed, "abbrev": t["abbrev"], "name": t["name"], "place": t["name"], "logo": t["logo"], "score": t["score"], "sog": t["sog"],
            "forwards": fw, "defense": df, "goalies": [goalie_line(seed + 900, sa, ga_opp, "G. Netminder")], "pp": None}

def game_detail(gid):
    g = GAMES[gid]
    st = g["state"]
    a, h = g["away"], g["home"]
    out = {"id": gid, "state": st, "venue": "Demo Arena", "start": g["start"], "period": g["period"], "ptype": g["ptype"],
           "last_period_type": g["ptype"] if st != "LIVE" else "", "clock": g["clock"], "intermission": False, "tv": ["DEMO TV"]}
    out["away"] = team_side(g, "away", int(gid[-3:]), h["score"] or 0, (h["sog"] or 20))
    out["home"] = team_side(g, "home", int(gid[-3:]) + 1, a["score"] or 0, (a["sog"] or 20))
    goals = []
    rnd = random.Random(int(gid[-3:]))
    seq = []
    scoreA = scoreH = 0
    tot = [("away", a["score"] or 0), ("home", h["score"] or 0)]
    # count regulation goals (shootout winner not a listed goal)
    reg = {"away": a["score"] or 0, "home": h["score"] or 0}
    if g["ptype"] == "SO":
        m = min(reg.values())
        reg = {"away": m, "home": m}
    events = ["away"] * reg["away"] + ["home"] * reg["home"]
    rnd.shuffle(events)
    for i, side in enumerate(events):
        per = ["1", "1", "2", "2", "3", "3", "3"][i % 7] if st != "LIVE" else ["1", "1", "2"][i % 3]
        if side == "away":
            scoreA += 1
        else:
            scoreH += 1
        team = out[side]
        p = rnd.choice(team["forwards"])
        asst = [rnd.choice(team["forwards"] + team["defense"])["name"] for _ in range(rnd.choice([1, 2]))]
        goals.append({"period": per, "time": "%02d:%02d" % (rnd.randint(1, 18), rnd.randint(0, 59)), "team": team["abbrev"], "scorer": p["name"],
                      "tally": rnd.randint(1, 4), "strength": rnd.choice(["ev", "ev", "pp", "sh"]), "mod": "", "shot": "wrist",
                      "assists": asst, "away": scoreA, "home": scoreH, "clip": 6407063317112, "url": ""})
    goals.sort(key=lambda x: (x["period"], x["time"]))
    out["goals"] = goals
    out["penalties"] = [{"period": "1", "time": "08:12", "team": out["away"]["abbrev"], "player": "A. Archer", "type": "tripping", "min": 2},
                        {"period": "2", "time": "14:03", "team": out["home"]["abbrev"], "player": "M. Novak", "type": "hooking", "min": 2}]
    out["stars"] = [{"star": 1, "name": goals[0]["scorer"] if goals else "-", "team": goals[0]["team"] if goals else "", "pos": "C"}] if goals else []
    periods = ["1", "2", "3"] + (["OT"] if g["ptype"] in ("OT", "SO") else []) + (["SO"] if g["ptype"] == "SO" else [])
    if st == "LIVE":
        periods = ["1", "2", "3"]
    ls = {p: {"away": 0, "home": 0} for p in periods}
    for gl in goals:
        ls.setdefault(gl["period"], {"away": 0, "home": 0})["away" if gl["team"] == out["away"]["abbrev"] else "home"] += 1
    if "SO" in ls:
        ls["SO"] = {"away": None, "home": None}
    out["periods"], out["linescore"] = periods, ls
    out["sog_by_period"] = {p: {"away": rnd.randint(4, 14), "home": rnd.randint(4, 14)} for p in periods if p != "SO"}
    out["now"] = time.time()
    return out

def club(abbr):
    nxt = GAMES["2026020141"]
    return {"abbr": abbr, "last": {"id": "2026020135", "date": "2026-10-18", "start": "2026-10-18T23:00:00Z", "state": "OFF", "venue": "Demo Arena",
                                   "last_period_type": "SO", "away": {"abbrev": "BUF", "score": 3, "logo": logo("BUF")}, "home": {"abbrev": "MTL", "score": 4, "logo": logo("MTL")}},
            "next": [{"id": nxt["id"], "date": "2026-10-20", "start": nxt["start"], "state": "FUT", "venue": "Centre Bell", "last_period_type": "",
                      "away": {"abbrev": "SJS", "score": None, "logo": logo("SJS")}, "home": {"abbrev": "MTL", "score": None, "logo": logo("MTL")}}]}


def news():
    heads = [("Sportsnet", "Demo headline: Canadiens climb the Atlantic with a shootout win"), ("THN", "Demo headline: Power rankings after the first two weeks"),
             ("Spector's", "Demo headline: Trade chatter heats up around the cap crunch"), ("Habs EOTP", "Demo headline: Prospect report from the AHL"),
             ("Sportsnet", "Demo headline: Goalie injury updates across the league"), ("THN", "Demo headline: Rookies making the early noise")]
    return {"items": [{"title": t, "source": s, "ts": 0, "summary": "Demo summary sentence giving a little more context about the story so you know what it is about."} for s, t in heads], "updated": time.time()}


def _rows(vals, rnd, fmt=None):
    ab = list(NAMES)
    return [{"id": 9000 + i, "name": "%s. %s" % (chr(65 + rnd.randint(0, 25)), ["Archer", "Novak", "Reyes", "Okafor", "Larsen", "Brandt", "Haas", "Walsh", "Petrov", "Koval"][i % 10]),
             "num": rnd.randint(2, 97), "abbrev": ab[(i * 5 + 3) % 32], "logo": logo(ab[(i * 5 + 3) % 32]), "headshot": "", "pos": "C", "value": v} for i, v in enumerate(vals)]

def leaders():
    import random
    rnd = random.Random(3)
    return {"skaters": {"points": _rows([23, 18, 17, 16, 15, 14, 14, 13, 12, 12], rnd), "goals": _rows([11, 10, 9, 8, 8, 7, 7, 6, 6, 6], rnd),
                        "assists": _rows([16, 14, 13, 12, 12, 11, 10, 10, 9, 9], rnd), "plusMinus": _rows([9, 8, 8, 7, 7, 6, 6, 6, 5, 5], rnd)},
            "goalies": {"wins": _rows([6, 6, 5, 5, 5, 4, 4, 4], rnd), "savePctg": _rows([.945, .938, .932, .929, .925, .921, .918, .915], rnd),
                        "goalsAgainstAverage": _rows([1.62, 1.75, 1.88, 1.93, 2.01, 2.08, 2.1, 2.15], rnd)}, "updated": time.time()}

def videos():
    return {"videos": [], "embed": None, "hours": 24}


def preview(gid):
    import random
    g = GAMES.get(str(gid)) or list(GAMES.values())[-1]
    rnd = random.Random(int(gid) % 997)
    last = ["Archer", "Novak", "Reyes", "Okafor", "Larsen", "Brandt", "Haas", "Walsh", "Petrov", "Koval", "Dufour", "Murray", "Kline", "Costa", "Ellis", "Greer"]
    def side(t):
        ab = t["abbrev"]
        ps = lambda n, pos: [{"name": "%s. %s" % (chr(65 + rnd.randint(0, 25)), rnd.choice(last)), "num": rnd.randint(2, 97), "pos": pos, "gp": 8, "g": rnd.randint(0, 5), "a": rnd.randint(0, 6), "p": rnd.randint(1, 9), "toi": "%d:%02d" % (rnd.randint(14, 21), rnd.randint(0, 59))} for _ in range(n)]
        return {"abbrev": ab, "name": NAMES[ab], "logo": logo(ab), "record": t.get("record") or "4-3-1",
                "stats": {"gp": 8, "pts": rnd.randint(6, 14), "ptsPct": round(rnd.uniform(.4, .8), 3), "gf": round(rnd.uniform(2.4, 3.8), 2), "ga": round(rnd.uniform(2.4, 3.8), 2),
                          "pp": round(rnd.uniform(.12, .3), 3), "pk": round(rnd.uniform(.7, .9), 3), "sf": round(rnd.uniform(26, 34), 1), "sa": round(rnd.uniform(26, 34), 1),
                          "fo": round(rnd.uniform(.46, .54), 3), "sat": round(rnd.uniform(.45, .56), 3), "xgf": round(rnd.uniform(.4, .6), 3), "pdo": round(rnd.uniform(.95, 1.05), 3), "zs": .5,
                          "rank": rnd.randint(1, 32), "divSeq": rnd.randint(1, 8), "div": "Atlantic", "streak": rnd.choice(["W2", "L1", "W3"]), "l10": "6-3-1"},
                "goalies": [{"name": "G. Netminder", "num": 30, "record": "3-1-0", "gaa": 2.41, "svp": .921, "gp": 4}, {"name": "B. Backup", "num": 35, "record": "1-2-0", "gaa": 3.1, "svp": .9, "gp": 3}],
                "lines": [ps(3, "F") for _ in range(4)], "pairs": [ps(2, "D") for _ in range(3)],
                "hot": [{"cat": "points", "name": "A. Star", "value": 6, "num": 9}, {"cat": "goals", "name": "B. Sniper", "value": 3, "num": 22}]}
    return {"id": str(gid), "start": g["start"], "venue": g.get("venue", ""), "tv": ["DEMO TV"], "state": "FUT", "away": side(g["away"]), "home": side(g["home"])}

def transactions():
    rows = []
    items = [("MTL", "Acquired D Demo Player from Boston for a 2027 fourth-round pick.", "TRADE"), ("EDM", "Signed F Demo Skater to a two-year contract.", "SIGNING"),
             ("CHI", "Placed G Demo Goalie on injured reserve.", "IR"), ("SEA", "Recalled F Demo Rookie from Coachella Valley.", "RECALL"),
             ("NYR", "Claimed D Demo Blueliner off waivers from Buffalo.", "WAIVERS"), ("COL", "Assigned F Demo Prospect to Colorado (AHL).", "ASSIGNED")] * 3
    for i, (a, t, k) in enumerate(items):
        rows.append({"date": "2026-10-%02d" % (19 - i // 4), "abbrev": a, "team": NAMES[a], "logo": logo(a), "text": t, "kind": k})
    return {"items": rows, "updated": time.time()}
