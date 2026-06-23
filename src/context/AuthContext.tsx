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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
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
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error && error.code === 'PGRST116') {
        // Profile not found, let's try to create one based on auth user data via API
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const API_URL = import.meta.env.VITE_APP_URL || '';
          try {
            const res = await fetch(`${API_URL}/api/profile`, {
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
            if (res.ok) {
              const resData = await res.json();
              if (resData.success && resData.profile) {
                setProfile(resData.profile);
                setLoading(false);
                return;
              }
            }
          } catch(apiError) {
             console.error("Failed to auto-create profile via API.", apiError);
          }
        }
      }
      
      if (data) setProfile(data as Profile);
    } catch (e) {
      console.error(e);
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
