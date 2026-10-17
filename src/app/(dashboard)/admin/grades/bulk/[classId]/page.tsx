import BulkReportCardClient from "./BulkReportCardClient";

export default async function BulkReportCardPage(
  props: {
    params: Promise<{ classId: string }>;
    searchParams?: Promise<{ term?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const term = searchParams?.term ? parseInt(searchParams.term) : 1;

  return (
    <div className="bg-[#F7F8FA] min-h-screen pt-8">
      <BulkReportCardClient classId={params.classId} term={term} />
    </div>
  );
}
