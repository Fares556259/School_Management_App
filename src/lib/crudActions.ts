"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { UserSex } from "@prisma/client";

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
  img?: string;
}) => {
  try {
    const id = crypto.randomUUID();

    // 2. Create Prisma Record
    await prisma.teacher.create({
      data: {
        id: id,
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
        img: data.img || null,
      },
    });
    await createAuditLog({
      action: "CREATE_TEACHER",
      entityType: "Teacher",
      entityId: id,
      description: `Enrolled new teacher: ${data.name} ${data.surname} (${data.username})`,
    });
    revalidatePath("/list/teachers");
    return { success: true };
  } catch (err: any) {
    console.error("createTeacher error:", err);
    return { success: false, error: err?.message || "Failed to create teacher." };
  }
};

export const bulkCreateTeachers = async (teachers: any[]) => {
  try {
    await prisma.$transaction(async (tx) => {
      for (const t of teachers) {
        const id = crypto.randomUUID();
        await tx.teacher.create({
          data: {
            id,
            username: t.username,
            name: t.name,
            surname: t.surname,
            email: t.email || null,
            phone: t.phone || null,
            address: t.address || "Unknown",
            bloodType: t.bloodType || "O+",
            birthday: new Date(t.birthday || "1980-01-01"),
            sex: t.sex as UserSex || UserSex.MALE,
            salary: t.salary ?? 3000,
            img: t.img || null,
          },
        });

        await createAuditLog({
          action: "BULK_CREATE_TEACHER",
          entityType: "Teacher",
          entityId: id,
          description: `Bulk enrolled teacher: ${t.name} ${t.surname} (${t.username})`,
        });
      }
    });

    revalidatePath("/list/teachers");
    return { success: true };
  } catch (err: any) {
    console.error("bulkCreateTeachers error:", err);
    return { success: false, error: err?.message || "Failed to bulk create teachers." };
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
    await createAuditLog({
      action: "UPDATE_TEACHER",
      entityType: "Teacher",
      entityId: id,
      description: `Updated teacher profile: ${id}`,
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
    const teacher = await prisma.teacher.findUnique({ where: { id } });
    await prisma.teacher.delete({ where: { id } });
    await createAuditLog({
      action: "DELETE_TEACHER",
      entityType: "Teacher",
      entityId: id,
      description: `Removed teacher: ${teacher?.name} ${teacher?.surname} (${teacher?.username})`,
    });
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
  levelId: number;
}) => {
  try {
    const id = crypto.randomUUID();
    await prisma.student.create({
      data: {
        id,
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
        levelId: data.levelId,
      },
    });
    await createAuditLog({
      action: "CREATE_STUDENT",
      entityType: "Student",
      entityId: id,
      description: `Enrolled new student: ${data.name} ${data.surname} (${data.username})`,
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
    levelId: number;
  }>
) => {
  try {
    const updateData: any = { ...data };
    if (data.birthday) updateData.birthday = new Date(data.birthday);
    await prisma.student.update({ where: { id }, data: updateData });
    await createAuditLog({
      action: "UPDATE_STUDENT",
      entityType: "Student",
      entityId: id,
      description: `Updated student profile: ${id}`,
    });
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
        role: data.role,
        salary: data.salary ?? 1500,
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
    const staff = await prisma.staff.findUnique({ where: { id } });
    await prisma.staff.delete({ where: { id } });
    await createAuditLog({
      action: "DELETE_STAFF",
      entityType: "Staff",
      entityId: id,
      description: `Removed staff member: ${staff?.name} ${staff?.surname} (${staff?.username})`,
    });
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
  levelId: number;
  supervisorId?: string;
}) => {
  try {
    await prisma.class.create({
      data: {
        name: data.name,
        capacity: data.capacity,
        levelId: data.levelId,
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
    levelId: number;
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
  img?: string;
}) => {
  try {
    const expense = await prisma.expense.create({
      data: {
        title: data.title,
        amount: data.amount,
        category: data.category,
        date: new Date(data.date),
        img: data.img || null,
      },
    });
    await createAuditLog({
      action: "GENERAL_EXPENSE",
      entityType: "School",
      entityId: expense.id.toString(),
      description: `Logged expense: ${data.title} ($${data.amount}) under ${data.category}`,
      amount: data.amount,
      type: "expense",
      effectiveDate: new Date(data.date),
    });
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
    img: string;
  }>
) => {
  try {
    // Fetch old data for meaningful audit
    const oldExpense = await prisma.expense.findUnique({ where: { id } });
    
    const updateData: any = { ...data };
    if (data.date) updateData.date = new Date(data.date);
    await prisma.expense.update({ where: { id }, data: updateData });

    const changes = [];
    if (data.title && data.title !== oldExpense?.title) changes.push(`Title: "${oldExpense?.title}" → "${data.title}"`);
    if (data.amount !== undefined && data.amount !== oldExpense?.amount) changes.push(`Amount: $${oldExpense?.amount} → $${data.amount}`);
    if (data.category && data.category !== oldExpense?.category) changes.push(`Category: "${oldExpense?.category}" → "${data.category}"`);

    await createAuditLog({
      action: "EDIT_EXPENSE",
      entityType: "Expense",
      entityId: id.toString(),
      description: `Updated expense ${id}. ${changes.join(", ")}`,
      amount: data.amount ?? oldExpense?.amount,
      type: "expense",
      effectiveDate: updateData.date ?? oldExpense?.date,
    });
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
    const oldExpense = await prisma.expense.findUnique({ where: { id } });
    await prisma.expense.delete({ where: { id } });
    await createAuditLog({
      action: "DELETE_EXPENSE",
      entityType: "Expense",
      entityId: id.toString(),
      description: `Deleted expense: ${oldExpense?.title} ($${oldExpense?.amount})`,
      amount: oldExpense?.amount,
      type: "expense",
    });
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
  img?: string;
}) => {
  try {
    const income = await prisma.income.create({
      data: {
        title: data.title,
        amount: data.amount,
        category: data.category,
        date: new Date(data.date),
        img: data.img || null,
      },
    });
    await createAuditLog({
      action: "GENERAL_INCOME",
      entityType: "School",
      entityId: income.id.toString(),
      description: `Logged income: ${data.title} ($${data.amount}) under ${data.category}`,
      amount: data.amount,
      type: "income",
      effectiveDate: new Date(data.date),
    });
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
    img: string;
  }>
) => {
  try {
    // Fetch old data for meaningful audit
    const oldIncome = await prisma.income.findUnique({ where: { id } });

    const updateData: any = { ...data };
    if (data.date) updateData.date = new Date(data.date);
    await prisma.income.update({ where: { id }, data: updateData });

    const changes = [];
    if (data.title && data.title !== oldIncome?.title) changes.push(`Title: "${oldIncome?.title}" → "${data.title}"`);
    if (data.amount !== undefined && data.amount !== oldIncome?.amount) changes.push(`Amount: $${oldIncome?.amount} → $${data.amount}`);
    if (data.category && data.category !== oldIncome?.category) changes.push(`Category: "${oldIncome?.category}" → "${data.category}"`);

    await createAuditLog({
      action: "EDIT_INCOME",
      entityType: "Income",
      entityId: id.toString(),
      description: `Updated income ${id}. ${changes.join(", ")}`,
      amount: data.amount ?? oldIncome?.amount,
      type: "income",
      effectiveDate: updateData.date ?? oldIncome?.date,
    });
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
    const oldIncome = await prisma.income.findUnique({ where: { id } });
    await prisma.income.delete({ where: { id } });
    await createAuditLog({
      action: "DELETE_INCOME",
      entityType: "Income",
      entityId: id.toString(),
      description: `Deleted income: ${oldIncome?.title} ($${oldIncome?.amount})`,
      amount: oldIncome?.amount,
      type: "income",
    });
    revalidatePath("/list/incomes");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete income." };
  }
};
