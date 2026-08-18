"use client";

import React, { useState } from "react";
import Table from "@/components/Table";
import AuditLogDetails from "./AuditLogDetails";
import { useLanguage } from "@/lib/translations/LanguageContext";

interface AuditLog {
  id: number;
  action: string;
  performedBy: string;
  entityType: string;
  entityId: string | null;
  description: string;
  amount: number | null;
  type: string | null;
  effectiveDate: Date | null;
  timestamp: Date;
}

interface AuditLogTableClientProps {
  logs: any[];
  performerMap: Record<string, any>;
  columns: any[];
  locale: string;
}

function translateDescription(desc: string, t: any, locale: string) {
  if (!t.auditLogPage?.descriptions) return desc;
  
  const salaryMatch = desc.match(/Paid(?: staff)? salary of \$?(?:\d+(?:\.\d+)?) to (.*?) for (.*)/i);
  if (salaryMatch) {
    let period = salaryMatch[2];
    const monthMatch = period.match(/([a-zA-Z]+) (\d{4})/);
    if (monthMatch && locale !== "en") {
      const monthMap: Record<string, string> = {
        "January": locale === "ar" ? "جانفي" : "Janvier",
        "February": locale === "ar" ? "فيفري" : "Février",
        "March": locale === "ar" ? "مارس" : "Mars",
        "April": locale === "ar" ? "أفريل" : "Avril",
        "May": locale === "ar" ? "ماي" : "Mai",
        "June": locale === "ar" ? "جوان" : "Juin",
        "July": locale === "ar" ? "جويلية" : "Juillet",
        "August": locale === "ar" ? "أوت" : "Août",
        "September": locale === "ar" ? "سبتمبر" : "Septembre",
        "October": locale === "ar" ? "أكتوبر" : "Octobre",
        "November": locale === "ar" ? "نوفمبر" : "Novembre",
        "December": locale === "ar" ? "ديسمبر" : "Décembre"
      };
      const m = monthMap[monthMatch[1].charAt(0).toUpperCase() + monthMatch[1].slice(1).toLowerCase()] || monthMatch[1];
      period = `${m} ${monthMatch[2]}`;
    }
    return t.auditLogPage.descriptions.paidSalary.replace('{name}', salaryMatch[1]).replace('{period}', period);
  }
  
  const resetMatch = desc.match(/Administrative password reset for: (.*?)(?: \((.*?)\))?$/i);
  if (resetMatch) {
    return t.auditLogPage.descriptions.passwordReset.replace('{name}', resetMatch[1]).replace('{phone}', resetMatch[2] ? `(${resetMatch[2]})` : '');
  }

  const noticeMatch = desc.match(/Published announcement: (.*)/i);
  if (noticeMatch) {
    return t.auditLogPage.descriptions.publishedNotice.replace('{title}', noticeMatch[1]);
  }
  
  const expenseMatch = desc.match(/Logged expense: (.*?) under (.*)/i);
  if (expenseMatch) {
    return t.auditLogPage.descriptions.loggedExpense.replace('{title}', expenseMatch[1]).replace('{category}', expenseMatch[2]);
  }

  const incomeMatch = desc.match(/Logged income: (.*?) under (.*)/i);
  if (incomeMatch && t.auditLogPage.descriptions.loggedIncome) {
    return t.auditLogPage.descriptions.loggedIncome.replace('{title}', incomeMatch[1]).replace('{category}', incomeMatch[2]);
  }

  const recordedPaymentMatch = desc.match(/\.?Recorded (.*?) payment for (.*?) \((.*?)\)\. Status: (.*)/i);
  if (recordedPaymentMatch && t.auditLogPage.descriptions.recordedPayment) {
    let period = recordedPaymentMatch[3];
    const monthMatch = period.match(/([a-zA-Z]+) (\d{4})/);
    if (monthMatch && locale !== "en") {
      const monthMap: Record<string, string> = {
        "January": locale === "ar" ? "جانفي" : "Janvier", "February": locale === "ar" ? "فيفري" : "Février",
        "March": locale === "ar" ? "مارس" : "Mars", "April": locale === "ar" ? "أفريل" : "Avril",
        "May": locale === "ar" ? "ماي" : "Mai", "June": locale === "ar" ? "جوان" : "Juin",
        "July": locale === "ar" ? "جويلية" : "Juillet", "August": locale === "ar" ? "أوت" : "Août",
        "September": locale === "ar" ? "سبتمبر" : "Septembre", "October": locale === "ar" ? "أكتوبر" : "Octobre",
        "November": locale === "ar" ? "نوفمبر" : "Novembre", "December": locale === "ar" ? "ديسمبر" : "Décembre"
      };
      const m = monthMap[monthMatch[1].charAt(0).toUpperCase() + monthMatch[1].slice(1).toLowerCase()] || monthMatch[1];
      period = `${m} ${monthMatch[2]}`;
    }
    return t.auditLogPage.descriptions.recordedPayment.replace('{amount}', recordedPaymentMatch[1]).replace('{name}', recordedPaymentMatch[2]).replace('{period}', period);
  }

  const recoveredPaymentMatch = desc.match(/\.?Recovered (.*?) for (.*?) \((.*?)\)\. Status: (.*)/i);
  if (recoveredPaymentMatch && t.auditLogPage.descriptions.recoveredPayment) {
    let period = recoveredPaymentMatch[3];
    const monthMatch = period.match(/([a-zA-Z]+) (\d{4})/);
    if (monthMatch && locale !== "en") {
      const monthMap: Record<string, string> = {
        "January": locale === "ar" ? "جانفي" : "Janvier", "February": locale === "ar" ? "فيفري" : "Février",
        "March": locale === "ar" ? "مارس" : "Mars", "April": locale === "ar" ? "أفريل" : "Avril",
        "May": locale === "ar" ? "ماي" : "Mai", "June": locale === "ar" ? "جوان" : "Juin",
        "July": locale === "ar" ? "جويلية" : "Juillet", "August": locale === "ar" ? "أوت" : "Août",
        "September": locale === "ar" ? "سبتمبر" : "Septembre", "October": locale === "ar" ? "أكتوبر" : "Octobre",
        "November": locale === "ar" ? "نوفمبر" : "Novembre", "December": locale === "ar" ? "ديسمبر" : "Décembre"
      };
      const m = monthMap[monthMatch[1].charAt(0).toUpperCase() + monthMatch[1].slice(1).toLowerCase()] || monthMatch[1];
      period = `${m} ${monthMatch[2]}`;
    }
    return t.auditLogPage.descriptions.recoveredPayment.replace('{amount}', recoveredPaymentMatch[1]).replace('{name}', recoveredPaymentMatch[2]).replace('{period}', period);
  }

  const updatedProfileMatch = desc.match(/Updated (?:teacher|student) profile: (.*)/i);
  if (updatedProfileMatch && t.auditLogPage.descriptions.updatedProfile) {
    return t.auditLogPage.descriptions.updatedProfile.replace('{id}', updatedProfileMatch[1]);
  }

  const createdAssignmentMatch = desc.match(/Created new assignment: (.*?) \(Lesson ID: (.*?)\)/i);
  if (createdAssignmentMatch && t.auditLogPage.descriptions.createdAssignment) {
    return t.auditLogPage.descriptions.createdAssignment.replace('{title}', createdAssignmentMatch[1]).replace('{id}', createdAssignmentMatch[2]);
  }

  const unifiedEnrollmentMatch = desc.match(/Unified Enrollment: Parent (.*?) \+ (\d+) students/i);
  if (unifiedEnrollmentMatch && t.auditLogPage.descriptions.unifiedEnrollment) {
    return t.auditLogPage.descriptions.unifiedEnrollment.replace('{name}', unifiedEnrollmentMatch[1]).replace('{count}', unifiedEnrollmentMatch[2]);
  }

  const enrolledTeacherMatch = desc.match(/Enrolled new teacher: (.*?) \((.*?)\)/i);
  if (enrolledTeacherMatch && t.auditLogPage.descriptions.enrolledTeacher) {
    return t.auditLogPage.descriptions.enrolledTeacher.replace('{name}', enrolledTeacherMatch[1]).replace('{username}', enrolledTeacherMatch[2]);
  }

  return desc;
}

