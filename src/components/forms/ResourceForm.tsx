"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState, useEffect, useRef, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FileText, Upload, X, Loader2 } from "lucide-react";
import { createResource, updateResource } from "@/lib/crudActions";
import { getSubjectName } from "@/lib/utils";
import { compressImageFiles } from "@/lib/imageCompression";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { fetchAttendanceJson } from "@/lib/attendanceRoster";
import { toast } from "react-toastify";

type LessonOption = { id: number | string; classId: number; subject: { name: string }; teacher: { name: string; surname: string } };
type ResourceData = { id: number; title: string; description?: string | null; url: string; lessonId: number; classId?: number; lesson?: { classId: number } };
type Inputs = { title: string; description?: string; lessonId: string };
const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400";

export default function ResourceForm({ type, data, onClose, onBusyChange }: {
  type: "create" | "update";
  data?: ResourceData;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t, locale } = useLanguage();
  const copy = t.resourcesPage.form;
  const router = useRouter();
  const formId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const uploadingRef = useRef(false);
  const [selectedClassId, setSelectedClassId] = useState(String(data?.classId || data?.lesson?.classId || ""));
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [files, setFiles] = useState(() => (data?.url?.split(",").filter(Boolean) || []).map(url => ({ url, name: url.split("/").pop() || copy.files })));
  const busy = isSaving || isUploading;
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);

  const classesQuery = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["attendanceClasses"],
    queryFn: ({ signal }) => fetchAttendanceJson("/api/attendance/classes", signal),
    staleTime: 60_000, retry: 1,
  });
  const lessonsQuery = useQuery<LessonOption[]>({
    queryKey: ["assignmentLessonOptions", selectedClassId],
    queryFn: ({ signal }) => fetchAttendanceJson(`/api/assignment-lessons?classId=${encodeURIComponent(selectedClassId)}`, signal),
    enabled: !!selectedClassId, staleTime: 30_000, retry: 1, refetchOnWindowFocus: false,
  });
  const classes = classesQuery.data || [];
  const lessons = lessonsQuery.data || [];
  const optionsLoading = classesQuery.isPending || (!!selectedClassId && lessonsQuery.isPending);
  const optionsError = classesQuery.isError || (!!selectedClassId && lessonsQuery.isError);
  const schema = z.object({
    title: z.string().trim().min(1, copy.requiredTitle),
    description: z.string().optional(),
    lessonId: z.string().regex(/^(?:[1-9]\d*|slot-[1-9]\d*)$/, copy.requiredLesson),
  });
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues: { title: data?.title || "", description: data?.description || "", lessonId: String(data?.lessonId || "") },
  });
  const watchedLessonId = watch("lessonId");
  const selectedLesson = lessons.find(lesson => String(lesson.id) === watchedLessonId);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(event.target.files || []);
    event.target.value = "";
    if (!rawFiles.length || savingRef.current || uploadingRef.current) return;
    uploadingRef.current = true;
    setIsUploading(true);
    setUploadError("");
    try {
      const compressed = await compressImageFiles(rawFiles, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 });
      const supabase = (await import("@/utils/supabase/client")).createClient();
      for (const file of compressed) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `resources/resource-${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage.from("uploads").upload(path, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(path);
        setFiles(previous => [...previous, { url: publicUrl, name: file.name }]);
      }
    } catch {
      setUploadError(copy.uploadError);
    } finally {
      uploadingRef.current = false;
      setIsUploading(false);
    }
  };

  const onSubmit = handleSubmit(async values => {
    if (savingRef.current || uploadingRef.current || optionsLoading || optionsError || !selectedLesson || selectedLesson.classId !== Number(selectedClassId)) return;
    if (!files.length) { setSaveError(copy.requiredFiles); return; }
    savingRef.current = true;
    setIsSaving(true);
    setSaveError("");
    try {
      const payload = { ...values, url: files.map(file => file.url).join(",") };
      const result = type === "update" && data ? await updateResource(data.id, payload) : await createResource(payload);
      if (!result.success) throw new Error(result.error || copy.saveError);
      toast.success(copy.saved);
      onBusyChange(false);
      onClose();
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : copy.saveError);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" aria-busy={busy}>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <fieldset disabled={busy} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={`${formId}-class`} className="block text-sm font-medium text-slate-700">{copy.classLabel} <span aria-hidden="true">*</span></label>
              <select id={`${formId}-class`} required className={fieldClass} disabled={busy || classesQuery.isPending || classesQuery.isError} value={selectedClassId} onChange={event => {
                setSelectedClassId(event.target.value);
                setValue("lessonId", "", { shouldDirty: true, shouldValidate: false });
                setSaveError("");
              }}>
                <option value="">{classesQuery.isPending ? copy.loading : copy.chooseClass}</option>
                {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${formId}-lesson`} className="block text-sm font-medium text-slate-700">{copy.lessonLabel} <span aria-hidden="true">*</span></label>
              <select id={`${formId}-lesson`} {...register("lessonId")} className={fieldClass} disabled={busy || !selectedClassId || optionsLoading || optionsError} aria-invalid={!!errors.lessonId} aria-describedby={errors.lessonId ? `${formId}-lesson-error` : undefined}>
                <option value="">{!selectedClassId ? copy.chooseClassFirst : optionsLoading ? copy.loading : copy.chooseLesson}</option>
                {lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{getSubjectName(lesson.subject.name, locale)} — {lesson.teacher.name} {lesson.teacher.surname}</option>)}
              </select>
              {errors.lessonId && <p id={`${formId}-lesson-error`} className="text-xs text-red-600">{errors.lessonId.message}</p>}
            </div>
          </div>
          {optionsError ? <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span>{copy.loadError}</span><button type="button" className="shrink-0 font-medium underline" onClick={() => { void classesQuery.refetch(); if (selectedClassId) void lessonsQuery.refetch(); }}>{copy.retry}</button>
          </div> : optionsLoading ? <p role="status" className="text-sm text-slate-500">{copy.loading}</p>
            : !classes.length ? <p role="status" className="text-sm text-slate-500">{copy.noClasses}</p>
            : selectedClassId && !lessons.length ? <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{copy.noLessons}</p> : null}
          {selectedLesson && <p className="text-xs text-slate-500">{copy.teacher} : <span className="font-medium text-slate-700">{selectedLesson.teacher.name} {selectedLesson.teacher.surname}</span></p>}
          <div className="space-y-1.5 border-t border-slate-100 pt-5">
            <label htmlFor={`${formId}-title`} className="block text-sm font-medium text-slate-700">{copy.title} <span aria-hidden="true">*</span></label>
            <input id={`${formId}-title`} {...register("title")} className={fieldClass} placeholder={copy.titlePlaceholder} aria-invalid={!!errors.title} aria-describedby={errors.title ? `${formId}-title-error` : undefined} />
            {errors.title && <p id={`${formId}-title-error`} className="text-xs text-red-600">{errors.title.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-description`} className="block text-sm font-medium text-slate-700">{copy.description} <span className="ms-1 text-xs font-normal text-slate-400">{copy.optional}</span></label>
            <textarea id={`${formId}-description`} {...register("description")} rows={3} className={`${fieldClass} resize-y`} placeholder={copy.descriptionPlaceholder} />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">{copy.files} <span aria-hidden="true">*</span></p>
            <input ref={fileInput} type="file" className="hidden" multiple onChange={handleFileUpload} aria-label={copy.addFiles} />
            <button type="button" onClick={() => fileInput.current?.click()} className="flex w-full items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-4 text-start transition-colors hover:border-blue-400 hover:bg-blue-50/40 disabled:opacity-60">
              {isUploading ? <Loader2 size={20} className="shrink-0 animate-spin text-blue-600" /> : <Upload size={20} className="shrink-0 text-blue-600" />}
              <span><span className="block text-sm font-medium text-slate-800">{isUploading ? copy.uploading : copy.addFiles}</span><span className="mt-1 block text-xs text-slate-500">{copy.filesHint}</span></span>
            </button>
            {uploadError && <p role="alert" className="text-sm text-red-600">{uploadError}</p>}
            {files.length > 0 && <ul className="space-y-2">{files.map((file, index) => <li key={`${file.url}-${index}`} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
              <FileText size={17} className="shrink-0 text-slate-400" /><span className="min-w-0 flex-1 truncate text-sm text-slate-700" title={file.name}>{file.name}</span>
              <button type="button" aria-label={`${copy.remove} ${file.name}`} onClick={() => setFiles(previous => previous.filter((_, i) => i !== index))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={16} /></button>
            </li>)}</ul>}
          </div>
        </fieldset>
      </div>
      <div className="shrink-0 border-t border-slate-200 bg-slate-50/60 px-6 py-4">
        {saveError && <p role="alert" className="mb-3 text-sm text-red-600">{saveError}</p>}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{copy.cancel}</button>
          <button type="submit" disabled={busy || optionsLoading || optionsError || !selectedLesson} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {isSaving && <Loader2 size={16} className="animate-spin" />}{isSaving ? copy.saving : type === "update" ? copy.save : copy.publish}
          </button>
        </div>
      </div>
    </form>
  );
}
