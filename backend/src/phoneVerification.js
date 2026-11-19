import { Router } from "express";
import mongoose from "mongoose";
import { randomInt, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { Account } from "./models.js";
import { authorize, fail } from "./auth.js";
import { notifyMasters } from "./webPush.js";

const verificationSchema=new mongoose.Schema({
 userId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 phone:{type:String,required:true},name:{type:String,required:true},
 role:{type:String,enum:["cliente","motorista"],required:true},
 status:{type:String,enum:["pending","issued","verified","cancelled","expired"],default:"pending",index:true},
 codeHash:{type:String,default:"",select:false},salt:{type:String,default:"",select:false},
 expiresAt:{type:Date,default:null},attempts:{type:Number,default:0},
 issuedAt:Date,issuedBy:String,verifiedAt:Date
},{timestamps:true});
verificationSchema.index({status:1,createdAt:-1});
const Verification=mongoose.models.FreteOnPhoneVerification||mongoose.model("FreteOnPhoneVerification",verificationSchema);
const limiter=(limit)=>rateLimit({windowMs:15*60*1000,limit,standardHeaders:"draft-7",legacyHeaders:false,message:{error:"Muitas tentativas. Aguarde 15 minutos."}});
const hash=(salt,code)=>createHmac("sha256",salt).update(code).digest("hex");
export const phoneVerification=Router();
const principal=req=>{if(req.user.role!=="master"||req.user.staffAccountId)fail(403,"Somente o Master Principal pode gerar códigos de verificação.");};
export function requireVerifiedPhone(req,_res,next){
 if(!["cliente","motorista"].includes(req.user.role)||!req.user.phoneVerifiedAt||req.user.phoneVerifiedNumber!==req.user.phone)
  fail(403,"Verifique seu celular em Meu perfil antes de realizar esta operação.");
 next();
}
phoneVerification.get("/phone-verification/status",authorize("cliente","motorista"),async(req,res)=>{
 const current=await Verification.findOne({userId:req.user._id,phone:req.user.phone,status:{$in:["pending","issued"]}}).sort({createdAt:-1}).lean();
 res.json({verified:Boolean(req.user.phoneVerifiedAt&&req.user.phoneVerifiedNumber===req.user.phone),status:current?.status||"none",expiresAt:current?.expiresAt||null,phone:req.user.phone});
});
phoneVerification.post("/phone-verification/request",authorize("cliente","motorista"),limiter(5),async(req,res)=>{
 if(req.user.phoneVerifiedAt&&req.user.phoneVerifiedNumber===req.user.phone)return res.json({message:"Este celular já está verificado."});
 const recent=await Verification.findOne({userId:req.user._id,phone:req.user.phone,status:{$in:["pending","issued"]},createdAt:{$gt:new Date(Date.now()-5*60000)}});
 if(recent)return res.json({message:"Solicitação já registrada. Aguarde o envio pelo Master."});
 await Verification.updateMany({userId:req.user._id,status:{$in:["pending","issued"]}},{$set:{status:"cancelled",codeHash:"",salt:""}});
 await Verification.create({userId:req.user._id,phone:req.user.phone,name:req.user.name,role:req.user.role});
 void notifyMasters({title:"Verificação de celular solicitada",body:"Há uma solicitação de confirmação de telefone no painel Master.",category:"verificacao-telefone",id:String(req.user._id)});
 res.json({message:"Solicitação enviada ao Master. Aguarde o código pelo WhatsApp."});
});
phoneVerification.post("/phone-verification/confirm",authorize("cliente","motorista"),limiter(12),async(req,res)=>{
 const code=String(req.body?.code||"");
 if(!/^\d{6}$/.test(code))fail(400,"Informe o código de 6 dígitos.");
 const item=await Verification.findOne({userId:req.user._id,phone:req.user.phone,status:"issued"}).sort({issuedAt:-1}).select("+codeHash +salt");
 if(!item||!item.expiresAt||item.expiresAt<=new Date()||item.attempts>=5)fail(400,"Código expirado ou bloqueado. Solicite outro.");
 const expected=Buffer.from(item.codeHash,"hex"),supplied=Buffer.from(hash(item.salt,code),"hex");
 if(!timingSafeEqual(expected,supplied)){
  await Verification.updateOne({_id:item._id,status:"issued"},{$inc:{attempts:1}});
  fail(400,"Código incorreto. Confira o WhatsApp.");
 }
 const claimed=await Verification.findOneAndUpdate({_id:item._id,status:"issued",phone:req.user.phone,expiresAt:{$gt:new Date()},attempts:{$lt:5}},{$set:{status:"verified",verifiedAt:new Date(),codeHash:"",salt:""}},{new:true});
 if(!claimed)fail(409,"Este código já foi utilizado.");
 await Account.updateOne({_id:req.user._id,phone:claimed.phone},{$set:{phoneVerifiedAt:new Date(),phoneVerifiedNumber:claimed.phone}});
 await Verification.updateMany({userId:req.user._id,status:{$in:["pending","issued"]}},{$set:{status:"cancelled",codeHash:"",salt:""}});
 res.json({message:"Telefone confirmado com sucesso!",verified:true});
});
phoneVerification.get("/master/phone-verifications",authorize("master"),async(req,res)=>{
 principal(req);
 const items=await Verification.find().sort({createdAt:-1}).limit(100).lean();
 res.json({items:items.map(x=>({id:String(x._id),name:x.name,phone:x.phone,role:x.role,status:x.status,createdAt:x.createdAt,expiresAt:x.expiresAt,verifiedAt:x.verifiedAt}))});
});
phoneVerification.post("/master/phone-verifications/:id/issue",authorize("master"),limiter(30),async(req,res)=>{
 principal(req);
 if(!mongoose.isValidObjectId(req.params.id))fail(400,"Solicitação inválida.");
 const item=await Verification.findOne({_id:req.params.id,status:{$in:["pending","issued"]}});
 if(!item)fail(404,"Solicitação não encontrada.");
 const account=await Account.findById(item.userId);
 if(!account||account.phone!==item.phone||account.role!==item.role)fail(409,"O telefone cadastrado foi alterado. Peça nova solicitação.");
 const code=String(randomInt(0,1000000)).padStart(6,"0"),salt=randomBytes(32).toString("hex");
 const updated=await Verification.findOneAndUpdate({_id:item._id,status:{$in:["pending","issued"]}},{$set:{status:"issued",codeHash:hash(salt,code),salt,attempts:0,issuedAt:new Date(),issuedBy:String(req.user._id),expiresAt:new Date(Date.now()+10*60000)}},{new:true});
 if(!updated)fail(409,"Solicitação já encerrada.");
 res.json({code,phone:item.phone,name:item.name,expiresAt:updated.expiresAt});
});
phoneVerification.post("/master/phone-verifications/:id/cancel",authorize("master"),async(req,res)=>{
 principal(req);
 if(!mongoose.isValidObjectId(req.params.id))fail(400,"Solicitação inválida.");
 await Verification.updateOne({_id:req.params.id,status:{$in:["pending","issued"]}},{$set:{status:"cancelled",codeHash:"",salt:""}});
 res.json({ok:true});
});
