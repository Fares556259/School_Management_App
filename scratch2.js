const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "snapschool_mobile_jwt_super_secret_key_2026";
const token = jwt.sign({ userId: 'parent_1785483406701_427l', userType: 'parent', schoolId: 'bringbringa138gmailcom-1' }, JWT_SECRET);

async function main() {
  const res = await fetch(`http://localhost:3000/api/mobile/parent-data`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log("Parent Data:", await res.text());
}
main();
