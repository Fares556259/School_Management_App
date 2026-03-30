"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ---- TEACHER ----
export const createTeacher = async (data: {
  username: string;
  name: string;
  surname: string;
  email?: string;
  phone?: string;
  address: string;
  bloodType: string;
  birthday: string;
  sex: "MALE" | "FEMALE";
  salary?: number;
}) => {
  try {
    await prisma.teacher.create({
      data: {
        id: crypto.randomUUID(),
        username: data.username,
        name: data.name,
        surname: data.surname,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address,
        bloodType: data.bloodType,
        birthday: new Date(data.birthday),
        sex: data.sex,
        salary: data.salary ?? 1000,
        isPaid: false,
      },
    });
    revalidatePath("/list/teachers");
    return { success: true };
  } catch (err: any) {
    console.error("createTeacher error:", err);
    return { success: false, error: err?.message || "Failed to create teacher." };
  }
};

export const updateTeacher = async (
  id: string,
  data: Partial<{
    username: string;
    name: string;
    surname: string;
    email: string;
    phone: string;
    address: string;
    bloodType: string;
    birthday: string;
    sex: "MALE" | "FEMALE";
    salary: number;
  }>
) => {
  try {
    await prisma.teacher.update({
      where: { id },
      data: {
        ...data,
        birthday: data.birthday ? new Date(data.birthday) : undefined,
      },
    });
    revalidatePath("/list/teachers");
    revalidatePath(`/list/teachers/${id}`);
    return { success: true };
  } catch (err: any) {
    console.error("updateTeacher error:", err);
    return { success: false, error: err?.message || "Failed to update teacher." };
  }
};

export const deleteTeacher = async (id: string) => {
  try {
    await prisma.teacher.delete({ where: { id } });
    revalidatePath("/list/teachers");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete teacher." };
  }
};

// ---- STUDENT ----
export const createStudent = async (data: {
  username: string;
  name: string;
  surname: string;
  email?: string;
  phone?: string;
  address: string;
  bloodType: string;
  birthday: string;
  sex: "MALE" | "FEMALE";
  parentId: string;
  classId: number;
  gradeId: number;
}) => {
  try {
    await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        username: data.username,
        name: data.name,
        surname: data.surname,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address,
        bloodType: data.bloodType,
        birthday: new Date(data.birthday),
        sex: data.sex,
        parentId: data.parentId,
        classId: data.classId,
        gradeId: data.gradeId,
        isPaid: false,
      },
    });
    revalidatePath("/list/students");
    return { success: true };
  } catch (err: any) {
    console.error("createStudent error:", err);
    return { success: false, error: err?.message || "Failed to create student." };
  }
};

export const updateStudent = async (
  id: string,
  data: Partial<{
    username: string;
    name: string;
    surname: string;
    email: string;
    phone: string;
    address: string;
    bloodType: string;
    birthday: string;
    sex: "MALE" | "FEMALE";
  }>
) => {
  try {
    await prisma.student.update({
      where: { id },
      data: {
        ...data,
        birthday: data.birthday ? new Date(data.birthday) : undefined,
      },
    });
    revalidatePath("/list/students");
    revalidatePath(`/list/students/${id}`);
    return { success: true };
  } catch (err: any) {
    console.error("updateStudent error:", err);
    return { success: false, error: err?.message || "Failed to update student." };
  }
};

export const deleteStudent = async (id: string) => {
  try {
    await prisma.student.delete({ where: { id } });
    revalidatePath("/list/students");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete student." };
  }
};
