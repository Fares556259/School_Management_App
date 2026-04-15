"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState, useTransition } from "react";
import { deleteNotice } from "@/lib/crudActions";

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

const forms: {
  [key: string]: (type: "create" | "update", data?: any) => JSX.Element;
} = {
  teacher: (type, data) => <TeacherForm type={type} data={data} />,
  student: (type, data) => <StudentForm type={type} data={data} />,
  announcement: (type, data) => <AnnouncementForm type={type} data={data} />,
};

const FormModal = ({
  table,
  type,
  data,
  id,
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
    | "result"
    | "attendance"
    | "event"
    | "announcement";
  type: "create" | "update" | "delete";
  data?: any;
  id?: string | number;
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

  const handleDelete = () => {
    if (!id) return;
    
    startTransition(async () => {
      let res;
      if (table === "announcement") {
        res = await deleteNotice(id as number);
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
          All data will be lost. Are you sure you want to delete this {table}?
        </span>
        <div className="flex gap-4 justify-center">
          <button 
            className="bg-slate-200 text-slate-700 py-2 px-4 rounded-md border-none w-max"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </button>
          <button 
            className="bg-red-700 text-white py-2 px-4 rounded-md border-none w-max disabled:opacity-50"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    ) : type === "create" || type === "update" ? (
      forms[table] ? (
        forms[table](type, data)
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
      <button
        className={`${size} flex items-center justify-center rounded-full ${bgColor}`}
        onClick={() => setOpen(true)}
      >
        <Image src={`/${type}.png`} alt="" width={16} height={16} />
      </button>
      {open && (
        <div className="w-screen h-screen absolute left-0 top-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-md relative w-[90%] md:w-[70%] lg:w-[60%] xl:w-[50%] 2xl:w-[40%]">
            <Form />
            <div
              className="absolute top-4 right-4 cursor-pointer"
              onClick={() => setOpen(false)}
            >
              <Image src="/close.png" alt="" width={14} height={14} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FormModal;
