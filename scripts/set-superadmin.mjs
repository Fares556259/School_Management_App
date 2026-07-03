/**
 * One-time script to set a Clerk user as superadmin.
 * Usage: node scripts/set-superadmin.mjs <userId>
 * 
 * To find your userId: go to https://dashboard.clerk.com → Users → click your account
 */

const CLERK_SECRET_KEY = "sk_test_MvBHZsgy7RLd8EWlsKCIWNJKJOz5e0GtJ9v0jEbZ88";
const userId = process.argv[2];

if (!userId) {
  console.error("❌ Usage: node scripts/set-superadmin.mjs <clerk_user_id>");
  console.error("   Find your user ID at: https://dashboard.clerk.com/last-active?path=/users");
  process.exit(1);
}

const res = await fetch(`https://api.clerk.com/v1/users/${userId}/metadata`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${CLERK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    public_metadata: {
      role: "superadmin",
      status: "active",
    },
  }),
});

const data = await res.json();

if (res.ok) {
  console.log("✅ Success! User is now superadmin.");
  console.log(`   Name: ${data.first_name} ${data.last_name}`);
  console.log(`   Email: ${data.email_addresses?.[0]?.email_address}`);
  console.log(`   Role: ${data.public_metadata?.role}`);
  console.log("\n👉 Now go to: http://localhost:3000/sign-in and log in.");
  console.log("   Then visit: http://localhost:3000/superadmin");
} else {
  console.error("❌ Failed:", data.errors || data);
}
