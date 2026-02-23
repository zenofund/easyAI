
import { PrismaClient, PlanTier, BillingCycle, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding plans...');

  const plans = [
    {
      name: 'Free Plan',
      tier: PlanTier.free,
      price: 0,
      billing_cycle: BillingCycle.monthly,
      features: {
        description: 'Basic access to legal assistant',
        items: [
          '5 documents per month',
          'Basic search',
          'No AI drafting',
        ]
      },
      max_documents: 5,
      max_chats_per_day: 10,
      internet_search: false,
      ai_drafting: false,
      collaboration: false,
      legal_citation: false,
      case_summarizer: false,
      document_export: false,
      priority_support: false,
      advanced_analytics: false,
      is_active: true
    },
    {
      name: 'Pro Plan',
      tier: PlanTier.pro,
      price: 5000,
      billing_cycle: BillingCycle.monthly,
      features: {
        description: 'Advanced features for professionals',
        items: [
          '50 documents per month',
          'Advanced search',
          'AI drafting',
          'Priority support',
          'Legal Citation',
          'Case Summarizer'
        ]
      },
      max_documents: 50,
      max_chats_per_day: 100,
      internet_search: true,
      ai_drafting: true,
      collaboration: false,
      legal_citation: true,
      case_summarizer: true,
      document_export: true,
      priority_support: true,
      advanced_analytics: false,
      is_active: true
    },
    {
      name: 'Enterprise Plan',
      tier: PlanTier.enterprise,
      price: 50000,
      billing_cycle: BillingCycle.monthly,
      features: {
        description: 'Full access for teams',
        items: [
          'Unlimited documents',
          'Full search capabilities',
          'AI drafting & review',
          'Collaboration tools',
          'Dedicated support',
          'Legal Citation',
          'Case Summarizer',
          'Advanced Analytics'
        ]
      },
      max_documents: 1000,
      max_chats_per_day: 500,
      internet_search: true,
      ai_drafting: true,
      collaboration: true,
      legal_citation: true,
      case_summarizer: true,
      document_export: true,
      priority_support: true,
      advanced_analytics: true,
      is_active: true
    }
  ];

  for (const plan of plans) {
    const existingPlan = await prisma.plan.findFirst({
      where: { name: plan.name }
    });

    if (!existingPlan) {
      await prisma.plan.create({
        data: plan
      });
      console.log(`Created plan: ${plan.name}`);
    } else {
      console.log(`Plan already exists: ${plan.name}`);
    }
  }

  // Create Admin User
  const adminEmail = 'admin@easyread.ng';
  const adminPassword = 'easyAI20##$$';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'Admin User',
        role: UserRole.admin, // or UserRole.super_admin depending on needs
      }
    });
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    // Optionally update the password if it already exists, or just skip
    // For safety, let's just log that it exists.
    console.log(`Admin user already exists: ${adminEmail}`);
    // Update password just in case
    await prisma.user.update({
      where: { email: adminEmail },
      data: {
        password: hashedPassword,
        role: UserRole.admin
      }
    });
    console.log(`Updated admin user password: ${adminEmail}`);
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
