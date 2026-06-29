/**
 * Seed 7 fuel sites with random tanks.
 *
 * Run with:
 *   npx ts-node scripts/seedFuelSites.ts
 *
 * Safe to re-run: upserts by `tag`.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { FuelSite } from "../models/FuelSite";
import { StationFuel } from "../models/Station";
import { getMongoUri, getMongoDbName } from "../config/mongodbConfig";

type TankSeed = { name: string; fuelType: StationFuel; capacity?: number };
type SiteSeed = { name: string; tag: string; fuelTypes: StationFuel[]; tanks: TankSeed[] };

const SITES: SiteSeed[] = [
  // 1 tank
  {
    name: "אתר חיפה",
    tag: "FS-HFA",
    fuelTypes: ["diesel"],
    tanks: [{ name: "מיכל ראשי", fuelType: "diesel", capacity: 50000 }],
  },
  // 2 tanks, single fuel
  {
    name: "אתר אשדוד",
    tag: "FS-ASH",
    fuelTypes: ["diesel"],
    tanks: [
      { name: "מיכל A", fuelType: "diesel", capacity: 30000 },
      { name: "מיכל B", fuelType: "diesel", capacity: 30000 },
    ],
  },
  // 3 tanks, single fuel
  {
    name: "אתר באר שבע",
    tag: "FS-BSV",
    fuelTypes: ["mazut"],
    tanks: [
      { name: "מיכל ראשי", fuelType: "mazut", capacity: 80000 },
      { name: "מיכל משני", fuelType: "mazut", capacity: 40000 },
      { name: "מיכל חירום", fuelType: "mazut", capacity: 20000 },
    ],
  },
  // 4 tanks, single fuel
  {
    name: "אתר אשקלון",
    tag: "FS-ASQ",
    fuelTypes: ["diesel"],
    tanks: [
      { name: "מיכל 1", fuelType: "diesel", capacity: 25000 },
      { name: "מיכל 2", fuelType: "diesel", capacity: 25000 },
      { name: "מיכל 3", fuelType: "diesel", capacity: 25000 },
      { name: "מיכל 4", fuelType: "diesel", capacity: 25000 },
    ],
  },
  // 2 tanks, two fuel types
  {
    name: "אתר חדרה",
    tag: "FS-HAD",
    fuelTypes: ["diesel", "mazut"],
    tanks: [
      { name: "מיכל סולר", fuelType: "diesel", capacity: 40000 },
      { name: "מיכל מזוט", fuelType: "mazut", capacity: 60000 },
    ],
  },
  // 4 tanks, two fuel types
  {
    name: "אתר רוטנברג",
    tag: "FS-ROT",
    fuelTypes: ["diesel", "mazut"],
    tanks: [
      { name: "סולר A", fuelType: "diesel", capacity: 35000 },
      { name: "סולר B", fuelType: "diesel", capacity: 35000 },
      { name: "מזוט A", fuelType: "mazut", capacity: 70000 },
      { name: "מזוט B", fuelType: "mazut", capacity: 70000 },
    ],
  },
  // 3 tanks, single fuel
  {
    name: "אתר אורות רבין",
    tag: "FS-ORB",
    fuelTypes: ["mazut"],
    tanks: [
      { name: "מיכל צפוני", fuelType: "mazut", capacity: 90000 },
      { name: "מיכל דרומי", fuelType: "mazut", capacity: 90000 },
      { name: "מיכל מרכזי", fuelType: "mazut", capacity: 45000 },
    ],
  },
];

async function main() {
  const uri = getMongoUri();
  const dbName = getMongoDbName();
  await mongoose.connect(uri, dbName ? { dbName } : {});
  console.log(`Connected to ${dbName ?? "(default db)"}`);

  let created = 0;
  let updated = 0;

  for (const seed of SITES) {
    const existing = await FuelSite.findOne({ tag: seed.tag });
    if (existing) {
      existing.name = seed.name;
      existing.fuelTypes = seed.fuelTypes;
      existing.tanks.splice(0, existing.tanks.length);
      for (const t of seed.tanks) existing.tanks.push(t);
      await existing.save();
      updated += 1;
      console.log(`  ↻ updated ${seed.tag} (${seed.name}) — ${seed.tanks.length} tank(s)`);
    } else {
      await FuelSite.create(seed);
      created += 1;
      console.log(`  + created ${seed.tag} (${seed.name}) — ${seed.tanks.length} tank(s)`);
    }
  }

  console.log(`\nDone. created=${created} updated=${updated} total=${SITES.length}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
