"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTransition, useState, useEffect } from "react";
import InputField from "../InputField";
import { createResource } from "@/lib/crudActions";

const schema = z.object({
  title: z.string().min(1, { message: "Resource title is required!" }),
  description: z.string().optional(),
  lessonId: z.coerce.number().min(1, { message: "Lesson is required!" }),
});

type Inputs = z.infer<typeof schema>;

const ResourceForm = ({
  type,
  data,
}: {
  type: "create" | "update";
  data?: any;
}) => {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(data?.classId ? data.classId.toString() : "");
  const [isPending, startTransition] = useTransition();
  const [lessons, setLessons] = useState<any[]>([]);
  const [fileUrls, setFileUrls] = useState<string[]>(data?.url ? data.url.split(",") : []);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);

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
      lessonId: data?.lessonId || "",
    },
  });

  const watchedLessonId = watch("lessonId");

  useEffect(() => {
    if (watchedLessonId && lessons.length > 0) {
      const lesson = lessons.find(l => l.id.toString() === watchedLessonId.toString());
      setSelectedLesson(lesson);
    } else if (data?.lessonId && lessons.length > 0) {
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
      ? `/api/lessons?classId=${selectedClassId}`
      : "/api/lessons";
      
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
        const fileName = `resource-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const filePath = `resources/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('uploads')
          .getPublicUrl(filePath);

        newUrls.push(publicUrl);
      }

      setFileUrls(prev => [...prev, ...newUrls]);
    } catch (err: any) {
      console.error("Resource upload failed:", err);
      alert(err.message || "Failed to upload files.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFileUrls(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = handleSubmit((formData) => {
    if (fileUrls.length === 0) {
      alert("Please upload at least one file!");
      return;
    }

    startTransition(async () => {
      const urlString = fileUrls.join(",");
      const res = await createResource({
        ...formData,
        url: urlString,
      });

      if (res.success) {
        window.location.reload();
      } else {
        alert(res.error || "Failed to save resource.");
      }
    });
  });

  return (
    <form className="flex flex-col gap-6 p-6 max-h-[90vh] overflow-y-auto" onSubmit={onSubmit}>
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
          📚 Upload Course Resources
        </h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Share documents and materials with your students</p>
      </div>

      <div className="flex flex-col gap-4">
        <InputField
          label="Resource Title"
          name="title"
          register={register}
          error={errors.title}
          placeholder="e.g. Chapter 1 - Introduction PDF"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Material Description</label>
          <textarea
            {...register("description")}
            className="ring-[1.5px] ring-slate-200 p-4 rounded-2xl text-sm w-full focus:ring-2 focus:ring-indigo-400 outline-none bg-slate-50 transition-all min-h-[100px] font-medium text-slate-700"
            placeholder="Briefly describe this material..."
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Select Class</label>
          <div className="relative">
            <select
              className="ring-[1.5px] ring-slate-200 p-4 rounded-2xl text-sm w-full focus:ring-2 focus:ring-indigo-400 outline-none bg-slate-50 transition-all appearance-none font-bold text-slate-700 cursor-pointer pr-10"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Select Lesson</label>
          <div className="relative">
            <select
              {...register("lessonId")}
              className="ring-[1.5px] ring-slate-200 p-4 rounded-2xl text-sm w-full focus:ring-2 focus:ring-indigo-400 outline-none bg-slate-50 transition-all appearance-none font-bold text-slate-700 cursor-pointer pr-10"
            >
              <option value="">Select a lesson...</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.subject.name} - {lesson.name} ({lesson.teacher.name} {lesson.teacher.surname})
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
          {errors.lessonId?.message && (
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-tight mt-1">{errors.lessonId.message.toString()}</p>
          )}
        </div>

        {selectedLesson && (
          <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 font-bold border border-indigo-200">
               {selectedLesson.teacher.name.charAt(0)}{selectedLesson.teacher.surname.charAt(0)}
            </div>
            <div>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Assigned Teacher</p>
              <p className="text-sm font-bold text-indigo-900">{selectedLesson.teacher.name} {selectedLesson.teacher.surname}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-800 font-bold uppercase tracking-wider">File Attachments</label>
          <input
            type="file"
            id="resource-file"
            className="hidden"
            onChange={handleFileUpload}
            multiple
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => document.getElementById('resource-file')?.click()}
            className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              {isUploading ? (
                  <span className="text-lg animate-spin">⏳</span>
              ) : (
                <span className="text-2xl">📁</span>
              )}
            </div>
            <span className="text-xs font-bold text-slate-500">
              {isUploading ? "Uploading..." : "Upload Documents (Multiple allowed)"}
            </span>
          </button>

          {fileUrls.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {fileUrls.map((url, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-sm">📄</span>
                    <span className="text-xs text-slate-600 truncate max-w-[200px]">{url.split('/').pop()}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:bg-red-50 p-1 rounded-md transition-colors"
                  >
                    <span className="text-xs font-bold">Remove</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all mt-4 disabled:opacity-50"
        disabled={isPending || isUploading}
      >
        {isPending ? "🚀 Processing..." : "Publish Resource"}
      </button>
    </form>
  );
};

export default ResourceForm;
