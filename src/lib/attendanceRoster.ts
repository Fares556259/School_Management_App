type AttendanceRecord = { id: number; status: string; note: string | null; lessonId?: number | null };
type Session = { id: string | number; realLessonId: number | null };

/** A class/day roster is loaded once; changing the session only selects its records. */
export function selectAttendanceSession<T extends { attendance: AttendanceRecord[] }>(
  students: T[], lessons: Session[], selectedLesson: string,
): T[] {
  const lesson = lessons.find(item => String(item.id) === selectedLesson);
  if (!lesson) return [];
  return students.map(student => {
    const attendance = student.attendance.filter(record =>
      record.lessonId == null || (lesson.realLessonId != null && record.lessonId === lesson.realLessonId));
    // Preserve the existing page's default-present convention without saving anything.
    return { ...student, attendance: attendance.length ? attendance : [{ id: -1, status: "PRESENT", note: null }] };
  });
}

/** Cancel obsolete class requests and bound a stalled request instead of silently showing an empty roster. */
export async function fetchAttendanceJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 20_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Attendance request failed (${response.status})`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
