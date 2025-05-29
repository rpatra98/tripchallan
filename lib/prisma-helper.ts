import prisma from './prisma';

/**
 * Execute a Prisma query with automatic retry on prepared statement errors
 * @param operation Function that performs the Prisma operation
 * @returns Result of the operation
 */
export async function executePrismaWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Check if this is a prepared statement error
    if (
      error.message && 
      (error.message.includes('prepared statement') || 
       (error.code === '42P05'))
    ) {
      console.warn('Prepared statement error detected, retrying with new connection');
      
      // For this specific error, try reconnecting and retrying once
      try {
        await prisma.$disconnect();
        await prisma.$connect();
        return await operation();
      } catch (retryError) {
        console.error('Error on retry after prepared statement issue:', retryError);
        throw retryError;
      }
    }
    
    // If it's not a prepared statement error, just rethrow
    throw error;
  }
}

/**
 * Safely finds a company by ID with retry logic for prepared statement errors
 */
export async function findCompanyById(id: string, includeEmployees = true) {
  return executePrismaWithRetry(async () => {
    return prisma.company.findUnique({
      where: { id },
      include: includeEmployees ? {
        employees: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subrole: true,
            coins: true,
          }
        }
      } : undefined
    });
  });
}

/**
 * Safely finds a user by ID with retry logic for prepared statement errors
 */
export async function findUserById(id: string) {
  return executePrismaWithRetry(async () => {
    return prisma.user.findUnique({
      where: { id }
    });
  });
}

/**
 * Safely finds users with specific criteria and retry logic for prepared statement errors
 */
export async function findUsers(criteria: any, select?: any) {
  return executePrismaWithRetry(async () => {
    return prisma.user.findMany({
      where: criteria,
      ...(select ? { select } : {})
    });
  });
}

/**
 * Safely finds first user with specific criteria and retry logic for prepared statement errors
 */
export async function findFirstUser(criteria: any, select?: any) {
  return executePrismaWithRetry(async () => {
    return prisma.user.findFirst({
      where: criteria,
      ...(select ? { select } : {})
    });
  });
}

export default {
  executePrismaWithRetry,
  findCompanyById,
  findUserById,
  findUsers,
  findFirstUser
}; 