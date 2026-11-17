import mongoose from "mongoose";
import { Router } from "express";
import { Account, PushSubscription } from "./models.js";
import { fail } from "./auth.js";
import { pushEnabled, sendPush } from "./webPush.js";

const campaignSchema = new mongoose.Schema({
 title:{type:String,required:true,maxlength:90},body:{type:String,required:true,maxlength:180},
 audience:{type:String,enum:["todos","cliente","motorista"],required:true},
 scheduledAt:{type:Date,required:true,index:true},
 status:{type:String,enum:["scheduled","sending","sent","cancelled"],default:"scheduled",index:true},
 createdBy:{type:String,required:true},sentAt:Date,expiresAt:Date,
 imageData:{type:String,default:"",select:false},hasImage:{type:Boolean,default:false},
 recipients:{type:Number,default:0},attempted:{type:Number,default:0},accepted:{type:Number,default:0},failed:{type:Number,default:0},
 lastError:{type:String,default:""}
},{timestamps:true});
const Campaign=mongoose.models.FreteOnCampaign||mongoose.model("FreteOnCampaign",campaignSchema);
const readSchema=new mongoose.Schema({campaignId:{type:mongoose.Schema.Types.ObjectId,required:true},userId:{type:String,required:true},readAt:{type:Date,default:Date.now}});
readSchema.index({campaignId:1,userId:1},{unique:true});
const Read=mongoose.models.FreteOnCampaignRead||mongoose.model("FreteOnCampaignRead",readSchema);
export const campaignsRouter=Router();
const isOwner=req=>req.user.role==="master"&&!req.user.staffAccountId;
function owner(req){if(!isOwner(req))fail(403,"Somente o Master Principal pode gerenciar campanhas.");}
const audienceFilter=a=>a==="todos"?["cliente","motorista"]:[a];
const view=c=>({id:String(c._id),title:c.title,body:c.body,audience:c.audience,scheduledAt:c.scheduledAt,status:c.status,createdAt:c.createdAt,sentAt:c.sentAt,expiresAt:c.expiresAt,recipients:c.recipients,attempted:c.attempted,accepted:c.accepted,failed:c.failed,lastError:c.lastError,hasImage:Boolean(c.hasImage||c.imageData),imageUrl:c.hasImage||c.imageData?"/api/campaigns/media/"+c._id:null});
campaignsRouter.get("/master/campaigns",async(req,res,next)=>{try{owner(req);res.json({items:(await Campaign.find().sort({createdAt:-1}).limit(100).lean()).map(view),pushEnabled:pushEnabled()});}catch(e){next(e)}});
campaignsRouter.post("/master/campaigns",async(req,res,next)=>{try{
 owner(req);
 const title=String(req.body.title||"").trim(),body=String(req.body.body||"").trim(),audience=req.body.audience;
 if(!title||title.length>90||!body||body.length>180||!["todos","cliente","motorista"].includes(audience))fail(400,"Preencha título, mensagem e destinatários.");
 const now=Date.now();let when=now;
 if(req.body.scheduledAt){when=new Date(req.body.scheduledAt).getTime();if(!Number.isFinite(when)||when<now-60000||when>now+365*86400000)fail(400,"Agendamento inválido.");}
 const expiresAt=req.body.expiresAt?new Date(req.body.expiresAt):null;
 if(expiresAt&&(!Number.isFinite(expiresAt.getTime())||expiresAt.getTime()<=when))fail(400,"Validade deve ser posterior ao envio.");
 const imageData=String(req.body.imageData||"");
 if(imageData&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(imageData))fail(400,"Imagem inválida: use PNG, JPG ou WebP.");
 if(imageData.length>470000)fail(413,"Imagem muito grande. Use uma imagem de até 350 KB.");
 const item=await Campaign.create({title,body,audience,scheduledAt:new Date(Math.max(when,now)),expiresAt,createdBy:String(req.user._id),imageData,hasImage:Boolean(imageData)});
 res.status(201).json({item:view(item)});
}catch(e){next(e)}});
campaignsRouter.post("/master/campaigns/:id/cancel",async(req,res,next)=>{try{owner(req);if(!mongoose.isValidObjectId(req.params.id))fail(400,"Campanha inválida.");const item=await Campaign.findOneAndUpdate({_id:req.params.id,status:"scheduled"},{$set:{status:"cancelled"}},{new:true});if(!item)fail(409,"Somente campanhas agendadas podem ser canceladas.");res.json({item:view(item)});}catch(e){next(e)}});
campaignsRouter.post("/master/campaigns/:id/resend",async(req,res,next)=>{try{
 owner(req);
 if(!mongoose.isValidObjectId(req.params.id))fail(400,"Campanha inválida.");
 const original=await Campaign.findById(req.params.id).select("+imageData").lean();
 if(!original)fail(404,"Campanha não encontrada.");
 if(original.status==="sending")fail(409,"Aguarde a conclusão do envio atual.");
 const copy=await Campaign.create({
  title:original.title,body:original.body,audience:original.audience,
  imageData:original.imageData||"",hasImage:Boolean(original.hasImage),
  scheduledAt:new Date(),expiresAt:null,createdBy:String(req.user._id)
 });
 res.status(201).json({item:view(copy)});
}catch(e){next(e)}});
campaignsRouter.delete("/master/campaigns/:id",async(req,res,next)=>{try{
 owner(req);
 if(!mongoose.isValidObjectId(req.params.id))fail(400,"Campanha inválida.");
 const deleted=await Campaign.findOneAndDelete({_id:req.params.id,status:{$ne:"sending"}});
 if(!deleted)fail(409,"Campanha inexistente ou ainda em processamento.");
 await Read.deleteMany({campaignId:deleted._id});
 res.json({ok:true});
}catch(e){next(e)}});
// Imagens só são públicas após o envio e enquanto o comunicado estiver válido.
export async function campaignMedia(req,res,next){try{
 if(!mongoose.isValidObjectId(req.params.id))return res.sendStatus(404);
 const now=new Date();
 const item=await Campaign.findOne({_id:req.params.id,status:"sent",sentAt:{$lte:now},$or:[{expiresAt:null},{expiresAt:{$gt:now}}]}).select("+imageData").lean();
 if(!item?.imageData)return res.sendStatus(404);
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(item.imageData);
 if(!match)return res.sendStatus(404);
 res.setHeader("Content-Type","image/"+match[1]);res.setHeader("Cache-Control","public,max-age=3600");res.setHeader("X-Content-Type-Options","nosniff");
 res.send(Buffer.from(match[2],"base64"));
}catch(e){next(e)}}
campaignsRouter.get("/campaigns/inbox",async(req,res,next)=>{try{
 const role=req.user.role;if(!["cliente","motorista"].includes(role))return res.json({items:[]});
 const now=new Date();
 const items=await Campaign.find({status:"sent",audience:{$in:["todos",role]},sentAt:{$lte:now},$or:[{expiresAt:null},{expiresAt:{$gt:now}}]}).sort({sentAt:-1}).limit(60).lean();
 const ids=items.map(i=>i._id);const reads=await Read.find({userId:String(req.user._id),campaignId:{$in:ids}}).select("campaignId").lean();
 const readSet=new Set(reads.map(r=>String(r.campaignId)));
 res.json({items:items.map(i=>({...view(i),read:readSet.has(String(i._id))}))});
}catch(e){next(e)}});
campaignsRouter.post("/campaigns/:id/read",async(req,res,next)=>{try{
 if(!mongoose.isValidObjectId(req.params.id))fail(400,"Aviso inválido.");
 const item=await Campaign.findOne({_id:req.params.id,status:"sent",audience:{$in:["todos",req.user.role]}});
 if(!item)fail(404,"Aviso não encontrado.");
 await Read.updateOne({campaignId:item._id,userId:String(req.user._id)},{$setOnInsert:{readAt:new Date()}},{upsert:true});
 res.json({ok:true});
}catch(e){next(e)}});
let working=false;
export async function dispatchDueCampaigns(){
 if(working||mongoose.connection.readyState!==1)return;working=true;
 try{
  for(let n=0;n<3;n++){
   const item=await Campaign.findOneAndUpdate({status:"scheduled",scheduledAt:{$lte:new Date()}},{$set:{status:"sending"}},{new:true,sort:{scheduledAt:1}});
   if(!item)break;
   try{
    const roles=audienceFilter(item.audience);
    const recipients=await Account.find({role:{$in:roles}}).select("_id").lean();
    const ids=recipients.map(r=>String(r._id));
    const subs=await PushSubscription.find({userId:{$in:ids}}).lean();
    // Publica o comunicado antes do push para permitir carregar a imagem imediatamente.
    await Campaign.updateOne({_id:item._id},{$set:{status:"sent",sentAt:new Date(),recipients:ids.length}});
    let accepted=0,failed=0,attempted=0;
    // Small batches to avoid overwhelming push providers and the application.
    for(let i=0;i<subs.length;i+=12){
      const results=await Promise.allSettled(subs.slice(i,i+12).map(async sub=>{
       const response=await sendPush(sub,{title:item.title,body:item.body,role:sub.role,id:String(item._id),campaignId:String(item._id),image:item.hasImage?"/api/campaigns/media/"+item._id:undefined});
       if(response.gone)await PushSubscription.deleteOne({_id:sub._id});
       return response.ok;
      }));
      for(const r of results){attempted++;if(r.status==="fulfilled"&&r.value)accepted++;else failed++;}
    }
    await Campaign.updateOne({_id:item._id},{$set:{status:"sent",sentAt:new Date(),recipients:ids.length,attempted,accepted,failed}});
   }catch(e){
    await Campaign.updateOne({_id:item._id},{$set:{status:"sent",sentAt:new Date(),lastError:"Falha parcial no envio push. O comunicado permanece disponível na caixa de entrada."}});
    console.warn("Campanha push:",e?.name||"Erro");
   }
  }
 }finally{working=false;}
}
