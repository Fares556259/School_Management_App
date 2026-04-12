"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  createTeacher, updateTeacher, deleteTeacher,
  createStudent, updateStudent, deleteStudent,
  createStaff, updateStaff, deleteStaff,
  createParent, updateParent, deleteParent,
  createClass, updateClass, deleteClass,
  createSubject, updateSubject, deleteSubject,
  createExpense, updateExpense, deleteExpense,
  createIncome, updateIncome, deleteIncome,
} from "@/lib/crudActions";

import { CldUploadWidget } from "next-cloudinary";

type EntityType = "teacher" | "student" | "staff" | "parent" | "class" | "subject" | "expense" | "income";

interface FieldDef {
  name: string;
  label: string;
  type: "text" | "email" | "number" | "date" | "select" | "image";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  parseAsNumber?: boolean;
}

const entityFields: Record<EntityType, FieldDef[]> = {
  teacher: [
    { name: "username", label: "Username", type: "text", required: true },
    { name: "name", label: "First Name", type: "text", required: true },
    { name: "surname", label: "Last Name", type: "text", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "address", label: "Address", type: "text", required: true },
    { name: "bloodType", label: "Blood Type", type: "text", required: true },
    { name: "birthday", label: "Birthday", type: "date", required: true },
    { name: "sex", label: "Sex", type: "select", required: true, options: [{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }] },
    { name: "salary", label: "Salary ($)", type: "number" },
  ],
  student: [
    { name: "username", label: "Username", type: "text", required: true },
    { name: "name", label: "First Name", type: "text", required: true },
    { name: "surname", label: "Last Name", type: "text", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "address", label: "Address", type: "text", required: true },
    { name: "bloodType", label: "Blood Type", type: "text", required: true },
    { name: "birthday", label: "Birthday", type: "date", required: true },
    { name: "sex", label: "Sex", type: "select", required: true, options: [{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }] },
    { name: "parentId", label: "Parent", type: "select", required: true },
    { name: "classId", label: "Class", type: "select", required: true, parseAsNumber: true },
    { name: "gradeId", label: "Grade", type: "select", required: true, parseAsNumber: true },
  ],
  staff: [
    { name: "username", label: "Username", type: "text", required: true },
    { name: "name", label: "First Name", type: "text", required: true },
    { name: "surname", label: "Last Name", type: "text", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "address", label: "Address", type: "text", required: true },
    { name: "role", label: "Role", type: "text", required: true, placeholder: "e.g. Secretary, Guard, Janitor" },
    { name: "bloodType", label: "Blood Type", type: "text", required: true },
    { name: "birthday", label: "Birthday", type: "date", required: true },
    { name: "sex", label: "Sex", type: "select", required: true, options: [{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }] },
    { name: "salary", label: "Salary ($)", type: "number" },
  ],
  parent: [
    { name: "username", label: "Username", type: "text", required: true },
    { name: "name", label: "First Name", type: "text", required: true },
    { name: "surname", label: "Last Name", type: "text", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "text", required: true },
    { name: "address", label: "Address", type: "text", required: true },
  ],
  class: [
    { name: "name", label: "Class Name", type: "text", required: true, placeholder: "e.g. 1A, 2B" },
    { name: "capacity", label: "Capacity", type: "number", required: true },
    { name: "gradeId", label: "Grade", type: "select", required: true, parseAsNumber: true },
    { name: "supervisorId", label: "Supervisor", type: "select" },
  ],
  subject: [
    { name: "name", label: "Subject Name", type: "text", required: true },
  ],
  expense: [
    { name: "title", label: "Description", type: "text", required: true, placeholder: "e.g., Bus Fuel - Route A" },
    { name: "amount", label: "Amount ($)", type: "number", required: true, parseAsNumber: true },
    { name: "category", label: "Category", type: "select", required: true, options: [
      {value: "FUEL", label: "FUEL"},
      {value: "MAINTENANCE", label: "MAINTENANCE"},
      {value: "SUPPLIES", label: "SUPPLIES"},
      {value: "UTILITIES", label: "UTILITIES"},
      {value: "OTHER", label: "OTHER"},
      {value: "SALARY", label: "SALARY"}
    ] },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "img", label: "Proof Image", type: "image" },
  ],
  income: [
    { name: "title", label: "Source/Description", type: "text", required: true, placeholder: "e.g., Annual Charity Event" },
    { name: "amount", label: "Amount ($)", type: "number", required: true, parseAsNumber: true },
    { name: "category", label: "Category", type: "select", required: true, options: [
      {value: "TUITION", label: "TUITION"},
      {value: "DONATION", label: "DONATION"},
      {value: "EVENT", label: "EVENT"},
      {value: "GRANT", label: "GRANT"},
      {value: "OTHER", label: "OTHER"}
    ] },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "img", label: "Proof Image", type: "image" },
  ],
};

const createFns: Record<EntityType, (data: any) => Promise<any>> = {
  teacher: createTeacher,
  student: createStudent,
  staff: createStaff,
  parent: createParent,
  class: createClass,
  subject: createSubject,
  expense: createExpense,
  income: createIncome,
};

const updateFns: Record<EntityType, (id: any, data: any) => Promise<any>> = {
  teacher: updateTeacher,
  student: updateStudent,
  staff: updateStaff,
  parent: updateParent,
  class: updateClass,
  subject: updateSubject,
  expense: updateExpense,
  income: updateIncome,
};

const deleteFns: Record<EntityType, (id: any) => Promise<any>> = {
  teacher: deleteTeacher,
  student: deleteStudent,
  staff: deleteStaff,
  parent: deleteParent,
  class: deleteClass,
  subject: deleteSubject,
  expense: deleteExpense,
  income: deleteIncome,
};

