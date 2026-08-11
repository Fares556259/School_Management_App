const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "snapschool_mobile_jwt_super_secret_key_2026";
const token = jwt.sign({ userId: 'parent_1785483406701_427l', userType: 'parent', schoolId: 'bringbringa138gmailcom-1' }, JWT_SECRET);

async function main() {
  const studentId = '84887b09-09fb-4c7f-86ac-969fa4aadf2a';
  
  console.log("Firing concurrent requests...");
  const p1 = fetch(`http://localhost:3000/api/mobile/parent-data`, { headers: { 'Authorization': `Bearer ${token}` } });
  const p2 = fetch(`http://localhost:3000/api/mobile/home?studentId=${studentId}&date=2026-08-11`, { headers: { 'Authorization': `Bearer ${token}` } });
  const p3 = fetch(`http://localhost:3000/api/mobile/courses?studentId=${studentId}`, { headers: { 'Authorization': `Bearer ${token}` } });
  const p4 = fetch(`http://localhost:3000/api/mobile/parent?id=parent_1785483406701_427l`, { headers: { 'Authorization': `Bearer ${token}` } });
  
  const results = await Promise.all([p1, p2, p3, p4]);
  console.log("Results:");
  for (const r of results) {
    console.log(r.url, r.status);
  }
}
main();
