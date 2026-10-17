import ReportCardClient from "./ReportCardClient";

export default async function ReportCardPage(
  props: {
    params: Promise<{ studentId: string }>;
    searchParams?: Promise<{ term?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const { studentId } = params;
  const term = searchParams?.term ? parseInt(searchParams.term) : 1;

  // We fetch high-level student data here if needed, but the Client component
  // will handle the detailed report fetching for interactivity and print prep.

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <ReportCardClient studentId={studentId} term={term} />
    </div>
  );
}
