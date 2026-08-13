"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTransition, useState, useEffect } from "react";
import InputField from "../InputField";
import { createAssignment, updateAssignment } from "@/lib/crudActions";
import { useLanguage } from "@/lib/translations/LanguageContext";

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
  lessonId: z.coerce.number().min(1, { message: "Lesson is required!" }),
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
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(data?.classId ? data.classId.toString() : "");
  const [isPending, startTransition] = useTransition();
  const [lessons, setLessons] = useState<any[]>([]);
  const [imgs, setImgs] = useState<string[]>(data?.img ? data.img.split(",") : []);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const { t, locale } = useLanguage();

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

  useEffect(() => {
    if (watchedLessonId && lessons.length > 0) {
      const lesson = lessons.find(l => l.id.toString() === watchedLessonId.toString());
      setSelectedLesson(lesson);
    } else if (data?.lessonId && lessons.length > 0) {
      // Fallback to data.lessonId if watch hasn't picked it up yet
      const lesson = lessons.find(l => l.id.toString() === data.lessonId.toString());
      setSelectedLesson(lesson);
    } else {
      setSelectedLesson(null);
    }
  }, [watchedLessonId, lessons, data?.lessonId]);

  useEffect(() => {
    // Fetch classes
    fetch("/api/attendance/classes")
      .then(res => res.json())
      .then(data => setClasses(data))
      .catch(err => console.error("Error fetching classes:", err));
  }, []);

  // Update lessons when class changes
  useEffect(() => {
    const url = selectedClassId 
      ? `/api/lessons?classId=${selectedClassId}&skipSync=true`
      : "/api/lessons?skipSync=true";
      
    fetch(url)
      .then(res => res.json())
      .then(data => setLessons(Array.isArray(data) ? data : []))
      .catch(err => console.error("Error filtering lessons:", err));
  }, [selectedClassId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
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
      alert(err.message || "Failed to upload files.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setImgs(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = handleSubmit((formData) => {
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
        alert(res.error || "Failed to save assignment.");
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
              className="border border-[#dddddd] p-2.5 rounded-[6px] text-[13px] w-full focus:border-[#1b61c9] outline-none transition-all bg-white appearance-none text-[#181d26] cursor-pointer pr-10"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
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
              className="border border-[#dddddd] p-2.5 rounded-[6px] text-[13px] w-full focus:border-[#1b61c9] outline-none transition-all bg-white appearance-none text-[#181d26] cursor-pointer pr-10"
            >
              <option value="">{t.assignmentsPage.modal.selectLessonPlaceholder}</option>
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
        disabled={isPending || isUploading}
      >
        {isPending ? t.assignmentsPage.modal.processing : type === "create" ? t.assignmentsPage.modal.createTitle : t.assignmentsPage.modal.updateTitle}
      </button>
    </form>
  );
};

export default AssignmentForm;
