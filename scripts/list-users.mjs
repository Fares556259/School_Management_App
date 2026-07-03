const CLERK_SECRET_KEY = "sk_test_MvBHZsgy7RLd8EWlsKCIWNJKJOz5e0GtJ9v0jEbZ88";
const res = await fetch("https://api.clerk.com/v1/users?limit=10", {
  headers: {
    Authorization: `Bearer ${CLERK_SECRET_KEY}`
  }
});
const users = await res.json();
users.forEach(u => {
  console.log(`ID: ${u.id} | Email: ${u.email_addresses?.[0]?.email_address} | Role: ${u.public_metadata?.role}`);
});
