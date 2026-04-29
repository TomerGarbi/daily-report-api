import { Request, Response } from "express";
import { Station } from "../models/Station";
import { AuthenticatedUser } from "../types/auth";
import { NotFoundError, BadRequestError } from "../errors/AppError";
import { logger } from "../services/loggerService";
import type {
  CreateStationInput,
  UpdateStationInput,
  ListStationsQuery,
  UnitInput,
  UpdateUnitInput,
} from "../schemas/stationSchemas";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Throws a `BadRequestError` when the unit tags inside a station collide.
 * Done in code (not a unique sub-doc index) so the error message names
 * the offending tag rather than a cryptic Mongo `E11000`.
 */
function assertUniqueUnitTags(units: { tag: string }[]): void {
  const seen = new Set<string>();
  for (const u of units) {
    const key = u.tag.trim().toLowerCase();
    if (seen.has(key)) {
      throw new BadRequestError(
        `Duplicate unit tag "${u.tag}" within station.`,
        "StationController"
      );
    }
    seen.add(key);
  }
}

// ─── GET /stations ────────────────────────────────────────────────────────────

/**
 * List stations with optional filtering and pagination.
 *
 * Query params (all optional):
 *   type   — filter by ownership type (iec | private)
 *   fuel   — filter by fuel / technology type
 *   search   — case-insensitive substring match against `name` and `tag`
 *   page     — 1-based (default 1)
 *   limit    — page size (default 50, max 200)
 *
 * Response 200: { data, total, page, limit, totalPages, hasNextPage }
 */
export const listStationsHandler = async (req: Request, res: Response): Promise<void> => {
  const { type, fuel, search, page, limit } = req.query as unknown as ListStationsQuery;

  const filter: Record<string, unknown> = {};
  if (type) filter["type"] = type;
  if (fuel) filter["fuel"] = fuel;
  if (search) {
    filter["$or"] = [
      { name: { $regex: search, $options: "i" } },
      { tag:  { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Station.find(filter).sort({ type: 1, name: 1 }).skip(skip).limit(limit).lean(),
    Station.countDocuments(filter),
  ]);

  const totalPages  = Math.max(1, Math.ceil(total / limit));
  const hasNextPage = page < totalPages;

  res.status(200).json({ data, total, page, limit, totalPages, hasNextPage });
};

// ─── GET /stations/:id ────────────────────────────────────────────────────────

export const getStationHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const station = await Station.findById(id).lean();
  if (!station) {
    throw new NotFoundError(`Station ${id} not found`, "StationController");
  }

  res.status(200).json(station);
};

// ─── POST /stations ───────────────────────────────────────────────────────────

export const createStationHandler = async (req: Request, res: Response): Promise<void> => {
  const actor = req.user as AuthenticatedUser;
  const input = req.body as CreateStationInput;

  if (input.units?.length) {
    assertUniqueUnitTags(input.units);
  }

  // Tag uniqueness is enforced by the unique index, but checking up-front
  // gives a clearer error message than the raw E11000 surface.
  const existing = await Station.findOne({ tag: input.tag }).select("_id").lean();
  if (existing) {
    throw new BadRequestError(
      `Station with tag "${input.tag}" already exists.`,
      "StationController"
    );
  }

  const station = await Station.create(input);

  logger.info("Station created", "StationController", {
    stationId: String(station._id),
    tag: station.tag,
    type: station.type,
    fuel: station.fuel,
    createdBy: actor.username,
  });

  res.status(201).json(station);
};

// ─── PATCH /stations/:id ──────────────────────────────────────────────────────

export const updateStationHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const actor  = req.user as AuthenticatedUser;
  const input  = req.body as UpdateStationInput;

  const station = await Station.findById(id);
  if (!station) {
    throw new NotFoundError(`Station ${id} not found`, "StationController");
  }

  if (input.tag && input.tag !== station.tag) {
    const conflict = await Station.findOne({ tag: input.tag, _id: { $ne: id as string } }).select("_id").lean();
    if (conflict) {
      throw new BadRequestError(
        `Station with tag "${input.tag}" already exists.`,
        "StationController"
      );
    }
  }

  if (input.units) {
    assertUniqueUnitTags(input.units);
  }

  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload["name"] = input.name;
  if (input.tag  !== undefined) payload["tag"]  = input.tag;
  if (input.type !== undefined) payload["type"] = input.type;
  if (input.fuel !== undefined) payload["fuel"] = input.fuel;
  if (input.units !== undefined) payload["units"] = input.units;

  const updated = await Station.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true }
  ).lean();

  logger.info("Station updated", "StationController", {
    stationId: id,
    fields: Object.keys(payload),
    updatedBy: actor.username,
  });

  res.status(200).json(updated);
};

