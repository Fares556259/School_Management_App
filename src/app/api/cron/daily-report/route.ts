import { NextResponse } from "next/server";
import { Resend } from "resend";
import prisma from "@/lib/prisma";
import { aggregateDailyData } from "@/lib/reports/aggregator";
import { generateSmartInsights } from "@/lib/reports/generator";
import { DailyReportEmail } from "@/components/emails/DailyReportEmail";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  // In a real production scenario, you would verify an Authorization header or Vercel CRON secret here
  // if (request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  try {
    const cookieStore = cookies();
    const locale = cookieStore.get("NEXT_LOCALE")?.value || "en";

    // 1. Aggregate Data
    const data = await aggregateDailyData();

    // 2. Generate Smart Insights using Gemini
    const insights = await generateSmartInsights(data, locale);

    // 3. Render Email Template
    const dateString = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // 4. Send Email
    // Fetch subscribers
    const subscribers = await prisma.reportSubscriber.findMany();
    const toEmails = subscribers.map((sub) => sub.email);

    if (toEmails.length === 0) {
      return NextResponse.json({ success: true, message: "No subscribers found, report skipped" });
    }

    // Using a verified domain email or onboarding test email
    const { data: emailData, error } = await resend.emails.send({
      from: "SnapSchool Reports <onboarding@resend.dev>", // Replace with verified domain in production
      to: toEmails,
      subject: `Daily School AI Report - ${dateString}`,
      react: DailyReportEmail({
        date: dateString,
        financialData: data.financialData,
        payments: data.payments,
        activity: data.activity,
        insights,
      }) as React.ReactElement,
    });

    if (error) {
      console.error("Resend Error:", error);
      
      // Log Failure
      await prisma.dailyReportLog.create({
        data: {
          date: new Date(),
          status: "FAILED",
          schoolId: "default", // If multi-tenant, use actual school ID
        },
      });

      return NextResponse.json({ error: "Failed to send email", details: error }, { status: 500 });
    }

    // 5. Log Success
    await prisma.dailyReportLog.create({
      data: {
        date: new Date(),
        status: "SUCCESS",
        schoolId: "default",
      },
    });

    return NextResponse.json({ success: true, emailId: emailData?.id });
  } catch (err) {
    console.error("Cron Job Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
