// Script to verify SuperAdmin login credentials
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

async function verifyCredentials() {
  // Create a Prisma client with retry logic for prepared statement errors
  const prisma = new PrismaClient();
  
  // Add middleware to handle prepared statement errors
  prisma.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (error) {
      // Check if this is a prepared statement error
      if (
        error.message && 
        (error.message.includes('prepared statement') || 
          (error.code === '42P05'))
      ) {
        console.log('Prepared statement error detected, retrying with new connection');
        
        // For this specific error, try reconnecting and retrying once
        try {
          await prisma.$disconnect();
          await prisma.$connect();
          return await next(params);
        } catch (retryError) {
          console.error('Error on retry after prepared statement issue:', retryError);
          throw retryError;
        }
      }
      
      throw error;
    }
  });
  
  try {
    console.log('Connecting to database...');
    
    // Find the user
    const email = 'superadmin@cbums.com';
    const password = 'superadmin123';
    
    console.log(`Looking for user with email: ${email}`);
    
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      console.log('User not found!');
      return;
    }
    
    console.log('User found:', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log(`Password match: ${passwordMatch}`);
    
    if (passwordMatch) {
      console.log('Login credentials are valid.');
    } else {
      console.log('Password is incorrect.');
    }
  } catch (error) {
    console.error('Error verifying credentials:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyCredentials()
  .then(() => console.log('Verification complete'))
  .catch(e => console.error('Verification failed:', e)); 