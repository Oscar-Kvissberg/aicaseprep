import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { supabaseServer } from '@/lib/supabase-server'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        try {
          // Check if user exists in Supabase
          const { data: existingUser, error: queryError } = await supabaseServer
            .from('users')
            .select()
            .eq('email', user.email)
            .single();

          if (queryError && queryError.code !== 'PGRST116') {
            console.error('Error checking existing user:', queryError);
            return false;
          }

          if (!existingUser) {
            // Create new user in Supabase
            const { error: insertError } = await supabaseServer
              .from('users')
              .insert({
                email: user.email,
                name: user.name,
                created_at: new Date().toISOString(),
              });

            if (insertError) {
              console.error('Error creating user:', insertError);
              return false;
            }
          }
        } catch (error) {
          console.error('Unexpected error during sign in:', error);
          return false;
        }
      }
      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        try {
          const { data: userData, error: userError } = await supabaseServer
            .from('users')
            .select('*')
            .eq('email', session.user.email)
            .single();

          if (userError) {
            console.error('Error fetching user data:', userError);
            return session;
          }

          if (userData) {
            session.user.id = userData.id;
          }
        } catch (error) {
          console.error('Unexpected error during session:', error);
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  debug: true,
}; 