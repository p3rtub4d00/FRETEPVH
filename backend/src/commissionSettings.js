import mongoose from "mongoose";
import { Router } from "express";
import { authorize, fail } from "./auth.js";
import { Account } from "./models.js";
const schema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  standardRate: { type: Number, default: 10, min: 0, max: 100 },
  introductoryRate: { type: Number, default: 5, min: 0, max: 100 },
  updatedBy: String
}, { timestamps: true });
const Config = mongoose.models.FreteOnCommissionConfig || mongoose.model("FreteOnCommissionConfig", schema);
export const commissionRouter = Router();
export async function commissionConfig() {
  const item = await Config.findOne({ key: "global" }).lean();
  return { standardRate: item?.standardRate ?? 10, introductoryRate: item?.introductoryRate ?? 5, introductoryDays: 30 };
}
export function commissionForDriver(driver, config, now = Date.now()) {
  const joined = driver?.createdAt ? new Date(driver.createdAt).getTime() : 0;
  const promotional = Number.isFinite(joined) && joined > 0 && now < joined + config.introductoryDays * 86400000;
  return { rate: promotional ? config.introductoryRate : config.standardRate, promotional, promotionEndsAt: promotional ? new Date(joined + config.introductoryDays * 86400000) : null };
}
commissionRouter.get("/commission/current", authorize("motorista"), async (req,res) => {
  const config = await commissionConfig();
  res.json({ ...commissionForDriver(req.user, config), ...config });
});
commissionRouter.get("/master/commission", authorize("master"), async (_req,res) => res.json(await commissionConfig()));
commissionRouter.patch("/master/commission", authorize("master"), async (req,res) => {
  const { standardRate, introductoryRate } = req.body || {};
  if (![standardRate,introductoryRate].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100 && Math.round(n*100) === n*100))
    fail(400,"Informe porcentagens entre 0 e 100, com até duas casas decimais.");
  await Config.findOneAndUpdate({ key:"global" }, { $set:{ standardRate,introductoryRate,updatedBy:String(req.user._id) } }, { upsert:true, runValidators:true });
  res.json(await commissionConfig());
});
