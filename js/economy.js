// LANTLIV — economy: shared inventory (coins, seeds, harvested crops). Host-authoritative.
import { CROPS, START_COINS } from './config.js';

export class Inventory {
  constructor() {
    this.coins = START_COINS;
    this.seeds = {};    // cropKey -> count owned
    this.harvest = {};  // cropKey -> count in storage (to sell)
    // start the family off with a few free seeds so there's something to plant
    this.seeds.carrot = 6;
    this.seeds.strawberry = 4;
  }

  seedCount(k) { return this.seeds[k] || 0; }
  harvestCount(k) { return this.harvest[k] || 0; }
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
    this.coins += total;
    this.harvest = {};
    return total;
  }

  serialize() { return { c: this.coins, s: this.seeds, h: this.harvest }; }
  apply(d) { if (!d) return; this.coins = d.c; this.seeds = d.s || {}; this.harvest = d.h || {}; }
}
