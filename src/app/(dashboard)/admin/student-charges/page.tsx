import { getStudentAdminSchool } from "@/lib/studentProfile";
import { syncStudentCharges } from "@/lib/studentCharges";
import StudentChargesClient from "./StudentChargesClient";
export const dynamic = "force-dynamic";
export default async function StudentChargesPage() {
  const schoolId = await getStudentAdminSchool();
  await syncStudentCharges(schoolId);
  return <StudentChargesClient />;
}
