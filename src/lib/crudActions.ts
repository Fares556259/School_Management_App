"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";

// ===================== TEACHER =====================
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
        salary: data.salary ?? 3000,
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

// ===================== STUDENT =====================
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
    parentId: string;
    classId: number;
    gradeId: number;
  }>
) => {
  try {
    const updateData: any = { ...data };
    if (data.birthday) updateData.birthday = new Date(data.birthday);
    await prisma.student.update({ where: { id }, data: updateData });
    revalidatePath("/list/students");
    revalidatePath(`/list/students/${id}`);
    return { success: true };
  } catch (err: any) {
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

// ===================== STAFF =====================
export const createStaff = async (data: {
  username: string;
  name: string;
  surname: string;
  email?: string;
  phone?: string;
  address: string;
  bloodType: string;
  birthday: string;
  sex: "MALE" | "FEMALE";
  role: string;
  salary?: number;
}) => {
  try {
    await prisma.staff.create({
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
        role: data.role,
        salary: data.salary ?? 1500,
        isPaid: false,
      },
    });
    revalidatePath("/list/staff");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create staff." };
  }
};

export const updateStaff = async (
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
    role: string;
    salary: number;
  }>
) => {
  try {
    const updateData: any = { ...data };
    if (data.birthday) updateData.birthday = new Date(data.birthday);
    await prisma.staff.update({ where: { id }, data: updateData });
    revalidatePath("/list/staff");
    revalidatePath(`/list/staff/${id}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update staff." };
  }
};

export const deleteStaff = async (id: string) => {
  try {
    await prisma.staff.delete({ where: { id } });
    revalidatePath("/list/staff");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete staff." };
  }
};

// ===================== PARENT =====================
export const createParent = async (data: {
  username: string;
  name: string;
  surname: string;
  email?: string;
  phone: string;
  address: string;
}) => {
  try {
    await prisma.parent.create({
      data: {
        id: crypto.randomUUID(),
        username: data.username,
        name: data.name,
        surname: data.surname,
        email: data.email || null,
        phone: data.phone,
        address: data.address,
      },
    });
    revalidatePath("/list/parents");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create parent." };
  }
};

export const updateParent = async (
  id: string,
  data: Partial<{
    username: string;
    name: string;
    surname: string;
    email: string;
    phone: string;
    address: string;
  }>
) => {
  try {
    await prisma.parent.update({ where: { id }, data });
    revalidatePath("/list/parents");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update parent." };
  }
};

export const deleteParent = async (id: string) => {
  try {
    await prisma.parent.delete({ where: { id } });
    revalidatePath("/list/parents");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete parent." };
  }
};

// ===================== CLASS =====================
export const createClass = async (data: {
  name: string;
  capacity: number;
  gradeId: number;
  supervisorId?: string;
}) => {
  try {
    await prisma.class.create({
      data: {
        name: data.name,
        capacity: data.capacity,
        gradeId: data.gradeId,
        supervisorId: data.supervisorId || null,
      },
    });
    revalidatePath("/list/classes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create class." };
  }
};

export const updateClass = async (
  id: number,
  data: Partial<{
    name: string;
    capacity: number;
    gradeId: number;
    supervisorId: string;
  }>
) => {
  try {
    await prisma.class.update({ where: { id }, data });
    revalidatePath("/list/classes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update class." };
  }
};

export const deleteClass = async (id: number) => {
  try {
    await prisma.class.delete({ where: { id } });
    revalidatePath("/list/classes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete class." };
  }
};

// ===================== SUBJECT =====================
export const createSubject = async (data: { name: string }) => {
  try {
    await prisma.subject.create({ data: { name: data.name } });
    revalidatePath("/list/subjects");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create subject." };
  }
};

export const updateSubject = async (
  id: number,
  data: Partial<{ name: string }>
) => {
  try {
    await prisma.subject.update({ where: { id }, data });
    revalidatePath("/list/subjects");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update subject." };
  }
};

export const deleteSubject = async (id: number) => {
  try {
    await prisma.subject.delete({ where: { id } });
    revalidatePath("/list/subjects");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete subject." };
  }
};

// ===================== EXPENSE =====================
export const createExpense = async (data: {
  title: string;
  amount: number;
  category: string;
  date: string;
}) => {
  try {
    const expense = await prisma.expense.create({
      data: {
        title: data.title,
        amount: data.amount,
        category: data.category,
        date: new Date(data.date),
      },
    });
    await createAuditLog(
      "GENERAL_EXPENSE",
      "School",
      expense.id.toString(),
      `Logged expense: ${data.title} ($${data.amount}) under ${data.category}`
    );
    revalidatePath("/list/expenses");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create expense." };
  }
};

export const updateExpense = async (
  id: number,
  data: Partial<{
    title: string;
    amount: number;
    category: string;
    date: string;
  }>
) => {
  try {
    const updateData: any = { ...data };
    if (data.date) updateData.date = new Date(data.date);
    await prisma.expense.update({ where: { id }, data: updateData });
    await createAuditLog(
      "EDIT_EXPENSE",
      "Expense",
      id.toString(),
      `Updated expense ${id}`
    );
    revalidatePath("/list/expenses");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update expense." };
  }
};

export const deleteExpense = async (id: number) => {
  try {
    await prisma.expense.delete({ where: { id } });
    await createAuditLog(
      "DELETE_EXPENSE",
      "Expense",
      id.toString(),
      `Deleted expense ${id}`
    );
    revalidatePath("/list/expenses");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete expense." };
  }
};

// ===================== INCOME =====================
export const createIncome = async (data: {
  title: string;
  amount: number;
  category: string;
  date: string;
}) => {
  try {
    const income = await prisma.income.create({
      data: {
        title: data.title,
        amount: data.amount,
        category: data.category,
        date: new Date(data.date),
      },
    });
    await createAuditLog(
      "GENERAL_INCOME",
      "School",
      income.id.toString(),
      `Logged income: ${data.title} ($${data.amount}) under ${data.category}`
    );
    revalidatePath("/list/incomes");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create income." };
  }
};

export const updateIncome = async (
  id: number,
  data: Partial<{
    title: string;
    amount: number;
    category: string;
    date: string;
  }>
) => {
  try {
    const updateData: any = { ...data };
    if (data.date) updateData.date = new Date(data.date);
    await prisma.income.update({ where: { id }, data: updateData });
    await createAuditLog(
      "EDIT_INCOME",
      "Income",
      id.toString(),
      `Updated income ${id}`
    );
    revalidatePath("/list/incomes");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update income." };
  }
};

export const deleteIncome = async (id: number) => {
  try {
    await prisma.income.delete({ where: { id } });
    await createAuditLog(
      "DELETE_INCOME",
      "Income",
      id.toString(),
      `Deleted income ${id}`
    );
    revalidatePath("/list/incomes");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete income." };
  }
};
