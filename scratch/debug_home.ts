async function testHome() {
  const url = 'http://localhost:3000/api/mobile/home?studentId=student1&date=2026-04-27';
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('Home Data Sessions:', JSON.stringify(data.sessions, null, 2));
  } catch (err: any) {
    console.error('Fetch Error:', err);
  }
}

testHome();
