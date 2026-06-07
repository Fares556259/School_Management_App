"use client";

import { useState, useTransition, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import SearchableSelect from "./SearchableSelect";
import MultiSelect from "./MultiSelect";
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
import { Pencil, Trash2, Loader2, UploadCloud, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";



type EntityType = "teacher" | "student" | "staff" | "parent" | "class" | "subject" | "expense" | "income";

interface FieldDef {
  name: string;
  label: string;
  type: "text" | "email" | "number" | "date" | "select" | "multi-select" | "image" | "searchable-select" | "creatable-select";
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
    { name: "phone", label: "Phone", type: "text" },
    { name: "address", label: "Address", type: "text", required: true },
    { name: "bloodType", label: "Blood Type", type: "text", required: true },
    { name: "birthday", label: "Birthday", type: "date", required: true },
    { name: "sex", label: "Sex", type: "select", required: true, options: [{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }] },
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
    { name: "img", label: "Profile Photo", type: "image" },
  ],
  staff: [
    { name: "username", label: "Username", type: "text", required: true },
    { name: "name", label: "First Name", type: "text", required: true },
    { name: "surname", label: "Last Name", type: "text", required: true },
    { name: "phone", label: "Phone", type: "text" },
    { name: "address", label: "Address", type: "text", required: true },
    { name: "role", label: "Role", type: "text", required: true, placeholder: "e.g. Secretary, Guard, Janitor" },
    { name: "bloodType", label: "Blood Type", type: "text", required: true },
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
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { t } = useLanguage();

  // Unified Enrollment State
  const [students, setStudents] = useState<any[]>([
    { id: Date.now(), name: "", surname: "", sex: "MALE", birthday: "", classId: "", levelId: "", username: "" }
  ]);

  // Reset state when modal is closed in create mode
  useEffect(() => {
    if (!open && mode === "create") {
      setImg(null);
      setError("");
      setUploadingImg(false);
      setUploadProgress(0);
      setStudents([
        { id: Date.now(), name: "", surname: "", sex: "MALE", birthday: "", classId: "", levelId: "", username: "" }
      ]);
    }
  }, [open, mode]);

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

    fields.forEach((f) => {
      if (f.type === "image") return; // Manual handle
      if (f.type === "multi-select") {
        const vals = formData.getAll(f.name);
        values[f.name] = vals.map(v => f.parseAsNumber ? parseInt(v as string, 10) : v);
      } else {
        const val = formData.get(f.name) as string;
        if ((f.type === "number" || f.parseAsNumber) && val) {
          values[f.name] = parseFloat(val);
        } else if (val) {
          values[f.name] = val;
        }
      }
    });

    // Handle image state: ensure null is sent if photo was explicitly removed
    values.img = img || null;

    startTransition(async () => {
      let result;
      if (mode === "create") {
        if (entity === "parent") {
          // Collect children data from the form
          const studentList = students.map((s, index) => ({
            name: formData.get(`student-${index}-name`),
            surname: formData.get(`student-${index}-surname`),
            sex: formData.get(`student-${index}-sex`),
            birthday: formData.get(`student-${index}-birthday`),
            classId: formData.get(`student-${index}-classId`),
            bloodType: "O+", // Default for speed
          }));

          // Validate that children info is filled
          const missingInfo = studentList.some(s => !s.name || !s.surname || !s.classId);
          if (missingInfo) {
            setError("Please fill in all student details.");
            return;
          }

          result = await enrollFamily(values, studentList);
        } else {
          result = await createFns[entity](values);
        }
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
        <button className="flex items-center gap-2 bg-[#181d26] text-white px-4 py-2.5 rounded-[6px] text-[13px] font-medium hover:bg-[#0d1218] transition-colors shadow-sm">
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

      {open && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[12px] shadow-xl border border-[#dddddd] max-w-lg w-full relative max-h-[90vh] overflow-y-auto custom-scrollbar">
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
                          <div className="flex flex-col gap-2">
                            <input
                              type="file"
                              id={`upload-${f.name}-${entity}-${mode}-${id || 'new'}`}
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                
                                setUploadingImg(true);
                                setUploadProgress(0);
                                setError("");
                                
                                // We use XMLHttpRequest for true, byte-accurate network progress reporting
                                const supabase = createClient();
                                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
                                const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
                                
                                const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                                const fileName = `${entity}-${Date.now()}-${safeName}`;
                                const filePath = `${fileName}`; // The bucket is 'uploads', the path is fileName

                                // Get session token if authenticated, fallback to anonKey
                                supabase.auth.getSession().then(({ data: { session } }) => {
                                  const token = session?.access_token || anonKey;

                                  const xhr = new XMLHttpRequest();
                                  xhr.open('POST', `${supabaseUrl}/storage/v1/object/uploads/${filePath}`);
                                  xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                                  xhr.setRequestHeader('apikey', anonKey);
                                  if (file.type) {
                                    xhr.setRequestHeader('Content-Type', file.type);
                                  }

                                  xhr.upload.onprogress = (event) => {
                                    if (event.lengthComputable) {
                                      const percentComplete = Math.round((event.loaded / event.total) * 100);
                                      // Keep it at max 99% until the response is fully processed
                                      setUploadProgress(Math.min(percentComplete, 99));
                                    }
                                  };

                                  xhr.onload = () => {
                                    if (xhr.status >= 200 && xhr.status < 300) {
                                      // Get public URL using JS client for convenience
                                      const { data: { publicUrl } } = supabase.storage
                                        .from('uploads')
                                        .getPublicUrl(filePath);
                                      
                                      setUploadProgress(100);
                                      setImg(publicUrl);
                                      
                                      setTimeout(() => {
                                        setUploadingImg(false);
                                        setUploadProgress(0);
                                      }, 500);
                                    } else {
                                      console.error("Upload failed with status:", xhr.status, xhr.responseText);
                                      setError(`Failed to upload: Server returned ${xhr.status}`);
                                      setUploadingImg(false);
                                      setUploadProgress(0);
                                    }
                                    // Reset input so the same file can be selected again
                                    e.target.value = '';
                                  };

                                  xhr.onerror = () => {
                                    console.error("Upload network error.");
                                    setError("Network error occurred during upload. Please check your connection.");
                                    setUploadingImg(false);
                                    setUploadProgress(0);
                                    e.target.value = '';
                                  };

                                  xhr.send(file);
                                }).catch(err => {
                                  console.error("Failed to get session for upload:", err);
                                  setError("Failed to authenticate upload request.");
                                  setUploadingImg(false);
                                  setUploadProgress(0);
                                  e.target.value = '';
                                });
                              }}
                            />
                            <div
                              className={`relative overflow-hidden flex items-center justify-center gap-2 cursor-pointer transition-all p-3 border rounded-[8px] ${
                                uploadingImg 
                                  ? "border-indigo-200 bg-indigo-50 text-indigo-700 pointer-events-none" 
                                  : img 
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
                                ) : img ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Image Uploaded
                                  </>
                                ) : (
                                  <>
                                    <UploadCloud className="w-4 h-4" />
                                    {entity === "parent" ? t.parents?.form?.uploadProof || "Upload Photo" : (t.crud.fields["Proof Image"] || "Upload Proof")}
                                  </>
                                )}
                              </div>
                            </div>
                            {img && (
                              <div className="relative w-full h-40 rounded-[8px] overflow-hidden border border-[#dddddd] mt-2 flex items-center justify-center bg-[#f8fafc] group shadow-sm">
                                {(typeof img === "string" ? img : img.secure_url).toLowerCase().endsWith(".pdf") ? (
                                  <div className="flex flex-col items-center gap-2">
                                    <span className="text-[13px] font-medium text-[#41454d]">PDF Document Uploaded</span>
                                  </div>
                                ) : (
                                  <Image 
                                    src={(typeof img === "string" ? img : img.secure_url)} 
                                    alt="Proof" fill className="object-cover" 
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => setImg(null)}
                                  className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm border border-[#dddddd] text-rose-500 w-8 h-8 flex items-center justify-center rounded-[6px] shadow-sm hover:bg-rose-50 hover:border-rose-200 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Remove Photo"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            )}
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
                        ) : (
                          <input
                            name={f.name}
                            type={f.type}
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
          </div>
        </div>
      )}
    </>
  );
}
