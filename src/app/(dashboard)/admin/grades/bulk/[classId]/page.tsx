import BulkReportCardClient from "./BulkReportCardClient";

export default function BulkReportCardPage({
  params,
  searchParams,
}: {
  params: { classId: string };
  searchParams: { term?: string };
}) {
  const term = searchParams.term ? parseInt(searchParams.term) : 1;

  return (
    <div className="bg-[#F7F8FA] min-h-screen pt-8">
      <BulkReportCardClient classId={params.classId} term={term} />
    </div>
  );
}
