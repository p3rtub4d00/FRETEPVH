import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    phone: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["cliente", "motorista", "master"],
      required: true,
    },
    vehicle: { type: String, default: "", maxlength: 100 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    available: { type: Boolean, default: false },
  },
  { timestamps: true },
);
userSchema.index(
  { role: 1 },
  { unique: true, partialFilterExpression: { role: "master" } },
);

const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    required: true,
  },
  expiresAt: { type: Date, required: true, expires: 0 },
});
const proposalSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    driverId: { type: String, required: true },
    price: { type: Number, required: true },
    time: { type: String, required: true },
    note: { type: String, default: "" },
  },
  { _id: false },
);
const freightSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    origin: { type: String, required: true },
    destination: { type: String, required: true },
    description: { type: String, required: true },
    vehicle: { type: String, required: true },
    helper: { type: Boolean, default: false },
    date: { type: String, required: true },
    time: { type: String, required: true },
    photos: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["open", "booked", "transit", "completed", "cancelled"],
      default: "open",
      index: true,
    },
    proposals: { type: [proposalSchema], default: [] },
    selectedId: { type: String, default: null },
    driverId: { type: String, default: null, index: true },
    rating: { type: Number, min: 1, max: 5, default: null },
  },
  { timestamps: true, optimisticConcurrency: true },
);

export const Account = mongoose.model("Account", userSchema);
export const Session = mongoose.model("Session", sessionSchema);
export const Freight = mongoose.model("Freight", freightSchema);
export function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    phone: user.phone,
    role: user.role,
    vehicle: user.vehicle,
    status: user.status,
    available: user.available,
    initials: user.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase(),
  };
}
