import prisma from '../lib/prisma';

async function main() {
  try {
    console.log('Connecting to database...');
    const userCount = await prisma.user.count();
    console.log(`Successfully connected! User count: ${userCount}`);
    
    // Check if vector extension works
    try {
      // Create a dummy document with vector
      // We won't actually create it, just check if the model is accessible
      console.log('Checking vector extension support...');
      const documentCount = await prisma.document.count();
      console.log(`Document count: ${documentCount}`);
    } catch (e) {
      console.error('Vector extension check failed:', e);
    }

  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
