"use server";

import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function signInAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Invalid email or password" };
  }

  const role = data.user?.user_metadata?.role as string | undefined;
  const status = data.user?.user_metadata?.status as string | undefined;

  // Smart redirect based on role
  if (role === "superadmin") {
    redirect("/superadmin");
  } else if (role === "admin" && status === "active") {
    redirect("/admin");
  } else {
    // Pending admin or unknown — send to waiting page
    redirect("/waiting-approval");
  }
}

export async function signUpAction(formData: FormData) {
  const name = formData.get("name") as string;
  const surname = formData.get("surname") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const schoolName = formData.get("schoolName") as string;

  if (!email || !password || !name || !surname || !schoolName) {
    return { error: "All fields are required" };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        firstName: name,
        lastName: surname,
        role: "admin",
        status: "pending",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  const user = data.user;
  if (!user) {
    return { error: "Failed to create user" };
  }

  // Create the Admin in Prisma
  try {
    await prisma.admin.create({
      data: {
        id: user.id,
        email: email,
        username: email.split("@")[0] + "_" + user.id.slice(0, 5),
        name: name,
        surname: surname,
        status: "pending",
        pendingSchoolName: schoolName,
        schoolId: "default_school",
      },
    });

    // Create the SetupRequest (Lead)
    await prisma.setupRequest.create({
      data: {
        schoolName: schoolName,
        ownerName: `${name} ${surname}`,
        phoneNumber: "N/A",
        city: "Signup Form",
        status: "PENDING",
      },
    });
  } catch (dbError) {
    console.error("Database sync failed:", dbError);
    return { error: "Failed to set up account data" };
  }

  redirect("/waiting-approval");
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
