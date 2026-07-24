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
| [js/config.js](js/config.js) | CROPS (26), LIVESTOCK/PRODUCTS/ANIMAL_SHOP (Fas B), GOODS/WORKSHOPS (Fas C), timers |
| [js/economy.js](js/economy.js) | `Inventory` — mynt/frön/skörd/produkter/goods/foder, köp/sälj, serialisering |
| [js/farm.js](js/farm.js) | uppodling, grödor, växtlogik, skörd (2-tall crop-render) |
| [js/animals.js](js/animals.js) | `Herd` + `Animal` — vandring, mata/producera/uppföda/avla, produkt-bubblor |
| [js/workshops.js](js/workshops.js) | `Workshops` — förädling (deposit→process→collect), stall+skylt-render |
| [js/world.js](js/world.js) | mark, dekor, kollision, `drawGround` (autotile + rundade ytterhörn), workshopSpots |
| [js/player.js](js/player.js) | spelare; per-action riktningsrader (ACTION_DIR_ROW) |
| [js/main.js](js/main.js) | host-auth loop, interaktion (verktyg/djur/workshop), spara/ladda, MP-state |
| [js/ui.js](js/ui.js) | HUD, hotbar, väska/butik (frön/djur/foder/sälj allt) |
| [js/assets.js](js/assets.js) | asset-laddning + rit-helpers, GRASS_CORNERS (ytterhörn-overlays) |
| [index.html](index.html) | spelet + pixel-startskärm |
| [editor.html](editor.html) / [js/editor.js](js/editor.js) | kartbyggaren |

- Spar-nycklar: `localStorage['lantliv_save']` / `['lantliv_save_custom']` + autosave var 10:e s.
- **Lokal testning:** `python -m http.server 8137` i mappen → öppna `http://localhost:8137`.
  Headless: Playwright via `D:\Qisy\QISYFrontend\QISYFrontend-1\node_modules\playwright`.

## Status

- ✅ **Grundspel + MP + kartbyggare + karaktärsval** — live.
- ✅ **Fas A (ekonomi-grund)** — 26 grödor, väska, köp/sälj-butik, spara/ladda, autosave.
- ✅ **Autotile** — förenad jord + gräskant-overlays; **rundade ytterhörn** via blob-hörn (`4d376b8`).
- ✅ **Pixel-startskärm.**
- ✅ **Buggfix-runda** (`4d376b8`): verktygs-riktningar (hoe/watering/scythe hade ner↔höger omkastade —
  action-ark använder `[upp,höger,vänster,ner]`), avklippta grödor (2-tall från stadie 2), rundade
  ytterhörn, gråskärm-skydd (repaint på focus/visibility + ingen 0×0-resize).
- ✅ **Fas B — djur & uppfödning** (`f964de3`): mata (foder köps / vete odlas) → ägg/mjölk/ull, samla via
  bubbla, sälj; köp baby-djur + foder i butiken; baby→vuxen (~2 dagar); daglig avel (≥2 vuxna av art);
  herd sparas + synkas. Starter: 2 höns + 1 ko.
- ✅ **Fas C — förädling** (`4f8698e`): Bageri 🌾→🍞, Mejeri 🥛→🧀, Väveri 🧶→🧵. Tre stall-byggnader söder
  om åkern; ställ in (deposit) → progress → hämta färdig vara; goods säljs i butiken. Deterministiska
  positioner, solida, state sparas + synkas.

## Nästa steg

**Fas D — bybygge / placering** (näst på tur): låt spelaren *placera* byggnader själv (workshops, hagar,
dekor) mot resurser/mynt, community-paket + milstolpar som drivkraft, delad by-bank i MP. Byggnader =
färgkodade tak + skyltar (skylt-mönstret finns redan i Fas C).

Därefter Fas E–H enligt GDD: smedja + mineraltiers (sten→koppar→…→diamant, tonad hacka per tier),
bybor att hyra (automation), levande bycentrum med porträtt-dialog, valfri äventyrs-/gruvdel
(fladdermus + slem, svärds-animationer finns).

### Verifieringsrutin (headless)
`python -m http.server 8137` → Playwright-script via `D:\Qisy\QISYFrontend\QISYFrontend-1\node_modules\playwright`
(kräver absolut `require`-sökväg). Testharness importerar spelmodulerna direkt och renderar scenarier
(pixel-identiskt med spelet); assertions loggas till console, screenshot läses tillbaka. Se commit-historik.

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
