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
    acceptsCard: { type: Boolean, default: false },
    pixKey: { type: String, default: "", maxlength: 150 },
    profilePhoto: { type: String, default: "" },
    termsVersion: { type: String, default: "" },
    termsAcceptedAt: { type: Date, default: null },
    privacyNoticeVersion: { type: String, default: "" },
    privacyAcknowledgedAt: { type: Date, default: null },
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
    distanceMeters: { type: Number, default: null, min: 0 },
    durationMinutes: { type: Number, default: null, min: 1 },
    paymentMethod: {
      type: String,
      enum: ["pix_freteon", "card_driver", "cash_driver", null],
      default: null, // Pedidos anteriores não geram comissão retroativa.
    },
    paymentStatus: {
      type: String,
      enum: ["none", "awaiting", "simulated_paid", "received_driver", "refunded_simulated"],
      default: "none",
    },
    agreedPriceCents: { type: Number, default: null, min: 0 },
    commissionCents: { type: Number, default: 0, min: 0 },
    driverNetCents: { type: Number, default: 0, min: 0 },
    commissionRate: { type: Number, default: 10 },
    commissionStatus: {
      type: String,
      enum: ["none", "pending", "paid", "waived"],
      default: "none",
    },
    commissionDueAt: { type: Date, default: null },
    commissionPaymentRequestedAt: { type: Date, default: null },
    commissionPaidAt: { type: Date, default: null },
    payoutStatus: {
      type: String,
      enum: ["none", "available", "requested", "paid_simulated"],
      default: "none",
    },
    payoutRequestedAt: { type: Date, default: null },
    payoutPaidAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    deliveryConfirmedAt: { type: Date, default: null },
    disputeStatus: {
      type: String,
      enum: ["none", "open", "resolved_approved", "resolved_cancelled"],
      default: "none",
    },
    disputeReason: { type: String, default: "", maxlength: 500 },
    disputedAt: { type: Date, default: null },
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

const privacyRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    contact: { type: String, required: true, maxlength: 160 },
    category: { type: String, required: true, enum: ["acesso", "correcao", "eliminacao", "oposicao", "outros"] },
    message: { type: String, required: true, maxlength: 1500 },
    status: { type: String, enum: ["pendente", "atendido"], default: "pendente", index: true },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const PrivacyRequest = mongoose.model("PrivacyRequest", privacyRequestSchema);
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
    acceptsCard: Boolean(user.acceptsCard),
    profilePhoto: user.profilePhoto || "",
    termsVersion: user.termsVersion || "",
    termsAcceptedAt: user.termsAcceptedAt || null,
    privacyNoticeVersion: user.privacyNoticeVersion || "",
    initials: user.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase(),
  };
}
