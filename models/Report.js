"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Report = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// ─── Schema ───────────────────────────────────────────────────────────────────
const UserRefSchema = new mongoose_1.Schema({
    username: { type: String, required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
}, { _id: false } // embedded sub-doc, no separate _id needed
);
const ReportSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500,
    },
    content: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    status: {
        type: String,
        required: true,
        enum: ["draft", "published"],
        default: "draft",
        index: true,
    },
    version: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
    },
    createdBy: {
        type: UserRefSchema,
        required: true,
    },
    updatedBy: {
        type: UserRefSchema,
        required: true,
    },
}, {
    timestamps: true, // auto-manages createdAt / updatedAt
    versionKey: false,
});
// ─── Indexes ──────────────────────────────────────────────────────────────────
// Fast look-up by creator — "show me all reports I created"
ReportSchema.index({ "createdBy.userId": 1 });
// List view: sort by newest first within a status bucket
ReportSchema.index({ status: 1, createdAt: -1 });
// ─── Hooks ────────────────────────────────────────────────────────────────────
/**
 * Bump the version counter on every update so callers can detect
 * concurrent-edit conflicts without pulling the full document.
 *
 * Hooks are registered for all common update paths so the counter
 * stays consistent regardless of which Mongoose method is used.
 */
ReportSchema.pre("findOneAndUpdate", function () {
    this.set({ $inc: { version: 1 } });
});
ReportSchema.pre("updateOne", function () {
    this.set({ $inc: { version: 1 } });
});
ReportSchema.pre("updateMany", function () {
    this.set({ $inc: { version: 1 } });
});
ReportSchema.pre("save", function () {
    if (!this.isNew) {
        this.version = (this.version ?? 0) + 1;
    }
});
// ─── Model ────────────────────────────────────────────────────────────────────
exports.Report = mongoose_1.default.model("Report", ReportSchema);
//# sourceMappingURL=Report.js.map