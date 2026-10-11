"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTransition, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import InputField from "../InputField";
import { createAssignment, updateAssignment } from "@/lib/crudActions";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { compressImageFiles } from "@/lib/imageCompression";
import { toast } from "react-toastify";
import { fetchAttendanceJson } from "@/lib/attendanceRoster";

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
}: {
  type: "create" | "update";
  data?: any;
  relatedData?: any;
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(String(data?.classId || data?.lesson?.classId || ""));
  const [isPending, startTransition] = useTransition();
  const [imgs, setImgs] = useState<string[]>(data?.img ? data.img.split(",") : []);
  const [isUploading, setIsUploading] = useState(false);
  const { t, locale } = useLanguage();
  const classesQuery = useQuery<any[]>({
    queryKey: ["attendanceClasses"],
    queryFn: ({ signal }) => fetchAttendanceJson("/api/attendance/classes", signal),
    staleTime: 60_000, retry: 1,
  });
  const lessonsQuery = useQuery<any[]>({
    queryKey: ["assignmentLessonOptions", selectedClassId],
    queryFn: ({ signal }) => fetchAttendanceJson(`/api/assignment-lessons${selectedClassId ? `?classId=${selectedClassId}` : ""}`, signal),
    staleTime: 30_000, retry: 1,
    refetchOnWindowFocus: false,
  });
  const classes = classesQuery.data || [];
  const lessons = lessonsQuery.data || [];
  const optionsLoading = classesQuery.isPending || lessonsQuery.isPending;
  const optionsError = classesQuery.isError || lessonsQuery.isError;

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
      dueDate: data?.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : "",
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
        window.location.reload();
      } else {
        toast.error(res.error || t.toasts.operationFailed);
      }
    });
  });

  return (
    <form className="flex flex-col gap-6 p-6 max-h-[90vh] overflow-y-auto" onSubmit={onSubmit}>
      <div>
        <h1 className="text-[20px] font-medium text-[#181d26] tracking-tight">
          {type === "create" ? t.assignmentsPage.modal.createTitle : t.assignmentsPage.modal.updateTitle}
        </h1>
        <p className="text-[13px] text-[#41454d] mt-1">{t.assignmentsPage.modal.subtitle}</p>
      </div>

      <div className="flex flex-col gap-4">
        <InputField
          label={t.assignmentsPage.modal.taskTitle}
          name="title"
          register={register}
          error={errors.title}
          placeholder={t.assignmentsPage.modal.taskTitlePlaceholder}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-[#181d26]">{t.assignmentsPage.modal.taskDesc}</label>
          <textarea
            {...register("description")}
            className="border border-[#dddddd] p-2.5 rounded-[6px] text-[13px] w-full focus:border-[#1b61c9] outline-none transition-all bg-white min-h-[100px] text-[#181d26]"
            placeholder={t.assignmentsPage.modal.taskDescPlaceholder}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-[#181d26]">{t.assignmentsPage.modal.selectClass}</label>
          <div className="relative">
            <select
              aria-label={t.assignmentsPage.modal.selectClass}
              className="border border-[#dddddd] p-2.5 rounded-[6px] text-[13px] w-full focus:border-[#1b61c9] outline-none transition-all bg-white appearance-none text-[#181d26] cursor-pointer pr-10"
              value={selectedClassId}
              disabled={classesQuery.isPending || isPending}
              onChange={(e) => { setSelectedClassId(e.target.value); setValue("lessonId", "", { shouldDirty: true }); }}
            >
              <option value="">{t.assignmentsPage.modal.allClasses}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9297a0]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-[#181d26]">{t.assignmentsPage.modal.selectLesson}</label>
          <div className="relative">
            <select
              {...register("lessonId")}
              aria-label={t.assignmentsPage.modal.selectLesson}
              value={watchedLessonId || ""}
              disabled={optionsLoading || optionsError || isPending}
              className="border border-[#dddddd] p-2.5 rounded-[6px] text-[13px] w-full focus:border-[#1b61c9] outline-none transition-all bg-white appearance-none text-[#181d26] cursor-pointer pr-10"
            >
              <option value="">{optionsLoading ? t.assignmentsPage.modal.loadingLessons : t.assignmentsPage.modal.selectLessonPlaceholder}</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {getTranslatedSubject(lesson.subject?.name, locale)} ({lesson.class?.name}) - {lesson.teacher?.name} {lesson.teacher?.surname}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9297a0]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
          {optionsError ? (
            <div role="alert" className="text-sm text-rose-700">
              {t.assignmentsPage.modal.optionsLoadError}
              <button type="button" className="ml-2 underline" onClick={() => {
                if (classesQuery.isError) void classesQuery.refetch();
                if (lessonsQuery.isError) void lessonsQuery.refetch();
              }}>{t.assignmentsPage.modal.retryOptions}</button>
            </div>
          ) : optionsLoading ? <p role="status" className="text-xs text-slate-500">{t.assignmentsPage.modal.loadingLessons}</p>
            : lessons.length === 0 ? <p className="text-xs text-slate-500">{t.assignmentsPage.modal.noLessons}</p> : null}
          {errors.lessonId?.message && (
            <p className="text-[10px] text-rose-500 mt-1">{errors.lessonId.message.toString()}</p>
          )}
        </div>

        {selectedLesson && (
          <div className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-[6px] border border-[#dddddd] animate-in fade-in slide-in-from-top-2">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#181d26] border border-[#dddddd] text-[12px] font-medium">
               {selectedLesson.teacher?.name?.charAt(0)}{selectedLesson.teacher?.surname?.charAt(0)}
            </div>
            <div>
              <p className="text-[11px] text-[#41454d]">{t.assignmentsPage.modal.assignedTeacher}</p>
              <p className="text-[13px] font-medium text-[#181d26]">{selectedLesson.teacher?.name} {selectedLesson.teacher?.surname}</p>
            </div>
          </div>
        )}

        <InputField
          label={t.assignmentsPage.modal.dueDate || "Due Date"}
          name="dueDate"
          type="datetime-local"
          register={register}
          error={errors.dueDate}
          defaultValue={data?.dueDate ? new Date(data.dueDate).toISOString().slice(0, 16) : ""}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-[#181d26]">{t.assignmentsPage.modal.attachments}</label>
          <input
            type="file"
            id="assignment-file"
            className="hidden"
            onChange={handleFileUpload}
            accept="image/*,.pdf"
            multiple
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => document.getElementById('assignment-file')?.click()}
            className="flex flex-col items-center justify-center gap-2 py-6 px-4 border border-dashed border-[#dddddd] bg-[#f8fafc] rounded-[6px] hover:bg-[#ffffff] hover:border-[#a0a5b0] transition-all group disabled:opacity-50"
          >
            <div className="w-8 h-8 bg-white border border-[#dddddd] rounded-full flex items-center justify-center transition-colors">
              {isUploading ? (
                  <span className="text-[14px] animate-spin">⏳</span>
              ) : (
                <span className="text-[14px]">📁</span>
              )}
            </div>
            <span className="text-[12px] text-[#41454d]">
              {isUploading ? t.assignmentsPage.modal.uploading : t.assignmentsPage.modal.uploadSheets}
            </span>
          </button>

          {imgs.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {imgs.map((url, index) => (
                <div key={index} className="flex items-center justify-between p-2.5 bg-[#f8fafc] rounded-[6px] border border-[#dddddd]">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-[14px]">📄</span>
                    <span className="text-[12px] text-[#41454d] truncate max-w-[200px]">{url.split('/').pop()}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-rose-500 hover:bg-rose-50 p-1 rounded-md transition-colors"
                  >
                    <span className="text-[12px] font-medium">{t.assignmentsPage.modal.remove}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        className="bg-[#181d26] hover:bg-[#0d1218] text-white py-2.5 px-4 rounded-[6px] text-[13px] font-medium transition-all mt-4 disabled:opacity-50"
        disabled={isPending || isUploading || optionsLoading || optionsError || !selectedLesson}
      >
        {isPending ? t.assignmentsPage.modal.processing : type === "create" ? t.assignmentsPage.modal.createTitle : t.assignmentsPage.modal.updateTitle}
      </button>
    </form>
  );
};

export default AssignmentForm;