// ─── DELETE /stations/:id ─────────────────────────────────────────────────────

export const deleteStationHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const actor  = req.user as AuthenticatedUser;

  const station = await Station.findById(id).select("_id tag").lean();
  if (!station) {
    throw new NotFoundError(`Station ${id} not found`, "StationController");
  }

  await Station.findByIdAndDelete(id);

  logger.info("Station deleted", "StationController", {
    stationId: id,
    tag: station.tag,
    deletedBy: actor.username,
  });

  res.status(204).end();
};

// ─── Unit sub-resource handlers ───────────────────────────────────────────────

/**
 * POST /stations/:id/units — append a unit to an existing station.
 *
 * Returns the updated station document so the client can refresh its cache
 * with one round-trip.
 */
export const addUnitHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const actor  = req.user as AuthenticatedUser;
  const input  = req.body as UnitInput;

  const station = await Station.findById(id);
  if (!station) {
    throw new NotFoundError(`Station ${id} not found`, "StationController");
  }

  // Reject duplicate tags within the same station.
  const lower = input.tag.trim().toLowerCase();
  if (station.units.some((u) => u.tag.trim().toLowerCase() === lower)) {
    throw new BadRequestError(
      `Unit tag "${input.tag}" already exists on station "${station.tag}".`,
      "StationController"
    );
  }

  station.units.push(input);
  await station.save();

  logger.info("Unit added", "StationController", {
    stationId: id,
    unitTag: input.tag,
    addedBy: actor.username,
  });

  res.status(201).json(station);
};

/**
 * PATCH /stations/:id/units/:unitId — partial update of a single unit.
 */
export const updateUnitHandler = async (req: Request, res: Response): Promise<void> => {
  const id     = req.params.id as string;
  const unitId = req.params.unitId as string;
  const actor = req.user as AuthenticatedUser;
  const input = req.body as UpdateUnitInput;

  const station = await Station.findById(id);
  if (!station) {
    throw new NotFoundError(`Station ${id} not found`, "StationController");
  }

  const unit = station.units.id(unitId);
  if (!unit) {
    throw new NotFoundError(
      `Unit ${unitId} not found on station ${id}`,
      "StationController"
    );
  }

  if (input.tag && input.tag !== unit.tag) {
    const lower = input.tag.trim().toLowerCase();
    if (station.units.some((u) => String(u._id) !== unitId && u.tag.trim().toLowerCase() === lower)) {
      throw new BadRequestError(
        `Unit tag "${input.tag}" already exists on station "${station.tag}".`,
        "StationController"
      );
    }
  }

  if (input.tag               !== undefined) unit.tag               = input.tag;
  if (input.installedCapacity !== undefined) unit.installedCapacity = input.installedCapacity;
  if (input.mainFuel          !== undefined) unit.mainFuel          = input.mainFuel;
  if (input.secondaryFuels    !== undefined) unit.secondaryFuels    = input.secondaryFuels;

  await station.save();

  logger.info("Unit updated", "StationController", {
    stationId: id,
    unitId,
    fields: Object.keys(input),
    updatedBy: actor.username,
  });

  res.status(200).json(station);
};

/**
 * DELETE /stations/:id/units/:unitId — remove a unit from a station.
 */
export const removeUnitHandler = async (req: Request, res: Response): Promise<void> => {
  const id     = req.params.id as string;
  const unitId = req.params.unitId as string;
  const actor = req.user as AuthenticatedUser;

  const station = await Station.findById(id);
  if (!station) {
    throw new NotFoundError(`Station ${id} not found`, "StationController");
  }

  const unit = station.units.id(unitId);
  if (!unit) {
    throw new NotFoundError(
      `Unit ${unitId} not found on station ${id}`,
      "StationController"
    );
  }

  unit.deleteOne();
  await station.save();

  logger.info("Unit removed", "StationController", {
    stationId: id,
    unitId,
    removedBy: actor.username,
  });

  res.status(200).json(station);
};
