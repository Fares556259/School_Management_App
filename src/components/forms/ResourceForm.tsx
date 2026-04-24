"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTransition, useState, useEffect } from "react";
import InputField from "../InputField";
import { createResource } from "@/lib/crudActions";

const schema = z.object({
  title: z.string().min(1, { message: "Resource title is required!" }),
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
  const [isPending, startTransition] = useTransition();
  const [lessons, setLessons] = useState<any[]>([]);
  const [fileUrl, setFileUrl] = useState<string | null>(data?.url || null);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: data?.title || "",
      lessonId: data?.lessonId || "",
    },
  });

  useEffect(() => {
    fetch("/api/lessons")
      .then((res) => res.json())
      .then((data) => {
        setLessons(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Error fetching lessons:", err);
        setLessons([]);
      });
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const supabase = (await import('@/utils/supabase/client')).createClient();
      const fileName = `resource-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const filePath = `resources/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      setFileUrl(publicUrl);
    } catch (err: any) {
      console.error("Resource upload failed:", err);
      alert(err.message || "Failed to upload file.");
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = handleSubmit((formData) => {
    if (!fileUrl) {
      alert("Please upload a file first!");
      return;
    }

    startTransition(async () => {
      const res = await createResource({
        ...formData,
        url: fileUrl,
      });

      if (res.success) {
        window.location.reload();
      } else {
        alert(res.error || "Failed to save resource.");
      }
    });
  });

  return (
    <form className="flex flex-col gap-6 p-4" onSubmit={onSubmit}>
      <h1 className="text-xl font-bold text-slate-800">
        📚 Upload Course Resource
      </h1>

      <div className="flex flex-col gap-4">
        <InputField
          label="Resource Title"
          name="title"
          register={register}
          error={errors.title}
          placeholder="e.g. Chapter 1 - Introduction PDF"
        />

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-500 font-bold">Select Lesson</label>
          <select
            {...register("lessonId")}
            className="ring-[1.5px] ring-gray-300 p-3 rounded-xl text-sm w-full focus:ring-indigo-500 outline-none bg-white transition-all appearance-none"
          >
            <option value="">Select a lesson...</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.subject.name} - Class {lesson.class.name} ({lesson.name})
              </option>
            ))}
          </select>
          {errors.lessonId?.message && (
            <p className="text-xs text-red-500">{errors.lessonId.message.toString()}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-800 font-bold">File Attachment</label>
          <input
            type="file"
            id="resource-file"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => document.getElementById('resource-file')?.click()}
            className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group disabled:opacity-50"
          >
            {fileUrl ? (
              <div className="flex items-center gap-2 bg-emerald-100 p-3 rounded-lg text-emerald-700 font-bold text-xs">
                <span>📄 File Successfully Attached</span>
              </div>
            ) : (
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                {isUploading ? (
                   <span className="text-lg animate-spin">⏳</span>
                ) : (
                  <span className="text-2xl">📁</span>
                )}
              </div>
            )}
            <span className="text-xs font-bold text-slate-500">
              {isUploading ? "Uploading..." : fileUrl ? "Change File" : "Upload Document (PDF, PPT, DOC)"}
            </span>
          </button>
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
