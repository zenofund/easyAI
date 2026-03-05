
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
      max_chats_per_day: 15,
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
      artifacts: true,
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
      console.log(`Plan already exists: ${plan.name}. Updating limits...`);
      await prisma.plan.update({
        where: { id: existingPlan.id },
        data: {
            max_documents: plan.max_documents,
            max_chats_per_day: plan.max_chats_per_day,
            features: plan.features,
            artifacts: plan.artifacts
        }
      });
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

  console.log('Seeding Legal Templates...');
  
  const templates = [
    {
      title: 'Motion Ex-Parte for Substituted Service',
      category: 'Litigation',
      description: 'Application to serve court processes by substituted means when personal service fails.',
      structure: {
        claimant: { label: 'Claimant/Applicant Name', type: 'text', placeholder: 'e.g., John Doe' },
        defendant: { label: 'Defendant/Respondent Name', type: 'text', placeholder: 'e.g., Jane Smith' },
        court_name: { label: 'Name of Court', type: 'text', placeholder: 'e.g., High Court of Lagos State' },
        suit_number: { label: 'Suit Number', type: 'text', placeholder: 'e.g., LD/1234/2023' },
        mode_of_service: { label: 'Proposed Mode of Service', type: 'text', placeholder: 'e.g., Pasting at last known address' },
        address_of_service: { label: 'Address for Service', type: 'text', placeholder: 'e.g., 123 Broad Street, Lagos' },
        attempts_made: { label: 'Details of Failed Attempts', type: 'textarea', placeholder: 'Describe how the bailiff tried and failed to serve personally...' }
      },
      system_prompt: `Draft a Motion Ex-Parte for Substituted Service in Nigeria.
      Structure:
      1. Motion Paper (heading, parties, reliefs sought pursuant to relevant High Court Civil Procedure Rules).
      2. Affidavit in Support (deposed by a litigation clerk or counsel, stating attempts made).
      3. Written Address (Issues for Determination, Legal Argument citing relevant cases on substituted service like *Mark v. Eke*, and Conclusion).
      
      Ensure you cite the specific Order and Rule of the Civil Procedure Rules of the court specified (default to Lagos State Civil Procedure Rules 2019 if generic).`
    },
    {
      title: 'Tenancy Agreement (Residential)',
      category: 'Property',
      description: 'Standard residential tenancy agreement for Nigeria.',
      structure: {
        landlord_name: { label: 'Landlord Name', type: 'text' },
        landlord_address: { label: 'Landlord Address', type: 'text' },
        tenant_name: { label: 'Tenant Name', type: 'text' },
        property_address: { label: 'Property Address', type: 'text' },
        rent_amount: { label: 'Annual Rent (N)', type: 'text' },
        commencement_date: { label: 'Commencement Date', type: 'text' },
        duration: { label: 'Duration (e.g., 1 year)', type: 'text' }
      },
      system_prompt: `Draft a standard Residential Tenancy Agreement in Nigeria.
      Include:
      - Parties clause.
      - Recitals.
      - Reddendum (Rent clause).
      - Covenants of the Tenant (to pay rent, keep in repair, not to sublet, etc.).
      - Covenants of the Landlord (quiet enjoyment, structural repairs).
      - Termination clause (Notice to Quit length based on tenancy type).
      - Dispute Resolution clause (Arbitration or Court).
      - Execution/Attestation block.
      Use formal legal language suitable for Nigerian property law.`
    },
    {
      title: 'Letter of Demand',
      category: 'Corporate',
      description: 'Formal demand for payment of debt or performance of obligation.',
      structure: {
        recipient_name: { label: 'Recipient Name', type: 'text' },
        recipient_address: { label: 'Recipient Address', type: 'text' },
        client_name: { label: 'Client Name', type: 'text' },
        debt_amount: { label: 'Debt Amount/Obligation', type: 'text' },
        transaction_details: { label: 'Details of Transaction', type: 'textarea' },
        deadline: { label: 'Deadline for Compliance', type: 'text', placeholder: 'e.g., 7 days' }
      },
      system_prompt: `Draft a strong Letter of Demand from a Nigerian Law Firm.
      - Heading: "DEMAND FOR PAYMENT OF..." or "DEMAND FOR..."
      - Body: State that you act for [Client]. Recount the transaction facts. State the breach/debt.
      - Demand: Clearly demand the sum/action within [Deadline].
      - Warning: Threaten legal action if the demand is not met, including a claim for legal costs.
      - Sign-off: "Yours faithfully, PP: [Law Firm Name]".`
    }
  ];

  for (const t of templates) {
    const exists = await prisma.legalTemplate.findFirst({
        where: { title: t.title }
    });

    if (!exists) {
        await prisma.legalTemplate.create({
            data: t
        });
        console.log(`Created template: ${t.title}`);
    } else {
        console.log(`Template exists: ${t.title}`);
    }
  }

  console.log('Legal Templates seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
