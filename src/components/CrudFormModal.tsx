"use client";

import { useState, useTransition, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import SearchableSelect from "./SearchableSelect";
import MultiSelect from "./MultiSelect";
import { toast } from "react-toastify";
import { AnimatePresence, motion } from "framer-motion";
import {
  createTeacher, updateTeacher, deleteTeacher,
  createStudent, updateStudent, deleteStudent,
  createStaff, updateStaff, deleteStaff,
  createParent, updateParent, deleteParent,
  createClass, updateClass, deleteClass,
  createSubject, updateSubject, deleteSubject,
  createExpense, updateExpense, deleteExpense,
  createIncome, updateIncome, deleteIncome,
  enrollFamily, 
} from "@/lib/crudActions";
import { Pencil, Trash2, Loader2, UploadCloud, CheckCircle2, Eye, FileText } from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { ProofViewerModal } from "./ProofViewerModal";

const parseImgs = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") return val.split(",").filter(Boolean);
  if (typeof val === "object" && val.secure_url) return [val.secure_url];
  return [];
};

type EntityType = "teacher" | "student" | "staff" | "parent" | "class" | "subject" | "expense" | "income";

interface FieldDef {
  name: string;
  label: string;
  type: "text" | "email" | "number" | "date" | "select" | "multi-select" | "image" | "searchable-select" | "creatable-select" | "conditional-number";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  parseAsNumber?: boolean;
}

