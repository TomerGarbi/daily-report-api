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
exports.Log = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const LogSchema = new mongoose_1.Schema({
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
    },
    level: {
        type: String,
        required: true,
        enum: ["info", "warn", "error", "debug"],
        index: true,
    },
    message: {
        type: String,
        required: true,
    },
    user: {
        type: String,
        required: true,
        default: "system",
        index: true,
    },
    context: {
        type: String,
        required: false,
    },
    meta: {
        type: mongoose_1.Schema.Types.Mixed,
        required: false,
    },
}, {
    timestamps: false, // We're using our own timestamp field
    collection: "logs",
});
// Index for efficient querying by timestamp and level
LogSchema.index({ timestamp: -1, level: 1 });
// TTL index - automatically delete logs older than 30 days (optional)
// Uncomment the line below if you want automatic log cleanup
// LogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });
exports.Log = mongoose_1.default.model("Log", LogSchema);
//# sourceMappingURL=Log.js.map