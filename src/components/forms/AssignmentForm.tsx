"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTransition, useState, useEffect } from "react";
import InputField from "../InputField";
import { createAssignment, updateAssignment } from "@/lib/crudActions";

const schema = z.object({
  title: z.string().min(1, { message: "Assignment title is required!" }),
  startDate: z.string().min(1, { message: "Start date is required!" }),
  dueDate: z.string().min(1, { message: "Due date is required!" }),
  lessonId: z.coerce.number().min(1, { message: "Lesson is required!" }),
});

type Inputs = z.infer<typeof schema>;

const AssignmentForm = ({
  type,
  data,
}: {
  type: "create" | "update";
  data?: any;
}) => {
  const [isPending, startTransition] = useTransition();
  const [lessons, setLessons] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: data?.title || "",
      startDate: data?.startDate ? new Date(data.startDate).toISOString().split('T')[0] : "",
      dueDate: data?.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : "",
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

  const onSubmit = handleSubmit((formData) => {
    startTransition(async () => {
      const res =
        type === "create"
          ? await createAssignment(formData)
          : await updateAssignment(data.id, formData);

      if (res.success) {
        window.location.reload();
      } else {
        alert(res.error || "Failed to save assignment.");
      }
    });
  });

  return (
    <form className="flex flex-col gap-6 p-4" onSubmit={onSubmit}>
      <h1 className="text-xl font-bold text-slate-800">
        {type === "create" ? "📝 Create New Task" : "✏️ Update Task"}
      </h1>

      <div className="flex flex-col gap-4">
        <InputField
          label="Task Title"
          name="title"
          register={register}
          error={errors.title}
          placeholder="e.g. Mathematics Chapter 5 Exercises"
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

        <div className="flex gap-4 flex-wrap">
          <InputField
            label="Start Date"
            name="startDate"
            type="date"
            register={register}
            error={errors.startDate}
            className="w-full md:w-[48%]"
          />
          <InputField
            label="Due Date"
            name="dueDate"
            type="date"
            register={register}
            error={errors.dueDate}
            className="w-full md:w-[48%]"
          />
        </div>
      </div>

      <button
        className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all mt-4 disabled:opacity-50"
        disabled={isPending}
      >
        {isPending ? "🚀 Processing..." : type === "create" ? "Assign Task" : "Update Task"}
      </button>
    </form>
  );
};

export default AssignmentForm;
