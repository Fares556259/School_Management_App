"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTransition, useState, useEffect } from "react";
import Image from "next/image";
import { createNotice, updateNotice } from "@/lib/crudActions";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { Upload, X, FileText, Image as ImageIcon, Trash2, FileCode, FileSpreadsheet, Archive, Loader2 } from "lucide-react";
import { compressImageFiles } from "@/lib/imageCompression";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

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
  onClose,
}: {
  type: "create" | "update";
  data?: any;
  relatedData?: any;
  onClose?: () => void;
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
  const router = useRouter();
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
        toast.error(res.error || t.toasts.operationFailed);
      } else {
        onClose?.();
        router.refresh();
      }
    });
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetType: 'image' | 'doc') => {
    const rawFiles = e.target.files ? Array.from(e.target.files) : [];
    if (rawFiles.length === 0) return;

    try {
      setUploadingTarget(targetType);
      setUploadProgress(0);

      const files = targetType === 'image'
        ? await compressImageFiles(rawFiles, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 })
        : rawFiles;

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
      toast.error(err.message || t.toasts.uploadFailed);
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

  const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400";
  const busy = isPending || uploadingTarget !== null;

  return (
    <form className="flex max-h-[90dvh] min-h-0 flex-col" onSubmit={onSubmit}>
      <header className="shrink-0 border-b border-slate-200 px-6 py-5 pe-14">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{type === "create" ? t.announcementForm?.createTitle || "Create Announcement" : t.announcementForm?.updateTitle || "Update Announcement"}</h1>
        <p className="mt-1.5 text-sm text-slate-500">{t.announcementsPage?.communications || "School Communications"}</p>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">{t.announcementForm?.titleLabel || "Announcement Title"} *</label>
          <input {...register("title")} className={fieldClass} placeholder={t.announcementForm?.titlePlaceholder || "e.g. End of Term Examination Schedule"} />
          {errors.title ? <p className="text-xs text-rose-600">{errors.title.message?.toString()}</p> : null}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">{t.announcementForm?.contentLabel || "Content"} *</label>
          <textarea {...register("message")} rows={4} className={`${fieldClass} resize-y`} placeholder={t.announcementForm?.contentPlaceholder || "Write your announcement details here..."} />
          {errors.message ? <p className="text-xs text-rose-600">{errors.message.message?.toString()}</p> : null}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">{t.announcementForm?.classScopeLabel || "Class Scope"}</label>
            <select className={fieldClass} {...register("classId")}><option value="">{t.announcementForm?.globalOption || "Global (All Classes)"}</option>{classes.map((schoolClass: any) => <option key={schoolClass.id} value={schoolClass.id}>{t.announcementForm?.classPrefix || "Class "}{schoolClass.name}</option>)}</select>
          </div>
          {classId ? <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">{t.announcementForm?.studentTargetLabel || "Student Target (Optional)"}</label>
            <select className={fieldClass} {...register("targetStudentId")} disabled={fetchingStudents}><option value="">{t.announcementForm?.allStudentsOption || "All Students in Class"}</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name} {student.surname}</option>)}</select>
            {fetchingStudents ? <p className="text-xs text-blue-600">{t.announcementForm?.loadingStudents || "Loading students..."}</p> : null}
          </div> : null}
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
          <input type="checkbox" {...register("important")} className="h-4 w-4 rounded border-slate-300 accent-rose-600" />
          <span className="text-sm font-medium text-slate-700">{t.announcementForm?.markUrgent || "Mark as URGENT"}</span>
        </label>
        <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-700"><ImageIcon size={16} className="text-blue-600" />{t.announcementForm?.imageAttachments || "Image Attachments"} ({imgs.length})</p>
            <input type="file" id="notice-imgs" className="hidden" accept="image/*" multiple onChange={(event) => handleFileUpload(event, "image")} />
            <button type="button" onClick={() => document.getElementById("notice-imgs")?.click()} disabled={busy} className="flex min-h-20 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:bg-blue-50/40 disabled:opacity-50">{uploadingTarget === "image" ? <Loader2 size={17} className="animate-spin text-blue-600" /> : <Upload size={17} className="text-blue-600" />}{uploadingTarget === "image" ? `${t.announcementForm?.uploadingImages || "Uploading Images"} ${uploadProgress}%` : t.announcementForm?.addImages || "Add Images"}</button>
            {imgs.length ? <div className="grid grid-cols-4 gap-2">{imgs.map((url, index) => <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200"><Image src={url} alt="" fill className="object-cover" /><button type="button" aria-label="Remove image" onClick={() => setImgs(previous => previous.filter((_, itemIndex) => itemIndex !== index))} className="absolute end-1 top-1 rounded bg-white/90 p-1 text-slate-500 shadow hover:text-rose-600"><X size={13} /></button></div>)}</div> : null}
          </div>
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-700"><FileText size={16} className="text-blue-600" />{t.announcementForm?.docAttachments || "Document Attachments"} ({pdfUrls.length})</p>
            <input type="file" id="notice-docs" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" multiple onChange={(event) => handleFileUpload(event, "doc")} />
            <button type="button" onClick={() => document.getElementById("notice-docs")?.click()} disabled={busy} className="flex min-h-20 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 text-center text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:bg-blue-50/40 disabled:opacity-50">{uploadingTarget === "doc" ? <Loader2 size={17} className="animate-spin text-blue-600" /> : <Upload size={17} className="text-blue-600" />}{uploadingTarget === "doc" ? `${t.announcementForm?.uploadingFiles || "Uploading Files"} ${uploadProgress}%` : t.announcementForm?.attachDocs || "Attach Documents"}</button>
            {pdfUrls.length ? <ul className="space-y-2">{pdfUrls.map((url, index) => <li key={url} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs"><span className="shrink-0">{getFileIcon(url)}</span><span className="min-w-0 flex-1 truncate text-slate-700">{getFileNameFromUrl(url)}</span><button type="button" aria-label="Remove document" onClick={() => setPdfUrls(previous => previous.filter((_, itemIndex) => itemIndex !== index))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button></li>)}</ul> : null}
          </div>
        </div>
      </div>
      <footer className="shrink-0 border-t border-slate-200 bg-slate-50/60 px-6 py-4">
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{t.resourcesPage.form.cancel}</button>
          <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{isPending ? <Loader2 size={16} className="animate-spin" /> : null}{isPending ? t.announcementForm?.publishing || "Publishing..." : type === "create" ? t.announcementForm?.publishButton || "Publish Announcement" : t.announcementForm?.updateButton || "Update Announcement"}</button>
        </div>
      </footer>
    </form>
  );
}
