import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  role: { type: String, enum: ["cliente","motorista"], required: true },
  phone: { type: String, required: true },
  name: { type: String, required: true },
  message: { type: String, required: true, maxlength: 500 },
  status: { type: String, enum: ["pending","reviewed"], default: "pending", index: true },
  reviewNote: { type: String, default: "", maxlength: 500 },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: String, default: "" },
}, { timestamps: true });
schema.index({ userId: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
export const BlockedAppeal = mongoose.models.FreteOnBlockedAppeal ||
  mongoose.model("FreteOnBlockedAppeal", schema);
