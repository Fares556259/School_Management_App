require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("URL:", supabaseUrl, "KEY:", supabaseKey ? "Present" : "Missing");

if (supabaseUrl && supabaseKey) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  async function main() {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error("Error fetching users:", error);
      return;
    }
    console.log("Users:", users.map(u => ({ id: u.id, email: u.email, role: u.user_metadata?.role, status: u.user_metadata?.status, schoolId: u.user_metadata?.schoolId })));
  }
  main();
}
