"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTransition, useState, useEffect } from "react";
import InputField from "../InputField";
import Image from "next/image";
import { createNotice, updateNotice } from "@/lib/crudActions";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { Upload, X, FileText, Image as ImageIcon, Trash2, FileCode, FileSpreadsheet, Archive } from "lucide-react";

const createSchema = (t: any) => z.object({
  title: z.string().min(1, { message: t.announcementForm?.titleRequired || "Title is required!" }),
  message: z.string().min(1, { message: t.announcementForm?.contentRequired || "Content is required!" }),
  important: z.boolean().default(false),
  classId: z.coerce.number().optional().nullable(),
  targetStudentId: z.string().optional().nullable(),
});

type Inputs = z.infer<ReturnType<typeof createSchema>>;

export default function AnnouncementForm({
  type,
  data,
  relatedData,
}: {
  type: "create" | "update";
  data?: any;
  relatedData?: any;
}) {
  const [isPending, startTransition] = useTransition();
  const [imgs, setImgs] = useState<string[]>(data?.img ? data.img.split(",").filter(Boolean) : []);
  const [pdfUrls, setPdfUrls] = useState<string[]>(data?.pdfUrl ? data.pdfUrl.split(",").filter(Boolean) : []);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingTarget, setUploadingTarget] = useState<'image' | 'doc' | null>(null);
  
  const classes = relatedData?.classes || [];
  const [students, setStudents] = useState<{ id: string; name: string; surname: string }[]>([]);
  const [fetchingStudents, setFetchingStudents] = useState(false);

  const { t } = useLanguage();
  const schema = createSchema(t);

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
        img: imgs.join(",") || null,
        pdfUrl: pdfUrls.join(",") || null,
      };
      
      const res = type === "create"
        ? await createNotice(payload)
        : await updateNotice(data?.id, payload);
        
      if (!res.success) {
          alert(res.error);
      } else {
          window.location.reload();
      }
    });
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetType: 'image' | 'doc') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadingTarget(targetType);
      setUploadProgress(0);

      const supabase = (await import('@/utils/supabase/client')).createClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || anonKey;

      const newUploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `${targetType}-${Date.now()}-${safeName}`;
        const filePath = `notices/${targetType}s/${fileName}`;

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${supabaseUrl}/storage/v1/object/uploads/${filePath}`);
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.setRequestHeader('apikey', anonKey);
          if (file.type) {
            xhr.setRequestHeader('Content-Type', file.type);
          }

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const filePercent = (event.loaded / event.total);
              const overallPercent = Math.round(((i + filePercent) / files.length) * 100);
              setUploadProgress(Math.min(overallPercent, 99));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const { data: { publicUrl } } = supabase.storage
                .from('uploads')
                .getPublicUrl(filePath);
              newUploadedUrls.push(publicUrl);
              resolve();
            } else {
              reject(new Error(`Upload failed for ${file.name}`));
            }
          };

          xhr.onerror = () => reject(new Error(`Network error uploading ${file.name}`));
          xhr.send(file);
        });
      }

      setUploadProgress(100);
      if (targetType === 'image') {
        setImgs(prev => [...prev, ...newUploadedUrls]);
      } else {
        setPdfUrls(prev => [...prev, ...newUploadedUrls]);
      }

      setTimeout(() => {
        setUploadingTarget(null);
        setUploadProgress(0);
      }, 500);

    } catch (err: any) {
      console.error(`${targetType} upload failed:`, err);
      alert(err.message || `Failed to upload files.`);
      setUploadingTarget(null);
      setUploadProgress(0);
    }
  };

  const getFileNameFromUrl = (url: string) => {
    try {
      const parts = url.split('/');
      const rawName = parts[parts.length - 1];
      const nameParts = rawName.split('-');
      if (nameParts.length > 2) {
        return nameParts.slice(2).join('-');
      }
      return rawName;
    } catch {
      return "Document";
    }
  };

  const getFileIcon = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return <FileText className="w-5 h-5 text-rose-500 shrink-0" />;
    if (['doc', 'docx'].includes(ext)) return <FileText className="w-5 h-5 text-blue-500 shrink-0" />;
    if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />;
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) return <Archive className="w-5 h-5 text-amber-500 shrink-0" />;
    return <FileCode className="w-5 h-5 text-slate-500 shrink-0" />;
  };

  return (
    <form className="flex flex-col gap-6 p-4 md:p-6 max-h-[85vh] overflow-y-auto" onSubmit={onSubmit}>
      <h1 className="text-[20px] font-semibold text-[#181d26] tracking-tight">
        {type === "create" ? t.announcementForm?.createTitle || "Create Announcement" : t.announcementForm?.updateTitle || "Update Announcement"}
      </h1>
      
      <div className="flex flex-col gap-4">
        {/* Title */}
        <InputField
          label={t.announcementForm?.titleLabel || "Announcement Title"}
          name="title"
          defaultValue={data?.title}
          register={register}
          error={errors?.title}
          placeholder={t.announcementForm?.titlePlaceholder || "e.g. End of Term Examination Schedule"}
        />

        {/* Message */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-[#41454d]">{t.announcementForm?.contentLabel || "Content"}</label>
          <textarea
            {...register("message")}
            className="border border-[#dddddd] p-2.5 rounded-[6px] text-[13px] font-medium text-[#181d26] w-full min-h-[120px] focus:border-indigo-500 focus:outline-none transition-all placeholder:font-normal placeholder:text-[#9297a0]"
            placeholder={t.announcementForm?.contentPlaceholder || "Write your announcement details here..."}
          />
          {errors.message?.message && (
            <p className="text-xs text-red-500">{errors.message.message.toString()}</p>
          )}
        </div>

        <div className="flex gap-4 flex-wrap">
          {/* Class Visibility */}
          <div className="flex flex-col gap-1.5 w-full md:w-[48%]">
            <label className="text-[12px] font-medium text-[#41454d]">{t.announcementForm?.classScopeLabel || "Class Scope"}</label>
            <select
              className="border border-[#dddddd] p-2.5 rounded-[6px] text-[13px] font-medium text-[#181d26] w-full focus:border-indigo-500 focus:outline-none bg-white transition-all appearance-none"
              {...register("classId")}
              defaultValue={data?.classId || ""}
            >
              <option value="">{t.announcementForm?.globalOption || "Global (All Classes)"}</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {t.announcementForm?.classPrefix || "Class "}{c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Student Targeting (Conditional) */}
          {classId && (
            <div className="flex flex-col gap-1.5 w-full md:w-[48%] animate-in fade-in slide-in-from-left-2 duration-300">
              <label className="text-[12px] font-medium text-[#41454d]">{t.announcementForm?.studentTargetLabel || "Student Target (Optional)"}</label>
              <select
                className="border border-[#dddddd] p-2.5 rounded-[6px] text-[13px] font-medium text-[#181d26] w-full focus:border-indigo-500 focus:outline-none bg-white transition-all appearance-none disabled:opacity-50"
                {...register("targetStudentId")}
                defaultValue={data?.targetStudentId || ""}
                disabled={fetchingStudents}
              >
                <option value="">{t.announcementForm?.allStudentsOption || "All Students in Class"}</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.surname}
                  </option>
                ))}
              </select>
              {fetchingStudents && <p className="text-[10px] text-indigo-500 animate-pulse font-medium ml-1">{t.announcementForm?.loadingStudents || "Loading students..."}</p>}
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
              {t.announcementForm?.markUrgent || "Mark as URGENT"}
            </label>
          </div>
        </div>

        {/* ATTACHMENTS SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pt-4 border-t border-[#f0f0f0]">
          
          {/* Images Upload Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-[#41454d] flex items-center gap-1.5">
                <ImageIcon size={14} className="text-indigo-500" />
                {t.announcementForm?.imageAttachments || "Image Attachments"} ({imgs.length})
              </label>
            </div>

            <input
              type="file"
              id="notice-imgs"
              className="hidden"
              accept="image/*"
              multiple
              onChange={(e) => handleFileUpload(e, 'image')}
            />

            <button
              type="button"
              onClick={() => document.getElementById('notice-imgs')?.click()}
              disabled={uploadingTarget === 'image'}
              className="flex items-center justify-center gap-2 p-3 border border-dashed border-[#dddddd] rounded-[8px] bg-[#f8fafc] hover:border-indigo-400 hover:bg-indigo-50 transition-all text-[12px] font-semibold text-slate-600 group relative overflow-hidden"
            >
              {uploadingTarget === 'image' && (
                <div className="absolute inset-0 bg-[#181d26]/80 flex flex-col items-center justify-center z-10 p-2 backdrop-blur-sm">
                  <div className="text-white text-[14px] font-bold">
                    {t.announcementForm?.uploadingImages || "Uploading Images"} ({uploadProgress}%)
                  </div>
                </div>
              )}
              <Upload size={16} className="text-indigo-500" />
              <span>{t.announcementForm?.addImages || "Add Images (Multiple allowed)"}</span>
            </button>

            {imgs.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {imgs.map((url, idx) => (
                  <div key={url} className="relative aspect-square rounded-md overflow-hidden border border-[#dddddd] group">
                    <Image src={url} alt="Attachment" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => setImgs(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      title="Remove image"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Files & Documents Upload Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-[#41454d] flex items-center gap-1.5">
                <FileText size={14} className="text-emerald-500" />
                {t.announcementForm?.docAttachments || "Document Attachments"} ({pdfUrls.length})
              </label>
            </div>

            <input
              type="file"
              id="notice-docs"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
              multiple
              onChange={(e) => handleFileUpload(e, 'doc')}
            />

            <button
              type="button"
              onClick={() => document.getElementById('notice-docs')?.click()}
              disabled={uploadingTarget === 'doc'}
              className="flex items-center justify-center gap-2 p-3 border border-dashed border-[#dddddd] rounded-[8px] bg-[#f8fafc] hover:border-emerald-400 hover:bg-emerald-50 transition-all text-[12px] font-semibold text-slate-600 group relative overflow-hidden"
            >
              {uploadingTarget === 'doc' && (
                <div className="absolute inset-0 bg-[#181d26]/80 flex flex-col items-center justify-center z-10 p-2 backdrop-blur-sm">
                  <div className="text-white text-[14px] font-bold">
                    {t.announcementForm?.uploadingFiles || "Uploading Files"} ({uploadProgress}%)
                  </div>
                </div>
              )}
              <Upload size={16} className="text-emerald-500" />
              <span>{t.announcementForm?.attachDocs || "Attach Documents (PDF, Word, Excel, etc.)"}</span>
            </button>

            {pdfUrls.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2 max-h-44 overflow-y-auto custom-scrollbar">
                {pdfUrls.map((url, idx) => (
                  <div key={url} className="flex items-center justify-between p-2 rounded-md border border-[#dddddd] bg-[#f8fafc] text-[12px] gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(url)}
                      <span className="truncate font-medium text-slate-700">{getFileNameFromUrl(url)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPdfUrls(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                      title="Remove document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      <button
        className="bg-[#181d26] hover:bg-[#0d1218] text-white p-3 rounded-[6px] font-medium text-[13px] shadow-sm transition-all mt-4 disabled:opacity-50"
        disabled={isPending}
      >
        {isPending ? (t.announcementForm?.publishing || "Publishing...") : type === "create" ? (t.announcementForm?.publishButton || "Publish Announcement") : (t.announcementForm?.updateButton || "Update Announcement")}
      </button>
    </form>
  );
}
