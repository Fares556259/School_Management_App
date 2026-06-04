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
  relatedData,
}: {
  type: "create" | "update";
  data?: any;
  relatedData?: any;
}) => {
  const [isPending, startTransition] = useTransition();
  const [img, setImg] = useState<string | null>(data?.img || null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(data?.pdfUrl || null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingTarget, setUploadingTarget] = useState<'image' | 'pdf' | null>(null);
  const classes = relatedData?.classes || [];
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
      setUploadingTarget(type);
      setUploadProgress(0);

      const supabase = (await import('@/utils/supabase/client')).createClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const fileName = `${type}-${Date.now()}-${safeName}`;
      const filePath = `notices/${type}s/${fileName}`;

      const { data: { session } } = await supabase.auth.getSession();
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
          setUploadProgress(Math.min(percentComplete, 99));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const { data: { publicUrl } } = supabase.storage
            .from('uploads')
            .getPublicUrl(filePath);
          
          setUploadProgress(100);
          if (type === 'image') setImg(publicUrl);
          else setPdfUrl(publicUrl);

          setTimeout(() => {
            setUploadingTarget(null);
            setUploadProgress(0);
          }, 800);
        } else {
          alert(`Upload failed: ${xhr.statusText}`);
          setUploadingTarget(null);
          setUploadProgress(0);
        }
      };

      xhr.onerror = () => {
        alert("Upload failed. Please check your connection.");
        setUploadingTarget(null);
        setUploadProgress(0);
      };

      xhr.send(file);
    } catch (err: any) {
      console.error(`${type} upload failed:`, err);
      alert(err.message || `Failed to upload ${type}.`);
      setUploadingTarget(null);
      setUploadProgress(0);
    }
  };

  return (
    <form className="flex flex-col gap-6 p-4 md:p-6 max-h-[85vh] overflow-y-auto" onSubmit={onSubmit}>
      <h1 className="text-[20px] font-semibold text-[#181d26] tracking-tight">
        {type === "create" ? "Create Announcement" : "Update Announcement"}
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
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-[#41454d]">Content</label>
          <textarea
            {...register("message")}
            className="border border-[#dddddd] p-2.5 rounded-[6px] text-[13px] font-medium text-[#181d26] w-full min-h-[120px] focus:border-indigo-500 focus:outline-none transition-all placeholder:font-normal placeholder:text-[#9297a0]"
            placeholder="Write your announcement details here..."
          />
          {errors.message?.message && (
            <p className="text-xs text-red-500">{errors.message.message.toString()}</p>
          )}
        </div>

        <div className="flex gap-4 flex-wrap">
          {/* Class Visibility */}
          <div className="flex flex-col gap-1.5 w-full md:w-[48%]">
            <label className="text-[12px] font-medium text-[#41454d]">Class Scope</label>
            <select
              className="border border-[#dddddd] p-2.5 rounded-[6px] text-[13px] font-medium text-[#181d26] w-full focus:border-indigo-500 focus:outline-none bg-white transition-all appearance-none"
              {...register("classId")}
              defaultValue={data?.classId || ""}
            >
              <option value="">Global (All Classes)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Class {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Student Targeting (Conditional) */}
          {classId && (
            <div className="flex flex-col gap-1.5 w-full md:w-[48%] animate-in fade-in slide-in-from-left-2 duration-300">
              <label className="text-[12px] font-medium text-[#41454d]">Student Target (Optional)</label>
              <select
                className="border border-[#dddddd] p-2.5 rounded-[6px] text-[13px] font-medium text-[#181d26] w-full focus:border-indigo-500 focus:outline-none bg-white transition-all appearance-none disabled:opacity-50"
                {...register("targetStudentId")}
                defaultValue={data?.targetStudentId || ""}
                disabled={fetchingStudents}
              >
                <option value="">All Students in Class</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.surname}
                  </option>
                ))}
              </select>
              {fetchingStudents && <p className="text-[10px] text-indigo-500 animate-pulse font-medium ml-1">Loading students...</p>}
            </div>
          )}

          {/* Important Toggle */}
          <div className="flex items-center gap-2.5 w-full md:w-[48%] mt-6 px-1">
            <input
              type="checkbox"
              id="important"
              {...register("important")}
              className="w-4 h-4 accent-rose-600 cursor-pointer rounded border-[#dddddd]"
            />
            <label htmlFor="important" className="text-[13px] font-medium text-rose-700 cursor-pointer select-none">
              Mark as URGENT
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          {/* Cover Image Upload */}
          <div className="flex flex-col gap-1.5 h-full">
            <label className="text-[12px] font-medium text-[#41454d]">Cover Image</label>
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
              disabled={uploadingTarget === 'image'}
              className="flex flex-col items-center justify-center gap-2 p-6 border border-dashed border-[#dddddd] rounded-[6px] bg-[#f8fafc] hover:border-indigo-400 hover:bg-indigo-50 transition-all group relative overflow-hidden flex-1"
            >
              {uploadingTarget === 'image' && (
                <div className="absolute inset-0 bg-[#181d26]/80 flex flex-col items-center justify-center z-10 p-4 backdrop-blur-sm">
                  <div className="text-white text-[24px] font-bold tracking-tight mb-2">
                    {uploadProgress}%
                  </div>
                  <div className="w-3/4 max-w-[120px] bg-white/20 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400 transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              )}
              {img ? (
                <div className="relative w-full aspect-video rounded overflow-hidden">
                  <Image src={img} alt="Preview" fill className="object-cover" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-white border border-[#dddddd] shadow-sm rounded-full flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                  <Image src="/upload.png" alt="" width={18} height={18} className="opacity-60" />
                </div>
              )}
              <span className="text-[12px] font-medium text-[#5a5a5a]">
                {img ? "Change Cover Image" : "Upload Image"}
              </span>
            </button>
          </div>

          {/* PDF attachment */}
          <div className="flex flex-col gap-1.5 h-full">
            <label className="text-[12px] font-medium text-[#41454d]">PDF Attachment</label>
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
              disabled={uploadingTarget === 'pdf'}
              className="flex flex-col items-center justify-center gap-2 p-6 border border-dashed border-[#dddddd] rounded-[6px] bg-[#f8fafc] hover:border-emerald-400 hover:bg-emerald-50 transition-all group relative overflow-hidden flex-1"
            >
              {uploadingTarget === 'pdf' && (
                <div className="absolute inset-0 bg-[#181d26]/80 flex flex-col items-center justify-center z-10 p-4 backdrop-blur-sm">
                  <div className="text-white text-[24px] font-bold tracking-tight mb-2">
                    {uploadProgress}%
                  </div>
                  <div className="w-3/4 max-w-[120px] bg-white/20 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              )}
              {pdfUrl ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 p-2.5 rounded text-emerald-700 font-medium text-[12px] max-w-full">
                  <span className="truncate">PDF Attached</span>
                </div>
              ) : (
                <div className="w-10 h-10 bg-white border border-[#dddddd] shadow-sm rounded-full flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                  <span className="text-lg opacity-60">📄</span>
                </div>
              )}
              <span className="text-[12px] font-medium text-[#5a5a5a]">
                {pdfUrl ? "Change Attachment" : "Attach PDF"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <button
        className="bg-[#181d26] hover:bg-[#0d1218] text-white p-3 rounded-[6px] font-medium text-[13px] shadow-sm transition-all mt-4 disabled:opacity-50"
        disabled={isPending}
      >
        {isPending ? "Publishing..." : type === "create" ? "Publish Announcement" : "Update Announcement"}
      </button>
    </form>
  );
};

export default AnnouncementForm;
