import type { AttendanceStatus } from '@prisma/client';

export function selectChangedNonPresent(
  records: { studentId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' }[],
  existing: Map<string, { status: AttendanceStatus }>
) {
  return records.filter((record) =>
    record.status !== 'PRESENT' && existing.get(record.studentId)?.status !== record.status
  );
}
