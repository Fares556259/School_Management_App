const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "snapschool_mobile_jwt_super_secret_key_2026";
const token = jwt.sign({ userId: 'parent_1785483406701_427l', userType: 'parent', schoolId: 'bringbringa138gmailcom-1' }, JWT_SECRET);

async function main() {
  const studentId = '84887b09-09fb-4c7f-86ac-969fa4aadf2a';
  console.log("Fetching home...");
  const res = await fetch(`http://localhost:3000/api/mobile/home?studentId=${studentId}&date=2026-08-11`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log("Home Status:", res.status);
  console.log("Home Data:", await res.text());
}
main();