const AuditLogTableClient: React.FC<AuditLogTableClientProps> = ({ logs, performerMap, columns, locale }) => {
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const { t } = useLanguage();

  const renderRow = (item: any) => (
    <tr 
      key={item.id} 
      onClick={() => setSelectedLog({
        ...item,
        performer: performerMap[item.performedBy] || { name: item.performedBy, role: "System" }
      })}
      className="border-b border-slate-100 last:border-none text-sm hover:bg-slate-50/80 cursor-pointer transition-colors group"
    >
      <td className="p-4">
        {(() => {
          let bgColor = "bg-slate-50 text-slate-600 border border-slate-100";
          if (item.action.includes("CREATE") || item.action.includes("POST")) bgColor = "bg-emerald-50 text-emerald-600 border border-emerald-100";
          if (item.action.includes("UPDATE") || item.action.includes("MARK")) bgColor = "bg-amber-50 text-amber-600 border border-amber-100";
          if (item.action.includes("DELETE")) bgColor = "bg-rose-50 text-rose-600 border border-rose-100";
          
          return (
            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors inline-block ${bgColor}`}>
              {(t as any).auditLogPage?.actions?.[item.action] || item.action.replace(/_/g, " ")}
            </span>
          );
        })()}
      </td>
      <td className="p-4 hidden md:table-cell">
        {(() => {
          const performer = performerMap[item.performedBy];
          const rawName = performer?.name || item.performedBy;
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawName);
          const displayName = isUUID
            ? (performer?.role === "Parent" ? "Parent" : performer?.role === "Enseignant" ? "Enseignant" : "Administrateur")
            : (rawName === "system" ? "Système" : rawName);
          const displayRole = performer?.role || (item.performedBy === "system" ? "Système" : "Administrateur");
          const avatarLetter = (displayName || "A").charAt(0).toUpperCase();

          return (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs uppercase shrink-0 overflow-hidden shadow-2xs">
                {performer?.avatar ? (
                  <img src={performer.avatar} alt="" className="object-cover w-full h-full" />
                ) : (
                  avatarLetter
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-slate-800 text-xs truncate group-hover:text-blue-600 transition-colors">
                  {displayName}
                </span>
                {displayRole && (
                  <span className="text-[10px] text-slate-400 font-medium capitalize truncate">
                    {displayRole}
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </td>
      <td className="p-4 hidden md:table-cell">
        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-md">
          {(t as any).auditLogPage?.entities?.[item.entityType.toUpperCase()] || item.entityType}
        </span>
      </td>
      <td className="p-4 hidden sm:table-cell text-xs text-slate-600 max-w-xs truncate" title={item.description}>
        {translateDescription(item.description, t, locale)}
      </td>
      <td className="p-4 hidden md:table-cell font-bold text-right">
        {item.amount !== null && item.amount !== undefined ? (
          <span className={item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}>
            {item.type === 'income' ? '+' : '-'}{item.amount.toLocaleString()} <span className="text-xs ml-0.5 opacity-70">DT</span>
          </span>
        ) : <span className="text-slate-300">-</span>}
      </td>
      <td className="p-4 hidden lg:table-cell whitespace-nowrap text-xs text-slate-500 font-medium">
        {new Date(item.timestamp).toLocaleString(locale === "ar" ? "ar-TN-u-nu-latn" : locale === "fr" ? "fr-FR" : "en-US", {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: 'numeric', hour12: false
        })}
      </td>
    </tr>
  );

  return (
    <>
      <Table columns={columns} renderRow={renderRow} data={logs} />
      <AuditLogDetails log={selectedLog} onClose={() => setSelectedLog(null)} />
    </>
  );
};

export default AuditLogTableClient;
