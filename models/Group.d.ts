import mongoose, { Document } from "mongoose";
export interface IGroup extends Document {
    /** Human-readable group name (e.g. "IT-Admins", "Finance"). */
    name: string;
    /** Timestamps managed by Mongoose. */
    createdAt: Date;
    updatedAt: Date;
}
export declare const Group: mongoose.Model<IGroup, {}, {}, {}, mongoose.Document<unknown, {}, IGroup, {}, mongoose.DefaultSchemaOptions> & IGroup & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IGroup>;
//# sourceMappingURL=Group.d.ts.map