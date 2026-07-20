/**
 * scripts/migrateStationsToGroups.ts
 *
 * One-shot migration from the legacy fuel-based report layout to the new
 * group-based one:
 *
 *   1. Creates one default `StationGroup` per fuel type per ownership type
 *      (e.g. "iec-gas", "private-solar"). Idempotent — reuses existing
 *      groups by tag.
 *   2. Assigns every Station without a `groupId` to the group matching its
 *      derived main fuel + ownership type. Stations with no units land in
 *      the "<type>-other" group.
 *   3. Rewrites every Report's `content.private[<fuel>]` and
 *      `content.iec[<fuel>]` maps to the same shape but keyed by group tag
 *      instead of fuel. Also stamps each StationRow with a `groupTag`
 *      snapshot so the row still knows its group even after future edits.
 *
 * Run with:
 *   npx ts-node scripts/migrateStationsToGroups.ts
 *
 * Re-running is safe: groups are upserted by tag, stations already tied to
 * a group are left alone, and report content that no longer contains any
 * fuel-shaped keys is a no-op.
 */

import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { getMongoUri, getMongoDbName } from "../config/mongodbConfig";
import { Station, STATION_FUELS, type StationFuel, type StationType, STATION_TYPES } from "../models/Station";
import { StationGroup } from "../models/StationGroup";
import { Report } from "../models/Report";

// ─── Helpers ────────────────────────────────────────────────────────────────

const log = (msg: string): void => console.log(`[migrate-station-groups] ${msg}`);

const FUEL_NAMES_HE: Record<StationFuel, string> = {
  gas:      "גז",
  diesel:   "דיזל",
  solar:    "סולרי",
  turbine:  "טורבינה",
  coal:     "פחם",
  hydro:    "הידרו",
  wind:     "רוח",
  nuclear:  "גרעיני",
  mazut:    "מזוט",
  methanol: "מתאנול",
  other:    "אחר",
};

const TYPE_NAMES_HE: Record<StationType, string> = {
  iec:     "חברת חשמל",
  private: "פרטית",
};

/** Group tag for the default fuel-based group of a given type/fuel. */
const defaultTag = (type: StationType, fuel: StationFuel): string =>
  `${type}-${fuel}`;

/** Group display name (Hebrew) for the default group. */
const defaultName = (type: StationType, fuel: StationFuel): string =>
  `${TYPE_NAMES_HE[type]} — ${FUEL_NAMES_HE[fuel]}`;

/** Derive a station's main fuel from its units (majority wins). */
function deriveMainFuel(units: Array<{ mainFuel?: { type?: string } }>): StationFuel {
  if (!units || units.length === 0) return "other";
  const counts = new Map<StationFuel, number>();
  for (const u of units) {
    const t = u.mainFuel?.type;
    if (!t || !(STATION_FUELS as string[]).includes(t)) continue;
    counts.set(t as StationFuel, (counts.get(t as StationFuel) ?? 0) + 1);
  }
  let best: StationFuel = "other";
  let bestCount = 0;
  for (const f of STATION_FUELS) {
    const c = counts.get(f) ?? 0;
    if (c > bestCount) {
      best = f;
      bestCount = c;
    }
  }
  return best;
}

// ─── Step 1: default groups ────────────────────────────────────────────────

async function ensureDefaultGroups(): Promise<Map<string, Types.ObjectId>> {
  const tagToId = new Map<string, Types.ObjectId>();

  let created = 0;
  let reused = 0;
  for (const type of STATION_TYPES) {
    for (let i = 0; i < STATION_FUELS.length; i++) {
      const fuel = STATION_FUELS[i]!;
      const tag  = defaultTag(type, fuel);
      const existing = await StationGroup.findOne({ tag }).select("_id").lean();
      if (existing) {
        tagToId.set(tag, existing._id as Types.ObjectId);
        reused++;
        continue;
      }
      const doc = await StationGroup.create({
        tag,
        name: defaultName(type, fuel),
        type,
        order: i,
        description: `קבוצת ברירת-מחדל שנוצרה במעבר מהמבנה הקודם לפי דלק (${FUEL_NAMES_HE[fuel]}).`,
      });
      tagToId.set(tag, doc._id as Types.ObjectId);
      created++;
    }
  }

  log(`Default groups: created=${created}, reused=${reused}, total=${tagToId.size}`);
  return tagToId;
}

// ─── Step 2: back-fill Station.groupId ─────────────────────────────────────

