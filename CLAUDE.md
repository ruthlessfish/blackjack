# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

A Phaser 4 blackjack game with two separate modes, on top of the
[phaserjs/template-vite-ts](https://github.com/phaserjs/template-vite-ts) starter. There is no server:
everything runs in the browser and `localStorage` is the only persistence.

- **Training** — one hand at a time, only the first move is played and scored against Basic Strategy.
  Tracks hands seen / correct, a live streak, and a best streak that survives reloads.
- **Standard** — 1-on-1 blackjack vs the dealer, ported from `../blackjack2` minus its training features
  (no "ask dealer", strategy warnings, accuracy, or Hi-Lo count).

Only `sprites.png` and `felt.png` from `public/assets` are loaded; every screen, Standard included, sits on
the tinted `felt.png` (`table.png` is an unused leftover). Text uses a system font stack; there are no font
files.

## Commands

```bash
npm install
npm run dev          # dev server on http://localhost:8080 with HMR
npm run build        # production build to dist/
npm run preview      # serve the production build locally
npm run clean        # rm -rf dist
npm test             # vitest run: the rules and strategy tests in tests/*.test.ts
npx tsc --noEmit     # type check (there is no npm script for this)
```

Tests are Vitest and cover `logic/` only (rules, settlement, the strategy chart, the shoe); there is no
linter, and `tsc --noEmit` is the static check. `StandardGame` takes `{ saved, shoe, schedule }` options:
a test passes a `shoe` to stack the cards (see `ScriptedShoe` in `StandardGame.test.ts`) and a `schedule`
it winds by hand (`manualClock`) to control the auto-sweep; the scene passes Phaser's clock. In dev,
`window.__phaser` is the Phaser `Game`, so a browser session can read state, e.g.
`__phaser.scene.getScene('Standard').table.view()` or `getScene('Training').session.view()`.

## Architecture

Three-hop bootstrap, each file with one job:

1. `index.html` — provides `<div id="game-container">`, loads `/src/main.ts` as a module.
2. `src/main.ts` — waits for `DOMContentLoaded`, calls `StartGame('game-container')`.
3. `src/game/main.ts` — holds the single `Phaser.Types.Core.GameConfig` and constructs the `Game`.

`src/game/main.ts` is the one place scene registration happens: **a new scene is inert until it's added
to the `scene: []` array there.** The first entry in that array is the scene that auto-starts.

The canvas is a fixed 1024×768 logical space with `Scale.FIT` + `Scale.CENTER_BOTH`, so all positioning
is in those coordinates regardless of window size (centre is 512, 384). Keep new layout code in that
space instead of reading real pixel dimensions.

### Game code layout

Rules and rendering are kept apart. **`src/game/logic/` has no Phaser imports**, so it can be bundled and
soaked from Node; scenes only draw a view object and forward clicks (they never decide a rule).

- `logic/` — `Card/Deck/Shoe/Hand/Player/Dealer/strategy` (ported from blackjack2; `Hand` is just cards,
  `PlayerHand` adds the bet and outcome, and `Player` changes its state only through named methods),
  `StandardGame`
  (the rules controller; emits a `ViewState` through an `onChange` callback and exposes `view()` /
  `snapshot()` / `dispose()`), `TrainingSession` (deal, `answer()`, stats; exposes `TrainingView`),
  `settings.ts` (sanitising), `types.ts`, `constants.ts`.
- `storage.ts` — the only `localStorage` access; every read/write is in try/catch and sanitised on load.
- `scenes/` — `Preloader` → `MainMenu` → `Training` | `Standard`. `Preloader` loads the two images and
  cuts the sprite frames.
- `ui/` — `Button`, `ChipButton`, `HandView` (diffs cards so only new ones animate, flips the hole card),
  `Pile`, `BetStack`, `SettingsModal`, `hud.ts` (the top-bar stat box and Menu button), `atlas.ts` (frame
  names), `theme.ts` (colours, fonts, backgrounds, chip labels).

### Sprite sheet

`sprites.png` is **not a uniform grid**, so frames are cut by hand in `ui/atlas.ts` (not
`load.spritesheet`): cards are 88×124 at `(col*88, row*124)` with rows ♠ ♥ ♣ ♦ (note: not blackjack2's
`SUITS` order), row 5 holds card backs and stack frames, and chips are 62×70 at `x=441+64*i`, `y=497/569`.
The chip art carries no denomination, so a Phaser text label is drawn over it. Nearest-neighbour filtering
is set on this texture only.

### Behaviour worth knowing

- Standard checks `{balance, decks, startingBalance}` on **every** state change and writes whenever they
  differ from what was last saved, so reloading mid-round forfeits the bet rather than undoing it. Training
  saves after every answer.
- Training skips hands with no decision (player natural, or a dealer natural the peek would catch).
- The best streak updates the moment the live streak passes it (blackjack2 only updated it on a miss).
- The bankroll setting is a row of presets (`BANKROLL_OPTIONS`) because Phaser has no text input.

## Assets

Two loading paths, and they behave differently at build time:

- **Runtime loading (preferred here):** files in `public/assets/` are copied verbatim to `dist/assets/`.
  Scenes call `this.load.setPath('assets')` once in `preload()`, then load by bare filename
  (`this.load.image('felt', 'felt.png')`).
- **Bundled:** `import feltImg from './assets/felt.png'` inside `src/` lets Vite hash and inline/emit
  the file; pass the imported URL to the loader.

## TypeScript config notes

`tsconfig.json` is strict with two settings that bite during incremental work: `noUnusedLocals` and
`noUnusedParameters` make stubbed-out code a type error, so wire things up or prefix params with `_`.
`strictPropertyInitialization` is deliberately **off**, which is what lets Phaser scenes declare class
fields that are assigned in `create()` rather than the constructor.

## Vite configs

Dev and prod are separate files (`vite/config.dev.mjs`, `vite/config.prod.mjs`) rather than one config
with mode branches — a build-affecting change usually needs editing both. Both use `base: './'` (so
`dist/` works from any subdirectory) and split `phaser` into its own manual chunk. Prod adds terser
with two compress passes.
