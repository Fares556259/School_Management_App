"use client";
import { FileText, UploadCloud, ArrowRight, ShieldCheck, AlertCircle, Loader2, Download, ScanLine, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { extractionSchema, fields, fieldLabels, reviewSummary, type Extraction, type PageAudit } from "@/lib/studentPdfImport/schema";
export default function StrictPdfImport() {
  const [file,setFile]=useState<File|null>(null);
  const [source,setSource]=useState("");
  const [data,setData]=useState<Extraction|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [audits,setAudits]=useState<PageAudit[]>([]);
  const [count,setCount]=useState("");
  useEffect(()=>{ if(!file)return;const url=URL.createObjectURL(file);setSource(url);return()=>URL.revokeObjectURL(url); },[file]);
  async function audit(){if(!file||!data)return;setBusy(true);setError("");try{for(const page of [...new Set(data.rows.map(r=>r.page))]){if(audits.some(a=>a.page===page))continue;const form=new FormData();form.append("file",file);form.append("auditPage",String(page));const res=await fetch("/api/admin/student-pdf-import",{method:"POST",body:form});const json=await readResponse(res);if(!res.ok)throw new Error(json.error);setAudits(a=>[...a.filter(x=>x.page!==page),json.audit]);}}catch(e){setError(e instanceof Error?e.message:"Audit échoué");}finally{setBusy(false);}}
  async function extract(){setAudits([]);if(!file)return;setBusy(true);setError("");setData(null);try{const form=new FormData();form.append("file",file);const res=await fetch("/api/admin/student-pdf-import",{method:"POST",body:form});const json=await readResponse(res);if(!res.ok)throw new Error(json.error);setData(extractionSchema.parse(json.extraction));}catch(e){setError(e instanceof Error?e.message:"Extraction échouée");}finally{setBusy(false);}}
  function download(){if(!data)return;const blob=new Blob([JSON.stringify({extraction:data,expectedCount:count?Number(count):null,audits,summary:reviewSummary(data,audits,count?Number(count):null)},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="student-pdf-staging.json";a.click();URL.revokeObjectURL(url);}
  async function readResponse(res: Response) {
    if (res.status === 504 || res.status === 502) throw new Error("La vérification a pris trop de temps. Relancez-la pour reprendre aux pages restantes ; les pages déjà vérifiées sont conservées.");
    if (res.redirected || !res.headers.get("content-type")?.includes("application/json")) throw new Error("Le service n’a pas répondu. Actualisez la page et réessayez. Si votre session a expiré, reconnectez-vous.");
    return res.json();
  }
  const summary = data ? reviewSummary(data, audits, count ? Number(count) : null) : null;
  const issueCount = data ? data.issues.length + data.rows.reduce((n,r)=>n+r.issues.length,0) : 0;
  function selectFile(value: File | null) {
    if (value && (value.size > 4_000_000 || !value.name.toLowerCase().endsWith(".pdf"))) { setError("Choisissez un fichier PDF de 4 Mo maximum."); return; }
    setFile(value); setData(null); setAudits([]); setError(""); setCount("");
  }
  return <section className="space-y-5">
    <div className="flex items-center gap-2 text-xs font-medium text-slate-400" aria-label="Étapes de l’importation">
      {["Choisir un PDF", "Vérifier les élèves", "Exporter la revue"].map((label,index)=><div key={label} className="flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded-full ${index===0||data?"bg-indigo-100 text-indigo-700":"bg-slate-100"}`}>{index+1}</span><span>{label}</span>{index<2&&<ArrowRight size={12} className="mx-1"/>}</div>)}
    </div>
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">Votre registre d’élèves</h3>
      <p className="mt-1 text-sm text-slate-500">Importez le registre PDF pour retrouver les élèves et leurs responsables.</p>
      <label onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)selectFile(e.dataTransfer.files[0]||null);}} className={`relative mt-5 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-5 py-7 text-center transition-colors focus-within:ring-2 focus-within:ring-indigo-500 ${file?"border-indigo-200 bg-indigo-50/40":"border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/30"} ${busy?"pointer-events-none opacity-60":""}`}>
        <input className="sr-only" aria-label="Choisir le registre PDF" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>selectFile(e.target.files?.[0]||null)}/>
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200">{file?<FileText size={24}/>:<UploadCloud size={24}/>}</span>
        <span className="max-w-full break-all text-sm font-semibold text-slate-800" dir="auto">{file?file.name:"Glissez votre PDF ici"}</span>
        <span className="mt-1 text-xs text-slate-500">{file?`${(file.size/1024).toFixed(0)} Ko · Cliquez pour changer de fichier`:"ou cliquez pour choisir un fichier · PDF, 4 Mo maximum"}</span>
      </label>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} className="text-emerald-600"/>Les données restent en revue avant toute inscription.</p>
        <button type="button" disabled={!file||busy} onClick={extract} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">{busy?<Loader2 size={16} className="animate-spin"/>:<ScanLine size={16}/>} {busy?"Traitement en cours…":data?"Extraire à nouveau":"Extraire les élèves"}{!busy&&<ArrowRight size={15}/>}</button>
      </div>
    </div>
    {error&&<div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle size={18} className="mt-0.5 shrink-0"/><div><p className="font-semibold">Le traitement n’a pas abouti</p><p className="mt-1 break-words">{error}</p></div></div>}
    {data&&<>
      <div className="grid grid-cols-3 gap-3">{[[data.rows.length,"Élèves extraits"],[data.pageCount,"Pages du registre"],[issueCount,"Points à vérifier"]].map(([value,label])=><div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-2xl font-semibold tracking-tight text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}</div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="text-sm font-semibold text-slate-900">Vérifier le nombre d’élèves</h4><p className="mt-1 text-xs text-slate-500">Indiquez le total attendu pour le comparer au PDF.</p></div><input aria-label="Nombre d’élèves attendu" className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Ex. 498" type="number" min="1" value={count} onChange={e=>setCount(e.target.value)}/></div>
        {count&&<p className={`flex items-center gap-2 text-xs ${summary?.countMatches?"text-emerald-700":"text-rose-700"}`}>{summary?.countMatches?<CheckCircle2 size={15}/>:<AlertCircle size={15}/>} {summary?.countMatches?"Le nombre d’élèves correspond au registre.":"Le nombre attendu ne correspond pas au PDF."}</p>}
        <div className="border-t border-slate-100 pt-4"><div className="flex justify-between text-xs text-slate-500"><span>Vérification indépendante par IA</span><span>{audits.length} / {summary?.totalPages} pages</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-500 transition-all" style={{width:`${summary?.totalPages?audits.length/summary.totalPages*100:0}%`}}/></div><p className="mt-2 text-xs text-slate-500">{summary?.discrepancies||0} divergence(s) signalée(s). Les valeurs du PDF restent inchangées.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={audit} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"><ShieldCheck size={16}/>{busy?"Vérification…":"Vérifier avec l’IA"}</button><button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Download size={16}/>Exporter la revue</button></div>
      </div>
      {(data.issues.length>0||summary?.discrepancies!==0)&&<div className="max-h-40 overflow-auto rounded-xl bg-amber-50 p-4 text-xs text-amber-900">{data.issues.map((i,n)=><p key={n}>{i.message}</p>)}{audits.flatMap(a=>a.checks.filter(c=>c.status!=="match").map(c=><p key={`${c.rowId}-${c.field}`}>{c.rowId} · {fieldLabels[c.field]} : {c.reason}</p>))}</div>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h4 className="text-sm font-semibold text-slate-900">Élèves extraits</h4><p className="mt-1 text-xs text-slate-500">Ouvrez la page source pour comparer chaque information.</p></div><div className="max-h-80 overflow-auto"><table className="w-full min-w-[760px] text-xs"><thead className="sticky top-0 bg-slate-50 text-left text-slate-500"><tr><th className="px-3 py-3 font-medium">Source</th>{fields.map(f=><th className="px-3 py-3 font-medium" key={f}>{fieldLabels[f]}</th>)}<th className="px-3 py-3 font-medium">Revue</th></tr></thead><tbody className="divide-y divide-slate-100">{data.rows.map(r=><tr key={r.id} className="hover:bg-slate-50/70"><td className="px-3 py-3"><a className="whitespace-nowrap text-indigo-600 hover:underline" href={`${source}#page=${r.page}`} target="_blank" rel="noreferrer">P. {r.page} · L. {r.row}</a></td>{fields.map(f=><td key={f} dir="auto" className={`px-3 py-3 whitespace-pre-wrap ${r.cells[f].verified?"text-slate-700":"bg-rose-50 text-rose-700"}`}>{r.cells[f].text||"—"}</td>)}<td className="px-3 py-3 text-amber-700">{r.issues.length?r.issues.map(i=>i.message).join("; "):"—"}</td></tr>)}</tbody></table></div></div>
      <p className="text-xs leading-relaxed text-slate-500">Ce dossier prépare la revue des élèves. L’inscription en base reste désactivée. Les informations absentes du PDF devront être complétées avant l’inscription.</p>
    </>}
  </section>;
}
