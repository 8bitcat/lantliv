// LANTLIV — economy: shared inventory (coins, seeds, harvested crops, animal products,
// feed). Host-authoritative.
import { CROPS, PRODUCTS, ANIMAL_SHOP, FODER_COST, START_COINS } from './config.js';

export class Inventory {
  constructor() {
    this.coins = START_COINS;
    this.seeds = {};    // cropKey -> count owned
    this.harvest = {};  // cropKey -> count in storage (to sell)
    this.products = {}; // productKey (egg/milk/wool) -> count in storage (to sell)
    this.foder = 0;     // bought animal feed units
    // start the family off with a few free seeds so there's something to plant
    this.seeds.carrot = 6;
    this.seeds.strawberry = 4;
  }

  seedCount(k) { return this.seeds[k] || 0; }
  harvestCount(k) { return this.harvest[k] || 0; }
  productCount(k) { return this.products[k] || 0; }
  totalHarvest() { let n = 0; for (const k in this.harvest) n += this.harvest[k]; return n; }

  buySeed(k, n = 1) {
    const cost = CROPS[k].seed * n;
    if (this.coins < cost) return false;
    this.coins -= cost;
    this.seeds[k] = (this.seeds[k] || 0) + n;
    return true;
  }
  useSeed(k) {
    if ((this.seeds[k] || 0) <= 0) return false;
    this.seeds[k]--;
    if (this.seeds[k] <= 0) delete this.seeds[k];
    return true;
  }
  addHarvest(k, n = 1) { this.harvest[k] = (this.harvest[k] || 0) + n; }

  sellOne(k) {
    if ((this.harvest[k] || 0) <= 0) return 0;
    this.harvest[k]--;
    if (this.harvest[k] <= 0) delete this.harvest[k];
    const gain = CROPS[k].price;
    this.coins += gain;
    return gain;
  }
  sellAll() {
    let total = 0;
    for (const k in this.harvest) total += CROPS[k].price * this.harvest[k];
    for (const k in this.products) total += PRODUCTS[k].price * this.products[k];
    this.coins += total;
    this.harvest = {};
    this.products = {};
    return total;
  }

  // --- animal products ---
  addProduct(k, n = 1) { this.products[k] = (this.products[k] || 0) + n; }
  sellProduct(k) {
    if ((this.products[k] || 0) <= 0) return 0;
    this.products[k]--;
    if (this.products[k] <= 0) delete this.products[k];
    this.coins += PRODUCTS[k].price;
    return PRODUCTS[k].price;
  }

  // --- feed (foder bought in the shop; wheat harvest is also usable, handled by the herd) ---
  buyFoder(n = 1) {
    const cost = FODER_COST * n;
    if (this.coins < cost) return false;
    this.coins -= cost; this.foder += n; return true;
  }
  useFoder() { if (this.foder <= 0) return false; this.foder--; return true; }
  hasFeed() { return this.foder > 0 || (this.harvest.wheat || 0) > 0; }
  useFeed() { // spend bought foder first, then fall back to harvested wheat
    if (this.foder > 0) { this.foder--; return true; }
    if ((this.harvest.wheat || 0) > 0) {
      this.harvest.wheat--; if (this.harvest.wheat <= 0) delete this.harvest.wheat; return true;
    }
    return false;
  }

  // --- buy a baby animal (payment only; the herd does the spawning) ---
  buyAnimal(k) {
    const def = ANIMAL_SHOP[k];
    if (!def || this.coins < def.price) return false;
    this.coins -= def.price; return true;
  }

  serialize() { return { c: this.coins, s: this.seeds, h: this.harvest, p: this.products, fo: this.foder }; }
  apply(d) {
    if (!d) return;
    this.coins = d.c; this.seeds = d.s || {}; this.harvest = d.h || {};
    this.products = d.p || {}; this.foder = d.fo || 0;
  }
}
