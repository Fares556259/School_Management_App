"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import ResourceForm from "./forms/ResourceForm";

export default function ResourceDialog({ type, data, trigger }: { type: "create" | "update"; data?: any; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { t, locale } = useLanguage();
  const copy = t.resourcesPage.form;
  return <Dialog.Root open={open} onOpenChange={next => { if (!busy) setOpen(next); }}>
    <Dialog.Trigger asChild>{trigger || <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus size={16} />{copy.createTitle}</button>}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/45" />
      <Dialog.Content dir={locale === "ar" ? "rtl" : "ltr"} className="fixed left-1/2 top-1/2 z-[101] flex max-h-[90dvh] w-[calc(100%-24px)] max-w-[680px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl focus:outline-none">
        <header className="relative shrink-0 border-b border-slate-200 px-6 py-5 pe-14">
          <Dialog.Title className="text-xl font-semibold tracking-tight text-slate-900">{type === "update" ? copy.editTitle : copy.createTitle}</Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm leading-5 text-slate-500">{copy.subtitle}</Dialog.Description>
          <Dialog.Close disabled={busy} aria-label={copy.close} className="absolute end-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"><X size={18} /></Dialog.Close>
        </header>
        <ResourceForm type={type} data={data} onBusyChange={setBusy} onClose={() => setOpen(false)} />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
