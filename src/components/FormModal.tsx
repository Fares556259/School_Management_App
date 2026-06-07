"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState, useTransition } from "react";
import { deleteNotice, deleteAssignment, deleteResource } from "@/lib/crudActions";
import { useLanguage } from "@/lib/translations/LanguageContext";

// USE LAZY LOADING

// import TeacherForm from "./forms/TeacherForm";
// import StudentForm from "./forms/StudentForm";

const TeacherForm = dynamic(() => import("./forms/TeacherForm"), {
  loading: () => <h1>Loading...</h1>,
});
const StudentForm = dynamic(() => import("./forms/StudentForm"), {
  loading: () => <h1>Loading...</h1>,
});
const AnnouncementForm = dynamic(() => import("./forms/AnnouncementForm"), {
  loading: () => <h1>Loading...</h1>,
});
const AssignmentForm = dynamic(() => import("./forms/AssignmentForm"), {
  loading: () => <h1>Loading...</h1>,
});
const ResourceForm = dynamic(() => import("./forms/ResourceForm"), {
  loading: () => <h1>Loading...</h1>,
});

const forms: {
  [key: string]: (type: "create" | "update", data?: any, relatedData?: any) => JSX.Element;
} = {
  teacher: (type, data, relatedData) => <TeacherForm type={type} data={data} relatedData={relatedData} />,
  student: (type, data, relatedData) => <StudentForm type={type} data={data} relatedData={relatedData} />,
  announcement: (type, data, relatedData) => <AnnouncementForm type={type} data={data} relatedData={relatedData} />,
  assignment: (type, data, relatedData) => <AssignmentForm type={type} data={data} relatedData={relatedData} />,
  resource: (type, data, relatedData) => <ResourceForm type={type} data={data} relatedData={relatedData} />,
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
      ? "bg-lamaYellow"
      : type === "update"
      ? "bg-lamaSky"
      : "bg-lamaPurple";

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
        window.location.reload();
      } else {
        alert(res?.error || "Failed to delete item.");
      }
    });
  };

  const Form = () => {
    return type === "delete" && id ? (
      <div className="p-4 flex flex-col gap-4">
        <span className="text-center font-medium">
          {t.crud.deleteConfirm} {t.crud.entities[table as keyof typeof t.crud.entities] || table}?
        </span>
        <div className="flex gap-4 justify-center">
          <button 
            className="bg-slate-200 text-slate-700 py-2 px-4 rounded-md border-none w-max"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {t.crud.cancel}
          </button>
          <button 
            className="bg-red-700 text-white py-2 px-4 rounded-md border-none w-max disabled:opacity-50"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? t.crud.deleting : t.crud.delete}
          </button>
        </div>
      </div>
    ) : type === "create" || type === "update" ? (
      forms[table] ? (
        forms[table](type, data, relatedData)
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
          className={`${size} flex items-center justify-center rounded-full ${bgColor}`}
          onClick={() => setOpen(true)}
        >
          <Image src={`/${type}.png`} alt="" width={16} height={16} />
        </button>
      )}
      {open && (
        <div className="w-screen h-screen fixed left-0 top-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
          <div className={`bg-white p-4 rounded-md relative w-[95%] ${(table === "assignment" || table === "resource") ? "md:w-[80%] lg:w-[70%] xl:w-[60%]" : "md:w-[70%] lg:w-[60%] xl:w-[50%] 2xl:w-[40%]"}`}>
            <Form />
            <div
              className="absolute top-4 right-4 cursor-pointer w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
              onClick={() => setOpen(false)}
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FormModal;