const entityFields: Record<EntityType, FieldDef[]> = {
  teacher: [
    { name: "name", label: "First Name", type: "text", required: true },
    { name: "surname", label: "Last Name", type: "text", required: true },
    { name: "phone", label: "Phone", type: "text", required: true },
    { name: "address", label: "Address", type: "text", required: true },
    { name: "bloodType", label: "Blood Type", type: "select", required: false, options: [
      { value: "A+", label: "A+" },
      { value: "A-", label: "A-" },
      { value: "B+", label: "B+" },
      { value: "B-", label: "B-" },
      { value: "AB+", label: "AB+" },
      { value: "AB-", label: "AB-" },
      { value: "O+", label: "O+" },
      { value: "O-", label: "O-" },
      { value: "Inconnu", label: "Inconnu" }
    ] },
    { name: "birthday", label: "Birthday", type: "date", required: true },
    { name: "sex", label: "Sex", type: "select", required: true, options: [{ value: "MALE", label: "Male (Homme)" }, { value: "FEMALE", label: "Female (Femme)" }] },
    { name: "salary", label: "Salary (DT)", type: "number" },
    { name: "subjects", label: "Subjects", type: "multi-select", parseAsNumber: true },
    { name: "classes", label: "Classes", type: "multi-select", parseAsNumber: true },
  ],
  student: [
    { name: "name", label: "First Name", type: "text", required: true },
    { name: "surname", label: "Last Name", type: "text", required: true },
    { name: "phone", label: "Phone", type: "text" },
    { name: "address", label: "Address", type: "text", required: true },
    { name: "birthday", label: "Birthday", type: "date", required: true },
    { name: "sex", label: "Sex", type: "select", required: true, options: [{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }] },
    { name: "parentId", label: "Parent", type: "searchable-select", required: true },
    { name: "classId", label: "Class", type: "select", required: true, parseAsNumber: true },
    { name: "customTuition", label: "Special Tuition Rate", type: "conditional-number", parseAsNumber: true },

    { name: "img", label: "Profile Photo", type: "image" },
  ],
  staff: [
    { name: "username", label: "Username", type: "text", required: true },
    { name: "name", label: "First Name", type: "text", required: true },
    { name: "surname", label: "Last Name", type: "text", required: true },
    { name: "phone", label: "Phone", type: "text" },
    { name: "address", label: "Address", type: "text", required: true },
    { name: "role", label: "Role", type: "text", required: true, placeholder: "e.g. Secretary, Guard, Janitor" },
    { name: "bloodType", label: "Blood Type", type: "select", required: false, options: [
      { value: "A+", label: "A+" },
      { value: "A-", label: "A-" },
      { value: "B+", label: "B+" },
      { value: "B-", label: "B-" },
      { value: "AB+", label: "AB+" },
      { value: "AB-", label: "AB-" },
      { value: "O+", label: "O+" },
      { value: "O-", label: "O-" },
      { value: "Inconnu", label: "Inconnu" }
    ] },
    { name: "birthday", label: "Birthday", type: "date", required: true },
    { name: "sex", label: "Sex", type: "select", required: true, options: [{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }] },
    { name: "salary", label: "Salary (DT)", type: "number" },
  ],
  parent: [
    { name: "name", label: "First Name", type: "text", required: true },
    { name: "surname", label: "Last Name", type: "text", required: true },
    { name: "phone", label: "Phone", type: "text", required: true },
    { name: "address", label: "Address", type: "text", required: true },
    { name: "img", label: "Profile Photo", type: "image" },
  ],
  class: [
    { name: "name", label: "Class Name", type: "select", required: true },
    { name: "capacity", label: "Capacity", type: "number", required: true },
  ],
  subject: [
    { 
      name: "name", 
      label: "Subject Name", 
      type: "text", 
      required: true,
      placeholder: "Arabic | Français | English  e.g. الرياضيات | Mathématiques | Mathematics"
    },
    { 
      name: "domain", 
      label: "Domain / Category", 
      type: "select", 
      required: false,
      options: [
        { value: "Languages",         label: "🔤 Languages" },
        { value: "Sciences",          label: "🔬 Sciences" },
        { value: "Religion & Values", label: "☪️ Religion & Values" },
        { value: "Humanities",        label: "🌍 Humanities" },
        { value: "Arts & Technology", label: "🎨 Arts & Technology" },
        { value: "Sport",             label: "⚽ Sport" },
        { value: "General",           label: "📚 General" },
      ]
    },
  ],
  expense: [
    { name: "title", label: "Description", type: "text", required: true, placeholder: "e.g., Bus Fuel - Route A" },
    { name: "amount", label: "Amount (DT)", type: "number", required: true, parseAsNumber: true },
    { name: "category", label: "Category", type: "creatable-select", required: true, placeholder: "Select or type new...", options: [
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
    { name: "amount", label: "Amount (DT)", type: "number", required: true, parseAsNumber: true },
    { name: "category", label: "Category", type: "creatable-select", required: true, placeholder: "Select or type new...", options: [
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
  onSuccess,
}: {
  entity: EntityType;
  mode: "create" | "update" | "delete";
  data?: any;
  id?: string | number;
  trigger?: React.ReactNode;
  relatedData?: Record<string, { value: string; label: string }[]>;
  onSuccess?: (values: any, mode: "create" | "update" | "delete", id?: string | number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [imgs, setImgs] = useState<string[]>(parseImgs(data?.img));
  const [isSpecialTuition, setIsSpecialTuition] = useState<boolean>(!!data?.customTuition);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewActiveIdx, setPreviewActiveIdx] = useState(0);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { t } = useLanguage();

  // Unified Enrollment State
  const [students, setStudents] = useState<any[]>([
    { id: Date.now(), name: "", surname: "", sex: "MALE", birthday: "", classId: "", levelId: "", username: "" }
  ]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      if (mode === "create") {
        setImgs([]);
      }
      setError("");
      setUploadingImg(false);
      setUploadProgress(0);
      setStudents([
        { id: Date.now(), name: "", surname: "", sex: "MALE", birthday: "", classId: "", levelId: "", username: "" }
      ]);
    } else {
      setImgs(parseImgs(data?.img));
    }
  }, [open, mode, data]);

  const addStudent = () => {
    setStudents([...students, { id: Date.now(), name: "", surname: "", sex: "MALE", birthday: "", classId: "", levelId: "", username: "" }]);
  };

  const removeStudent = (id: number) => {
    if (students.length > 1) {
      setStudents(students.filter(s => s.id !== id));
    }
  };

  // Merge dynamic relatedData options into field definitions
  const fields = entityFields[entity].map(f => {
    let options = f.options;
    if (relatedData && relatedData[f.name]) {
      if (options) {
        const existingValues = new Set(options.map(o => o.value.toLowerCase()));
        const newOptions = relatedData[f.name].filter(o => !existingValues.has(o.value.toLowerCase()));
        options = [...options, ...newOptions];
      } else {
        options = relatedData[f.name];
      }
    }
    // For Class dropdown in update mode, ensure current name is in the list
    if (entity === "class" && f.name === "name" && data?.name) {
      const opts = options || [];
      if (!opts.some((o: any) => o.value === data.name)) {
        options = [{ value: data.name, label: data.name }, ...opts];
      } else {
        options = opts;
      }
    }
    return { ...f, options };
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    const values: any = {};

    let hasValidationError = false;
    fields.forEach((f) => {
      if (f.type === "image") return; // Manual handle
      if (f.type === "multi-select") {
        const vals = formData.getAll(f.name);
        values[f.name] = vals.map(v => f.parseAsNumber ? parseInt(v as string, 10) : v);
      } else {
        const val = formData.get(f.name) as string;
        if ((f.type === "number" || f.type === "conditional-number" || f.parseAsNumber) && val) {
          // Unify comma and dot for international decimal input
          values[f.name] = parseFloat(val.replace(/,/g, '.'));
        } else if (f.type === "conditional-number" && !val) {
          values[f.name] = null;
        } else if (val) {
          values[f.name] = val;
        } else if (f.required) {
          hasValidationError = true;
          setError(`Please fill in ${t.crud.fields[f.label as keyof typeof t.crud.fields] || f.label}.`);
        }
      }
    });

    if (hasValidationError) return;

    // Handle image state: ensure null is sent if photo was explicitly removed
    values.img = imgs.length > 0 ? imgs.join(",") : null;

    // Optimistic UI: Close modal instantly to remove the 3-second blocking wait
    setOpen(false);
    
    // Trigger optimistic update in parent component immediately
    if (onSuccess) onSuccess(values, mode, id);

    const promise = new Promise(async (resolve, reject) => {
      startTransition(async () => {
        let result;
        try {
          if (mode === "create") {
            if (entity === "parent") {
              const studentList = students.map((s, index) => ({
                name: formData.get(`student-${index}-name`),
                surname: formData.get(`student-${index}-surname`),
                sex: formData.get(`student-${index}-sex`),
                birthday: formData.get(`student-${index}-birthday`),
                classId: formData.get(`student-${index}-classId`),
                bloodType: "O+",
              }));

              const missingInfo = studentList.some(s => !s.name || !s.surname || !s.classId);
              if (missingInfo) {
                setError("Please fill in all student details.");
                return reject("Missing student details");
              }

              result = await enrollFamily(values, studentList);
            } else {
              result = await createFns[entity](values);
            }
          } else if (mode === "update" && id) {
            result = await updateFns[entity](id, values);
          }
          
          if (result?.success) {
            resolve("Success");
            setOpen(false); // Close instantly on success
          } else {
            setError(result?.error || "Something went wrong.");
            reject(result?.error || "Something went wrong.");
          }
        } catch (err: any) {
          setError(err.message || "An error occurred.");
          reject(err.message);
        }
      });
    });

    toast.promise(promise, {
      pending: mode === "create" ? `Creating ${entity}...` : `Updating ${entity}...`,
      success: mode === "create" ? `${entity} created successfully!` : `${entity} updated successfully!`,
      error: "Operation failed."
    });
  };

  const handleDelete = () => {
    if (!id) return;
    setError("");
    
    // Optimistic UI: Close modal instantly
    setOpen(false);

    if (onSuccess) onSuccess({}, "delete", id);

    const promise = new Promise(async (resolve, reject) => {
      startTransition(async () => {
        try {
          const result = await deleteFns[entity](id);
          if (result?.success) {
            resolve("Success");
            setOpen(false); // Close instantly
          } else {
            setError(result?.error || "Failed to delete.");
            reject(result?.error || "Failed to delete.");
          }
        } catch (err: any) {
          setError(err.message || "Failed to delete.");
          reject(err.message);
        }
      });
    });

    toast.promise(promise, {
      pending: `Deleting ${entity}...`,
      success: `${entity} deleted successfully!`,
      error: "Failed to delete."
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
        <button className="flex items-center gap-2 bg-[#181d26] text-white px-4 py-2.5 rounded-[6px] text-[13px] font-medium hover:bg-[#0d1218] transition-colors shadow-sm whitespace-nowrap shrink-0">
          <span className="text-lg leading-none">+</span> {t.crud.add} {t.crud.entities[entity] || (entity.charAt(0).toUpperCase() + entity.slice(1))}
        </button>
      );
    }
    if (mode === "update") {
      return (
        <button className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-[#f8fafc] transition-colors text-[#41454d]" title="Edit">
          <Pencil size={14} strokeWidth={2} />
        </button>
      );
    }
    return (
      <button className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-rose-50 hover:text-rose-600 transition-colors group text-[#41454d]" title="Delete">
        <Trash2 size={16} strokeWidth={2} className="group-hover:text-rose-600" />
      </button>
    );
  })();

  return (
    <>
      <div onClick={() => setOpen(true)} className="cursor-pointer">
        {trigger || defaultTrigger}
      </div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[100] flex justify-center items-center">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`relative z-[101] bg-white rounded-[16px] shadow-2xl w-[95%] max-h-[90vh] overflow-y-auto custom-scrollbar ${entity === "income" || entity === "expense" || entity === "parent" || entity === "teacher" ? "max-w-xl" : "max-w-lg"}`}
            >
            {/* Header */}
            <div className="sticky top-0 bg-white p-6 border-b border-[#dddddd] flex justify-between items-center rounded-t-[12px] z-10">
              <h2 className="text-[20px] font-medium text-[#181d26] tracking-tight">
                {mode === "delete" ? t.crud.delete : mode === "create" ? t.crud.add : t.crud.edit}{" "}
                {t.crud.entities[entity] || (entity.charAt(0).toUpperCase() + entity.slice(1))}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-[#f8fafc] hover:text-[#181d26] text-[#41454d] transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {mode === "delete" ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="text-4xl">⚠️</div>
                  <p className="text-center text-[#41454d] text-[14px] font-normal leading-relaxed">
                    {t.crud.deleteConfirm} {t.crud.entities[entity] || entity}?
                    <br />
                    <span className="text-[#9297a0]">{t.crud.cannotUndo}</span>
                  </p>
                  {error && <p className="text-rose-500 text-[14px] font-medium">{error}</p>}
                  <div className="flex justify-end gap-3 mt-4 w-full border-t border-[#dddddd] pt-6">
                    <button
                      onClick={() => setOpen(false)}
                      disabled={isPending}
                      className="px-6 py-2.5 text-[16px] font-medium text-[#181d26] bg-white border border-[#dddddd] hover:bg-[#f8fafc] rounded-[12px] transition-colors"
                    >
                      {t.crud.cancel}
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isPending}
                      className="px-6 py-2.5 text-[16px] font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-[12px] transition-colors disabled:opacity-50"
                    >
                      {isPending ? t.crud.deleting : t.crud.delete}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {fields.map((f) => (
                      <div key={f.name} className={f.name === "address" ? "sm:col-span-2" : ""}>
                        <label className="block text-[14px] font-medium text-[#181d26] mb-2">
                          {t.crud.fields[f.label as keyof typeof t.crud.fields] || f.label} {f.required && <span className="text-rose-500">*</span>}
                        </label>
                        {f.type === "select" ? (
                          <select
                            name={f.name}
                            defaultValue={data?.[f.name] || ""}
                            required={f.required}
                            className="w-full border border-[#dddddd] rounded-[6px] px-4 py-2.5 text-[14px] font-normal text-[#181d26] bg-white h-[44px] focus:outline-none focus:border-[#458fff] focus:ring-1 focus:ring-[#458fff] transition-colors shadow-sm"
                          >
                            {/* <option value="">Select...</option> */}
                            {f.options?.map((o) => (
                              <option key={o.value} value={o.value}>
                                {t.crud.fields[o.label as keyof typeof t.crud.fields] || o.label}
                              </option>
                            ))}
                          </select>
                        ) : f.type === "multi-select" ? (
                          <div className="relative pb-2">
                            <MultiSelect
                              name={f.name}
                              options={f.options || []}
                              defaultValue={data?.[f.name]?.map((item: any) => item.id.toString()) || []}
                              placeholder={`Select ${t.crud.fields[f.label as keyof typeof t.crud.fields] || f.label}...`}
                            />
                          </div>
                        ) : f.type === "image" ? (
                          <div className="flex flex-col gap-3">
                            {(() => {
                              const isMulti = entity === "income" || entity === "expense";
                              const maxAllowed = isMulti ? 5 : 1;
                              const isMaxReached = imgs.length >= maxAllowed;

                              return (
                                <>
                                  <input
                                    type="file"
                                    id={`upload-${f.name}-${entity}-${mode}-${id || 'new'}`}
                                    className="hidden"
                                    multiple={isMulti}
                                    accept="image/*,application/pdf"
                                    onChange={async (e) => {
                                      const files = Array.from(e.target.files || []);
                                      if (files.length === 0) return;

                                      const remaining = maxAllowed - imgs.length;
                                      if (remaining <= 0) {
                                        setError(`Maximum of ${maxAllowed} image(s) allowed.`);
                                        e.target.value = '';
                                        return;
                                      }

                                      const selected = files.slice(0, remaining);
                                      setUploadingImg(true);
                                      setUploadProgress(0);
                                      setError("");

                                      const supabase = createClient();
                                      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
                                      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

                                      const uploadedUrls: string[] = [];
                                      for (let i = 0; i < selected.length; i++) {
                                        const file = selected[i];
                                        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                                        const fileName = `${entity}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeName}`;

                                        try {
                                          const url = await new Promise<string | null>((resolve) => {
                                            supabase.auth.getSession().then(({ data: { session } }) => {
                                              const token = session?.access_token || anonKey;
                                              const xhr = new XMLHttpRequest();
                                              xhr.open('POST', `${supabaseUrl}/storage/v1/object/uploads/${fileName}`);
                                              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                                              xhr.setRequestHeader('apikey', anonKey);
                                              if (file.type) xhr.setRequestHeader('Content-Type', file.type);

                                              xhr.upload.onprogress = (evt) => {
                                                if (evt.lengthComputable) {
                                                  const filePct = evt.loaded / evt.total;
                                                  const overallPct = Math.round(((i + filePct) / selected.length) * 100);
                                                  setUploadProgress(Math.min(overallPct, 99));
                                                }
                                              };

                                              xhr.onload = () => {
                                                if (xhr.status >= 200 && xhr.status < 300) {
                                                  const { data: { publicUrl } } = supabase.storage
                                                    .from('uploads')
                                                    .getPublicUrl(fileName);
                                                  resolve(publicUrl);
                                                } else {
                                                  resolve(null);
                                                }
                                              };

                                              xhr.onerror = () => resolve(null);
                                              xhr.send(file);
                                            }).catch(() => resolve(null));
                                          });

                                          if (url) uploadedUrls.push(url);
                                        } catch (err) {
                                          console.error("Upload error:", err);
                                        }
                                      }

                                      setUploadProgress(100);
                                      if (uploadedUrls.length > 0) {
                                        setImgs((prev) => [...prev, ...uploadedUrls].slice(0, maxAllowed));
                                      } else {
                                        setError("Failed to upload image(s).");
                                      }

                                      setTimeout(() => {
                                        setUploadingImg(false);
                                        setUploadProgress(0);
                                      }, 400);

                                      e.target.value = '';
                                    }}
                                  />

                                  {!isMaxReached && (
                                    <div
                                      className={`relative overflow-hidden flex items-center justify-center gap-2 cursor-pointer transition-all p-3 border rounded-[8px] ${
                                        uploadingImg 
                                          ? "border-indigo-200 bg-indigo-50 text-indigo-700 pointer-events-none" 
                                          : imgs.length > 0 
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" 
                                            : "border-dashed border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-100"
                                      }`}
                                      onClick={() => {
                                        if (!uploadingImg) document.getElementById(`upload-${f.name}-${entity}-${mode}-${id || 'new'}`)?.click();
                                      }}
                                    >
                                      {uploadingImg && (
                                        <div className="absolute inset-0 bg-indigo-100/30">
                                          <div 
                                            className="h-full bg-indigo-200/60 transition-all duration-300 ease-out" 
                                            style={{ width: `${uploadProgress}%` }} 
                                          />
                                        </div>
                                      )}
                                      
                                      <div className="relative z-10 flex items-center gap-2 text-[14px] font-medium">
                                        {uploadingImg ? (
                                          <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : "Finalizing..."}
                                          </>
                                        ) : (
                                          <>
                                            <UploadCloud className="w-4 h-4" />
                                            {entity === "parent"
                                              ? t.parents?.form?.uploadProof || "Upload Photo"
                                              : (t.crud.fields["Proof Image"] || "Upload Proof")}
                                            {isMulti && (
                                              <span className="text-xs opacity-75 font-normal">
                                                ({imgs.length}/{maxAllowed})
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Thumbnails Grid */}
                                  {imgs.length > 0 && (
                                    <div className="flex flex-col gap-1.5 mt-1">
                                      <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                                        <span>{(t.crud as any)?.uploadedProofs || "Uploaded Proofs"} ({imgs.length}/{maxAllowed})</span>
                                        <span className="text-[11px] text-slate-400 italic">{(t.crud as any)?.clickToPreview || "Click image to preview"}</span>
                                      </div>
                                      <div className="flex flex-wrap gap-3 mt-1">
                                        {imgs.map((url, idx) => {
                                          const isPdf = url.toLowerCase().split('?')[0].endsWith('.pdf');
                                          return (
                                            <div
                                              key={`${url}-${idx}`}
                                              className="relative w-28 h-28 rounded-2xl overflow-hidden border border-slate-200 bg-white group shadow-sm flex flex-col items-center justify-center cursor-pointer transition-all hover:shadow-md hover:border-slate-300"
                                              onClick={() => {
                                                setPreviewActiveIdx(idx);
                                                setPreviewOpen(true);
                                              }}
                                            >
                                              {isPdf ? (
                                                <div className="flex flex-col items-center justify-center p-2 text-center bg-slate-50 w-full h-full">
                                                  <FileText size={32} className="text-rose-500 mb-1" />
                                                  <span className="text-xs font-semibold text-slate-700 truncate max-w-[90px]">
                                                    {(t.crud as any)?.pdfDocument || "PDF Doc"}
                                                  </span>
                                                </div>
                                              ) : (
                                                <Image
                                                  src={url}
                                                  alt={`Proof ${idx + 1}`}
                                                  fill
                                                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                                                />
                                              )}

                                              {/* Hover Overlay */}
                                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-2 z-10">
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPreviewActiveIdx(idx);
                                                    setPreviewOpen(true);
                                                  }}
                                                  className="w-8 h-8 rounded-full bg-white text-slate-800 flex items-center justify-center hover:bg-slate-100 transition-all shadow-lg hover:scale-110"
                                                  title="Preview Image"
                                                >
                                                  <Eye size={16} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setImgs((prev) => prev.filter((_, i) => i !== idx));
                                                  }}
                                                  className="w-8 h-8 rounded-full bg-white text-rose-600 flex items-center justify-center hover:bg-rose-50 transition-all shadow-lg hover:scale-110"
                                                  title="Remove Image"
                                                >
                                                  <Trash2 size={16} />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Proof Viewer Modal */}
                                  <ProofViewerModal
                                    urls={imgs}
                                    initialIndex={previewActiveIdx}
                                    isOpen={previewOpen}
                                    onClose={() => setPreviewOpen(false)}
                                  />
                                </>
                              );
                            })()}
                          </div>
                        ) : f.type === "searchable-select" ? (
                          <SearchableSelect
                            name={f.name}
                            options={f.options || []}
                            defaultValue={data?.[f.name]}
                            required={f.required}
                            placeholder={`...Search ${t.crud.fields[f.label as keyof typeof t.crud.fields] || f.label}`}
                          />
                        ) : f.type === "creatable-select" ? (
                          <SearchableSelect
                            name={f.name}
                            options={f.options?.map(o => ({
                              ...o,
                              label: t.categories?.[o.label as keyof typeof t.categories] || t.crud.fields?.[o.label as keyof typeof t.crud.fields] || o.label
                            })) || []}
                            defaultValue={data?.[f.name]}
                            required={f.required}
                            placeholder={f.placeholder === "Select or type new..." ? t.placeholders?.selectOrType || f.placeholder : f.placeholder || `Select or type ${t.crud.fields[f.label as keyof typeof t.crud.fields] || f.label}...`}
                            allowCreate={true}
                          />
                        ) : f.type === "conditional-number" ? (
                          <div className="flex flex-col gap-2 relative">
                            <label className="flex items-center gap-2 cursor-pointer mb-1">
                              <input 
                                type="checkbox" 
                                checked={isSpecialTuition} 
                                onChange={(e) => setIsSpecialTuition(e.target.checked)}
                                className="w-4 h-4 text-[#458fff] rounded border-[#dddddd] focus:ring-[#458fff]"
                              />
                              <span className="text-[14px] font-medium text-slate-700 select-none">
                                {t.crud.fields[f.label as keyof typeof t.crud.fields] || f.label}
                              </span>
                            </label>
                            
                            <input
                              type="text"
                              inputMode="decimal"
                              name={f.name}
                              defaultValue={data?.[f.name] || ""}
                              disabled={!isSpecialTuition}
                              placeholder="0.00"
                              onChange={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = target.value.replace(/[^0-9.,]/g, '');
                              }}
                              className={`w-full border border-[#dddddd] rounded-[6px] px-4 py-2 text-[14px] font-normal text-[#181d26] h-[44px] focus:outline-none focus:border-[#458fff] focus:ring-1 focus:ring-[#458fff] transition-colors shadow-sm disabled:bg-slate-50 disabled:text-slate-400`}
                            />
                            {!isSpecialTuition && <input type="hidden" name={f.name} value="" />}
                          </div>
                        ) : (
                          <input
                            name={f.name}
                            type={f.type === "number" ? "text" : f.type}
                            inputMode={f.type === "number" ? "decimal" : undefined}
                            defaultValue={
                              f.type === "date"
                                ? formatDate(data?.[f.name])
                                : data?.[f.name] || ""
                            }
                            required={f.required}
                            placeholder={(() => {
                              if (f.placeholder === "e.g., Annual Charity Event") return t.placeholders?.incomeDesc || f.placeholder;
                              if (f.placeholder === "e.g., Bus Fuel - Route A") return t.placeholders?.expenseDesc || f.placeholder;
                              if (f.placeholder === "e.g. Secretary, Guard, Janitor") return t.placeholders?.staffRole || f.placeholder;
                              return t.crud.fields[f.placeholder as keyof typeof t.crud.fields] || f.placeholder;
                            })()}
                            step={f.type === "number" ? "0.01" : undefined}
                            className={`w-full border ${
                              error && f.name === error.split(" ")[0].toLowerCase()
                                ? "border-rose-500 focus:ring-rose-500"
                                : "border-[#dddddd] focus:border-[#458fff] focus:ring-[#458fff]"
                            } rounded-[6px] px-4 py-2 text-[14px] font-normal text-[#181d26] bg-white h-[44px] focus:outline-none focus:ring-1 transition-colors shadow-sm placeholder-[#9297a0]`}
                            onInput={(e) => {
                              if (f.type === "number") {
                                const target = e.target as HTMLInputElement;
                                target.value = target.value.replace(/[^0-9.,]/g, '');
                              }
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* CHILDREN SECTION FOR PARENT ENROLLMENT */}
                  {entity === "parent" && mode === "create" && (
                    <div className="flex flex-col gap-6 mt-4 pt-6 border-t border-[#dddddd]">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-[16px] font-medium text-[#181d26]">{t.parents?.form?.children || "Children"}</h3>
                          <p className="text-[13px] font-normal text-[#41454d]">{t.parents?.form?.registerChild || "Register at least one student"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={addStudent}
                          className="text-[14px] font-medium text-[#1b61c9] hover:text-[#1a3866] flex items-center gap-1 transition-colors"
                        >
                          <span className="text-[18px] leading-none">+</span> {t.parents?.form?.addSibling || "Add Sibling"}
                        </button>
                      </div>

                      <div className="flex flex-col gap-6">
                        {students.map((student, index) => (
                          <div key={student.id} className="relative p-5 bg-[#f8fafc] rounded-[10px] border border-[#dddddd]">
                            {students.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeStudent(student.id)}
                                className="absolute -top-3 -right-3 w-7 h-7 bg-white border border-[#dddddd] text-rose-500 rounded-[8px] flex items-center justify-center shadow-sm hover:bg-rose-50 transition-colors"
                              >
                                ✕
                              </button>
                            )}
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                              <div>
                                <label className="block text-[13px] font-medium text-[#181d26] mb-1.5">{t.parents?.form?.firstName || "First Name"} *</label>
                                <input
                                  name={`student-${index}-name`}
                                  required
                                  placeholder={t.parents?.form?.childName || "Child's Name"}
                                  className="w-full border border-[#dddddd] rounded-[6px] px-3 py-2 text-[14px] font-normal text-[#181d26] bg-white h-[40px] focus:outline-none focus:border-[#458fff] focus:ring-1 focus:ring-[#458fff] transition-colors placeholder-[#9297a0]"
                                />
                              </div>
                              <div>
                                <label className="block text-[13px] font-medium text-[#181d26] mb-1.5">{t.parents?.form?.lastName || "Last Name"} *</label>
                                <input
                                  name={`student-${index}-surname`}
                                  required
                                  placeholder={t.parents?.form?.childSurname || "Child's Surname"}
                                  className="w-full border border-[#dddddd] rounded-[6px] px-3 py-2 text-[14px] font-normal text-[#181d26] bg-white h-[40px] focus:outline-none focus:border-[#458fff] focus:ring-1 focus:ring-[#458fff] transition-colors placeholder-[#9297a0]"
                                />
                              </div>
                              <div>
                                <label className="block text-[13px] font-medium text-[#181d26] mb-1.5">{t.parents?.form?.sex || "Sex"} *</label>
                                <select
                                  name={`student-${index}-sex`}
                                  required
                                  className="w-full border border-[#dddddd] rounded-[6px] px-3 py-2 text-[14px] font-normal text-[#181d26] bg-white h-[40px] focus:outline-none focus:border-[#458fff] focus:ring-1 focus:ring-[#458fff] transition-colors"
                                >
                                  <option value="MALE">{t.parents?.form?.male || "Male"}</option>
                                  <option value="FEMALE">{t.parents?.form?.female || "Female"}</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[13px] font-medium text-[#181d26] mb-1.5">{t.parents?.form?.birthday || "Birthday"} *</label>
                                <input
                                  type="date"
                                  name={`student-${index}-birthday`}
                                  required
                                  className="w-full border border-[#dddddd] rounded-[6px] px-3 py-2 text-[14px] font-normal text-[#181d26] bg-white h-[40px] focus:outline-none focus:border-[#458fff] focus:ring-1 focus:ring-[#458fff] transition-colors"
                                />
                              </div>
                              <div>
                                <label className="block text-[13px] font-medium text-[#181d26] mb-1.5">{t.parents?.form?.class || "Class"} *</label>
                                <select
                                  name={`student-${index}-classId`}
                                  required
                                  className="w-full border border-[#dddddd] rounded-[6px] px-3 py-2 text-[14px] font-normal text-[#181d26] bg-white h-[40px] focus:outline-none focus:border-[#458fff] focus:ring-1 focus:ring-[#458fff] transition-colors"
                                >
                                  {relatedData?.classId?.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {error && <p className="text-rose-500 text-[14px] font-medium text-center">{error}</p>}

                  <div className="flex justify-end gap-3 mt-4 pt-6 border-t border-[#dddddd]">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      disabled={isPending}
                      className="px-6 py-2.5 text-[16px] font-medium text-[#181d26] bg-white border border-[#dddddd] hover:bg-[#f8fafc] rounded-[12px] transition-colors"
                    >
                      {t.crud.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={isPending || uploadingImg}
                      className="px-6 py-2.5 text-[16px] font-medium text-white bg-[#181d26] hover:bg-[#0d1218] rounded-[12px] transition-colors disabled:opacity-50"
                    >
                      {isPending ? t.crud.saving : uploadingImg ? t.crud.uploading : mode === "create" ? t.crud.create : t.crud.saveChanges}
                    </button>
                  </div>
                </form>
              )}
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
