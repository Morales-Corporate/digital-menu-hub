import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type UserRole = 'admin' | 'user' | 'mesero' | 'cocina';

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_CHECK_INTERVAL_MS = 60 * 1000; // check every minute
const SESSION_LOGIN_TS_KEY = 'session_login_ts';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole | null;
  isAdmin: boolean;
  isMesero: boolean;
  isCocina: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const expirationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (data && data.length > 0) {
      const roles = data.map(r => r.role as UserRole);
      if (roles.includes('admin')) setRole('admin');
      else if (roles.includes('mesero')) setRole('mesero');
      else if (roles.includes('cocina')) setRole('cocina');
      else setRole('user');
    } else {
      setRole('user');
    }
  };

  const forceLogout = useCallback(async () => {
    localStorage.removeItem(SESSION_LOGIN_TS_KEY);
    await supabase.auth.signOut({ scope: 'local' });
    setSession(null);
    setUser(null);
    setRole(null);
    toast.info('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
    window.location.href = '/auth';
  }, []);

  const isSessionExpired = useCallback(() => {
    const loginTs = localStorage.getItem(SESSION_LOGIN_TS_KEY);
    if (!loginTs) return false;
    return Date.now() - parseInt(loginTs, 10) > SESSION_MAX_AGE_MS;
  }, []);

  const startExpirationCheck = useCallback(() => {
    if (expirationTimerRef.current) clearInterval(expirationTimerRef.current);
    expirationTimerRef.current = setInterval(() => {
      if (isSessionExpired()) {
        forceLogout();
      }
    }, SESSION_CHECK_INTERVAL_MS);
  }, [isSessionExpired, forceLogout]);

  const stopExpirationCheck = useCallback(() => {
    if (expirationTimerRef.current) {
      clearInterval(expirationTimerRef.current);
      expirationTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN') {
          localStorage.setItem(SESSION_LOGIN_TS_KEY, Date.now().toString());
          startExpirationCheck();
        }

        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setRole(null);
          stopExpirationCheck();
          localStorage.removeItem(SESSION_LOGIN_TS_KEY);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
        // If no login timestamp, set it now (existing session)
        if (!localStorage.getItem(SESSION_LOGIN_TS_KEY)) {
          localStorage.setItem(SESSION_LOGIN_TS_KEY, Date.now().toString());
        }
        // Check immediately if expired
        if (isSessionExpired()) {
          forceLogout();
        } else {
          startExpirationCheck();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      stopExpirationCheck();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName }
      }
    });
    return { error };
  };

  const signOut = async () => {
    localStorage.removeItem(SESSION_LOGIN_TS_KEY);
    stopExpirationCheck();
    await supabase.auth.signOut({ scope: 'local' });
    setSession(null);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      role,
      isAdmin: role === 'admin',
      isMesero: role === 'mesero',
      isCocina: role === 'cocina',
      signIn,
      signUp,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}