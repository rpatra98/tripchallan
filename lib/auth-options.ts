import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcrypt";
import prisma from "./prisma";
import prismaHelper from "./prisma-helper";
import { UserRole, EmployeeSubrole, ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "./activity-logger";
import { detectDevice } from "./utils";

// Special fallback handler for the first superadmin login
async function createInitialSuperAdmin() {
  try {
    // Reset the Prisma connection before doing anything
    await prismaHelper.resetConnection();
    
    // Wait a bit to ensure connection is ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Create a new client for this operation specifically
    const { PrismaClient } = require('@prisma/client');
    const isolatedClient = new PrismaClient();
    
    try {
      // Check if any SuperAdmin exists
      const superAdminCount = await isolatedClient.user.count({
        where: { role: UserRole.SUPERADMIN },
      });
      
      if (superAdminCount === 0) {
        console.log("No SuperAdmin found, creating one with isolated client");
        // Create the SuperAdmin user with bcrypt
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('superadmin123', 12);
        
        const newSuperAdmin = await isolatedClient.user.create({
          data: {
            name: 'Super Admin',
            email: 'superadmin@cbums.com',
            password: hashedPassword,
            role: UserRole.SUPERADMIN,
            coins: 1000000,
          },
        });
        
        console.log("Created SuperAdmin:", newSuperAdmin.id);
        return {
          id: newSuperAdmin.id,
          email: newSuperAdmin.email,
          name: newSuperAdmin.name,
          role: UserRole.SUPERADMIN,
          subrole: null,
          companyId: null,
          coins: 1000000,
        };
      }
      
      // If we have a superadmin but couldn't find it with main client
      const superAdmin = await isolatedClient.user.findUnique({
        where: { email: 'superadmin@cbums.com' }
      });
      
      if (superAdmin) {
        return {
          id: superAdmin.id,
          email: superAdmin.email,
          name: superAdmin.name,
          role: UserRole.SUPERADMIN,
          subrole: null,
          companyId: null,
          coins: superAdmin.coins || 1000000,
        };
      }
      
      return null;
    } finally {
      // Always disconnect the isolated client
      await isolatedClient.$disconnect();
    }
  } catch (error) {
    console.error("Error creating initial superadmin:", error);
    return null;
  }
}

// Hardcoded SuperAdmin fallback - use when database is completely unreachable
const HARDCODED_SUPERADMIN = {
  id: "00000000-0000-0000-0000-000000000000",
  name: "Emergency Super Admin",
  email: "superadmin@cbums.com",
  role: UserRole.SUPERADMIN,
  subrole: null,
  companyId: null,
  coins: 1000000,
};

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          console.log("Missing credentials");
          return null;
        }

        try {
          console.log(`Attempting login for email: ${credentials.email}`);
          
          // Special handling for SuperAdmin
          if (credentials.email === "superadmin@cbums.com" && credentials.password === "superadmin123") {
            console.log("SuperAdmin login with default credentials detected");
            
            // Try all methods to authenticate SuperAdmin
            try {
              // Try with our enhanced prisma helper first
              const superAdmin = await prismaHelper.executePrismaWithRetry(async () => {
                return prisma.user.findUnique({
                  where: { email: credentials.email },
                });
              });
              
              if (superAdmin) {
                console.log("SuperAdmin found using prismaHelper");
                return {
                  id: superAdmin.id,
                  email: superAdmin.email,
                  name: superAdmin.name,
                  role: UserRole.SUPERADMIN,
                  subrole: null,
                  companyId: null,
                  coins: superAdmin.coins || 1000000,
                };
              }
              
              console.log("SuperAdmin not found with prismaHelper, trying isolated client...");
              const fallbackSuperAdmin = await createInitialSuperAdmin();
              
              if (fallbackSuperAdmin) {
                console.log("SuperAdmin found/created with isolated client");
                return fallbackSuperAdmin;
              }
              
              // Last resort - use hardcoded superadmin
              console.log("Using emergency hardcoded SuperAdmin credentials");
              return HARDCODED_SUPERADMIN;
            } catch (superAdminError) {
              console.error("All SuperAdmin authentication methods failed:", superAdminError);
              
              // Last resort - use hardcoded superadmin
              console.log("Using emergency hardcoded SuperAdmin credentials after errors");
              return HARDCODED_SUPERADMIN;
            }
          }
          
          // Reset connection before regular authentication
          await prismaHelper.resetConnection();

          // Normal authentication flow for all users
          const user = await prismaHelper.executePrismaWithRetry(async () => {
            return prisma.user.findUnique({
              where: {
                email: credentials.email,
              },
              include: {
                company: true, // Include company data
                operatorPermissions: true,
              }
            });
          });

          if (!user) {
            console.log(`No user found for email: ${credentials.email}`);
            return null;
          }

          // If user is a COMPANY, check if it's active
          if (user.role === UserRole.COMPANY && user.company && !user.company.isActive) {
            throw new Error("The Company you are accessing is deactivated by your Admin. Contact Admin for reactivation.");
          }

          // If user belongs to a company, verify the company's active status
          if (user.companyId && user.company && !user.company.isActive) {
            throw new Error("The Company you are accessing is deactivated by your Admin. Contact Admin for reactivation.");
          }

          // Verify password
          const passwordsMatch = await compare(credentials.password, user.password);

          if (!passwordsMatch) {
            console.log(`Password mismatch for email: ${credentials.email}`);
            return null;
          }

          console.log(`Successful login for: ${credentials.email}`);
          
          const userAgent = req?.headers?.["user-agent"] || "unknown";
          const deviceInfo = detectDevice(userAgent);

          // Log successful login
          try {
            await addActivityLog({
              userId: user.id,
              action: ActivityAction.LOGIN,
              details: {
                method: "credentials",
                device: deviceInfo,
                deviceDetails: deviceInfo
              },
              ipAddress: req?.headers?.["x-forwarded-for"]?.toString() || "unknown",
              userAgent: userAgent
            });
          } catch (logError) {
            console.error("Failed to log activity:", logError);
            // Don't block login if logging fails
          }

          // Safely prepare the user object 
          const safeUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role as unknown as UserRole,
            subrole: user.subrole as unknown as EmployeeSubrole | null,
            companyId: user.companyId,
            coins: user.coins,
          };

          return safeUser;
        } catch (error) {
          console.error("Authentication error:", error);
          
          // If this is a prepared statement error, try to reset the connection
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('prepared statement') || errorMessage.includes('42P05')) {
            try {
              await prismaHelper.resetConnection();
            } catch (resetError) {
              console.error("Failed to reset connection during auth:", resetError);
            }
          }
          
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.subrole = user.subrole;
        token.companyId = user.companyId;
        token.coins = user.coins;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.subrole = token.subrole as EmployeeSubrole | null;
        session.user.companyId = token.companyId as string | null;
        session.user.coins = token.coins as number;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/?error=AuthError", 
    signOut: "/api/auth/logout"
  },
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
}; 