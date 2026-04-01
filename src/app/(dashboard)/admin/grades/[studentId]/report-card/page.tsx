import ReportCardClient from "./ReportCardClient";

export default async function ReportCardPage({
  params,
  searchParams,
}: {
  params: { studentId: string };
  searchParams: { term?: string };
}) {
  const { studentId } = params;
  const term = searchParams.term ? parseInt(searchParams.term) : 1;

  // We fetch high-level student data here if needed, but the Client component
  // will handle the detailed report fetching for interactivity and print prep.
  
  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <ReportCardClient studentId={studentId} term={term} />
    </div>
  );
}
