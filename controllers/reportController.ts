import { Request, Response } from "express";
import { Types } from "mongoose";
import { Report } from "../models/Report";
import { User } from "../models/User";
import { AuthenticatedUser } from "../types/auth";
import { NotFoundError, ForbiddenError, BadRequestError } from "../errors/AppError";
import { logger } from "../services/loggerService";
import {
  getEnergyForDate,
  type YesterdayEnergyTotals,
} from "../services/externalEnergyService";
import {
  getWeatherAt,
  type HourlyWeatherSnapshot,
} from "../services/externalWeatherService";
import type { StationFuel } from "../models/Station";
import type { CreateReportInput, UpdateReportInput, ListReportsQuery } from "../schemas/reportSchemas";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the MongoDB _id for the currently authenticated user.
 * Throws BadRequestError when the user record doesn't exist yet.
 */
async function resolveUserId(username: string): Promise<Types.ObjectId> {
  const user = await User.findOne({ username }).select("_id").lean();
  if (!user) {
    throw new BadRequestError(
      `User "${username}" not found in the database. Ensure the user has logged in at least once.`,
      "ReportController"
    );
  }
  return user._id as Types.ObjectId;
}

// ─── GET /reports/stats ──────────────────────────────────────────────────────

/**
 * Returns aggregate statistics about reports.
 *
 * - Admins / managers see **global** stats (all reports in the system).
 * - Regular users see only **their own** reports.
 *
 * Response 200:
 * ```json
 * {
 *   "total": 42,
 *   "byStatus": { "draft": 5, "published": 37 },
 *   "mine": {
 *     "total": 12,
 *     "draft": 2,
 *     "published": 10
 *   },
 *   "recent": {
 *     "last7Days": 4,
 *     "last30Days": 18
 *   },
 *   "dailyCounts": [
 *     { "date": "2026-03-15", "count": 2 },
 *     { "date": "2026-03-16", "count": 0 },
 *     ...
 *   ],
 *   "topAuthors": [
 *     { "username": "admin.dev", "count": 15 },
 *     { "username": "user.dev",  "count": 10 }
 *   ]
 * }
 * ```
 *
 * Notes:
 * - `dailyCounts` covers the last 30 days (inclusive of today), with zero-filled gaps.
 * - `topAuthors` is only present for managers / admins (top 10 by report count).
 */
