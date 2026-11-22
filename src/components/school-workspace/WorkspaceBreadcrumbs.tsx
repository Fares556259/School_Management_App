'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/translations/LanguageContext';
import { schoolWorkspaceCopy } from '@/lib/schoolWorkspaceCopy';

export default function WorkspaceBreadcrumbs() {
  const pathname = usePathname();
  const { locale } = useLanguage();
  const copy = schoolWorkspaceCopy[locale];
  const section = pathname.startsWith('/list/classes') ? { label: copy.classes, href: '/list/classes', group: copy.academics }
    : pathname.startsWith('/list/students') ? { label: copy.students, href: '/list/students', group: copy.people } : null;
  if (!section) return null;
  const detail = pathname !== section.href;
  return (
    <nav aria-label={locale === 'ar' ? 'مسار التنقل' : locale === 'fr' ? 'Fil d’Ariane' : 'Breadcrumb'} className="school-breadcrumbs print:hidden">
      <Link href="/admin">{copy.home}</Link><span aria-hidden="true">/</span>
      <span>{section.group}</span><span aria-hidden="true">/</span>
      {detail ? <><Link href={section.href}>{section.label}</Link><span aria-hidden="true">/</span><span aria-current="page">{locale === "ar" ? "التفاصيل" : locale === "fr" ? "Détails" : "Details"}</span></> : <span aria-current="page">{section.label}</span>}
    </nav>
  );
}
