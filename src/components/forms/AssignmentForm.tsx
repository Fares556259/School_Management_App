"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTransition, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createAssignment, updateAssignment } from "@/lib/crudActions";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { compressImageFiles } from "@/lib/imageCompression";
import { toast } from "react-toastify";
import { fetchAttendanceJson } from "@/lib/attendanceRoster";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";

function getTranslatedSubject(subjectStr: string, locale: string): string {
  if (!subjectStr) return "";
  const parts = subjectStr.split('|').map(p => p.trim());
  if (parts.length >= 3) {
    if (locale === 'ar') return parts[0];
    if (locale === 'fr') return parts[1];
    return parts[2];
  }
  return subjectStr;
}

const schema = z.object({
  title: z.string().min(1, { message: "Assignment title is required!" }),
  description: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  lessonId: z.union([z.coerce.number().int().positive(), z.string().regex(/^slot-[1-9]\d*$/)], { message: "Lesson is required!" }),
});

type Inputs = z.infer<typeof schema>;

const AssignmentForm = ({
  type,
  data,
  onClose,
}: {
  type: "create" | "update";
  data?: any;
  relatedData?: any;
  onClose?: () => void;
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(String(data?.classId || data?.lesson?.classId || ""));
  const [isPending, startTransition] = useTransition();
  const [imgs, setImgs] = useState<string[]>(data?.img ? data.img.split(",") : []);
  const [isUploading, setIsUploading] = useState(false);
  const { t, locale } = useLanguage();
  const router = useRouter();
  const classesQuery = useQuery<any[]>({
    queryKey: ["attendanceClasses"],
    queryFn: ({ signal }) => fetchAttendanceJson("/api/attendance/classes", signal),
    staleTime: 60_000, retry: 1,
  });
  const lessonsQuery = useQuery<any[]>({
    queryKey: ["assignmentLessonOptions", selectedClassId],
    queryFn: ({ signal }) => fetchAttendanceJson(`/api/assignment-lessons?classId=${selectedClassId}`, signal),
    enabled: !!selectedClassId,
    staleTime: 30_000, retry: 1,
    refetchOnWindowFocus: false,
  });
  const classes = classesQuery.data || [];
  const lessons = lessonsQuery.data || [];
  const optionsLoading = classesQuery.isPending || (!!selectedClassId && lessonsQuery.isPending);
  const optionsError = classesQuery.isError || (!!selectedClassId && lessonsQuery.isError);

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
      description: data?.description || "",
      startDate: data?.startDate ? new Date(data.startDate).toISOString().split('T')[0] : "",
      dueDate: data?.dueDate ? new Date(data.dueDate).toISOString().slice(0, 16) : "",
      lessonId: data?.lessonId || "",
    },
  });

  const watchedLessonId = watch("lessonId");
  const selectedLesson = lessons.find(lesson => String(lesson.id) === String(watchedLessonId));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = e.target.files ? Array.from(e.target.files) : [];
    if (rawFiles.length === 0) return;

    setIsUploading(true);
    try {
      const files = await compressImageFiles(rawFiles, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8,
      });

      const supabase = (await import('@/utils/supabase/client')).createClient();
      const newUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `task-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const filePath = `assignments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('uploads')
          .getPublicUrl(filePath);

        newUrls.push(publicUrl);
      }

      setImgs(prev => [...prev, ...newUrls]);
    } catch (err: any) {
      console.error("Task upload failed:", err);
      toast.error(err.message || t.toasts.uploadFailed);
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setImgs(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = handleSubmit((formData) => {
    if (optionsLoading || optionsError || !selectedLesson) return;
    startTransition(async () => {
      const imgString = imgs.join(",");
      const now = new Date();
      const defaultNoDate = new Date(0);
      
      const payload = {
        ...formData,
        img: imgString || undefined,
        startDate: formData.startDate || (data?.startDate ? new Date(data.startDate).toISOString() : now.toISOString()),
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : (data?.dueDate ? new Date(data.dueDate).toISOString() : defaultNoDate.toISOString())
      };

      const res =
        type === "create"
          ? await createAssignment(payload)
          : await updateAssignment(data.id, payload);

      if (res.success) {
        onClose?.();
        router.refresh();
      } else {
        toast.error(res.error || t.toasts.operationFailed);
      }
    });
  });

  const fieldClass = "ss-field py-2.5";

  return (
    <form className="flex max-h-[90dvh] min-h-0 flex-col" onSubmit={onSubmit}>
      <header className="shrink-0 border-b border-ink-200 px-6 py-5 pe-14">
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink-900">{type === "create" ? t.assignmentsPage.modal.createTitle : t.assignmentsPage.modal.updateTitle}</h1>
        <p className="mt-1.5 text-sm text-ink-500">{t.assignmentsPage.modal.subtitle}</p>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="ss-label">{t.assignmentsPage.modal.selectClass} *</label>
            <select aria-label={t.assignmentsPage.modal.selectClass} className={fieldClass} value={selectedClassId} disabled={classesQuery.isPending || isPending} onChange={(event) => { setSelectedClassId(event.target.value); setValue("lessonId", "", { shouldDirty: true }); }}>
              <option value="">{t.resourcesPage.form.chooseClass}</option>
              {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="ss-label">{t.assignmentsPage.modal.selectLesson} *</label>
            <select {...register("lessonId")} aria-label={t.assignmentsPage.modal.selectLesson} value={watchedLessonId || ""} disabled={!selectedClassId || optionsLoading || optionsError || isPending} className={fieldClass}>
              <option value="">{!selectedClassId ? t.resourcesPage.form.chooseClassFirst : optionsLoading ? t.assignmentsPage.modal.loadingLessons : t.assignmentsPage.modal.selectLessonPlaceholder}</option>
              {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{getTranslatedSubject(lesson.subject?.name, locale)} — {lesson.teacher?.name} {lesson.teacher?.surname}</option>)}
            </select>
            {errors.lessonId?.message ? <p className="text-xs text-rose-600">{errors.lessonId.message.toString()}</p> : null}
          </div>
        </div>
        {optionsError ? <div role="alert" className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><span>{t.assignmentsPage.modal.optionsLoadError}</span><button type="button" className="font-medium underline" onClick={() => { void classesQuery.refetch(); if (selectedClassId) void lessonsQuery.refetch(); }}>{t.assignmentsPage.modal.retryOptions}</button></div> : null}
        {!optionsLoading && selectedClassId && lessons.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">{t.assignmentsPage.modal.noLessons}</p> : null}
        {selectedLesson ? <p className="text-xs text-slate-500">{t.assignmentsPage.modal.assignedTeacher}: <span className="font-medium text-slate-700">{selectedLesson.teacher?.name} {selectedLesson.teacher?.surname}</span></p> : null}

        <div className="space-y-1.5 border-t border-ink-100 pt-5">
          <label className="ss-label">{t.assignmentsPage.modal.taskTitle} *</label>
          <input {...register("title")} className={fieldClass} placeholder={t.assignmentsPage.modal.taskTitlePlaceholder} />
          {errors.title ? <p className="text-xs text-rose-600">{errors.title.message?.toString()}</p> : null}
        </div>
        <div className="space-y-1.5">
          <label className="ss-label">{t.assignmentsPage.modal.taskDesc}</label>
          <textarea {...register("description")} rows={3} className={`${fieldClass} resize-y`} placeholder={t.assignmentsPage.modal.taskDescPlaceholder} />
        </div>
        <div className="space-y-1.5">
          <label className="ss-label">{t.assignmentsPage.modal.dueDate}</label>
          <input type="datetime-local" {...register("dueDate")} className={fieldClass} />
        </div>
        <div className="space-y-3">
          <p className="ss-label">{t.assignmentsPage.modal.attachments}</p>
          <input type="file" id="assignment-file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf" multiple />
          <button type="button" disabled={isUploading} onClick={() => document.getElementById("assignment-file")?.click()} className="flex w-full items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-4 text-start transition hover:border-blue-400 hover:bg-brand-50/40 disabled:opacity-60">
            {isUploading ? <Loader2 size={20} className="shrink-0 animate-spin text-brand-600" /> : <Upload size={20} className="shrink-0 text-brand-600" />}
            <span className="text-sm font-medium text-slate-700">{isUploading ? t.assignmentsPage.modal.uploading : t.assignmentsPage.modal.uploadSheets}</span>
          </button>
          {imgs.length ? <ul className="space-y-2">{imgs.map((url, index) => <li key={url} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5"><FileText size={17} className="text-slate-400" /><span className="min-w-0 flex-1 truncate text-sm text-slate-700">{url.split("/").pop()}</span><button type="button" aria-label={t.assignmentsPage.modal.remove} onClick={() => removeFile(index)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X size={16} /></button></li>)}</ul> : null}
        </div>
      </div>
      <footer className="shrink-0 border-t border-ink-200 bg-ink-50/70 px-6 py-4">
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isPending || isUploading} className="ss-button-secondary">{t.resourcesPage.form.cancel}</button>
          <button className="ss-button-primary" disabled={isPending || isUploading || optionsLoading || optionsError || !selectedLesson}>{isPending ? <><Loader2 size={16} className="animate-spin" />{t.assignmentsPage.modal.processing}</> : type === "create" ? t.assignmentsPage.modal.assignTask : t.assignmentsPage.modal.updateTitle}</button>
        </div>
      </footer>
    </form>
  );
};

export default AssignmentForm;
