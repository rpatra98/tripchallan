import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcrypt";
import prisma from "./prisma";
import { UserRole, EmployeeSubrole, ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "./activity-logger";
import { detectDevice } from "./utils";

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
          
          // Check if this is the SuperAdmin hardcoded login
          if (credentials.email === "superadmin@cbums.com") {
            console.log("SuperAdmin login attempt detected");
            
            try {
              // Try to find the user normally first
              const superAdmin = await prisma.user.findUnique({
                where: { email: credentials.email },
              });
              
              // If user exists, verify password
              if (superAdmin) {
                console.log("SuperAdmin user found in database");
                const passwordsMatch = await compare(credentials.password, superAdmin.password);
                
                if (passwordsMatch) {
                  console.log("SuperAdmin password matched");
                  return {
                    id: superAdmin.id,
                    email: superAdmin.email,
                    name: superAdmin.name,
                    role: UserRole.SUPERADMIN,
                    subrole: null,
                    companyId: null,
                    coins: superAdmin.coins || 1000000,
                  };
                } else if (credentials.password === "superadmin123") {
                  // Fallback for known default password (only for SuperAdmin)
                  console.log("Using fallback SuperAdmin authentication");
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
              }
              
              // If this is the first login, we might need to create the user
              if (credentials.password === "superadmin123") {
                console.log("First SuperAdmin login - checking if we need to create user");
                // Check if any SuperAdmin exists
                const superAdminCount = await prisma.user.count({
                  where: { role: UserRole.SUPERADMIN },
                });
                
                if (superAdminCount === 0) {
                  console.log("No SuperAdmin found, creating one");
                  // Create the SuperAdmin user with bcrypt
                  const bcrypt = require('bcrypt');
                  const hashedPassword = await bcrypt.hash('superadmin123', 12);
                  
                  const newSuperAdmin = await prisma.user.create({
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
              }
            } catch (superAdminError) {
              console.error("Error during SuperAdmin authentication:", superAdminError);
              // Continue to normal flow - don't throw here
            }
          }

          // Normal authentication flow for all users
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            },
            include: {
              company: true, // Include company data
              operatorPermissions: true,
            }
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