import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabaseClient as supabase } from '../api/supabaseClient'; 
import type { User as SupabaseUser, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { Loader } from '../components/ui/Loader'; 

interface AuthContextType {
  user: SupabaseUser | null;
  isLoading: boolean;
  updateUser: (user: SupabaseUser) => void;
  logout: () => Promise<void>; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  
  const [isAuthLoading, setIsAuthLoading] = useState(true); 
  const [isLoaderVisible, setIsLoaderVisible] = useState(true); 

  useEffect(() => {
    const checkUserOnLoad = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error("Erro ao verificar a sessão:", error);
      } finally {
        setIsLoaderVisible(false);
        setTimeout(() => {
          setIsAuthLoading(false);
        }, 400); 
      }
    };
    checkUserOnLoad();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const updateUser = useCallback((updatedUser: SupabaseUser) => {
    setUser(updatedUser);
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const value = { 
    user, 
    isLoading: isAuthLoading,
    updateUser, 
    logout 
  };
  
  return (
    <AuthContext.Provider value={value}>
      {isAuthLoading && <Loader fullScreen isVisible={isLoaderVisible} />}
      {!isAuthLoading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
