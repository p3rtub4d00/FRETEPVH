import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true, enum: ["cnh", "crlv", "selfie"] },
    fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);
const verificationSchema = new mongoose.Schema(
  {
    status: {
      type: String, enum: ["unsubmitted", "pending", "approved", "rejected"],
      default: "unsubmitted",
    },
    plate: { type: String, default: "", maxlength: 7 },
    cnhExpiresAt: { type: Date, default: null },
    crlvYear: { type: Number, default: null },
    rntrc: { type: String, default: "", maxlength: 20 },
    rntrcApplies: { type: Boolean, default: false },
    documents: { type: [documentSchema], default: [] },
    rejectionReason: { type: String, default: "", maxlength: 500 },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: "" },
  },
  { _id: false },
);

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
    verification: { type: verificationSchema, default: () => ({}) },
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
    services: { type: [String], default: [] },
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
    // Pedidos antigos preservam seu veículo; novos são livres para qualquer tipo.
    vehicle: { type: String, default: "" },
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
    refundStatus: { type: String, enum: ["none", "pending", "approved", "rejected", "refunded_simulated"], default: "none" },
    refundReason: { type: String, default: "", maxlength: 500 },
    refundDecisionReason: { type: String, default: "", maxlength: 500 },
    refundAmountCents: { type: Number, default: 0, min: 0 },
    refundStage: { type: String, default: "" },
    refundRequestedAt: { type: Date, default: null },
    refundReviewedAt: { type: Date, default: null },
    refundReviewedBy: { type: String, default: "" },
    refundedAt: { type: Date, default: null },
    refundedBy: { type: String, default: "" },
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

// As conversas e denúncias não são incluídas nas respostas públicas de fretes.
const freightChatSchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Freight", index: true },
  authorId: { type: String, required: true },
  authorRole: { type: String, required: true, enum: ["cliente", "motorista"] },
  content: { type: String, required: true, maxlength: 500 },
}, { timestamps: true });
freightChatSchema.index({ requestId: 1, createdAt: 1 });

const freightReportSchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Freight", index: true },
  reporterId: { type: String, required: true },
  reporterRole: { type: String, enum: ["cliente", "motorista"], required: true },
  reportedId: { type: String, default: "" },
  category: { type: String, enum: ["outside_deal", "inappropriate", "other", "cancel_after_booking"], required: true },
  description: { type: String, required: true, maxlength: 500 },
  status: { type: String, enum: ["pending", "reviewed"], default: "pending" },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });
freightReportSchema.index({ status: 1, createdAt: -1 });

const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ["cliente", "motorista"], required: true },
    endpointHash: { type: String, required: true, unique: true },
    endpoint: { type: String, required: true, maxlength: 2200 },
    p256dh: { type: String, required: true, maxlength: 128 },
    auth: { type: String, required: true, maxlength: 64 },
  },
  { timestamps: true },
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
export const PushSubscription = mongoose.model("PushSubscription", pushSubscriptionSchema);
export const Account = mongoose.model("Account", userSchema);
export const Session = mongoose.model("Session", sessionSchema);
export const Freight = mongoose.model("Freight", freightSchema);
export const FreightChat = mongoose.model("FreightChat", freightChatSchema);
export const FreightReport = mongoose.model("FreightReport", freightReportSchema);
export function verificationStatus(user, now = new Date()) {
  if (user.role !== "motorista") return "not_applicable";
  const v = user.verification;
  if (!v || !v.status || v.status === "unsubmitted") return "unsubmitted";
  if (v.status === "approved" &&
    (v.cnhExpiresAt == null || new Date(v.cnhExpiresAt) < now ||
     v.crlvYear == null || v.crlvYear < now.getFullYear()))
    return "expired";
  return v.status;
}

export function isVerifiedDriver(user, now = new Date()) {
  if (user.role !== "motorista" || user.status !== "approved" ||
      verificationStatus(user, now) !== "approved") return false;
  const v = user.verification;
  return Boolean(
    ["cnh", "crlv", "selfie"].every((kind) =>
      v.documents?.some((document) => document.kind === kind && document.fileId)) &&
    /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(v.plate || "") &&
    (!v.rntrcApplies || /^[0-9]{8,12}$/.test(v.rntrc || "")),
  );
}

export function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    phone: user.phone,
    role: user.role,
    vehicle: user.vehicle,
    status: user.status,
    available: user.role === "motorista" ? isVerifiedDriver(user) : Boolean(user.available),
    acceptsCard: Boolean(user.acceptsCard),
    verified: isVerifiedDriver(user),
    verificationStatus: verificationStatus(user),
    verificationExpiringSoon: Boolean(
      user.role === "motorista" &&
      user.verification?.cnhExpiresAt &&
      new Date(user.verification.cnhExpiresAt).getTime() - Date.now() <
        30 * 24 * 60 * 60 * 1000 &&
      new Date(user.verification.cnhExpiresAt).getTime() >= Date.now()
    ),
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
