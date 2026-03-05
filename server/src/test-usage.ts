
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      role: 'super_admin'
    },
    include: {
      subscriptions: {
        where: { status: 'active' },
        include: { plan: true }
      }
    }
  });

  if (!user) {
    console.log('No super_admin found');
    return;
  }

  console.log('Found user:', user.email, user.role);
  
  const count = await prisma.document.count({
    where: { uploaded_by: user.id }
  });

  let max = 10;
  if (user.subscriptions?.[0]?.plan) {
    max = user.subscriptions[0].plan.max_documents;
    console.log('Plan limit:', max);
  } else {
    console.log('No active subscription found');
  }

  // Override logic from controller
  if (user.role === 'admin' || user.role === 'super_admin') {
    console.log('Admin override applied');
    max = -1;
  }

  console.log('Final Result:', {
    count,
    max_limit: max
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
