import mongoose, { Document, Types } from "mongoose";
import { Role } from "../types/auth";
export interface IUser extends Document {
    /** Unique login name — sAMAccountName in AD, or the chosen handle in dev. */
    username: string;
    /**
     * Groups this user belongs to — stored as ObjectId refs to the Group collection.
     * Mirrors the AD group memberships populated at login time.
     */
    groups: Types.ObjectId[];
    /** Resolved application role (derived from groups at login, cached here). */
    role: Role;
    /** Timestamps managed by Mongoose. */
    createdAt: Date;
    updatedAt: Date;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IUser>;
//# sourceMappingURL=User.d.ts.map