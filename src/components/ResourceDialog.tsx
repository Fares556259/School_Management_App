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
    <Dialog.Trigger asChild>{trigger || <button className="ss-button-primary"><Plus size={16} strokeWidth={1.75} />{copy.createTitle}</button>}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[100] bg-ink-950/45 backdrop-blur-[2px]" />
      <Dialog.Content dir={locale === "ar" ? "rtl" : "ltr"} className="ss-dialog fixed left-1/2 top-1/2 z-[101] flex max-h-[90dvh] w-[calc(100%-24px)] max-w-[680px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden focus:outline-none">
        <header className="relative shrink-0 border-b border-ink-200 px-6 py-5 pe-14">
          <Dialog.Title className="text-xl font-semibold tracking-[-0.02em] text-ink-900">{type === "update" ? copy.editTitle : copy.createTitle}</Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm leading-5 text-ink-500">{copy.subtitle}</Dialog.Description>
          <Dialog.Close disabled={busy} aria-label={copy.close} className="ss-icon-button absolute end-4 top-4 disabled:opacity-40"><X size={18} strokeWidth={1.75} /></Dialog.Close>
        </header>
        <ResourceForm type={type} data={data} onBusyChange={setBusy} onClose={() => setOpen(false)} />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