export default function CrudFormModal({
  entity,
  mode,
  data,
  id,
  trigger,
  relatedData,
}: {
  entity: EntityType;
  mode: "create" | "update" | "delete";
  data?: any;
  id?: string | number;
  trigger?: React.ReactNode;
  relatedData?: Record<string, { value: string; label: string }[]>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [img, setImg] = useState<any>(data?.img || null);

  // Merge dynamic relatedData options into field definitions
  const fields = entityFields[entity].map((f) => {
    if (relatedData && relatedData[f.name] && f.type === "select" && !f.options) {
      return { ...f, options: relatedData[f.name] };
    }
    return f;
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    const values: any = {};

    fields.forEach((f) => {
      if (f.type === "image") return; // Manual handle
      const val = formData.get(f.name) as string;
      if ((f.type === "number" || f.parseAsNumber) && val) {
        values[f.name] = parseFloat(val);
      } else if (val) {
        values[f.name] = val;
      }
    });

    if (img) {
      values.img = typeof img === "string" ? img : img.secure_url;
    }

    startTransition(async () => {
      let result;
      if (mode === "create") {
        result = await createFns[entity](values);
      } else if (mode === "update" && id) {
        result = await updateFns[entity](id, values);
      }
      if (result?.success) {
        setOpen(false);
      } else {
        setError(result?.error || "Something went wrong.");
      }
    });
  };

  const handleDelete = () => {
    if (!id) return;
    setError("");
    startTransition(async () => {
      const result = await deleteFns[entity](id);
      if (result?.success) {
        setOpen(false);
      } else {
        setError(result?.error || "Failed to delete.");
      }
    });
  };

  const formatDate = (val: any) => {
    if (!val) return "";
    const d = new Date(val);
    return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
  };

  const defaultTrigger = (() => {
    if (mode === "create") {
      return (
        <button className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-600 transition-colors shadow-sm">
          <span className="text-lg leading-none">+</span> Add {entity.charAt(0).toUpperCase() + entity.slice(1)}
        </button>
      );
    }
    if (mode === "update") {
      return (
        <button className="w-7 h-7 flex items-center justify-center rounded-full bg-lamaSky hover:bg-blue-300 transition-colors">
          <Image src="/update.png" alt="Edit" width={16} height={16} />
        </button>
      );
    }
    return (
      <button className="w-7 h-7 flex items-center justify-center rounded-full bg-lamaPurple hover:bg-purple-300 transition-colors">
        <Image src="/delete.png" alt="Delete" width={16} height={16} />
      </button>
    );
  })();

  return (
    <>
      <div onClick={() => setOpen(true)} className="cursor-pointer">
        {trigger || defaultTrigger}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 relative max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white p-5 border-b border-slate-100 flex justify-between items-center rounded-t-xl z-10">
              <h2 className="text-lg font-bold text-slate-800">
                {mode === "delete" ? "Delete" : mode === "create" ? "Add New" : "Edit"}{" "}
                {entity.charAt(0).toUpperCase() + entity.slice(1)}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              {mode === "delete" ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="text-4xl">⚠️</div>
                  <p className="text-center text-slate-600 font-medium">
                    Are you sure you want to delete this {entity}?
                    <br />
                    <span className="text-sm text-slate-400">This action cannot be undone.</span>
                  </p>
                  {error && <p className="text-rose-500 text-sm">{error}</p>}
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => setOpen(false)}
                      disabled={isPending}
                      className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isPending}
                      className="px-5 py-2 text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isPending ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {fields.map((f) => (
                      <div key={f.name} className={f.name === "address" ? "sm:col-span-2" : ""}>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          {f.label} {f.required && <span className="text-rose-400">*</span>}
                        </label>
                        {f.type === "select" ? (
                          <select
                            name={f.name}
                            defaultValue={data?.[f.name] || ""}
                            required={f.required}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          >
                            <option value="">Select...</option>
                            {f.options?.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : f.type === "image" ? (
                          <div className="flex flex-col gap-2">
                            <CldUploadWidget
                              uploadPreset="school"
                              onSuccess={(result, { close }) => {
                                setImg(result.info);
                                close();
                              }}
                            >
                              {({ open }) => (
                                <div
                                  className="flex items-center gap-2 cursor-pointer text-slate-500 hover:text-slate-800 transition-all p-3 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50"
                                  onClick={() => open()}
                                >
                                  <Image src="/upload.png" alt="" width={24} height={24} />
                                  <span className="text-sm">{img ? "Image Uploaded ✅" : "Upload Proof"}</span>
                                </div>
                              )}
                            </CldUploadWidget>
                            {img && (
                              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 mt-1">
                                <Image 
                                  src={
                                    (typeof img === "string" ? img : img.secure_url).toLowerCase().endsWith(".pdf") 
                                      ? (typeof img === "string" ? img : img.secure_url).replace(/\.pdf$/i, ".jpg")
                                      : (typeof img === "string" ? img : img.secure_url)
                                  } 
                                  alt="Proof" fill className="object-cover" 
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <input
                            name={f.name}
                            type={f.type}
                            defaultValue={
                              f.type === "date"
                                ? formatDate(data?.[f.name])
                                : data?.[f.name] ?? ""
                            }
                            required={f.required}
                            placeholder={f.placeholder}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {error && <p className="text-rose-500 text-sm text-center">{error}</p>}

                  <div className="flex justify-end gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      disabled={isPending}
                      className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-5 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isPending ? "Saving..." : mode === "create" ? "Create" : "Save Changes"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