export const statsReportHandler = async (req: Request, res: Response): Promise<void> => {
  const actor = req.user as AuthenticatedUser;
  const isManagerOrAbove = actor.role === "manager" || actor.role === "admin";

  const now   = new Date();
  const last7  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Scope filter: managers+ see everything, others see only their own reports.
  const scopeMatch = isManagerOrAbove
    ? {}
    : { "createdBy.username": actor.username };

  const [
    statusAgg,
    mineAgg,
    recentAgg,
    dailyAgg,
    topAuthorsAgg,
  ] = await Promise.all([
    // 1. Total + breakdown by status (scoped)
    Report.aggregate([
      { $match: scopeMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    // 2. Current user's own counts (always scoped to actor)
    Report.aggregate([
      { $match: { "createdBy.username": actor.username } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    // 3. Reports created in the last 7 / 30 days (scoped)
    Report.aggregate([
      { $match: { ...scopeMatch, createdAt: { $gte: last30 } } },
      {
        $group: {
          _id:  null,
          last7Days:  { $sum: { $cond: [{ $gte: ["$createdAt", last7] }, 1, 0] } },
          last30Days: { $sum: 1 },
        },
      },
    ]),

    // 4. Daily counts for the last 30 days (scoped) — for charts
    Report.aggregate([
      { $match: { ...scopeMatch, createdAt: { $gte: last30 } } },
      {
        $group: {
          _id:   { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // 5. Top authors (managers+ only — top 10)
    isManagerOrAbove
      ? Report.aggregate([
          {
            $group: {
              _id:   "$createdBy.username",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 10 },
          { $project: { _id: 0, username: "$_id", count: 1 } },
        ])
      : Promise.resolve([]),
  ]);

  // ── Shape helpers ──────────────────────────────────────────────────────────

  const toStatusMap = (agg: { _id: string; count: number }[]) =>
    agg.reduce<{ draft: number; published: number }>(
      (acc, row) => { acc[row._id as "draft" | "published"] = row.count; return acc; },
      { draft: 0, published: 0 },
    );

  // Zero-fill daily counts so the frontend always has 30 entries.
  const dailyMap = new Map<string, number>(
    dailyAgg.map((d: { _id: string; count: number }) => [d._id, d.count]),
  );
  const dailyCounts: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyCounts.push({ date: key, count: dailyMap.get(key) ?? 0 });
  }

  const byStatus     = toStatusMap(statusAgg);
  const mineByStatus = toStatusMap(mineAgg);

  const body: Record<string, unknown> = {
    total: byStatus.draft + byStatus.published,
    byStatus,
    mine: {
      total:     mineByStatus.draft + mineByStatus.published,
      draft:     mineByStatus.draft,
      published: mineByStatus.published,
    },
    recent: {
      last7Days:  recentAgg[0]?.last7Days  ?? 0,
      last30Days: recentAgg[0]?.last30Days ?? 0,
    },
    dailyCounts,
  };

  if (isManagerOrAbove) {
    body["topAuthors"] = topAuthorsAgg;
  }

  res.status(200).json(body);
};

// ─── POST /reports ────────────────────────────────────────────────────────────

/**
 * Create a new report.
 * Body: CreateReportInput
 *
 * Response 201: created report document
 * Response 400: validation error or user not found
 */
export const createReportHandler = async (req: Request, res: Response): Promise<void> => {
  const { title, description, content, status } = req.body as CreateReportInput;
  const actor = req.user as AuthenticatedUser;

  const userId = await resolveUserId(actor.username);

  const report = await Report.create({
    title,
    description,
    content,
    status,
    createdBy: { username: actor.username, userId },
    updatedBy: { username: actor.username, userId },
  });

  logger.info("Report created", "ReportController", {
    reportId: report._id,
    username: actor.username,
  });

  res.status(201).json(report);
};

// ─── GET /reports ─────────────────────────────────────────────────────────────

/**
 * List reports with optional filtering and pagination.
 * Query: ListReportsQuery
 *
 * Response 200: { data: IReport[], total, page, limit }
 */
export const listReportsHandler = async (req: Request, res: Response): Promise<void> => {
  const { status, search, author, createdAfter, createdBefore, page, limit } = req.query as unknown as ListReportsQuery;

  const filter: Record<string, unknown> = {};
  if (status) filter["status"] = status;
  if (search) filter["title"]  = { $regex: search, $options: "i" };
  if (author) filter["createdBy.username"] = { $regex: author, $options: "i" };

  // Date-range filter on createdAt
  if (createdAfter || createdBefore) {
    const dateFilter: Record<string, Date> = {};
    if (createdAfter)  dateFilter["$gte"] = new Date(createdAfter);
    if (createdBefore) dateFilter["$lte"] = new Date(createdBefore);
    filter["createdAt"] = dateFilter;
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Report.find(filter)
      .select("-content")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Report.countDocuments(filter),
  ]);

  const totalPages  = Math.ceil(total / limit);
  const hasNextPage  = page < totalPages;

  res.status(200).json({ data, total, page, limit, totalPages, hasNextPage });
};

// ─── GET /reports/:id ─────────────────────────────────────────────────────────

/**
 * Get a single report by its MongoDB ObjectId.
 *
 * Response 200: report document (group populated)
 * Response 404: not found
 */
export const getReportHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const report = await Report.findById(id).lean();

  if (!report) {
    throw new NotFoundError(`Report ${id} not found`, "ReportController");
  }

  res.status(200).json(report);
};

// ─── PATCH /reports/:id ───────────────────────────────────────────────────────

/**
 * Update a report.
 * - Owners (createdBy) may update any field.
 * - Managers and admins may update any report.
 * - Other users receive 403.
 *
 * Body: UpdateReportInput
 *
 * Response 200: updated report document
 * Response 403: not the owner and not manager+
 * Response 404: not found
 */
export const updateReportHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const actor = req.user as AuthenticatedUser;
  const updates = req.body as UpdateReportInput;

  const report = await Report.findById(id);
  if (!report) {
    throw new NotFoundError(`Report ${id} not found`, "ReportController");
  }

  const isOwner   = report.createdBy.username === actor.username;
  const isManager = actor.role === "manager" || actor.role === "admin";

  if (!isOwner && !isManager) {
    throw new ForbiddenError("You do not have permission to update this report", "ReportController");
  }

  const userId = await resolveUserId(actor.username);

  const updated = await Report.findByIdAndUpdate(
    id,
    {
      ...updates,
      updatedBy: { username: actor.username, userId },
    },
    { new: true, runValidators: true }
  );

  logger.info("Report updated", "ReportController", {
    reportId: id,
    username: actor.username,
    fields: Object.keys(updates),
  });

  res.status(200).json(updated);
};

// ─── DELETE /reports/:id ──────────────────────────────────────────────────────

/**
 * Delete a report.
 * Restricted to admins and the Reports-Admin group (enforced by route policy).
 *
 * Response 204: no content
 * Response 404: not found
 */
export const deleteReportHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const report = await Report.findByIdAndDelete(id);

  if (!report) {
    throw new NotFoundError(`Report ${id} not found`, "ReportController");
  }

  logger.info("Report deleted", "ReportController", {
    reportId: id,
    username: (req.user as AuthenticatedUser).username,
  });

  res.status(204).end();
};

// ─── GET /reports/archive/yesterday ──────────────────────────────────────────

/**
 * In-memory cache for the archive endpoint. The external energy + weather
 * sources are slow and rate-limited, but yesterday's data doesn't change
 * within a day — so we cache per-date for ~10 minutes to absorb traffic
 * from multiple report views.
 */
interface ArchiveCacheEntry {
  expiresAt: number;
  payload: YesterdayArchivePayload;
}
const ARCHIVE_CACHE_TTL_MS = 10 * 60 * 1000;
const archiveCache = new Map<string, ArchiveCacheEntry>();

const RENEWABLE_FUELS: StationFuel[] = ["solar", "hydro", "wind"];
const DEFAULT_WEATHER_REGION = "gush-dan";

interface YesterdayArchivePayload {
  date: string;
  dayName: string;
  peakConsumptionHour: string | null;
  totalsMwhByFuel: Partial<Record<StationFuel, number>>;
  renewableMwh: number;
  totalIecMwh: number | null;
  totalPrivateMwh: number | null;
  weather: HourlyWeatherSnapshot | null;
  hasData: boolean;
}

/**
 * Returns aggregated information about yesterday's energy production +
 * peak-hour weather. Used by the report's "archive" section.
 *
 * Data is sourced from external integrations (see externalEnergyService /
 * externalWeatherService). When neither integration is configured or both
 * fail, the response still returns 200 with `hasData: false` and zeroed
 * totals — the UI is expected to show a "no data" notice rather than an
 * error.
 *
 * Response 200:
 * ```json
 * {
 *   "date": "2026-04-28T00:00:00.000Z",
 *   "dayName": "יום שלישי",
 *   "peakConsumptionHour": "14:30",
 *   "totalsMwhByFuel": { "gas": 12345, "coal": 678, ... },
 *   "renewableMwh": 432,
 *   "totalIecMwh": 9876,
 *   "totalPrivateMwh": 1234,
 *   "weather": { "temperatureC": 28.5, "feelsLikeC": 30.1, "humidityPct": 65 },
 *   "hasData": true
 * }
 * ```
 */
export const getYesterdayArchiveHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  // Determine target date. Defaults to yesterday; an optional `?date=YYYY-MM-DD`
  // query lets callers fetch any historical day (used by the archive section's
  // "extra days" feature).
  const targetDate = (() => {
    const raw = typeof req.query.date === "string" ? req.query.date : "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const d = new Date(`${raw}T00:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  })();

  const cacheKey = targetDate.toISOString().slice(0, 10);
  const cached = archiveCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.status(200).json(cached.payload);
    return;
  }

  const dayName = new Intl.DateTimeFormat("he-IL", { weekday: "long" })
    .format(targetDate);

  const energy = await getEnergyForDate(targetDate);
  let weather: HourlyWeatherSnapshot | null = null;
  if (energy?.peakHour) {
    weather = await getWeatherAt(targetDate, energy.peakHour, DEFAULT_WEATHER_REGION);
  }

  const totalsMwhByFuel = energy?.totalsMwhByFuel ?? {};
  const renewableMwh = RENEWABLE_FUELS.reduce(
    (sum, k) => sum + (totalsMwhByFuel[k] ?? 0),
    0,
  );

  const payload: YesterdayArchivePayload = {
    date: targetDate.toISOString(),
    dayName,
    peakConsumptionHour: energy?.peakHour ?? null,
    totalsMwhByFuel,
    renewableMwh,
    totalIecMwh: energy?.totalIecMwh ?? null,
    totalPrivateMwh: energy?.totalPrivateMwh ?? null,
    weather,
    hasData: Boolean(energy) || Boolean(weather),
  };

  archiveCache.set(cacheKey, {
    expiresAt: Date.now() + ARCHIVE_CACHE_TTL_MS,
    payload,
  });

  res.status(200).json(payload);
};

// ─── GET /reports/archive/last-year ──────────────────────────────────────────

/**
 * Returns aggregated information about the same calendar day one year ago
 * (relative to yesterday). Used by the report's "archive" section to show
 * a year-over-year comparison alongside yesterday's data.
 *
 * Like `getYesterdayArchiveHandler`, this gracefully degrades to
 * `hasData: false` with zeroed totals when the upstream integrations are
 * not configured or fail.
 */
interface LastYearArchivePayload {
  date: string;
  dayName: string;
  peakConsumptionHour: string | null;
  peakConsumptionMw: number | null;
  totalIecMwh: number | null;
  totalPrivateMwh: number | null;
  totalMwh: number;
  weather: HourlyWeatherSnapshot | null;
  ytdEnergyGrowthPct: number | null;
  hasData: boolean;
}

interface LastYearArchiveCacheEntry {
  expiresAt: number;
  payload: LastYearArchivePayload;
}
const lastYearArchiveCache = new Map<string, LastYearArchiveCacheEntry>();

export const getLastYearSameDayHandler = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  // Same calendar day one year before yesterday.
  const sameDay = new Date();
  sameDay.setUTCDate(sameDay.getUTCDate() - 1);
  sameDay.setUTCFullYear(sameDay.getUTCFullYear() - 1);
  sameDay.setUTCHours(0, 0, 0, 0);

  const cacheKey = sameDay.toISOString().slice(0, 10);
  const cached = lastYearArchiveCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.status(200).json(cached.payload);
    return;
  }

  const dayName = new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(sameDay);

  const energy = await getEnergyForDate(sameDay);
  let weather: HourlyWeatherSnapshot | null = null;
  if (energy?.peakHour) {
    weather = await getWeatherAt(sameDay, energy.peakHour, DEFAULT_WEATHER_REGION);
  }

  const totalIecMwh = energy?.totalIecMwh ?? null;
  const totalPrivateMwh = energy?.totalPrivateMwh ?? null;
  const totalMwh = (totalIecMwh ?? 0) + (totalPrivateMwh ?? 0);

  const payload: LastYearArchivePayload = {
    date: sameDay.toISOString(),
    dayName,
    peakConsumptionHour: energy?.peakHour ?? null,
    peakConsumptionMw:   energy?.peakConsumptionMw ?? null,
    totalIecMwh,
    totalPrivateMwh,
    totalMwh,
    weather,
    ytdEnergyGrowthPct: energy?.ytdEnergyGrowthPct ?? null,
    hasData: Boolean(energy) || Boolean(weather),
  };

  lastYearArchiveCache.set(cacheKey, {
    expiresAt: Date.now() + ARCHIVE_CACHE_TTL_MS,
    payload,
  });

  res.status(200).json(payload);
};
