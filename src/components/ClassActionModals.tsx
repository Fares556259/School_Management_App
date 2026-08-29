"use client";

import { useState } from "react";
import { Users, GraduationCap, Loader2 } from "lucide-react";
import ModalRouteOverlay from "./ModalRouteOverlay";
import ClassStudentsTable from "./ClassStudentsTable";
import ClassTeachersTable from "./ClassTeachersTable";
import { fetchClassStudentsAction, fetchClassTeachersAction } from "@/app/(dashboard)/list/classes/actions";

export default function ClassActionModals({ 
  classId, 
  role, 
  viewStudentsText, 
  viewTeachersText 
}: { 
  classId: number, 
  role: string, 
  viewStudentsText: string, 
  viewTeachersText: string 
}) {
  const [modal, setModal] = useState<"students" | "teachers" | null>(null);
  const [loading, setLoading] = useState<"students" | "teachers" | null>(null);
  const [studentsData, setStudentsData] = useState<any>(null);
  const [teachersData, setTeachersData] = useState<any>(null);
  
  const openStudents = async () => {
    if (!studentsData) {
      setLoading("students");
      const data = await fetchClassStudentsAction(classId);
      setStudentsData(data);
      setLoading(null);
    }
    setModal("students");
  };
  
  const openTeachers = async () => {
    if (!teachersData) {
      setLoading("teachers");
      const data = await fetchClassTeachersAction(classId);
      setTeachersData(data);
      setLoading(null);
    }
    setModal("teachers");
  };
  
  return (
    <>
      <div className="flex items-center gap-2">
        <button 
          onClick={openStudents}
          disabled={loading !== null}
          className="flex items-center gap-1.5 bg-white border border-[#dddddd] text-[#181d26] px-3 py-1.5 rounded-full text-[13px] font-medium hover:bg-slate-50 hover:shadow-sm transition-all disabled:opacity-50"
        >
          {loading === "students" ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
          <span>{viewStudentsText}</span>
        </button>
        <button 
          onClick={openTeachers}
          disabled={loading !== null}
          className="flex items-center gap-1.5 bg-white border border-[#dddddd] text-[#181d26] px-3 py-1.5 rounded-full text-[13px] font-medium hover:bg-slate-50 hover:shadow-sm transition-all disabled:opacity-50"
        >
          {loading === "teachers" ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
          <span>{viewTeachersText}</span>
        </button>
      </div>

      {modal === "students" && studentsData?.activeClass && (
        <ModalRouteOverlay onClose={() => setModal(null)}>
          <ClassStudentsTable
            isModal={true}
            activeClass={{
              id: studentsData.activeClass.id,
              name: studentsData.activeClass.name,
              capacity: studentsData.activeClass.capacity,
              level: studentsData.activeClass.level,
              supervisor: studentsData.activeClass.supervisor,
              students: studentsData.activeClass.students.map((student: any) => ({
                id: student.id,
                username: student.username,
                name: student.name,
                surname: student.surname,
                phone: student.phone,
                address: student.address,
                img: student.img,
                birthday: student.birthday,
                sex: student.sex,
                bloodType: student.bloodType,
                createdAt: student.createdAt,
                parent: student.parent,
              })),
            }}
            
            role={role}
          />
        </ModalRouteOverlay>
      )}

      {modal === "teachers" && teachersData && (
        <ModalRouteOverlay onClose={() => setModal(null)}>
          <ClassTeachersTable
            isModal={true}
            activeClass={{
              id: teachersData.id,
              name: teachersData.name,
              capacity: teachersData.capacity,
              level: teachersData.level,
              supervisor: teachersData.supervisor,
              teachers: teachersData.teachers,
            }}
            role={role}
          />
        </ModalRouteOverlay>
      )}
    </>
  );
}
