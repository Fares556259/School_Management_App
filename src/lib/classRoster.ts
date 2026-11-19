export type RosterStudent = {id:string;name:string;surname:string;nationalId?:string|null;classId?:number|null;level?:{level:number}|null};
// Exact comparison after Unicode presentation/diacritic formatting only; no fuzzy matching.
const nameKey=(value:string)=>value.normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/g,"").replace(/\s+/g," ").trim();
export function matchClassRoster(text:string,students:RosterStudent[],classId:number,level:number){
 const ids=text.match(/(?<![0-9])[0-9]{12}(?![0-9])/g);
 const entries=ids||text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(!entries.length||entries.length>500)throw new Error("Collez une liste de 1 à 500 élèves.");
 const seen=new Set<string>();
 return entries.map(entry=>{
  const matches=students.filter(s=>ids?s.nationalId===entry:nameKey(`${s.name} ${s.surname}`)===nameKey(entry));
  const student=matches.length===1?matches[0]:null;
  let error=matches.length===0?"Introuvable":matches.length>1?"Plusieurs élèves correspondent":null;
  if(student){if(seen.has(student.id))error="Élève répété dans la liste";seen.add(student.id);
   if(student.level?.level!==level)error="Niveau différent de la classe";
   if(student.classId&&student.classId!==classId)error="Déjà affecté à une autre classe";
  }
  return {entry,student,error};
 });
}
