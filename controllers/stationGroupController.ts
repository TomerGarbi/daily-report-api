import { Request, Response } from "express";
import { StationGroup } from "../models/StationGroup";
import { Station } from "../models/Station";
import { AuthenticatedUser } from "../types/auth";
import { NotFoundError, BadRequestError } from "../errors/AppError";
import { logger } from "../services/loggerService";
import { audit } from "../services/auditService";
import type {
  CreateStationGroupInput,
  UpdateStationGroupInput,
  ListStationGroupsQuery,
} from "../schemas/stationGroupSchemas";

// ─── GET /station-groups ──────────────────────────────────────────────────────

export const listStationGroupsHandler = async (req: Request, res: Response): Promise<void> => {
  const { type, search, page, limit } = req.query as unknown as ListStationGroupsQuery;

  const filter: Record<string, unknown> = {};
  if (type) filter["type"] = type;
  if (search) {
    filter["$or"] = [
      { name: { $regex: search, $options: "i" } },
      { tag:  { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    StationGroup.find(filter)
      .sort({ type: 1, order: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StationGroup.countDocuments(filter),
  ]);

  const totalPages  = Math.max(1, Math.ceil(total / limit));
  const hasNextPage = page < totalPages;

  res.status(200).json({ data, total, page, limit, totalPages, hasNextPage });
};

// ─── GET /station-groups/:id ──────────────────────────────────────────────────

export const getStationGroupHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const group = await StationGroup.findById(id).lean();
  if (!group) {
    throw new NotFoundError(`Station group ${id} not found`, "StationGroupController");
  }
  res.status(200).json(group);
};

// ─── POST /station-groups ─────────────────────────────────────────────────────

export const createStationGroupHandler = async (req: Request, res: Response): Promise<void> => {
  const actor = req.user as AuthenticatedUser;
  const input = req.body as CreateStationGroupInput;

  const [tagConflict, nameConflict] = await Promise.all([
    StationGroup.findOne({ tag: input.tag }).select("_id").lean(),
    StationGroup.findOne({ type: input.type, name: input.name }).select("_id").lean(),
  ]);
  if (tagConflict) {
    throw new BadRequestError(
      `Station group with tag "${input.tag}" already exists.`,
      "StationGroupController",
    );
  }
  if (nameConflict) {
    throw new BadRequestError(
      `Station group "${input.name}" already exists for ${input.type}.`,
      "StationGroupController",
    );
  }

  const createPayload: Record<string, unknown> = {
    name: input.name,
    tag:  input.tag,
    type: input.type,
    order: input.order,
  };
  if (input.description !== undefined) createPayload["description"] = input.description;

  const group = await StationGroup.create(createPayload);

  logger.info("Station group created", "StationGroupController", {
    groupId: String(group._id),
    tag: group.tag,
    type: group.type,
    createdBy: actor.username,
  });
  audit.recordSuccess({
    req,
    action: "stationGroup.create",
    resource: { type: "stationGroup", id: String(group._id), label: group.tag },
    after: { tag: group.tag, name: group.name, type: group.type },
  });

  res.status(201).json(group);
};

// ─── PATCH /station-groups/:id ────────────────────────────────────────────────

export const updateStationGroupHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const actor  = req.user as AuthenticatedUser;
  const input  = req.body as UpdateStationGroupInput;

  const group = await StationGroup.findById(id);
  if (!group) {
    throw new NotFoundError(`Station group ${id} not found`, "StationGroupController");
  }

  if (input.tag && input.tag !== group.tag) {
    const conflict = await StationGroup.findOne({ tag: input.tag, _id: { $ne: id as string } }).select("_id").lean();
    if (conflict) {
      throw new BadRequestError(
        `Station group with tag "${input.tag}" already exists.`,
        "StationGroupController",
      );
    }
  }

  const nextType = input.type ?? group.type;
  const nextName = input.name ?? group.name;
  if ((input.name && input.name !== group.name) || (input.type && input.type !== group.type)) {
    const nameConflict = await StationGroup.findOne({
      type: nextType,
      name: nextName,
      _id: { $ne: id as string },
    }).select("_id").lean();
    if (nameConflict) {
      throw new BadRequestError(
        `Station group "${nextName}" already exists for ${nextType}.`,
        "StationGroupController",
      );
    }
  }

  // Changing the type would strand stations whose own type differs; block it
  // when any station still references the group.
  if (input.type && input.type !== group.type) {
    const stationCount = await Station.countDocuments({ groupId: id as string });
    if (stationCount > 0) {
      throw new BadRequestError(
        `Cannot change type of group "${group.tag}" while ${stationCount} stations reference it. Reassign the stations first.`,
        "StationGroupController",
      );
    }
  }

  const payload: Record<string, unknown> = {};
  if (input.name        !== undefined) payload["name"]        = input.name;
  if (input.tag         !== undefined) payload["tag"]         = input.tag;
  if (input.type        !== undefined) payload["type"]        = input.type;
  if (input.order       !== undefined) payload["order"]       = input.order;
  if (input.description !== undefined) payload["description"] = input.description;

  const updated = await StationGroup.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true },
  ).lean();

  logger.info("Station group updated", "StationGroupController", {
    groupId: id,
    fields: Object.keys(payload),
    updatedBy: actor.username,
  });
  audit.recordSuccess({
    req,
    action: "stationGroup.update",
    resource: { type: "stationGroup", id: id as string, label: group.tag },
    meta: { changedFields: Object.keys(payload) },
  });

  res.status(200).json(updated);
};

// ─── DELETE /station-groups/:id ───────────────────────────────────────────────

export const deleteStationGroupHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const actor  = req.user as AuthenticatedUser;

  const group = await StationGroup.findById(id).select("_id tag").lean();
  if (!group) {
    throw new NotFoundError(`Station group ${id} not found`, "StationGroupController");
  }

  // Refuse to delete a group that still owns stations to prevent silent data loss.
  const stationCount = await Station.countDocuments({ groupId: id as string });
  if (stationCount > 0) {
    throw new BadRequestError(
      `Cannot delete group "${group.tag}" while ${stationCount} stations reference it. Reassign the stations first.`,
      "StationGroupController",
    );
  }

  await StationGroup.findByIdAndDelete(id);

  logger.info("Station group deleted", "StationGroupController", {
    groupId: id,
    tag: group.tag,
    deletedBy: actor.username,
  });
  audit.recordSuccess({
    req,
    action: "stationGroup.delete",
    resource: { type: "stationGroup", id: id as string, label: group.tag },
    before: { tag: group.tag },
  });

  res.status(204).end();
};
