import prisma from '@/lib/prisma';
import { TOOLS } from '@/lib/telegram/tools';
import type { ToolContext } from '@/lib/telegram/tools/readTools';
import { READ_ONLY_ACTIONS, requiresActionConfirmation } from './actionPolicy';
import { cleanTelegramFormattingForMobile } from './mobileFormatting';

export function getExactSchoolRead(message: string): { name: string; args: Record<string, any> } | null {
  const text=message.trim().replace(/[?!.]+$/,'').trim();
  const classList=text.match(/^(?:(?:chkoun|chkoune|chkon)\s+ya[9q]raw\s+(?:fi\s+)?|(?:liste\s+(?:des\s+)?)?[ée]l[èe]ves\s+(?:de\s+)?(?:la\s+)?(?:classe\s+)?)(\d+\s*[a-z])$/i);
  if(classList) return {name:'get_students',args:{className:classList[1].replace(/\s/g,'').toUpperCase(),limit:100,offset:0}};
  if(/^(?:caisse(?: du jour)?|point de caisse|كاسة)$/i.test(text)) return {name:'get_daily_caisse',args:{date:'today'}};
  if(/^(?:impay[ée]s(?: du mois| de ce mois)?|qui n'a pas pay[ée] ce mois)$/i.test(text)) return {name:'get_payments',args:{status:'UNPAID'}};
  if(/^(?:revenus?(?: du mois| de ce mois)?|recettes du mois|chiffre d'affaires)$/i.test(text)) return {name:'get_financial_summary',args:{}};
  if(/^(?:absences du jour|absents aujourd'hui|qui est absent aujourd'hui|شكون غايب)$/i.test(text)) return {name:'get_attendance',args:{}};
  if(/^(?:effectif(?:s)?(?: [ée]cole)?|statistiques [ée]cole|stats [ée]cole)$/i.test(text)) return {name:'get_school_stats',args:{}};
  return null;
}

export function formatSchoolRead(name: string, output: any): string {
  if(!output || output.error || output.success===false) return cleanTelegramFormattingForMobile(output?.message || 'La vérification en base a échoué. Aucun résultat actuel vérifié.');
  if(output.formattedText) return cleanTelegramFormattingForMobile(output.formattedText);
  if(name==='get_student_profile' && output.student) {
    const student=output.student;
    return `**Fiche élève : ${student.fullName || "Non renseigné"}**\n\n• Classe : ${student.class || "Non renseignée"}\n• Niveau : ${student.level || "Non renseigné"}\n• Parent : ${student.parent?.name || 'Non renseigné'}\n• Téléphone parent : ${student.parent?.phone || 'Non renseigné'}\n• Tarif : ${student.tuitionSummary?.monthlyFee || 'Non disponible'}\n• Réglé sur l’année scolaire : ${student.tuitionSummary?.totalPaid || 'Non disponible'}\n• Reste sur l’année scolaire : ${student.tuitionSummary?.totalRemainingDue || 'Non disponible'}\n• Appels enregistrés sur 30 jours : ${student.attendance30Days?.absences ?? 'Non disponible'} absence(s), ${student.attendance30Days?.retards ?? 'Non disponible'} retard(s)\n\n**Dernières notes**\n${student.recentGrades?.length ? student.recentGrades.map((grade:any)=>`• ${grade.subject} : ${grade.score} (${grade.term})`).join('\n') : 'Aucune note enregistrée.'}`;
  }
  if ((name === 'get_incomes' || name === 'get_expenses') && output.records) {
    const total = output.summary?.selectedTotal ?? output.summary?.filteredPeriodTotal ?? 'Non disponible';
    const count = output.summary?.selectedCount ?? output.summary?.filteredPeriodCount;
    return `**${name === 'get_incomes' ? 'Recettes' : 'Dépenses'} — ${output.period}**\n\nTotal filtré : **${total}**\n\n` +
      output.records.map((record:any)=>`• **${record.title}** — ${record.amount} (${record.category}, ${record.date})`).join('\n') +
      `\n\n${output.records.length} enregistrement(s) affiché(s)${count !== undefined ? ` sur ${count}` : ''}.`;
  }
  if(output.message) return cleanTelegramFormattingForMobile(output.message);
  // Structured data remains verifiable; never invent a profile/status to fill an absent field.
  const labels: Record<string,string> = { total:'Total', count:'Nombre', name:'Nom', fullName:'Nom complet', className:'Classe', subject:'Matière', score:'Note', term:'Trimestre', students:'Élèves', teachers:'Enseignants', parents:'Parents', grades:'Notes', records:'Enregistrements', date:'Date', status:'Statut', amount:'Montant', summary:'Résumé', title:'Titre', description:'Description', phone:'Téléphone', classes:'Classes' };
  const render = (value:any, depth=0):string => {
    if(value === null || value === undefined) return 'Non disponible';
    if(Array.isArray(value)) return value.length ? value.map((item,index)=>`${index+1}. ${render(item,depth+1)}`).join('\n') : 'Aucun enregistrement.';
    if(typeof value !== 'object') return String(value);
    if(depth>5) return 'Détails supplémentaires disponibles dans le dossier.';
    return Object.entries(value).filter(([key])=>!['id','source','fetchedAt'].includes(key) && !key.endsWith('Id') && !/password|token|secret/i.test(key))
      .map(([key,child])=>`• ${labels[key] || key.replace(/([A-Z])/g,' $1')} : ${render(child,depth+1)}`).join('\n');
  };
  return cleanTelegramFormattingForMobile(render(output));
}

export async function executeFreshSchoolRead(name:string,args:Record<string,any>,context:ToolContext,conversationId:string) {
  const tool=TOOLS[name];
  if(!tool || !READ_ONLY_ACTIONS.has(name) || requiresActionConfirmation(name,tool)) throw new Error('Cette vérification nécessite un outil de consultation autorisé.');
  let output:any;
  try { output=await tool.execute(args,context); }
  catch { output={success:false,error:true,message:'La lecture des données a échoué. Je ne peux pas confirmer le résultat actuel.'}; }
  const failed=!output || output.error || output.success===false;
  const fetchedAt=new Date().toISOString();
  if(output && typeof output==='object') output={...output,source:'school_database',fetchedAt,scopeSchoolId:context.schoolId};
  // Persist before replying so "U sure" can re-run the exact filters on the next turn.
  const toolCall = await prisma.aIToolCall.create({data:{conversationId,toolName:name,arguments:args,result:output,status:failed?'FAILED':'EXECUTED',executedAt:new Date(),requiresConfirm:false}});
  return {output,message:formatSchoolRead(name,output),fetchedAt,success:!failed,toolCallId:toolCall.id};
}
