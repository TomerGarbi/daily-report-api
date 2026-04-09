import mongoose, { Schema, Document } from "mongoose";

export interface IDenylistedToken extends Document {
  token: string;
  expiresAt: Date;
}

const DenylistedTokenSchema: Schema = new Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
    collection: "denylisted_tokens",
  }
);

// TTL index — MongoDB automatically removes expired documents
DenylistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const DenylistedToken = mongoose.model<IDenylistedToken>(
  "DenylistedToken",
  DenylistedTokenSchema
);
