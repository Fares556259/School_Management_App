const testLogin = async () => {
  const res = await fetch('http://localhost:3000/api/mobile/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'parent1@gmail.com' }),
    headers: { 'Content-Type': 'application/json' }
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text.substring(0, 500));
}

testLogin();
