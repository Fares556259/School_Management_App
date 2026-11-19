"use client";
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
  async function audit(){if(!file||!data)return;setBusy(true);setError("");try{for(const page of [...new Set(data.rows.map(r=>r.page))]){if(audits.some(a=>a.page===page))continue;const form=new FormData();form.append("file",file);form.append("auditPage",String(page));const res=await fetch("/api/admin/student-pdf-import",{method:"POST",body:form});const json=await res.json();if(!res.ok)throw new Error(json.error);setAudits(a=>[...a.filter(x=>x.page!==page),json.audit]);}}catch(e){setError(e instanceof Error?e.message:"Audit échoué");}finally{setBusy(false);}}
  async function extract(){setAudits([]);if(!file)return;setBusy(true);setError("");setData(null);try{const form=new FormData();form.append("file",file);const res=await fetch("/api/admin/student-pdf-import",{method:"POST",body:form});const json=await res.json();if(!res.ok)throw new Error(json.error);setData(extractionSchema.parse(json.extraction));}catch(e){setError(e instanceof Error?e.message:"Extraction échouée");}finally{setBusy(false);}}
  function download(){if(!data)return;const blob=new Blob([JSON.stringify({extraction:data,expectedCount:count?Number(count):null,audits,summary:reviewSummary(data,audits,count?Number(count):null)},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="student-pdf-staging.json";a.click();URL.revokeObjectURL(url);}
  return <section className="space-y-4 border rounded-xl p-4 bg-white">
    <h3 className="font-semibold">PDF — extraction stricte et revue</h3>
    <p className="text-sm">Les valeurs originales restent inchangées. Aucun élève ou responsable n’est enregistré pendant cette revue.</p>
    <input aria-label="PDF du registre" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]||null);setData(null);setAudits([]);setError("");}} />
    <button type="button" disabled={!file||busy} onClick={extract} className="block bg-indigo-600 text-white rounded px-4 py-2 disabled:opacity-50">{busy?"Extraction…":"Extraire le PDF"}</button>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    {data&&<><p>{data.rows.length} élèves · {data.pageCount} pages · {data.issues.length+data.rows.reduce((n,r)=>n+r.issues.length,0)} anomalies à revoir</p>
      <label className="block">Nombre attendu <input className="border p-1" type="number" min="1" value={count} onChange={e=>setCount(e.target.value)}/></label>
      {count&&Number(count)!==data.rows.length&&<p role="alert" className="text-red-700">Le nombre attendu ne correspond pas au PDF.</p>}
      <p className="text-amber-800">Audit indépendant : {audits.length}/{new Set(data.rows.map(r=>r.page)).size} pages · {reviewSummary(data,audits,count?Number(count):null).discrepancies} divergences. Enregistrement désactivé. Les dates de naissance, adresses et groupes sanguins absents ne sont pas inventés.</p>
      {data.issues.map((i,n)=><p key={n} className="text-red-700">{i.message}</p>)}
      {audits.flatMap(a=>a.checks.filter(c=>c.status!=="match").map(c=><p className="text-red-700 text-sm" key={`${c.rowId}-${c.field}`}>{c.rowId} · {fieldLabels[c.field]} : {c.reason}</p>))}
      <button type="button" disabled={busy} onClick={audit} className="border rounded px-3 py-2">{busy?"Audit en cours…":"Vérifier les cellules avec l’IA"}</button>
      <button type="button" onClick={download} className="border rounded px-3 py-2">Exporter le dossier de revue</button>
      <div className="overflow-auto max-h-96"><table className="text-xs w-full"><thead><tr><th>Source</th>{fields.map(f=><th key={f}>{fieldLabels[f]}</th>)}<th>Anomalies</th></tr></thead><tbody>{data.rows.map(r=><tr key={r.id} className="border-t"><td><a href={`${source}#page=${r.page}`} target="_blank" rel="noreferrer">Page {r.page}, ligne {r.row}</a></td>{fields.map(f=><td key={f} dir="auto" className={`p-2 whitespace-pre-wrap ${r.cells[f].verified?"":"bg-red-100"}`}>{r.cells[f].text||"—"}</td>)}<td>{r.issues.map(i=>i.message).join("; ")}</td></tr>)}</tbody></table></div>
    </>}
  </section>;
}
