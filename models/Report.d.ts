import mongoose, { Document, Types } from "mongoose";
export type ReportStatus = "draft" | "published";
/**
 * Minimal reference stored inline on the document.
 * Avoids a second DB round-trip for the most common read pattern.
 */
export interface IUserRef {
    /** sAMAccountName / application username */
    username: string;
    /** MongoDB ObjectId of the user document (when a users collection exists) */
    userId: Types.ObjectId;
}
export interface IReport extends Document {
    /** Short display name for the report. */
    title: string;
    /** One-paragraph summary shown in list views. */
    description: string;
    /** Full report payload — structure TBD. */
    content: Record<string, unknown>;
    /** Lifecycle stage of the report. */
    status: ReportStatus;
    /** Monotonically increasing integer; starts at 1, bumped on every save. */
    version: number;
    /** Who created the report. */
    createdBy: IUserRef;
    /** Who last saved the report (same as createdBy on first save). */
    updatedBy: IUserRef;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Report: mongoose.Model<IReport, {}, {}, {}, mongoose.Document<unknown, {}, IReport, {}, mongoose.DefaultSchemaOptions> & IReport & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IReport>;
//# sourceMappingURL=Report.d.ts.map