import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcrypt";
import { UserRole, EmployeeSubrole, ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "./activity-logger";
import { detectDevice } from "./utils";
import supabase from "./supabase";
import * as supabaseHelper from "./supabase-helper";

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
            console.log("🔑 DIRECT SUPERADMIN LOGIN DETECTED");
            
            // First try to find SuperAdmin in database to get the ID
            const { data: existingSuperAdmin, error: findError } = await supabase
              .from('users')
              .select('*')
              .eq('email', 'superadmin@cbums.com')
              .single();
            
            // If found in database, use that ID
            if (!findError && existingSuperAdmin) {
              console.log("✅ Using existing SuperAdmin ID:", existingSuperAdmin.id);
              
              // CRITICAL: Bypass all normal auth flow for SuperAdmin
              return {
                id: existingSuperAdmin.id,
                email: "superadmin@cbums.com",
                name: "Super Admin",
                role: "SUPERADMIN",
                subrole: null,
                companyId: null,
                coins: 1000000,
              };
            } 
            
            // If not found in database, create a new one with default credentials
            console.log("⚠️ SuperAdmin not found, creating new one");
            try {
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
                console.error("❌ Failed to create SuperAdmin:", createError);
                
                // EMERGENCY FALLBACK: Hardcoded SuperAdmin ID
                // This ensures login works even if database operations fail
                console.log("🚨 Using emergency fallback SuperAdmin ID");
                return {
                  id: "3c439996-c6c5-4541-9c5c-20a41a542a68", // Hardcoded ID from your database
                  email: "superadmin@cbums.com",
                  name: "Super Admin",
                  role: "SUPERADMIN",
                  subrole: null,
                  companyId: null,
                  coins: 1000000,
                };
              }
              
              console.log("✅ Created new SuperAdmin with ID:", newSuperAdmin.id);
              return {
                id: newSuperAdmin.id,
                email: "superadmin@cbums.com",
                name: "Super Admin",
                role: "SUPERADMIN",
                subrole: null,
                companyId: null,
                coins: 1000000,
              };
            } catch (error) {
              console.error("❌ SuperAdmin creation error:", error);
              
              // EMERGENCY FALLBACK: Hardcoded SuperAdmin ID
              console.log("🚨 Using emergency fallback SuperAdmin ID after error");
              return {
                id: "3c439996-c6c5-4541-9c5c-20a41a542a68", // Hardcoded ID from your database
                email: "superadmin@cbums.com",
                name: "Super Admin",
                role: "SUPERADMIN",
                subrole: null,
                companyId: null,
                coins: 1000000,
              };
            }
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