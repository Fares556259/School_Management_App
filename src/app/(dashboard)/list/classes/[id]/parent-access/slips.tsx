"use client";
import { useState } from "react";
import Link from "next/link";
import { Printer, KeyRound, ArrowLeft } from "lucide-react";
import { prepareClassParentSlips } from "./actions";
type Target={id:number;name:string;students:{id:string;name:string;surname:string;parent:{name:string;surname:string;phone:string;accessStatus:string}|null}[]};
type Packet=Extract<Awaited<ReturnType<typeof prepareClassParentSlips>>,{success:true}>;
export default function ParentAccessSlips({target}:{target:Target}){
 const [packet,setPacket]=useState<Packet|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function prepare(){setBusy(true);setError("");try{const result=await prepareClassParentSlips(target.id);if(!result.success)throw new Error(result.error);setPacket(result);}catch(e){setError(e instanceof Error?e.message:"Erreur");}finally{setBusy(false);}}
 return <main className="p-4 md:p-8">
 <section className="slip-controls mx-auto max-w-5xl space-y-5">
 <Link href={`/list/classes/${target.id}`} className="inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/>Retour à la classe</Link>
 <div><h1 className="text-2xl font-semibold text-slate-900">Accès parents · {target.name}</h1><p className="mt-2 text-sm text-slate-600">Une fiche par enfant. Un seul compte et le même code pour tous les enfants d’un responsable, même dans d’autres classes.</p></div>
 <div className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-600">Préparer les fiches active les comptes sans mot de passe. Les mots de passe personnels existants ne sont pas remplacés. Les fiches contiennent des accès privés : remettez chaque fiche au bon enfant.</p><div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} onClick={prepare} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><KeyRound size={17}/>{busy?"Préparation…":packet?"Actualiser les fiches":"Préparer les accès de cette classe"}</button>{packet&&<button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold"><Printer size={17}/>Imprimer les fiches A4</button>}</div></div>
 {error&&<p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
 {packet&&<p role="status" className="text-sm text-emerald-700">{packet.cards.filter(c=>c.code).length} fiches avec code · {packet.cards.filter(c=>!c.code).length} comptes à vérifier. Les réimpressions conservent les mêmes codes.</p>}
 {!packet&&<div className="overflow-auto rounded-xl border bg-white"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Élève</th><th>Responsable</th><th>Téléphone</th><th>Accès</th></tr></thead><tbody>{target.students.map(s=><tr key={s.id} className="border-t"><td className="p-3" dir="auto">{s.name} {s.surname}</td><td dir="auto">{s.parent?.name} {s.parent?.surname}</td><td>{s.parent?.phone||"—"}</td><td>{s.parent?.accessStatus||"Non lié"}</td></tr>)}</tbody></table></div>}
 </section>
 {packet&&<div className="parent-slips mx-auto mt-6">{packet.cards.map(card=><article className="parent-slip" key={card.studentId}>
 <header><strong>{packet.school}</strong><span>Classe {packet.className}</span></header>
 <h2 dir="auto">{card.studentName}</h2><p dir="auto">Responsable : {card.parentName||"Non renseigné"}</p>
 <div className="slip-credentials"><p>Téléphone / الهاتف <b dir="ltr">{card.phone||"—"}</b></p><p>Code / رمز الدخول <b dir="ltr">{card.code||"—"}</b></p></div>
 {card.code?<><p>Ouvrez SnapSchool → Parent → saisissez votre téléphone, puis ce code dans « Mot de passe ».</p><p dir="rtl">افتحوا تطبيق SnapSchool، اختاروا وليّ، ثم أدخلوا رقم الهاتف والرمز في خانة كلمة المرور.</p><small>Le même compte donne accès à tous vos enfants. Gardez ce code privé et changez-le après connexion.</small></>:<p>{card.status}. Aucun mot de passe existant n’a été changé.</p>}
 <footer>SnapSchool · Fiche confidentielle à remettre à la famille</footer>
 </article>)}</div>}
 <style jsx global>{`
 .parent-slips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));max-width:190mm;background:white}
 .parent-slip{box-sizing:border-box;border:1px dashed #9ca3af;padding:5mm;height:89mm;overflow:hidden;color:#172033;font-family:Arial,sans-serif;font-size:10px;line-height:1.45;break-inside:avoid}
 .parent-slip header{display:flex;justify-content:space-between;gap:5mm;border-bottom:1px solid #ddd;padding-bottom:2mm}.parent-slip h2{font-size:15px;margin:3mm 0 1mm}.parent-slip p{margin:2mm 0}.slip-credentials{background:#f5f6fa;padding:2mm 3mm}.slip-credentials b{display:block;font-size:21px;letter-spacing:2px}.parent-slip footer{font-size:8px;margin-top:2mm;color:#64748b}
 @page{size:A4 portrait;margin:10mm}
 @media print{body *{visibility:hidden!important}.parent-slips,.parent-slips *{visibility:visible!important}.parent-slips{position:absolute;left:0;top:0;width:190mm;margin:0;display:block}.parent-slip{display:inline-block;vertical-align:top;width:95mm;height:89mm;page-break-inside:avoid}.slip-controls{display:none!important}}
 @media screen and (max-width:640px){.parent-slips{grid-template-columns:1fr}.parent-slip{height:auto;min-height:89mm}}
 `}</style>
 </main>;
}
