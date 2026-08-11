async function test() {
  try {
    const res = await fetch("http://127.0.0.1:3000/api/mobile/home?studentId=1&date=2024-05-10");
    const text = await res.text();
    console.log("Status:", res.status);
    console.log(text.substring(0, 500));
  } catch (e) {
    console.error(e);
  }
}
test();
