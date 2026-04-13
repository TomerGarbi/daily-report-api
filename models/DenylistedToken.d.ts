import mongoose, { Document } from "mongoose";
export interface IDenylistedToken extends Document {
    token: string;
    expiresAt: Date;
}
export declare const DenylistedToken: mongoose.Model<IDenylistedToken, {}, {}, {}, mongoose.Document<unknown, {}, IDenylistedToken, {}, mongoose.DefaultSchemaOptions> & IDenylistedToken & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IDenylistedToken>;
//# sourceMappingURL=DenylistedToken.d.ts.map