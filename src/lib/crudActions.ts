"use server";

import { getSchoolId } from "@/lib/school";


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
    const schoolId = await getSchoolId();
    const id = crypto.randomUUID();

    // 2. Create Prisma Record
    await prisma.teacher.create({
      data: {
        schoolId,
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
    const schoolId = await getSchoolId();
    await prisma.$transaction(async (tx) => {
      for (const t of teachers) {
        const id = crypto.randomUUID();
        await tx.teacher.create({
          data: {
            schoolId,
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
    img: string | null;
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
    console.error("updateTeacher error:", err);
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
  bloodType?: string;
  birthday: string;
  sex: "MALE" | "FEMALE";
  parentId: string;
  classId: number;
  levelId?: number;
  img?: string | null;
}) => {
  try {
    const id = crypto.randomUUID();

    // Auto-fetch levelId from class if not provided
    let finalLevelId = data.levelId;
    if (!finalLevelId || finalLevelId === 0) {
      const targetClass = await prisma.class.findUnique({
        where: { id: data.classId },
        select: { levelId: true }
      });
      finalLevelId = targetClass?.levelId || 1;
    }

    const finalUsername = data.username || 
      `${data.name.toLowerCase()}.${data.surname.toLowerCase()}.${Math.floor(Math.random() * 1000)}`;

    const schoolId = await getSchoolId();

    await prisma.student.create({
      data: {
        schoolId,
        id,
        username: finalUsername,
        name: data.name,
        surname: data.surname,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address,
        bloodType: data.bloodType || "O+",
        birthday: new Date(data.birthday),
        sex: data.sex,
        parentId: data.parentId,
        classId: data.classId,
        levelId: finalLevelId,
        img: data.img || null,
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

export const bulkCreateStudents = async (students: any[]) => {
  try {
    await prisma.$transaction(async (tx) => {
      for (const s of students) {
        const studentId = crypto.randomUUID();

        // 1. Find or Create Parent
        let parentId = s.parentId;

        if (!parentId && s.parentPhone) {
          const existingParent = await tx.parent.findUnique({
            where: { phone: s.parentPhone },
          });

          if (existingParent) {
            parentId = existingParent.id;
          } else {
            // Create new parent
            parentId = crypto.randomUUID();
            await tx.parent.create({
              data: {
                id: parentId,
                username: s.parentName?.toLowerCase() + Math.floor(Math.random() * 1000),
                name: s.parentName || "Parent",
                surname: s.parentSurname || s.surname || "Unknown",
                phone: s.parentPhone,
                address: s.address || "Unknown",
              },
            });
          }
        }

        // 2. Create Student
        const schoolId = await getSchoolId();
        await tx.student.create({
          data: {
            schoolId,
            id: studentId,
            username: s.username,
            name: s.name,
            surname: s.surname,
            email: s.email || null,
            phone: s.phone || null,
            address: s.address || "Unknown",
            bloodType: s.bloodType || "O+",
            birthday: new Date(s.birthday || "2015-01-01"),
            sex: s.sex as UserSex || UserSex.MALE,
            parentId: parentId || "default-parent-id", // Should ideally have a fallback or throw
            classId: s.classId || 1,
            levelId: s.levelId || 1,
          },
        });

        await createAuditLog({
          action: "BULK_CREATE_STUDENT",
          entityType: "Student",
          entityId: studentId,
          description: `Bulk enrolled student: ${s.name} ${s.surname} (${s.username})`,
        });
      }
    });

    revalidatePath("/list/students");
    return { success: true };
  } catch (err: any) {
    console.error("bulkCreateStudents error:", err);
    return { success: false, error: err?.message || "Failed to bulk create students." };
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
    levelId?: number;
    img: string | null;
  }>
) => {
  try {
    const updateData: any = { ...data };
    if (data.birthday) updateData.birthday = new Date(data.birthday);

    // Auto-update levelId if classId changed
    if (data.classId) {
      const targetClass = await prisma.class.findUnique({
        where: { id: data.classId },
        select: { levelId: true }
      });
      if (targetClass) updateData.levelId = targetClass.levelId;
    }

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
    const schoolId = await getSchoolId();
    await prisma.staff.create({
      data: {
        schoolId,
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
  img?: string | null;
}) => {
  try {
    const finalUsername = data.username || 
      `${data.name.toLowerCase()}.${data.surname.toLowerCase()}.${data.phone.slice(-4)}`;

    const schoolId = await getSchoolId();

    await prisma.parent.create({
      data: {
        schoolId,
        id: crypto.randomUUID(),
        username: finalUsername,
        name: data.name,
        surname: data.surname,
        email: data.email || null,
        phone: data.phone,
        address: data.address,
        img: data.img || null,
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
    img: string | null;
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
    const schoolId = await getSchoolId();
    await prisma.class.create({
      data: {
        schoolId,
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
    const schoolId = await getSchoolId();
    await prisma.subject.create({ data: { schoolId, name: data.name } });
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
    const schoolId = await getSchoolId();
    const expense = await prisma.expense.create({
      data: {
        schoolId,
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
    const schoolId = await getSchoolId();
    const income = await prisma.income.create({
      data: {
        schoolId,
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

// ===================== NOTICE / ANNOUNCEMENT =====================
export const createNotice = async (data: {
  title: string;
  message: string;
  important: boolean;
  classId?: number | null;
  targetStudentId?: string | null;
  img?: string | null;
  pdfUrl?: string | null;
}) => {
  try {
    const schoolId = await getSchoolId();
    const notice = await prisma.notice.create({
      data: {
        schoolId,
        title: data.title,
        message: data.message,
        important: data.important,
        img: data.img || null,
        pdfUrl: data.pdfUrl || null,
        classId: data.classId || null,
        targetStudentId: data.targetStudentId || null,
      },
    });

    // Trigger notifications for parents
    import("@/lib/notifications").then(m => m.createAnnouncementNotifications(notice.id));

    await createAuditLog({
      action: "CREATE_NOTICE",
      entityType: "Notice",
      entityId: notice.id.toString(),
      description: `Published announcement: ${data.title}${
        data.targetStudentId 
          ? ` (Targeted Student: ${data.targetStudentId})` 
          : data.classId 
            ? ` (Class ID: ${data.classId})` 
            : " (Global)"
      }`,
    });

    revalidatePath("/list/announcements");
    return { success: true };
  } catch (err: any) {
    console.error("createNotice error:", err);
    return { success: false, error: err?.message || "Failed to publish notice." };
  }
};

export const updateNotice = async (
  id: number,
  data: Partial<{
    title: string;
    message: string;
    important: boolean;
    classId: number | null;
    targetStudentId: string | null;
    img: string | null;
    pdfUrl: string | null;
  }>
) => {
  try {
    const { classId, targetStudentId, ...otherData } = data;
    
    await prisma.notice.update({
      where: { id },
      data: {
        ...otherData,
        class: classId 
          ? { connect: { id: classId } } 
          : classId === null 
            ? { disconnect: true } 
            : undefined,
        targetStudent: targetStudentId 
          ? { connect: { id: targetStudentId } } 
          : targetStudentId === null 
            ? { disconnect: true } 
            : undefined,
      },
    });

    await createAuditLog({
      action: "UPDATE_NOTICE",
      entityType: "Notice",
      entityId: id.toString(),
      description: `Updated announcement: ${id}`,
    });

    revalidatePath("/list/announcements");
    return { success: true };
  } catch (err: any) {
    console.error("updateNotice error:", err);
    return { success: false, error: err?.message || "Failed to update notice." };
  }
};

export const deleteNotice = async (id: number) => {
  try {
    const notice = await prisma.notice.findUnique({ where: { id } });
    await prisma.notice.delete({ where: { id } });
    
    await createAuditLog({
      action: "DELETE_NOTICE",
      entityType: "Notice",
      entityId: id.toString(),
      description: `Removed announcement: ${notice?.title}`,
    });

    revalidatePath("/list/announcements");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete notice." };
  }
};

// ===================== TIMETABLE =====================
export const bulkUpdateTimetableSlots = async (classId: number, slots: any[]) => {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete existing slots for this class
      await tx.timetableSlot.deleteMany({
        where: { classId },
      });

      // 2. Create new slots
      for (const slot of slots) {
        await tx.timetableSlot.create({
          data: {
            day: slot.day,
            startTime: slot.startTime,
            endTime: slot.endTime,
            slotNumber: parseInt(String(slot.slotNumber)),
            room: slot.room || "TBA",
            subjectId: slot.subjectId ? parseInt(String(slot.subjectId)) : null,
            teacherId: slot.teacherId ? String(slot.teacherId) : null,
            classId: parseInt(String(classId)),
          },
        });
      }
    });

    await createAuditLog({
      action: "AI_GENERATE_TIMETABLE",
      entityType: "Class",
      entityId: String(classId),
      description: `AI Generated new timetable for Class ID: ${classId} (${slots.length} slots)`,
    });

    revalidatePath("/admin/timetable");
    return { success: true };
  } catch (err: any) {
    console.error("bulkUpdateTimetableSlots error:", err);
    return { success: false, error: err?.message || "Failed to update timetable." };
  }
};

// ===================== SECURITY =====================
export const resetParentPassword = async (parentId: string) => {
  try {
    console.log(`[SECURITY] Initiating password reset for Parent ID: ${parentId}`);

    // Direct update to clear the password
    const parent = await prisma.parent.update({
      where: { id: parentId },
      data: { password: null }
    });

    await createAuditLog({
      action: "RESET_PARENT_PASSWORD",
      entityType: "Parent",
      entityId: parentId,
      description: `Administrative password reset for: ${parent.name} ${parent.surname} (${parent.phone})`,
    });

    revalidatePath("/list/parents");
    return { success: true };
  } catch (err: any) {
    console.error("[SECURITY_ERROR] resetParentPassword failed:", err);
    
    // Return a more descriptive error if it's a Prisma record not found
    if (err.code === 'P2025') {
      return { success: false, error: "Account record not found in database." };
    }
    
    return { success: false, error: err?.message || "Database connection error." };
  }
};

// ===================== UNIFIED ENROLLMENT =====================
export const enrollFamily = async (parentData: any, children: any[]) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or Create Parent (Smart lookup by phone OR username)
      let parent = await tx.parent.findFirst({
        where: { 
          OR: [
            { phone: parentData.phone },
            { username: parentData.username }
          ]
        },
      });

      if (!parent) {
        // Generate a clean username if not provided
        const genUsername = parentData.username || 
          `${parentData.name.toLowerCase()}.${parentData.surname.toLowerCase()}.${parentData.phone.slice(-4)}`;
          
        const schoolId = await getSchoolId();
        parent = await tx.parent.create({
          data: {
            schoolId,
            id: crypto.randomUUID(),
            username: genUsername,
            name: parentData.name,
            surname: parentData.surname,
            email: parentData.email || null,
            phone: parentData.phone,
            address: parentData.address,
            img: parentData.img || null,
          }
        });
      }

      // 2. Create Students
      for (const child of children) {
        // Auto-fetch levelId from class
        const targetClass = await tx.class.findUnique({
          where: { id: parseInt(child.classId) },
          select: { levelId: true }
        });

        const studentUsername = child.username || 
          `${child.name.toLowerCase()}.${child.surname.toLowerCase()}.${Math.floor(Math.random() * 1000)}`;

        const schoolId = await getSchoolId();
        await tx.student.create({
          data: {
            schoolId,
            id: crypto.randomUUID(),
            username: studentUsername,
            name: child.name,
            surname: child.surname,
            email: child.email || null,
            phone: child.phone || null,
            address: child.address || parent.address,
            bloodType: child.bloodType || "O+",
            birthday: new Date(child.birthday),
            sex: child.sex,
            parentId: parent.id,
            classId: parseInt(child.classId),
            levelId: targetClass?.levelId || 1,
            img: child.img || null,
          }
        });
      }

      return parent;
    });

    await createAuditLog({
      action: "ENROLL_FAMILY",
      entityType: "Parent",
      entityId: result.id,
      description: `Unified Enrollment: Parent ${result.name} ${result.surname} + ${children.length} students.`,
    });

// ===================== ASSIGNMENT =====================
export const createAssignment = async (data: {
  title: string;
  startDate: string;
  dueDate: string;
  lessonId: number;
}) => {
  try {
    const schoolId = await getSchoolId();
    const assignment = await prisma.assignment.create({
      data: {
        schoolId,
        title: data.title,
        startDate: new Date(data.startDate),
        dueDate: new Date(data.dueDate),
        lessonId: data.lessonId,
      },
    });

    await createAuditLog({
      action: "CREATE_ASSIGNMENT",
      entityType: "Assignment",
      entityId: assignment.id.toString(),
      description: `Created new assignment: ${data.title} (Lesson ID: ${data.lessonId})`,
    });

    revalidatePath("/list/assignments");
    return { success: true };
  } catch (err: any) {
    console.error("createAssignment error:", err);
    return { success: false, error: err?.message || "Failed to create assignment." };
  }
};

export const updateAssignment = async (
  id: number,
  data: Partial<{
    title: string;
    startDate: string;
    dueDate: string;
    lessonId: number;
  }>
) => {
  try {
    const updateData: any = { ...data };
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate);

    await prisma.assignment.update({ where: { id }, data: updateData });
    
    await createAuditLog({
      action: "UPDATE_ASSIGNMENT",
      entityType: "Assignment",
      entityId: id.toString(),
      description: `Updated assignment: ${id}`,
    });

    revalidatePath("/list/assignments");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update assignment." };
  }
};

export const deleteAssignment = async (id: number) => {
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    await prisma.assignment.delete({ where: { id } });
    
    await createAuditLog({
      action: "DELETE_ASSIGNMENT",
      entityType: "Assignment",
      entityId: id.toString(),
      description: `Deleted assignment: ${assignment?.title}`,
    });

    revalidatePath("/list/assignments");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete assignment." };
  }
};

// ===================== RESOURCE =====================
export const createResource = async (data: {
  title: string;
  url: string;
  lessonId: number;
}) => {
  try {
    const schoolId = await getSchoolId();
    const resource = await prisma.resource.create({
      data: {
        schoolId,
        title: data.title,
        url: data.url,
        lessonId: data.lessonId,
      },
    });

    await createAuditLog({
      action: "CREATE_RESOURCE",
      entityType: "Resource",
      entityId: resource.id.toString(),
      description: `Uploaded new course resource: ${data.title} (Lesson ID: ${data.lessonId})`,
    });

    revalidatePath("/list/lessons"); // Since resources are often viewed there
    return { success: true };
  } catch (err: any) {
    console.error("createResource error:", err);
    return { success: false, error: err?.message || "Failed to create resource." };
  }
};

export const deleteResource = async (id: number) => {
  try {
    const resource = await prisma.resource.findUnique({ where: { id } });
    await prisma.resource.delete({ where: { id } });
    
    await createAuditLog({
      action: "DELETE_RESOURCE",
      entityType: "Resource",
      entityId: id.toString(),
      description: `Deleted resource: ${resource?.title}`,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete resource." };
  }
};
