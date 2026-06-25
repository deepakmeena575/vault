import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { Profile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Supabase session check failed:", err);
        setLoading(false);
      });

    // Listen for changes on auth state (logged in, signed out, etc.)
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    } catch (err) {
      console.error("Failed to register auth state change listener:", err);
      setLoading(false);
    }
  }, []);

  const fetchWithRetry = async (url: string, options?: RequestInit, retries = 3, delay = 1000): Promise<Response> => {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (retries > 0) {
        console.warn(`Fetch failed for ${url}. Retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 1.5);
      }
      throw err;
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const res = await fetchWithRetry(`/api/profile?id=${userId}`);
      
      if (res.ok) {
        const { profile } = await res.json();
        setProfile(profile);
        console.log("PROFILE_DATA", profile);
        console.log("PROFILE_ROLE", profile?.role);
      } else {
        try {
          // Profile not found, let's try to create one based on auth user data via API
          const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
          if (userError) {
            console.error("Supabase auth.getUser error during auto-profile creation:", userError);
          }
          if (authUser) {
            const createRes = await fetchWithRetry(`/api/profile`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: authUser.id,
                email: authUser.email,
                full_name: authUser.user_metadata?.full_name || '',
                mobile_number: authUser.user_metadata?.mobile_number || '',
                role: 'user'
              })
            });
            if (createRes.ok) {
              const resData = await createRes.json();
              if (resData.success && resData.profile) {
                setProfile(resData.profile);
                console.log("PROFILE_DATA", resData.profile);
                console.log("PROFILE_ROLE", resData.profile?.role);
                setLoading(false);
                return;
              }
            }
          }
        } catch (apiError) {
          console.error("Failed to auto-create profile via API.", apiError);
        }
      }
    } catch (e) {
      console.error("Failed to fetch profile:", e);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
