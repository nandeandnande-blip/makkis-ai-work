import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, UserProfile, CyclePlan } from '../types';
import {
  getCurrentUser,
  login as loginService,
  register as registerService,
  logout as logoutService,
  getProfile,
} from '../services/authService';
import { getPlan } from '../services/planService';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  plan: CyclePlan | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<CyclePlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserData = async (currentUser: User | null) => {
    setUser(currentUser);
    if (currentUser) {
      const currentProfile = getProfile(currentUser.id);
      setProfile(currentProfile);
      if (currentProfile) {
        try {
          const currentPlan = await getPlan(currentUser.id, currentProfile);
          setPlan(currentPlan);
        } catch (err) {
          console.error('[AuthContext] load plan error:', err);
          setPlan(null);
        }
      } else {
        setPlan(null);
      }
    } else {
      setProfile(null);
      setPlan(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const currentUser = await getCurrentUser();
      if (!cancelled) {
        await loadUserData(currentUser);
        setIsLoading(false);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const loggedInUser = await loginService(email, password);
    await loadUserData(loggedInUser);
  };

  const register = async (email: string, password: string, nickname: string) => {
    const newUser = await registerService(email, password, nickname);
    setUser(newUser);
    setProfile(null);
    setPlan(null);
  };

  const logout = async () => {
    await logoutService();
    await loadUserData(null);
  };

  const refreshProfile = async () => {
    if (user) {
      const currentProfile = getProfile(user.id);
      setProfile(currentProfile);
      if (currentProfile) {
        try {
          const currentPlan = await getPlan(user.id, currentProfile);
          setPlan(currentPlan);
        } catch (err) {
          console.error('[AuthContext] refresh plan error:', err);
          setPlan(null);
        }
      } else {
        setPlan(null);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, plan, isLoading, login, register, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
