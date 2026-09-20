import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { db } from '@/services/db';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  verifySession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);
  const wasLoggedInRef = useRef(false);

  const checkAdminRole = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await db
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error('Error in checkAdminRole:', err);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = db.auth.onAuthStateChange(
      (event: string, session: any) => {
        if (!isMounted) return;

        if (event === 'INITIAL_SESSION') return;
        if (event === 'SIGNED_OUT') return;

        if (event === 'SIGNED_IN' && session?.user) {
          wasLoggedInRef.current = true;
          if (currentUserIdRef.current !== session.user.id) {
            currentUserIdRef.current = session.user.id;
            sessionRef.current = session;
            setUser(session.user);
            checkAdminRole(session.user.id).then(result => {
              if (isMounted) setIsAdmin(result);
            });
          } else {
            sessionRef.current = session;
          }
        }
      }
    );

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await db.auth.getSession();

        if (!isMounted) return;

        sessionRef.current = session ?? null;
        setUser(session?.user ?? null);
        currentUserIdRef.current = session?.user?.id ?? null;

        if (session?.user) {
          wasLoggedInRef.current = true;
          const adminResult = await checkAdminRole(session.user.id);
          if (isMounted) setIsAdmin(adminResult);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error, data } = await db.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data?.user) {
      const { data: status } = await db.rpc('get_my_account_status');
      const row = Array.isArray(status) ? status[0] : status;

      if (row?.is_banned) {
        await db.auth.signOut();
        currentUserIdRef.current = null;
        sessionRef.current = null;
        setUser(null);
        setIsAdmin(false);
        return { error: new Error('Din konto er midlertidigt spærret. Kontakt en administrator for at blive låst op igen.') };
      }
    }

    return { error };
  }, []);

  const signOut = useCallback(async () => {
    currentUserIdRef.current = null;
    sessionRef.current = null;
    wasLoggedInRef.current = false;
    setUser(null);
    setIsAdmin(false);

    try {
      await db.auth.signOut();
    } catch (err) {
      console.error('Error during signOut:', err);
    }
  }, []);

  const verifySession = useCallback(async (): Promise<boolean> => {
    const { data: { session } } = await db.auth.getSession();
    if (session) return true;

    currentUserIdRef.current = null;
    sessionRef.current = null;
    setUser(null);
    setIsAdmin(false);
    return false;
  }, []);

  const contextValue = useMemo(() => ({
    user,
    session: sessionRef.current,
    loading,
    isAdmin,
    signIn,
    signOut,
    verifySession,
  }), [user, loading, isAdmin, signIn, signOut, verifySession]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
