# Lantliv — session-återupptagning

> **Du som är Claude:** läs hela den här filen så har du all kontext för att fortsätta
> bygga Lantliv. Carl behöver inte klistra in någon startinstruktion — han säger bara
> *"läs SESSION.md, fortsätt"*. Nästa planerade steg står under **Nästa steg**.

---

## Vad är det här?

**Lantliv** — familjespelet 7. Ett mysigt co-op **farming → bybygge**-spel (Stardew-light)
som familjen kan joina över nätet. Byggt på **Little Dreamyland**-sprite-paketet.

| | |
|---|---|
| **Live** | https://8bitcat.github.io/lantliv |
| **Repo** | https://github.com/8bitcat/lantliv (branch `main`, GitHub Pages) |
| **Källkod** | `D:\GamesProjects\lantliv` |
| **Sprites (källa)** | Little Dreamyland asset pack — starmixu.itch.io/little-dreamyland-asset-pack (extraherade PNG:er ligger committade under `assets/`) |
| **Extra sprites** | `D:\Sprites\Farm game 1\` (Free-Samples m.m. — Kibyra-paket, ej huvudkälla) |

## Artefakter & design

- **Speldesign (GDD, publicerad artefakt):** Lantliv 2.0 — Speldesign
  → https://claude.ai/code/artifact/f1e0d55b-a0c3-4b32-9d6e-67fc9588a886
- **Lokal kopia av designdoc:** [design/lantliv-design.html](design/lantliv-design.html) (self-contained, öppna i browser)
- **Inspirationsmontage:** [design/inspiration-montage.png](design/inspiration-montage.png)

## Teknik (snabb ramp)

- Buildless **HTML5 Canvas + ES-moduler**, inget byggsteg, hostas på GitHub Pages.
- Multiplayer: **PeerJS WebRTC**, host-authoritative, 4-teckens rumskoder (prefix `lantliv-`).
- Sprites: karaktärer/djur **48×48**, 4 riktningsrader (upp0/ner1/vänster2/höger3),
  **fötter på frame-rad 32** → rita `dy = y - 32`.
- Tilesets **16×16**. Crops (betald, 464×464, 26 grödor): frö rad1, växt rad [2,4,6,8,10], vissnat [18,20,22,24].
- **Jord-autotile:** platt `T_DIRT`-bas + `assets/tiles/grassedge.png` (8 frames: 0–3 kanter TBLR, 4–7 innerhörns-nubbar).
  `world.isDirtAt()` förenar världsjord + uppodlad jord så de aldrig slåss om kanter.

### Filkarta
| Fil | Ansvar |
|---|---|
| [js/config.js](js/config.js) | CROPS (26 st), tile-konstanter, timers |
| [js/economy.js](js/economy.js) | `Inventory` — mynt/frön/skörd, köp/sälj, serialisering |
| [js/farm.js](js/farm.js) | uppodling, grödor, växtlogik, skörd |
| [js/world.js](js/world.js) | mark, dekor, kollision, `drawGround` (autotile) |
| [js/main.js](js/main.js) | host-auth loop, spara/ladda, MP-state |
| [js/ui.js](js/ui.js) | HUD, hotbar, väska/butik-paneler |
| [js/assets.js](js/assets.js) | asset-laddning + rit-helpers |
| [index.html](index.html) | spelet + pixel-startskärm |
| [editor.html](editor.html) / [js/editor.js](js/editor.js) | kartbyggaren |

- Spar-nycklar: `localStorage['lantliv_save']` / `['lantliv_save_custom']` + autosave var 10:e s.
- **Lokal testning:** `python -m http.server 8137` i mappen → öppna `http://localhost:8137`.
  Headless: Playwright via `D:\Qisy\QISYFrontend\QISYFrontend-1\node_modules\playwright`.

## Status

- ✅ **Grundspel + MP + kartbyggare + karaktärsval** — live.
- ✅ **Fas A (ekonomi-grund)** — 26 grödor, väska, köp/sälj-butik, spara/ladda, autosave. Live.
- ✅ **Autotile-fix** (commit `83846ce`) — förenad jord (världsplättar + uppodlat) med
  gräskant-overlays + korrekta innerhörn. Löste "L-hål blir fel" + "hackar man i befintlig miljö blir det fel".
- ✅ **Pixel-startskärm** — panel/menybakgrund från UI-paketet.

## Nästa steg

**Fas B — djur & uppfödning** (sprites finns: höns/kyckling, ko/kalv, get/killing, får/lamm, and/ankunge):
1. Köp djur i butiken, placera i hagen.
2. Mata (hö/foder) + vatten.
3. Dagliga produkter: ägg, mjölk, ull → till väskan → sälj.
4. Uppfödning: baby → vuxen över tid.
5. Djur-cykel: sova/äta (dygnsrytm).

Därefter Fas C–H enligt GDD (bybygge, hantverksbyggnader som kvarn/bageri/mejeri, smedja + mineraltiers,
bybor att hyra, äventyr/gruva). Kvarnen använder **vete-skylt**.

## Så återupptar vi

1. Dubbelklicka skrivbordsgenvägen **"Lantliv — Little Dreamyland"** → VS Code öppnas i projektet.
2. Starta Claude Code i det fönstret.
3. Säg: *"läs SESSION.md, fortsätt med Fas B"* (eller vad som är aktuellt).

## Carls designbeslut (fastställda)

- Realtid (ej turordning).
- Hyrbara bybor som arbetare (automation).
- MP = egna åkrar + byggrättigheter + delad by-bank.
- Både milstolpar **och** community-paket som drivkraft.
- Byggnader = färgkodade tak + skyltar.
- Mineraltiers: sten → koppar → brons → järn → silver → guld → diamant, med **tonad hacka** per uppgradering.
- Levande bycentrum med porträtt-dialog.
- Valfri äventyrs-/gruvdel (fladdermus + slem som fiender; svärds-animationer finns).
- Kartbyggare med stora prefab-tiles.
