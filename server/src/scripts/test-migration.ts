import prisma from '../lib/prisma';
// import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

async function main() {
  console.log('Starting migration test...');

  // 1. Create a test user directly in DB (since we don't have auth API yet)
  const userEmail = `test_${Date.now()}@example.com`;
  console.log(`Creating test user: ${userEmail}`);
  
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: userEmail,
        name: 'Test User',
        role: 'user',
        preferences: {},
        memory: {}
      }
    });
    console.log(`User created with ID: ${user.id}`);
  } catch (e) {
    console.error('Failed to create user:', e);
    return;
  }

  // 2. Create a session via API
  console.log('Testing create session API...');
  let sessionId;
  try {
    const sessionRes = await fetch(`${API_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id })
    });
    
    if (!sessionRes.ok) throw new Error(`Session creation failed: ${sessionRes.statusText}`);
    const sessionData = await sessionRes.json();
    sessionId = sessionData.id;
    console.log(`Session created: ${sessionId}`);

    // 3. Send a message via API
    console.log('Testing send message API...');
    try {
      const chatRes = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          session_id: sessionId,
          message: 'Hello, what is the capital of Nigeria?'
        })
      });
      
      if (!chatRes.ok) {
        const errText = await chatRes.text();
        console.log('Chat API failed (expected if OpenAI key missing):', errText);
      } else {
        const chatData = await chatRes.json();
        console.log('Chat response:', chatData);
      }
    } catch (e: any) {
      console.log('Chat API fetch error:', e.message);
    }

    // 4. Verify messages in DB
    console.log('Verifying messages in DB...');
    const messages = await prisma.chat.findMany({
      where: { session_id: sessionId }
    });
    
    console.log(`Found ${messages.length} messages in DB.`);
    messages.forEach(m => {
      console.log(`- [${m.role}] ${m.message.substring(0, 50)}...`);
    });

    // 5. Verify session update
    const updatedSession = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    });
    console.log(`Session message count: ${updatedSession?.message_count}`);

  } catch (error: any) {
    console.error('Test failed:', error.message);
  } finally {
    // Cleanup
    if (user) {
      await prisma.chatSession.deleteMany({ where: { user_id: user.id } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

main();
