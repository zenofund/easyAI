import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up orphaned chats...');
  try {
      const result = await prisma.$executeRaw`
        DELETE FROM "chats"
        WHERE "session_id" NOT IN (SELECT "id" FROM "chat_sessions");
      `;
      console.log(`Deleted ${result} orphaned chats.`);
  } catch (e) {
      console.error(e);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
