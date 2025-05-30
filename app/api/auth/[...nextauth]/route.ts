import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { testSupabaseConnection } from "@/lib/supabase";

// Test Supabase connection on server initialization
testSupabaseConnection().then(success => {
  console.log('NextAuth API route - Supabase connection test:', success ? 'SUCCESS' : 'FAILED');
});

console.log('NextAuth route initializing with auth options:', {
  debug: authOptions.debug,
  providers: authOptions.providers.map(p => p.id),
  secret: authOptions.secret ? 'Set' : 'Not set',
  session: authOptions.session
});

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 