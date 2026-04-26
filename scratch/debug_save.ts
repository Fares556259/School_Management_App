async function testSave() {
  const url = 'http://localhost:3000/api/mobile/teacher/attendance';
  const data = {
    teacherId: 'teacher1',
    classId: '93',
    date: '2026-04-27',
    records: [
      { studentId: 'student1', status: 'PRESENT', score: 5, note: 'Test note' }
    ],
    lessonId: null
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    console.log('Status:', res.status);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('Fetch Error:', err);
  }
}

testSave();
