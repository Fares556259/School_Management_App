"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTransition, useState, useEffect } from "react";
import InputField from "../InputField";
import Image from "next/image";
import { createNotice, updateNotice } from "@/lib/crudActions";

const schema = z.object({
  title: z.string().min(1, { message: "Title is required!" }),
  message: z.string().min(1, { message: "Content is required!" }),
  important: z.boolean().default(false),
  classId: z.coerce.number().optional().nullable(),
  targetStudentId: z.string().optional().nullable(),
});

type Inputs = z.infer<typeof schema>;

const AnnouncementForm = ({
  type,
  data,
}: {
  type: "create" | "update";
  data?: any;
}) => {
  const [isPending, startTransition] = useTransition();
  const [img, setImg] = useState<string | null>(data?.img || null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(data?.pdfUrl || null);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string; surname: string }[]>([]);
  const [fetchingStudents, setFetchingStudents] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: data?.title || "",
      message: data?.message || "",
      important: data?.important || false,
      classId: data?.classId || null,
      targetStudentId: data?.targetStudentId || "",
    },
  });

  const classId = watch("classId");

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await fetch('/api/classes');
        const result = await response.json();
        setClasses(result);
      } catch (err) {
        console.error("Failed to fetch classes:", err);
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    if (classId) {
      setFetchingStudents(true);
      fetch(`/api/students?classId=${classId}`)
        .then(res => res.json())
        .then(data => {
          setStudents(data);
          setFetchingStudents(false);
        })
        .catch(err => {
          console.error("Error fetching students:", err);
          setFetchingStudents(false);
        });
    } else {
      setStudents([]);
      setValue("targetStudentId", null);
    }
  }, [classId, setValue]);

  const onSubmit = handleSubmit((formData) => {
    startTransition(async () => {
      const payload = {
        ...formData,
        classId: formData.classId || null,
        targetStudentId: formData.targetStudentId || null,
        img,
        pdfUrl,
      };
      
      const res = type === "create"
        ? await createNotice(payload)
        : await updateNotice(data?.id, payload);
        
      if (!res.success) {
          alert(res.error);
      } else {
          // Success! The modal will be closed by the user or common logic if applicable.
          window.location.reload(); // Refresh to show changes
      }
    });
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const supabase = (await import('@/utils/supabase/client')).createClient();
      const fileName = `${type}-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const filePath = `notices/${type}s/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      if (type === 'image') setImg(publicUrl);
      else setPdfUrl(publicUrl);
    } catch (err: any) {
      console.error(`${type} upload failed:`, err);
      alert(err.message || `Failed to upload ${type}.`);
    }
  };

  return (
    <form className="flex flex-col gap-6 p-4 max-h-[85vh] overflow-y-auto" onSubmit={onSubmit}>
      <h1 className="text-xl font-bold text-slate-800">
        {type === "create" ? "📢 Create New Announcement" : "✏️ Update Announcement"}
      </h1>
      
      <div className="flex flex-col gap-4">
        {/* Title */}
        <InputField
          label="Announcement Title"
          name="title"
          defaultValue={data?.title}
          register={register}
          error={errors?.title}
          placeholder="e.g. End of Term Examination Schedule"
        />

        {/* Message */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-500 font-bold">Content / Message</label>
          <textarea
            {...register("message")}
            className="ring-[1.5px] ring-gray-300 p-3 rounded-xl text-sm w-full min-h-[120px] focus:ring-indigo-500 outline-none transition-all"
            placeholder="Write your announcement details here..."
          />
          {errors.message?.message && (
            <p className="text-xs text-red-500">{errors.message.message.toString()}</p>
          )}
        </div>

        <div className="flex gap-4 flex-wrap">
          {/* Class Visibility */}
          <div className="flex flex-col gap-2 w-full md:w-[48%]">
            <label className="text-xs text-gray-500 font-bold">Class Scope</label>
            <select
              className="ring-[1.5px] ring-gray-300 p-3 rounded-xl text-sm w-full focus:ring-indigo-500 outline-none bg-white transition-all appearance-none"
              {...register("classId")}
              defaultValue={data?.classId || ""}
            >
              <option value="">🌍 Global (All Classes)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  📚 Class {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Student Targeting (Conditional) */}
          {classId && (
            <div className="flex flex-col gap-2 w-full md:w-[48%] animate-in fade-in slide-in-from-left-2 duration-300">
              <label className="text-xs text-gray-500 font-bold">Student Target (Optional)</label>
              <select
                className="ring-[1.5px] ring-gray-300 p-3 rounded-xl text-sm w-full focus:ring-indigo-500 outline-none bg-white transition-all appearance-none disabled:opacity-50"
                {...register("targetStudentId")}
                defaultValue={data?.targetStudentId || ""}
                disabled={fetchingStudents}
              >
                <option value="">👤 All Students in Class</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    🎓 {s.name} {s.surname}
                  </option>
                ))}
              </select>
              {fetchingStudents && <p className="text-[10px] text-indigo-500 animate-pulse font-medium ml-1">Loading students...</p>}
            </div>
          )}

          {/* Important Toggle */}
          <div className="flex items-center gap-3 w-full md:w-[48%] mt-6 px-2">
            <input
              type="checkbox"
              id="important"
              {...register("important")}
              className="w-5 h-5 accent-red-500 cursor-pointer"
            />
            <label htmlFor="important" className="text-sm font-bold text-slate-700 cursor-pointer">
              Mark as URGENT 🚨
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          {/* Cover Image Upload */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-800 font-bold">Cover Image (Full width on mobile)</label>
            <input
              type="file"
              id="notice-img"
              className="hidden"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, 'image')}
            />
            <button
              type="button"
              onClick={() => document.getElementById('notice-img')?.click()}
              className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
            >
              {img ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                  <Image src={img} alt="Preview" fill className="object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                  <Image src="/upload.png" alt="" width={24} height={24} className="opacity-50" />
                </div>
              )}
              <span className="text-xs font-bold text-slate-500">
                {img ? "Change Cover Image" : "Upload Cover Image"}
              </span>
            </button>
          </div>

          {/* PDF attachment */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-800 font-bold">PDF Attachment (Exam schedule, etc.)</label>
            <input
              type="file"
              id="notice-pdf"
              className="hidden"
              accept="application/pdf"
              onChange={(e) => handleFileUpload(e, 'pdf')}
            />
            <button
              type="button"
              onClick={() => document.getElementById('notice-pdf')?.click()}
              className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
            >
              {pdfUrl ? (
                <div className="flex items-center gap-2 bg-emerald-100 p-3 rounded-lg text-emerald-700 font-bold text-xs max-w-full">
                  <span className="truncate">📄 PDF Attached</span>
                </div>
              ) : (
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                  <span className="text-2xl">📁</span>
                </div>
              )}
              <span className="text-xs font-bold text-slate-500">
                {pdfUrl ? "Change Attachment" : "Attach PDF Document"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <button
        className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all mt-4 disabled:opacity-50"
        disabled={isPending}
      >
        {isPending ? "🚀 Publishing..." : type === "create" ? "Publish Announcement" : "Update Announcement"}
      </button>
    </form>
  );
};

export default AnnouncementForm;
