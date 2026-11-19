"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { processClassRoster } from "@/app/(dashboard)/list/classes/rosterActions";
import { type RosterStudent } from "@/lib/classRoster";
type Row={entry:string;student:RosterStudent|null;error:string|null};
export default function ClassRosterImport({classId,className,onAssigned}:{classId:number;className:string;onAssigned:()=>void}){
 const [open,setOpen]=useState(false),[text,setText]=useState(""),[rows,setRows]=useState<Row[]|null>(null),[count,setCount]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const router=useRouter();
 async function run(commit=false){setBusy(true);setError("");try{const result=await processClassRoster(classId,text,count?Number(count):null,commit);if(!result.success)throw new Error(result.error);if(commit){router.refresh();onAssigned();}else if("rows" in result)setRows(result.rows||null);}catch(e){setError(e instanceof Error?e.message:"Erreur");}finally{setBusy(false);}}
 return <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3">
 <button type="button" onClick={()=>setOpen(v=>!v)} className="text-sm font-semibold text-indigo-700">{open?"Masquer la liste":"Affecter depuis une liste de classe"}</button>
 {open&&<div className="mt-3 space-y-3"><p className="text-xs text-slate-600">Dans LaVieScolaire, copiez la liste depuis le PDF avec les identifiants uniques, puis collez-la ici. À défaut, un nom et prénom complets par ligne. Aucune correspondance approximative.</p>
 <textarea aria-label="Liste de la classe" value={text} disabled={busy} onChange={e=>{setText(e.target.value);setRows(null);}} rows={5} className="w-full rounded-lg border border-slate-200 p-3 text-sm" placeholder="268473787210 … ou nom complet par ligne"/>
 <button type="button" disabled={busy||!text.trim()} onClick={()=>run()} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 disabled:opacity-40">{busy?"Traitement…":"Identifier les élèves"}</button>
 {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
 {rows&&<><p className="text-sm">{rows.length} lignes · {rows.filter(r=>!r.error).length} correspondances · {rows.filter(r=>r.error).length} anomalies</p><div className="max-h-44 overflow-auto rounded border bg-white">{rows.map((row,index)=><div key={index} className="flex justify-between gap-3 border-b px-3 py-2 text-xs"><span dir="auto">{row.student?`${row.student.name} ${row.student.surname}`:row.entry}</span><span className={row.error?"text-rose-700":"text-emerald-700"}>{row.error||"Correspondance exacte"}</span></div>)}</div>
 <label className="block text-xs">Nombre attendu dans cette liste <input type="number" min="1" value={count} disabled={busy} onChange={e=>setCount(e.target.value)} className="ml-2 w-20 rounded border p-2"/></label>
 <p className="text-xs text-slate-600">Les élèves déjà dans {className} restent inscrits. Les élèves d’autres classes ne seront pas déplacés.</p>
 <button type="button" disabled={busy||Number(count)!==rows.length||rows.some(r=>r.error)} onClick={()=>run(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Confirmer l’affectation à {className}</button></>}
 </div>}
 </div>;
}
