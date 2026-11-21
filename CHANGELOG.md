# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/). Dates are YYYY-MM-DD.

## [Unreleased]
### Added
- Prospect Watch shows rankings from NHL.com, The Hockey News, The Hockey Writers and TSN (Button Top 50) as chips, plus a consensus order (`prospect_rankings.json`, edit when new lists publish); personal `prospect_notes.json` overrides
### Changed
### Fixed

## [1.1.0-beta] - 2026-10-24
### Added
- Goal reels now have sound; mute with `M` or the button (choice remembered); launcher enables kiosk autoplay-with-sound
- Favourite-team game-day screen (league ranks, goalies, skaters)
- Prospect Watch screens (NHL prospects data, optional personal ranks via `prospect_notes.json`)
### Removed
- YouTube video panel, `/api/videos`, `/api/embed`, `V` key, `video_*` config keys

## [1.0.0-beta] - 2026-10-20
First release prepared for GitHub (builds v8.1 plus repo hardening).
### Added
- Version number shown in the header and printed by the installer (`VERSION` file)
- `.gitignore`, `.env.example`, optional `.env` overrides (`NHL_HUB_PORT`, `NHL_HUB_FAVOURITE`)
- README, CHANGELOG and `docs/DATA_SOURCES.md`
### Security
- `/api/embed` now only probes hosts listed in `config.json` (plus youtube.com) over HTTPS
### Fixed
- Team records in the box score header now come from standings when the score feed has none

## [0.8.1] - 2026-10-20
### Fixed
- Records missing in the box score header on live data

## [0.8.0] - 2026-10-20
### Added
- Desktop shortcut and app icon created by the installer; records in the box score header
### Changed
- Three stars box replaces the penalties box
### Fixed
- Highlighted stat numbers were off-centre

## [0.7.0] - 2026-10-20
### Added
- Game previews (cycle 2): team and advanced stats, projected lines, goalie matchup
- League transactions screen (cycle 5)
### Removed
- Conference standings screen (near-duplicate of wild card)

## [0.6.0] - 2026-10-20
### Changed
- Goal reels play plain MP4 clips (no ad player), story style with progress bars, game by game

## [0.5.0] - 2026-10-20
### Changed
- Puckfeed replaced by NHL goal highlight clips (Puckfeed blocks embedding)
### Removed
- Spector's feed from the news ticker

## [0.4.0] - 2026-10-20
### Added
- Reels panel, goals ticker; upcoming games merged into the scores ticker

## [0.3.0] - 2026-10-20
### Added
- League leaders screens, news summaries, YouTube video panel limited to the last 24 hours

## [0.2.0] - 2026-10-19
### Added
- News and up-next tickers
### Fixed
- Overlapping screens during transitions, tab bar overflow, longer transitions

## [0.1.0] - 2026-10-19
### Added
- Initial dashboard: box scores, standings, scores ticker, video panel, demo mode

[Unreleased]: https://github.com/jeremylegere-wq/hockey-night/compare/v1.0.0-beta...HEAD
[1.0.0-beta]: https://github.com/jeremylegere-wq/hockey-night/releases/tag/v1.0.0-beta
