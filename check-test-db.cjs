const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

async function main() {
    console.log("Connected to test database.");

    const tables = await db.$queryRaw`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    `;

    console.log("\nTables found:");

    for (const table of tables) {
        console.log("-", table.tablename);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await db.$disconnect();
    });
