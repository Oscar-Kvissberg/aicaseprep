import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { supabaseServer } from '@/lib/supabase-server';

const ALLOWED_DOMAINS = ['liuformulastudent.se', 'gmail.com'];

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
        // Check if email domain is allowed
        const emailDomain = user.email.split('@')[1];
        if (!ALLOWED_DOMAINS.includes(emailDomain)) {
          console.error('Unauthorized domain:', emailDomain);
          return false;
        }

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
          // First check if there are any duplicate emails
          const { data: duplicateCheck, error: duplicateError } = await supabaseServer
            .from('users')
            .select('id')
            .eq('email', session.user.email);

          if (duplicateError) {
            console.error('Error checking for duplicate emails:', duplicateError);
            return session;
          }

          // If there are duplicates, keep only the first one and delete others
          if (duplicateCheck && duplicateCheck.length > 1) {
            const [keepId, ...duplicateIds] = duplicateCheck.map(user => user.id);
            
            // Delete duplicate entries
            const { error: deleteError } = await supabaseServer
              .from('users')
              .delete()
              .in('id', duplicateIds);

            if (deleteError) {
              console.error('Error deleting duplicate users:', deleteError);
            }

            // Set the user ID to the kept entry
            session.user.id = keepId;
          } else if (duplicateCheck && duplicateCheck.length === 1) {
            // If there's only one user, set their ID
            session.user.id = duplicateCheck[0].id;
          }
        } catch (error) {
          console.error('Unexpected error during session:', error);
        }
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
}; 