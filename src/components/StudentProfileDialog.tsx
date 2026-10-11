"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { UserRound, GraduationCap, Phone, Wallet, X } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";

export function StudentProfileDialog({ open, onOpenChange, mode, busy, restoreFocus, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "update";
  busy: boolean;
  children: ReactNode;
  restoreFocus: () => void;
}) {
  const { t, locale } = useLanguage();
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/45 backdrop-blur-sm" />
        <Dialog.Content onCloseAutoFocus={(event) => { event.preventDefault(); restoreFocus(); }} dir={locale === "ar" ? "rtl" : "ltr"} className="fixed left-1/2 top-1/2 z-[101] flex max-h-[90dvh] w-[calc(100%-24px)] max-w-[760px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl focus:outline-none">
          <header className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-5 py-5 sm:px-7">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600"><UserRound size={22} aria-hidden="true" /></div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-xl font-semibold tracking-tight text-slate-900">
                {mode === "update" ? t.crud.edit : t.crud.add} {t.crud.entities.student}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-5 text-slate-500">
                {mode === "update" ? t.crud.studentProfile.editDescription : t.crud.studentProfile.createDescription}
              </Dialog.Description>
            </div>
            <Dialog.Close disabled={busy} aria-label={t.crud.cancel} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"><X size={20} /></Dialog.Close>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const sections = [
  { key: "identity", icon: UserRound, fields: ["name", "surname", "birthday", "sex", "nationalId", "img"] },
  { key: "enrollment", icon: GraduationCap, fields: ["classId", "parentId"] },
  { key: "contact", icon: Phone, fields: ["phone", "address"] },
  { key: "tuition", icon: Wallet, fields: ["customTuition"] },
] as const;

export function StudentProfileSections({ renderField }: { renderField: (name: string) => ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="divide-y divide-slate-100">
      {sections.map(({ key, icon: Icon, fields }) => (
        <fieldset key={key} className="min-w-0 py-6 first:pt-0 last:pb-0">
          <legend className="sr-only">{t.crud.studentProfile[key]}</legend>
          <div className="mb-4 flex items-center gap-2 text-slate-900" aria-hidden="true">
            <Icon size={16} className="text-blue-600" />
            <h3 className="text-sm font-semibold">{t.crud.studentProfile[key]}</h3>
          </div>
          {key === "tuition" && <p className="mb-4 text-xs leading-5 text-slate-500">{t.crud.studentProfile.tuitionHint}</p>}
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">{fields.map(renderField)}</div>
        </fieldset>
      ))}
    </div>
  );
}
