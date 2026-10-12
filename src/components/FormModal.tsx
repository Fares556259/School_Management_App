"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState, useTransition } from "react";
import { deleteNotice, deleteAssignment, deleteResource } from "@/lib/crudActions";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-toastify";

// USE LAZY LOADING

// import TeacherForm from "./forms/TeacherForm";
// import StudentForm from "./forms/StudentForm";

const FormLoading = () => (
  <div className="space-y-5 p-6" aria-label="Loading form">
    <div className="h-7 w-56 animate-pulse rounded-md bg-slate-200" />
    <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
    <div className="space-y-3 border-t border-slate-100 pt-6">
      <div className="h-11 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-11 animate-pulse rounded-lg bg-slate-100" />
    </div>
  </div>
);

const TeacherForm = dynamic(() => import("./forms/TeacherForm"), {
  loading: FormLoading,
});
const StudentForm = dynamic(() => import("./forms/StudentForm"), {
  loading: FormLoading,
});
const AnnouncementForm = dynamic(() => import("./forms/AnnouncementForm"), {
  loading: FormLoading,
});
const AssignmentForm = dynamic(() => import("./forms/AssignmentForm"), {
  loading: FormLoading,
});
const ResourceDialog = dynamic(() => import("./ResourceDialog"), {
  loading: FormLoading,
});

const forms: {
  [key: string]: (type: "create" | "update", data?: any, relatedData?: any, onClose?: () => void) => JSX.Element;
} = {
  teacher: (type, data, relatedData) => <TeacherForm type={type} data={data} relatedData={relatedData} />,
  student: (type, data, relatedData) => <StudentForm type={type} data={data} relatedData={relatedData} />,
  announcement: (type, data, relatedData, onClose) => <AnnouncementForm type={type} data={data} relatedData={relatedData} onClose={onClose} />,
  assignment: (type, data, relatedData, onClose) => <AssignmentForm type={type} data={data} relatedData={relatedData} onClose={onClose} />,

};

const FormModal = ({
  table,
  type,
  data,
  id,
  trigger,
  relatedData,
}: {
  table:
    | "teacher"
    | "student"
    | "parent"
    | "subject"
    | "class"
    | "lesson"
    | "exam"
    | "assignment"
    | "resource"
    | "result"
    | "attendance"
    | "event"
    | "announcement";
  type: "create" | "update" | "delete";
  data?: any;
  id?: string | number;
  trigger?: React.ReactNode;
  relatedData?: any;
}) => {
  const size = type === "create" ? "w-8 h-8" : "w-7 h-7";
  const bgColor =
    type === "create"
      ? "border border-brand-200 bg-brand-50 text-brand-700"
      : type === "update"
      ? "border border-ink-200 bg-white text-ink-600"
      : "border border-rose-200 bg-rose-50 text-rose-600";

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { t } = useLanguage();

  const handleDelete = () => {
    if (!id) return;
    
    startTransition(async () => {
      let res;
      if (table === "announcement") {
        res = await deleteNotice(id as number);
      } else if (table === "assignment") {
        res = await deleteAssignment(id as number);
      } else if (table === "resource") {
        res = await deleteResource(id as number);
      }
      // Add other table deletions here if needed
      
      if (res?.success) {
        setOpen(false);
        const entityLabel = t.crud.entities[table as keyof typeof t.crud.entities] || table;
        toast.success(t.toasts?.deletedSuccess?.replace("{entity}", entityLabel) || "Deleted successfully!");
        window.location.reload();
      } else {
        toast.error(res?.error || t.toasts?.deleteFailed || "Failed to delete item.");
      }
    });
  };

  if (table === "resource" && type !== "delete") {
    return <ResourceDialog type={type} data={data} trigger={trigger} />;
  }

  const Form = () => {
    return type === "delete" && id ? (
      <div className="flex flex-col gap-5 p-6">
        <span className="text-center font-medium text-ink-800">
          {t.crud.deleteConfirm} {t.crud.entities[table as keyof typeof t.crud.entities] || table}?
        </span>
        <div className="flex gap-4 justify-center">
          <button 
            className="ss-button-secondary w-max"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {t.crud.cancel}
          </button>
          <button 
            className="inline-flex min-h-10 w-max items-center justify-center rounded-control bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? t.crud.deleting : t.crud.delete}
          </button>
        </div>
      </div>
    ) : type === "create" || type === "update" ? (
      forms[table] ? (
        forms[table](type, data, relatedData, () => setOpen(false))
      ) : (
        <div className="p-8 text-center text-slate-400 font-bold">
          Form for &quot;{table}&quot; is not implemented yet.
        </div>
      )
    ) : (
      "Form not found!"
    );
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)} className="cursor-pointer inline-block">
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          aria-label={`${type} ${table}`}
          className={`${size} flex items-center justify-center rounded-control transition-colors ${bgColor}`}
          onClick={() => setOpen(true)}
        >
          <Image src={`/${type}.png`} alt="" width={16} height={16} />
        </button>
      )}
      <AnimatePresence>
        {open && (
          <div className="fixed left-0 top-0 z-50 flex h-screen w-screen items-center justify-center">
            {/* BACKDROP */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]"
            />
            
            {/* MODAL CONTAINER */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              className={`ss-dialog relative z-10 max-h-[90dvh] w-[calc(100%-24px)] overflow-hidden ${(table === "assignment" || table === "announcement") ? "max-w-[720px]" : "max-w-[620px]"}`}
            >
              <Form />
              <button
                type="button"
                aria-label={t.crud.cancel}
                className="ss-icon-button absolute end-4 top-4 z-20 h-9 w-9 cursor-pointer"
                onClick={() => setOpen(false)}
              >
                <svg className="h-4 w-4 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FormModal;
