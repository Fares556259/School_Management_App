import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.$executeRawUnsafe(`
    UPDATE auth.users AS u
    SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'role', CASE
        WHEN u.raw_user_meta_data->>'role' = 'superadmin' THEN 'superadmin'
        ELSE 'admin'
      END,
      'status', CASE
        WHEN u.raw_user_meta_data->>'role' = 'superadmin' THEN 'active'
        ELSE COALESCE(a.status, 'pending')
      END,
      'schoolId', a."schoolId"
    ),
    updated_at = NOW()
    FROM "Admin" AS a
    WHERE u.id::text = a.id
  `);

  const summary = await prisma.$queryRawUnsafe<
    Array<{ role: string; status: string; count: number }>
  >(`
    SELECT
      COALESCE(raw_app_meta_data->>'role', 'none') AS role,
      COALESCE(raw_app_meta_data->>'status', 'none') AS status,
      COUNT(*)::int AS count
    FROM auth.users
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);

  console.log(JSON.stringify({ updated, summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
