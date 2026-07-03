import { clerkClient } from "@clerk/nextjs/server";

async function makeSuperAdmin(email) {
  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({ emailAddress: [email] });
    
    if (users.data.length === 0) {
      console.log(`❌ No user found with email: ${email}`);
      return;
    }

    const user = users.data[0];
    
    await client.users.updateUserMetadata(user.id, {
      publicMetadata: {
        ...user.publicMetadata,
        role: "superadmin",
        status: "active",
      }
    });

    console.log(`✅ Success! User ${email} (ID: ${user.id}) is now a superadmin.`);
  } catch (error) {
    console.error("❌ Error updating user:", error);
  }
}

makeSuperAdmin("bringbringa138@gmail.com");
