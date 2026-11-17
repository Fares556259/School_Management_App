"use client";

import Link from 'next/link';
import { useLanguage } from '@/lib/translations/LanguageContext';

export default function OperationsSnapshot({ students, teachers, staff, classes }: {
  students: number;
  teachers: number;
  staff: number;
  classes: number;
}) {
  const { t, locale } = useLanguage();
  const counts = [
    { label: t.adminWidgets.studentsEnrolled, value: students, href: '/list/students' },
    { label: t.adminWidgets.activeTeachers, value: teachers, href: '/list/teachers' },
    { label: t.adminWidgets.supportStaff, value: staff, href: '/list/staff' },
    { label: t.adminWidgets.activeClasses, value: classes, href: '/list/classes' },
  ];

  return (
    <section aria-labelledby="school-overview">
      <h2 id="school-overview" className="mb-2 text-sm font-semibold text-slate-800">{t.adminWidgets.operationalSnapshot}</h2>
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 lg:grid-cols-4">
        {counts.map(({ label, value, href }) => (
          <li key={href}>
            <Link href={href} className="flex h-full flex-col gap-1 bg-white px-4 py-3 hover:bg-blue-50 focus-visible:bg-blue-50">
              <span className="text-lg font-semibold tabular-nums text-slate-900">{value.toLocaleString(locale)}</span>
              <span className="text-xs text-slate-600">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
