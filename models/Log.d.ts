import mongoose, { Document } from "mongoose";
export interface ILog extends Document {
    timestamp: Date;
    level: "info" | "warn" | "error" | "debug";
    message: string;
    user: string;
    context?: string;
    meta?: Record<string, any>;
}
export declare const Log: mongoose.Model<ILog, {}, {}, {}, mongoose.Document<unknown, {}, ILog, {}, mongoose.DefaultSchemaOptions> & ILog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ILog>;
//# sourceMappingURL=Log.d.ts.map