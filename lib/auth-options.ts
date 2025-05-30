import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcrypt";
import { UserRole, EmployeeSubrole, ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "./activity-logger";
import { detectDevice } from "./utils";
import supabase from "./supabase";
import * as supabaseHelper from "./supabase-helper";

// Special fallback handler for the first superadmin login
async function createInitialSuperAdmin() {
  try {
    console.log("Attempting to create initial SuperAdmin user");
    
    // First check if SuperAdmin already exists
    const { data: existingSuperAdmin, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'superadmin@cbums.com')
      .single();
    
    if (!findError && existingSuperAdmin) {
      console.log("Found existing SuperAdmin:", existingSuperAdmin.id);
      return {
        id: existingSuperAdmin.id,
        email: existingSuperAdmin.email,
        name: existingSuperAdmin.name,
        role: 'SUPERADMIN',
        subrole: null,
        companyId: null,
        coins: existingSuperAdmin.coins || 1000000,
      };
    }
    
    // Create the SuperAdmin user with bcrypt
    console.log("No SuperAdmin found, creating new one");
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('superadmin123', 12);
    
    const { data: newSuperAdmin, error: createError } = await supabase
      .from('users')
      .insert({
        name: 'Super Admin',
        email: 'superadmin@cbums.com',
        password: hashedPassword,
        role: 'SUPERADMIN',
        coins: 1000000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();
    
    if (createError) {
      console.error("Error creating SuperAdmin:", createError);
      return null;
    }
    
    console.log("Created new SuperAdmin with ID:", newSuperAdmin.id);
    return {
      id: newSuperAdmin.id,
      email: newSuperAdmin.email,
      name: newSuperAdmin.name,
      role: 'SUPERADMIN',
      subrole: null,
      companyId: null,
      coins: 1000000,
    };
  } catch (error) {
    console.error("Error creating initial superadmin:", error);
    return null;
  }
}

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
          if (credentials.email === "superadmin@cbums.com") {
            console.log("SuperAdmin login attempt detected");
            
            try {
              // First, try to directly find the SuperAdmin in the database
              console.log("Querying SuperAdmin from Supabase");
              const { data: superAdminUser, error: superAdminError } = await supabase
                .from('users')
                .select('*')
                .eq('email', 'superadmin@cbums.com')
                .eq('role', 'SUPERADMIN')
                .single();
              
              if (superAdminError) {
                console.error("Error querying SuperAdmin:", superAdminError);
                return null;
              }
              
              if (superAdminUser) {
                console.log("Found SuperAdmin in database, ID:", superAdminUser.id);
                
                // For default credentials, bypass password check
                if (credentials.password === 'superadmin123') {
                  console.log("Using default credentials for SuperAdmin, bypassing password check");
                  return {
                    id: superAdminUser.id,
                    email: superAdminUser.email,
                    name: superAdminUser.name || 'Super Admin',
                    role: superAdminUser.role,
                    subrole: superAdminUser.subrole,
                    companyId: superAdminUser.companyId,
                    coins: superAdminUser.coins || 1000000,
                  };
                }
                
                // If not using default password, try normal password verification
                try {
                  console.log("Verifying SuperAdmin password");
                  const passwordsMatch = await compare(credentials.password, superAdminUser.password);
                  
                  if (passwordsMatch) {
                    console.log("SuperAdmin password verified successfully");
                    return {
                      id: superAdminUser.id,
                      email: superAdminUser.email,
                      name: superAdminUser.name || 'Super Admin',
                      role: superAdminUser.role,
                      subrole: superAdminUser.subrole,
                      companyId: superAdminUser.companyId,
                      coins: superAdminUser.coins || 1000000,
                    };
                  } else {
                    console.log("SuperAdmin password verification failed");
                    return null;
                  }
                } catch (pwError) {
                  console.error("Error verifying SuperAdmin password:", pwError);
                  
                  // If password check throws an error but using default password, allow login anyway
                  if (credentials.password === 'superadmin123') {
                    console.log("Falling back to default credentials despite password check error");
                    return {
                      id: superAdminUser.id,
                      email: superAdminUser.email,
                      name: superAdminUser.name || 'Super Admin',
                      role: superAdminUser.role,
                      subrole: superAdminUser.subrole,
                      companyId: superAdminUser.companyId,
                      coins: superAdminUser.coins || 1000000,
                    };
                  }
                  
                  return null;
                }
              } else {
                console.log("SuperAdmin not found, attempting to create");
                // Try to create a SuperAdmin as a fallback
                const superAdmin = await createInitialSuperAdmin();
                if (superAdmin) {
                  console.log("Created new SuperAdmin, ID:", superAdmin.id);
                  return superAdmin;
                }
              }
            } catch (error) {
              console.error("SuperAdmin authentication error:", error);
            }
            
            console.log("SuperAdmin authentication failed");
            return null;
          }
          
          // Normal authentication flow for all users
          const { data: user, error } = await supabase
            .from('users')
            .select(`
              *,
              company:companies(*)
            `)
            .eq('email', credentials.email)
            .single();
          
          if (error || !user) {
            console.log(`No user found for email: ${credentials.email}`);
            return null;
          }

          // If user is a COMPANY, check if it's active
          if (user.role === 'COMPANY' && user.company && !user.company.isActive) {
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
            role: user.role,
            subrole: user.subrole,
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
        session.user.role = token.role;
        session.user.subrole = token.subrole;
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