async function backfillStationGroups(
  tagToId: Map<string, Types.ObjectId>,
): Promise<Map<string, string>> {
  // stationId → group tag, used by the report rewrite step below.
  const stationIdToGroupTag = new Map<string, string>();

  const stations = await Station.find({}).select("_id type units groupId").lean();
  let updated = 0;
  let alreadySet = 0;

  for (const s of stations) {
    const fuel = deriveMainFuel(s.units as Array<{ mainFuel?: { type?: string } }>);
    const tag  = defaultTag(s.type as StationType, fuel);
    stationIdToGroupTag.set(String(s._id), tag);

    if (s.groupId) {
      alreadySet++;
      continue;
    }
    const groupId = tagToId.get(tag);
    if (!groupId) {
      log(`WARN station ${s._id} has no matching group for ${tag} — skipping`);
      continue;
    }
    await Station.updateOne({ _id: s._id }, { $set: { groupId } });
    updated++;
  }

  log(`Stations: updated=${updated}, already-assigned=${alreadySet}, total=${stations.length}`);
  return stationIdToGroupTag;
}

// ─── Step 3: rewrite report content ────────────────────────────────────────

type StationRow = { stationId?: string; groupTag?: string; [k: string]: unknown };
type StationData = Record<string, StationRow[]>;
type FuelKeyedBucket = Partial<Record<StationFuel, StationData>>;
type GroupKeyedBucket = Record<string, StationData>;

/** Returns true if every key on the bucket is a known fuel enum value. */
function isFuelKeyed(bucket: unknown): bucket is FuelKeyedBucket {
  if (!bucket || typeof bucket !== "object") return false;
  const keys = Object.keys(bucket);
  if (keys.length === 0) return true;
  return keys.every((k) => (STATION_FUELS as string[]).includes(k));
}

function rewriteBucket(
  bucket: unknown,
  type: StationType,
  stationIdToGroupTag: Map<string, string>,
): { changed: boolean; result: GroupKeyedBucket } {
  if (!bucket || typeof bucket !== "object") {
    return { changed: false, result: {} };
  }

  // If it's already group-keyed (unknown keys), leave it alone but still
  // stamp missing groupTag snapshots on rows.
  const alreadyGroupKeyed = !isFuelKeyed(bucket);
  const result: GroupKeyedBucket = alreadyGroupKeyed
    ? (bucket as GroupKeyedBucket)
    : {};

  let changed = false;

  if (!alreadyGroupKeyed) {
    for (const [fuel, data] of Object.entries(bucket as FuelKeyedBucket)) {
      if (!data) continue;
      const defaultTagForFuel = defaultTag(type, fuel as StationFuel);
      for (const [stationName, rows] of Object.entries(data)) {
        // Try to find a more accurate group per row via stationId; fall
        // back to the fuel-based default group.
        const byGroup = new Map<string, StationRow[]>();
        for (const r of rows) {
          const rowGroup = (r.stationId && stationIdToGroupTag.get(String(r.stationId)))
            || defaultTagForFuel;
          const arr = byGroup.get(rowGroup) ?? [];
          // Stamp snapshot so the row remembers its group even if the
          // catalog assignment changes later.
          arr.push({ ...r, groupTag: rowGroup });
          byGroup.set(rowGroup, arr);
        }
        for (const [gTag, gRows] of byGroup) {
          const bucketData = (result[gTag] ??= {});
          bucketData[stationName] = [...(bucketData[stationName] ?? []), ...gRows];
        }
      }
      changed = true;
    }
  } else {
    // Group-keyed already: still stamp groupTag on any row missing it.
    for (const [gTag, data] of Object.entries(result)) {
      for (const [stationName, rows] of Object.entries(data)) {
        const patched = rows.map((r) => {
          if (r.groupTag) return r;
          changed = true;
          return { ...r, groupTag: gTag };
        });
        data[stationName] = patched;
      }
    }
  }

  return { changed, result };
}

async function rewriteReports(stationIdToGroupTag: Map<string, string>): Promise<void> {
  // Stream the collection to avoid loading every report into memory.
  const cursor = Report.find({}).cursor();

  let scanned = 0;
  let modified = 0;

  for await (const doc of cursor) {
    scanned++;
    const content = (doc.content ?? {}) as Record<string, unknown>;
    if (!content || typeof content !== "object") continue;

    const priv = rewriteBucket(content["private"], "private", stationIdToGroupTag);
    const iec  = rewriteBucket(content["iec"],     "iec",     stationIdToGroupTag);

    if (!priv.changed && !iec.changed) continue;

    // Use updateOne to bypass the version-bumping `pre save` hook — this is
    // a maintenance rewrite, not a user edit.
    await Report.collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          "content.private": priv.result,
          "content.iec":     iec.result,
        },
      },
    );
    modified++;
  }

  log(`Reports: scanned=${scanned}, modified=${modified}`);
}

// ─── Entry point ───────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const dbName = getMongoDbName();
  await mongoose.connect(getMongoUri(), dbName ? { dbName } : undefined);
  log(`Connected to ${dbName ?? "(default db)"}`);

  const tagToId = await ensureDefaultGroups();
  const stationIdToGroupTag = await backfillStationGroups(tagToId);
  await rewriteReports(stationIdToGroupTag);

  await mongoose.disconnect();
  log("Done.");
}

run().catch(async (err) => {
  console.error("[migrate-station-groups] FAILED:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
