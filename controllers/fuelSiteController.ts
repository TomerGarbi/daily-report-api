import { Request, Response } from "express";
import { FuelSite } from "../models/FuelSite";
import { AuthenticatedUser } from "../types/auth";
import { NotFoundError, BadRequestError } from "../errors/AppError";
import { logger } from "../services/loggerService";
import type {
  CreateFuelSiteInput,
  UpdateFuelSiteInput,
  ListFuelSitesQuery,
  TankInput,
  UpdateTankInput,
} from "../schemas/fuelSiteSchemas";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertUniqueTankNames(tanks: { name: string }[]): void {
  const seen = new Set<string>();
  for (const t of tanks) {
    const key = t.name.trim().toLowerCase();
    if (seen.has(key)) {
      throw new BadRequestError(
        `Duplicate tank name "${t.name}" within fuel site.`,
        "FuelSiteController"
      );
    }
    seen.add(key);
  }
}

/**
 * Every tank's `fuelType` must appear in the site's declared `fuelTypes` list.
 */
function assertTanksMatchFuelTypes(
  fuelTypes: readonly string[] | undefined,
  tanks: { name: string; fuelType: string }[],
): void {
  if (!fuelTypes || fuelTypes.length === 0 || tanks.length === 0) return;
  const allowed = new Set(fuelTypes);
  for (const t of tanks) {
    if (!allowed.has(t.fuelType)) {
      throw new BadRequestError(
        `Tank "${t.name}" uses fuel "${t.fuelType}" which is not declared on the site.`,
        "FuelSiteController"
      );
    }
  }
}

// ─── GET /fuel-sites ──────────────────────────────────────────────────────────

export const listFuelSitesHandler = async (req: Request, res: Response): Promise<void> => {
  const { fuel, search, page, limit } = req.query as unknown as ListFuelSitesQuery;

  const filter: Record<string, unknown> = {};
  if (fuel) filter["fuelTypes"] = fuel;
  if (search) {
    filter["$or"] = [
      { name: { $regex: search, $options: "i" } },
      { tag:  { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    FuelSite.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    FuelSite.countDocuments(filter),
  ]);

  const totalPages  = Math.max(1, Math.ceil(total / limit));
  const hasNextPage = page < totalPages;

  res.status(200).json({ data, total, page, limit, totalPages, hasNextPage });
};

// ─── GET /fuel-sites/:id ──────────────────────────────────────────────────────

export const getFuelSiteHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const site = await FuelSite.findById(id).lean();
  if (!site) throw new NotFoundError(`Fuel site ${id} not found`, "FuelSiteController");
  res.status(200).json(site);
};

// ─── POST /fuel-sites ─────────────────────────────────────────────────────────

export const createFuelSiteHandler = async (req: Request, res: Response): Promise<void> => {
  const actor = req.user as AuthenticatedUser;
  const input = req.body as CreateFuelSiteInput;

  if (input.tanks?.length) {
    assertUniqueTankNames(input.tanks);
    assertTanksMatchFuelTypes(input.fuelTypes, input.tanks);
  }

  const existing = await FuelSite.findOne({ tag: input.tag }).select("_id").lean();
  if (existing) {
    throw new BadRequestError(
      `Fuel site with tag "${input.tag}" already exists.`,
      "FuelSiteController"
    );
  }

  const site = await FuelSite.create(input);

  logger.info("Fuel site created", "FuelSiteController", {
    fuelSiteId: String(site._id),
    tag: site.tag,
    createdBy: actor.username,
  });

  res.status(201).json(site);
};

// ─── PATCH /fuel-sites/:id ────────────────────────────────────────────────────

export const updateFuelSiteHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const actor  = req.user as AuthenticatedUser;
  const input  = req.body as UpdateFuelSiteInput;

  const site = await FuelSite.findById(id);
  if (!site) throw new NotFoundError(`Fuel site ${id} not found`, "FuelSiteController");

  if (input.tag && input.tag !== site.tag) {
    const conflict = await FuelSite.findOne({ tag: input.tag, _id: { $ne: id as string } }).select("_id").lean();
    if (conflict) {
      throw new BadRequestError(
        `Fuel site with tag "${input.tag}" already exists.`,
        "FuelSiteController"
      );
    }
  }

  if (input.tanks) {
    assertUniqueTankNames(input.tanks);
    const effectiveFuelTypes = input.fuelTypes ?? site.fuelTypes;
    assertTanksMatchFuelTypes(effectiveFuelTypes, input.tanks);
  }

  const payload: Record<string, unknown> = {};
  if (input.name      !== undefined) payload["name"]      = input.name;
  if (input.tag       !== undefined) payload["tag"]       = input.tag;
  if (input.fuelTypes !== undefined) payload["fuelTypes"] = input.fuelTypes;
  if (input.tanks     !== undefined) payload["tanks"]     = input.tanks;

  const updated = await FuelSite.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true }
  ).lean();

  logger.info("Fuel site updated", "FuelSiteController", {
    fuelSiteId: id,
    fields: Object.keys(payload),
    updatedBy: actor.username,
  });

  res.status(200).json(updated);
};

