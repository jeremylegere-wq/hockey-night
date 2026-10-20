# Data sources, local endpoints and webhooks

## Outbound data (all public, no API keys)
Line numbers refer to `server.py` for v1.0.0-beta unless a file is named.

| Data | Function (lines) | Source URL(s) |
|---|---|---|
| Scores (yesterday, today, tomorrow) | `scores()` 78-90 | `https://api-web.nhle.com/v1/score/now`, `/score/{date}` (base URL line 25) |
| Box score detail | `game_detail()` 111-202 | `/gamecenter/{id}/boxscore`, `/landing`, `/play-by-play` |
| Standings | `standings()` 203-220 | `/standings/now` |
| Club schedule (kept, unused by UI) | `club()` 221-235 | `/club-schedule-season/{abbr}/now` |
| League leaders | `_lead()` 302-310, `leaders()` 311-322 | `/skater-stats-leaders/current`, `/goalie-stats-leaders/current` |
| Game previews | `team_stats()` 382-397, `preview()` 398-458 | `https://api.nhle.com/stats/rest/en/team/summary` and `/percentages` (URL line 380), `/gamecenter/{id}/landing` |
| News | `NEWS_FEEDS` 236, `_parse_feed()` 254-285, `news()` 286-301 | Sportsnet, The Hockey News, Habs Eyes on the Prize, ESPN RSS (overridable via `news_feeds` in config.json) |
| Videos (last 24h) | `videos()` 323-351 | `https://www.youtube.com/feeds/videos.xml?channel_id=...` |
| Goal clips | `clip()` 352-379 | `https://players.brightcove.net/{acct}/default_default/config.json` (public player key), `https://edge.api.brightcove.com/playback/v1/accounts/{acct}/videos/{id}` |
| Transactions | `transactions()` 459-476 | `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/transactions` |
| Embed check | `embeddable()` 477-500 | only hosts listed in `config.json` `video_sources` (plus youtube.com) |

Browser-side loads (not through the server): team logos and headshots from `assets.nhle.com` (URLs come from the
API responses), Google Fonts (`web/index.html` lines 8-9), the YouTube embed and fallback Brightcove iframe
(`web/app.js` `initVideo()` 429-444, `playReel()` 401-428), and the MP4 clips themselves.

Polling (front end, `web/app.js`): scores every 15 s (`pollScores` 445), standings every 120 s (`pollSlow` 469),
news every 10 min (`pollNews` 468), leaders and transactions every 5 min (`pollLeaders` 467). The server caches
each source (`cached()` 38-54) and serves stale data if a source fails.

## Local endpoints exposed by the app
Served on `127.0.0.1:<port>` only (`ThreadingHTTPServer`, line 602). All are read-only `GET`:
`/api/config`, `/api/scores`, `/api/standings`, `/api/game/<id>`, `/api/club/<ABBR>`, `/api/leaders`,
`/api/videos`, `/api/clip/<id>`, `/api/preview/<id>`, `/api/transactions`, `/api/news`, `/api/embed?url=`
(handler `api()` 555-594), plus static files from `web/`.

## Webhooks
**This app receives no webhooks.** It only polls public feeds and has no `do_POST` handler, so there is no
Stripe, GitHub or Twilio endpoint to configure. It also stores no customers, payments or messages.

If you later add one, put it behind a verified route, for example:

```python
# in class H (server.py): accept POST /webhooks/github with signature check
import hmac, hashlib
def do_POST(self):
    if self.path != "/webhooks/github":
        return self.send(404, {"error": "unknown endpoint"})
    body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
    secret = os.environ["GITHUB_WEBHOOK_SECRET"].encode()          # keep in .env, never in code
    want = "sha256=" + hmac.new(secret, body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(want, self.headers.get("X-Hub-Signature-256", "")):
        return self.send(401, {"error": "bad signature"})
    self.send(200, {"ok": True})
```

Testing locally with ngrok: `python3 server.py` then `ngrok http 8765`; use the printed `https://<id>.ngrok-free.app/webhooks/github`
as the provider's webhook URL, and watch requests at http://127.0.0.1:4040. Note that ngrok would make the
**whole dashboard** reachable from the internet, so only run it while testing and keep the verification above.
(Stripe: use `stripe listen --forward-to localhost:8765/webhooks/stripe`; Twilio: set the number's webhook to the ngrok URL and validate `X-Twilio-Signature`.)
