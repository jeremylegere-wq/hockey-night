# Hockey Night

A full-screen, 16:9 NHL dashboard for a spare screen or TV. It cycles through live scores and full box
scores, division and wild-card standings, league leaders, game previews and league transactions, with a
scrolling ticker for news, goals and scores, plus a video panel and story-style goal reels.

> Status: **v1.0.0-beta**. Built and tested against sample data; live-data behaviour is still being verified.
> See [CHANGELOG.md](CHANGELOG.md).

## Features
- Box scores in a broadcast style: team blocks with records, scoring, three stars, top skaters, goalie lines
- Standings: division and wild card; league leaders (rotating category each cycle)
- Game previews (cycle 2): team and advanced stats, projected lines, goalie matchup
- League transactions (cycle 5)
- Three tickers: news (with summaries), goals, and scores plus upcoming games
- Video panel (NHL YouTube, last 24 hours) and goal reels (NHL highlight clips, game by game)
- Goal alerts, keyboard controls, 1920x1080 stage that scales to any 16:9 screen
- `--demo` mode with built-in sample data (no internet needed)

## Prerequisites
- Linux (developed on Ubuntu), macOS should also work for the server
- Python 3.9+ (standard library only, no `pip install` needed)
- Firefox (the launcher uses `--kiosk`; any modern browser works if you open the URL yourself)
- Internet access for live data

## Install
```bash
git clone https://github.com/jeremylegere-wq/hockey-night.git
cd hockey-night
./install.sh            # installs to ~/.local/share/nhl-hub-app, adds app-grid + desktop icon
```

## Run locally
```bash
nhl-hub                 # full-screen kiosk (Ctrl+Q to quit)
nhl-hub --demo          # sample data, works offline

# or, without installing:
python3 server.py --demo        # then open http://127.0.0.1:8765/
python3 server.py --port 9000
```

Keyboard: `<-`/`->` change screen, `Space` pause, `V` next video source, `R` refresh, `F` fullscreen.

## Configuration
Settings live in `config.json` (favourite team, screen durations, video channels and sources, news feeds).
Optional overrides go in a `.env` file (copy `.env.example`); real environment variables win over `.env`.

| Setting | Where | Purpose |
|---|---|---|
| `favourite` / `NHL_HUB_FAVOURITE` | config / env | Team highlighted everywhere |
| `port` / `NHL_HUB_PORT` | config / env | Local server port |
| `scene_seconds` | config | Seconds per screen type |
| `video_channels`, `video_max_age_hours` | config | YouTube channels and age limit for the video panel |
| `news_feeds` | config | List of `{ "name", "url" }` RSS feeds (defaults built in) |
| `goal_player_url`, `reel_seconds`, `reel_fit` | config | Goal reel player fallback, timing, `cover`/`contain` |

## Data sources and security
There are no API keys or credentials in this project; everything comes from public endpoints (NHL web and
stats APIs, public RSS feeds, YouTube channel RSS, ESPN's public transactions feed, NHL's Brightcove clips).
The server binds to `127.0.0.1` only. See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) for every outbound call
and the local endpoints. This app does not receive webhooks.

## Project layout
```
server.py        local server: serves web/ and proxies/normalises data (stdlib only)
demo.py          offline sample data
web/             index.html, app.css, app.js (the full-screen front end)
nhl-hub          launcher (server + Firefox kiosk)
install.sh       installer (app grid entry, desktop icon)
config.json      defaults
```

## Disclaimer
Unofficial fan project, not affiliated with or endorsed by the NHL or any team. Team names and logos are
loaded at runtime from the NHL's public asset URLs and remain the property of their owners. Check each data
provider's terms before any public or commercial use.

## Licence
MIT, see [LICENSE](LICENSE).
