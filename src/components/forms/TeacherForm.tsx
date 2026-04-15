"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTransition } from "react";
import InputField from "../InputField";
import Image from "next/image";
import { createTeacher, updateTeacher } from "@/lib/crudActions";
import { useState } from "react";

const schema = z.object({
  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters long!" })
    .max(20, { message: "Username must be at most 20 characters long!" }),
  email: z.string().email({ message: "Invalid email address!" }).optional().or(z.literal("")),
  firstName: z.string().min(1, { message: "First name is required!" }),
  lastName: z.string().min(1, { message: "Last name is required!" }),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().min(1, { message: "Address is required!" }),
  bloodType: z.string().min(1, { message: "Blood Type is required!" }),
  birthday: z.string().min(1, { message: "Birthday is required!" }),
  sex: z.enum(["MALE", "FEMALE"], { message: "Sex is required!" }),
  salary: z.coerce.number().optional(),
});

type Inputs = z.infer<typeof schema>;

const TeacherForm = ({
  type,
  data,
}: {
  type: "create" | "update";
  data?: any;
}) => {
  const [isPending, startTransition] = useTransition();
  const [img, setImg] = useState<string | null>(data?.img || null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: data?.username || "",
      email: data?.email || "",
      firstName: data?.name || "",
      lastName: data?.surname || "",
      phone: data?.phone || "",
      address: data?.address || "",
      bloodType: data?.bloodType || "",
      birthday: data?.birthday ? new Date(data.birthday).toISOString().split("T")[0] : "",
      sex: data?.sex || "MALE",
      salary: data?.salary || 1000,
    },
  });

  const onSubmit = handleSubmit((formData) => {
    startTransition(async () => {
      const payload = {
        username: formData.username,
        name: formData.firstName,
        surname: formData.lastName,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address,
        bloodType: formData.bloodType,
        birthday: formData.birthday,
        sex: formData.sex as "MALE" | "FEMALE",
        salary: formData.salary,
        img: img || undefined,
      };
      const res = type === "create"
        ? await createTeacher(payload)
        : await updateTeacher(data?.id, payload);
      if (!res.success) alert(res.error);
    });
  });

  return (
    <form className="flex flex-col gap-8" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">
        {type === "create" ? "Create a new teacher" : "Update teacher"}
      </h1>
      <span className="text-xs text-gray-400 font-medium">Personal Information</span>
      <div className="flex justify-between flex-wrap gap-4">
        <InputField
          label="Username"
          name="username"
          defaultValue={data?.username}
          register={register}
          error={errors?.username}
        />
        <InputField
          label="Email"
          name="email"
          defaultValue={data?.email}
          register={register}
          error={errors?.email}
        />
        <InputField
          label="First Name"
          name="firstName"
          defaultValue={data?.name}
          register={register}
          error={errors.firstName}
        />
        <InputField
          label="Last Name"
          name="lastName"
          defaultValue={data?.surname}
          register={register}
          error={errors.lastName}
        />
        <InputField
          label="Phone"
          name="phone"
          defaultValue={data?.phone}
          register={register}
          error={errors.phone}
        />
        <InputField
          label="Address"
          name="address"
          defaultValue={data?.address}
          register={register}
          error={errors.address}
        />
        <InputField
          label="Blood Type"
          name="bloodType"
          defaultValue={data?.bloodType}
          register={register}
          error={errors.bloodType}
        />
        <InputField
          label="Birthday"
          name="birthday"
          defaultValue={data?.birthday ? new Date(data.birthday).toISOString().split("T")[0] : ""}
          register={register}
          error={errors.birthday}
          type="date"
        />
        <InputField
          label="Monthly Salary ($)"
          name="salary"
          defaultValue={data?.salary}
          register={register}
          error={errors.salary}
          type="number"
        />
        <div className="flex flex-col gap-2 w-full md:w-1/4">
          <label className="text-xs text-gray-500">Sex</label>
          <select
            className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
            {...register("sex")}
            defaultValue={data?.sex || "MALE"}
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
          {errors.sex?.message && (
            <p className="text-xs text-red-400">{errors.sex.message.toString()}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full md:w-1/4 justify-center">
          <label className="text-xs text-gray-500 mb-1">Profile Photo</label>
          <input
            type="file"
            id="teacher-photo"
            className="hidden"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              
              try {
                const supabase = (await import('@/utils/supabase/client')).createClient();
                const fileName = `teacher-${Date.now()}`;
                const filePath = `teachers/${fileName}`;

                const { data, error: uploadError } = await supabase.storage
                  .from('uploads')
                  .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                  .from('uploads')
                  .getPublicUrl(filePath);

                setImg(publicUrl);
              } catch (err: any) {
                console.error("Teacher upload failed:", err);
                alert(err.message || "Failed to upload teacher photo.");
              }
            }}
          />
          <button
            type="button"
            onClick={() => document.getElementById('teacher-photo')?.click()}
            className="flex items-center gap-2 p-2 border border-dashed border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
              {img ? (
                <Image src={img} alt="Preview" width={40} height={40} className="object-cover" />
              ) : (
                <Image src="/upload.png" alt="" width={20} height={20} />
              )}
            </div>
            <span className="text-xs text-gray-500">{img ? "Change Photo" : "Upload Photo"}</span>
          </button>
        </div>
      </div>
      <button
        className="bg-blue-400 text-white p-2 rounded-md disabled:opacity-50"
        disabled={isPending}
      >
        {isPending ? "Saving..." : type === "create" ? "Create" : "Update"}
      </button>
    </form>
  );
};

export default TeacherForm;
