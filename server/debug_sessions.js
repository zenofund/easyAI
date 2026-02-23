
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const sessions = await prisma.chatSession.findMany({
      orderBy: { last_message_at: 'desc' },
      take: 5,
      include: {
        chats: {
          orderBy: { created_at: 'asc' },
          take: 1,
          select: {
            message: true,
            role: true
          }
        }
      }
    });

    console.log('Found sessions:', sessions.length);
    sessions.forEach(session => {
      console.log(`ID: ${session.id}`);
      console.log(`Title: ${session.title}`);
      console.log(`Chats found: ${session.chats.length}`);
      if (session.chats.length > 0) {
        console.log(`First message: ${session.chats[0].message}`);
        console.log(`First role: ${session.chats[0].role}`);
      }
      console.log('---');
    });
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
