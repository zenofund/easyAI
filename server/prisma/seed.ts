import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const templates = [
    {
      title: 'Tenancy Agreement (Residential)',
      category: 'Property',
      sub_category: 'Lease',
      description: 'Standard residential tenancy agreement for Nigeria.',
      structure: {
        landlord_name: { label: 'Landlord Name', type: 'text', placeholder: 'Full name of landlord' },
        tenant_name: { label: 'Tenant Name', type: 'text', placeholder: 'Full name of tenant' },
        property_address: { label: 'Property Address', type: 'text', placeholder: 'Full address of the property' },
        rent_amount: { label: 'Rent Amount', type: 'text', placeholder: 'Annual rent amount' },
        start_date: { label: 'Start Date', type: 'date', placeholder: 'Commencement date' },
        duration: { label: 'Duration', type: 'text', placeholder: 'e.g., 1 year' }
      },
      system_prompt: 'Draft a standard Nigerian Residential Tenancy Agreement. Include covenants for landlord and tenant, rent review clause, and termination clause.'
    },
    {
      title: 'Power of Attorney (General)',
      category: 'Corporate',
      sub_category: 'Agency',
      description: 'General Power of Attorney appointing an agent.',
      structure: {
        donor_name: { label: 'Donor Name', type: 'text', placeholder: 'Person giving power' },
        donee_name: { label: 'Donee Name', type: 'text', placeholder: 'Person receiving power' },
        powers: { label: 'Powers Granted', type: 'textarea', placeholder: 'List specific powers granted...' }
      },
      system_prompt: 'Draft a General Power of Attorney under Nigerian law. Ensure it is by deed if it relates to land.'
    },
    {
      title: 'Employment Contract',
      category: 'Corporate',
      sub_category: 'HR',
      description: 'Standard employment contract for permanent staff.',
      structure: {
        employer_name: { label: 'Employer Name', type: 'text', placeholder: 'Company name' },
        employee_name: { label: 'Employee Name', type: 'text', placeholder: 'Full name of employee' },
        position: { label: 'Position', type: 'text', placeholder: 'Job title' },
        salary: { label: 'Salary', type: 'text', placeholder: 'Annual/Monthly salary' },
        probation_period: { label: 'Probation Period', type: 'text', placeholder: 'e.g., 3 months' }
      },
      system_prompt: 'Draft a standard Employment Contract compliant with the Nigerian Labour Act.'
    },
    {
      title: 'Affidavit of Change of Name',
      category: 'Litigation',
      sub_category: 'Affidavit',
      description: 'Affidavit for changing name.',
      structure: {
        deponent_old_name: { label: 'Old Name', type: 'text', placeholder: 'Previous full name' },
        deponent_new_name: { label: 'New Name', type: 'text', placeholder: 'New full name' },
        reason: { label: 'Reason', type: 'text', placeholder: 'Reason for change (e.g., marriage)' }
      },
      system_prompt: 'Draft an Affidavit of Change of Name for the Nigerian High Court registry.'
    },
    {
      title: 'Deed of Assignment',
      category: 'Property',
      sub_category: 'Conveyance',
      description: 'Transfer of ownership of land.',
      structure: {
        assignor_name: { label: 'Assignor Name', type: 'text', placeholder: 'Seller' },
        assignee_name: { label: 'Assignee Name', type: 'text', placeholder: 'Buyer' },
        property_description: { label: 'Property Description', type: 'textarea', placeholder: 'Detailed description of the land' },
        consideration: { label: 'Consideration', type: 'text', placeholder: 'Purchase price' }
      },
      system_prompt: 'Draft a Deed of Assignment for land transfer in Nigeria. Include receipt clause and indemnity.'
    }
  ];

  for (const t of templates) {
    const exists = await prisma.legalTemplate.findFirst({ where: { title: t.title } });
    if (!exists) {
      await prisma.legalTemplate.create({ data: t });
      console.log(`Created template: ${t.title}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
