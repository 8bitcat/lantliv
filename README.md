# 🌱 Lantliv — familjens bondgård

Ett litet, mysigt farming-spel för hela familjen. Spela i webbläsaren, ensam eller
tillsammans i samma gård via en **rumskod** — precis som VILDMARK & Trollnatt.

Byggt helt kring sprite-paketet **“Little Dreamyland”**.

## Spela

* **Öppna** `index.html` via en webbserver (ES-moduler kräver http, inte `file://`).
  Lokalt: `python -m http.server 8123` och gå till `http://localhost:8123`.
* **Publikt:** GitHub Pages → `https://8bitcat.github.io/lantliv`.

### Kontroller
| | Dator | Mobil |
|---|---|---|
| Gå | WASD / piltangenter | dra på vänstra halvan (spak) |
| Använd verktyg | Mellanslag / E | stora runda knappen |
| Byt verktyg | siffror 1–6 | tryck i verktygsfältet |

### Så odlar du
1. **⛏️ Hacka** en gräsruta framför dig → bar jord.
2. **🥕🥦🎃🍓 Så** ett frö i jorden.
3. **💧 Vattna** — grödan växer bara medan jorden är blöt (5 stadier).
4. När den är mogen: tryck **Använd** på den → **skörd + mynt** 🪙
   (ibland en kvalitetsstjärna ★ som ger extra mynt).

## Spela tillsammans
* **📣 Bjud in familjen** → du blir värd och får en 4-teckens **rumskod**.
* Dela koden. Alla andra väljer **🔗 Gå med i ett rum** och skriver koden.
* Ni odlar samma åker i realtid. Värden håller ordning på grödorna (host-authoritative).

## Teknik
* Buildless: HTML + Canvas 2D + ES-moduler. Ingen kompilering, inget backend.
* Multiplayer: **PeerJS** (WebRTC P2P), samma mönster som de andra familjespelen.
* Deterministisk värld (fast seed) — alla får identisk karta utan att synka den.

Källkod: `js/` — `world` (karta), `farm` (odling), `player`, `animals`, `net`
(nätverk), `ui`, `main` (loop + limning).

## Krediter
Grafik: **“Little Dreamyland” av Starmixu & Utaskuas**
(<https://starmixu.itch.io/little-dreamyland-asset-pack>).
Använt enligt gratis-licensen (icke-kommersiellt familjeprojekt, med credit).
Se `assets/CREDITS.txt`.
