import { getSchoolId } from "@/lib/school";
import { RedirectToSignIn } from "@clerk/nextjs";
import MobileAppClient from "./MobileAppClient";

export default async function MobileAppPage() {
  const schoolId = await getSchoolId();

  if (!schoolId) {
    return <RedirectToSignIn />;
  }

  // Deep Link format: snapschool://login?schoolId=[id]
  const deepLink = `snapschool://login?schoolId=${schoolId}`;

  return (
    <div className="p-4 md:p-8 min-h-[calc(100vh-100px)] flex items-center justify-center">
      <div className="w-full max-w-4xl">
         <MobileAppClient deepLink={deepLink} schoolId={schoolId} />
      </div>
    </div>
  );
}
