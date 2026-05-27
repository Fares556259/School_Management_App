import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent, clerkClient } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!SIGNING_SECRET) {
    console.error('Error: Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
    return new Response('Error: Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local', {
      status: 400,
    })
  }

  // Create new Svix instance with secret
  const wh = new Webhook(SIGNING_SECRET)

  // Get headers
  const headerPayload = headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing Svix headers', {
      status: 400,
    })
  }

  // Get body
  const body = await req.text()

  let evt: WebhookEvent

  // Verify payload with headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error: Could not verify webhook:', err)
    return new Response('Error: Verification failed', {
      status: 400,
    })
  }

  // Handle the webhook
  const eventType = evt.type
  console.log(`Clerk Webhook Received: ${eventType}`)

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name, username, public_metadata, unsafe_metadata } = evt.data
    const email = email_addresses[0]?.email_address

    if (!email) return new Response('No email found', { status: 400 })

    const schoolName = (unsafe_metadata?.schoolName as string) 
                    || (public_metadata?.schoolName as string) 
                    || `${first_name || "New"}'s School`;

    try {
      // INTEL: Check if they are already active in Clerk
      const clerkStatus = public_metadata?.status as string;
      const dbAdminStatus = clerkStatus === "active" ? "active" : "pending";
      const dbLeadStatus = clerkStatus === "active" ? "ACTIVATED" : "PENDING";

      // 1. Sync Admin record
      await prisma.admin.upsert({
        where: { id: id },
        update: {
          pendingSchoolName: clerkStatus === "active" ? null : schoolName,
          status: dbAdminStatus,
        },
        create: {
          id: id,
          username: username || "user_" + id.slice(-5),
          name: first_name || "New",
          surname: last_name || "Admin",
          status: dbAdminStatus,
          pendingSchoolName: clerkStatus === "active" ? null : schoolName,
          schoolId: public_metadata?.schoolId as string || "default_school",
        },
      });

      // 2. Create SetupRequest (Lead) - Skip email as it's no longer in schema
      await prisma.setupRequest.create({
        data: {
          schoolName: schoolName,
          ownerName: `${first_name || "New"} ${last_name || "Admin"}`,
          phoneNumber: "N/A",
          city: "Webhook Automatic",
          status: dbLeadStatus
        }
      });

      // 3. Update Clerk metadata (role/status)
      const client = await clerkClient()
      await client.users.updateUserMetadata(id, {
        publicMetadata: {
          role: "admin",
          status: "pending",
          schoolName: schoolName
        }
      });

      console.log(`Successfully synced user ${id} via webhook`)
    } catch (dbErr) {
      console.error('Error syncing user via webhook:', dbErr)
      return new Response('Database sync failed', { status: 500 })
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data
    if (!id) return new Response('No ID found', { status: 400 })

    try {
      // Remove from Admin
      await prisma.admin.delete({
        where: { id: id }
      });
      
      console.log(`Successfully deleted user ${id} via webhook`)
    } catch (dbErr) {
      console.error('Error deleting user via webhook:', dbErr)
      return new Response('Database deletion failed', { status: 500 })
    }
  }

  return new Response('Webhook processed', { status: 200 })
}