// ─── DELETE /fuel-sites/:id ───────────────────────────────────────────────────

export const deleteFuelSiteHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const actor  = req.user as AuthenticatedUser;

  const site = await FuelSite.findById(id).select("_id tag").lean();
  if (!site) throw new NotFoundError(`Fuel site ${id} not found`, "FuelSiteController");

  await FuelSite.findByIdAndDelete(id);

  logger.info("Fuel site deleted", "FuelSiteController", {
    fuelSiteId: id,
    tag: site.tag,
    deletedBy: actor.username,
  });

  res.status(204).end();
};

// ─── Tank sub-resource ────────────────────────────────────────────────────────

export const addTankHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const actor  = req.user as AuthenticatedUser;
  const input  = req.body as TankInput;

  const site = await FuelSite.findById(id);
  if (!site) throw new NotFoundError(`Fuel site ${id} not found`, "FuelSiteController");

  const lower = input.name.trim().toLowerCase();
  if (site.tanks.some((t) => t.name.trim().toLowerCase() === lower)) {
    throw new BadRequestError(
      `Tank "${input.name}" already exists on fuel site "${site.tag}".`,
      "FuelSiteController"
    );
  }

  if (site.fuelTypes.length > 0 && !site.fuelTypes.includes(input.fuelType)) {
    throw new BadRequestError(
      `Tank fuel "${input.fuelType}" is not declared on site "${site.tag}".`,
      "FuelSiteController"
    );
  }

  site.tanks.push(input);
  await site.save();

  logger.info("Tank added", "FuelSiteController", {
    fuelSiteId: id,
    tankName: input.name,
    addedBy: actor.username,
  });

  res.status(201).json(site);
};

export const updateTankHandler = async (req: Request, res: Response): Promise<void> => {
  const id     = req.params.id as string;
  const tankId = req.params.tankId as string;
  const actor  = req.user as AuthenticatedUser;
  const input  = req.body as UpdateTankInput;

  const site = await FuelSite.findById(id);
  if (!site) throw new NotFoundError(`Fuel site ${id} not found`, "FuelSiteController");

  const tank = site.tanks.id(tankId);
  if (!tank) {
    throw new NotFoundError(
      `Tank ${tankId} not found on fuel site ${id}`,
      "FuelSiteController"
    );
  }

  if (input.name && input.name !== tank.name) {
    const lower = input.name.trim().toLowerCase();
    if (site.tanks.some((t) => String(t._id) !== tankId && t.name.trim().toLowerCase() === lower)) {
      throw new BadRequestError(
        `Tank "${input.name}" already exists on fuel site "${site.tag}".`,
        "FuelSiteController"
      );
    }
  }

  if (input.fuelType && site.fuelTypes.length > 0 && !site.fuelTypes.includes(input.fuelType)) {
    throw new BadRequestError(
      `Tank fuel "${input.fuelType}" is not declared on site "${site.tag}".`,
      "FuelSiteController"
    );
  }

  if (input.name     !== undefined) tank.name     = input.name;
  if (input.fuelType !== undefined) tank.fuelType = input.fuelType;
  if (input.capacity !== undefined) tank.capacity = input.capacity;

  await site.save();

  logger.info("Tank updated", "FuelSiteController", {
    fuelSiteId: id,
    tankId,
    fields: Object.keys(input),
    updatedBy: actor.username,
  });

  res.status(200).json(site);
};

export const removeTankHandler = async (req: Request, res: Response): Promise<void> => {
  const id     = req.params.id as string;
  const tankId = req.params.tankId as string;
  const actor  = req.user as AuthenticatedUser;

  const site = await FuelSite.findById(id);
  if (!site) throw new NotFoundError(`Fuel site ${id} not found`, "FuelSiteController");

  const tank = site.tanks.id(tankId);
  if (!tank) {
    throw new NotFoundError(
      `Tank ${tankId} not found on fuel site ${id}`,
      "FuelSiteController"
    );
  }

  tank.deleteOne();
  await site.save();

  logger.info("Tank removed", "FuelSiteController", {
    fuelSiteId: id,
    tankId,
    removedBy: actor.username,
  });

  res.status(200).json(site);
};
