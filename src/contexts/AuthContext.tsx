import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, UserProfile, CyclePlan } from '../types';
import {
  getCurrentUser,
  login as loginService,
  register as registerService,
  logout as logoutService,
  getProfile,
  getPlan,
} from '../services/authService';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  plan: CyclePlan | null;
  isLoading: boolean;
  login: (email: string, password: string) => void;
  register: (email: string, password: string, nickname: string) => void;
  logout: () => void;
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<CyclePlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserData = (currentUser: User | null) => {
    setUser(currentUser);
    if (currentUser) {
      setProfile(getProfile(currentUser.id));
      setPlan(getPlan(currentUser.id));
    } else {
      setProfile(null);
      setPlan(null);
    }
  };

  useEffect(() => {
    const currentUser = getCurrentUser();
    loadUserData(currentUser);
    setIsLoading(false);
  }, []);

  const login = (email: string, password: string) => {
    const loggedInUser = loginService(email, password);
    loadUserData(loggedInUser);
  };

  const register = (email: string, password: string, nickname: string) => {
    const newUser = registerService(email, password, nickname);
    setUser(newUser);
    setProfile(null);
    setPlan(null);
  };

  const logout = () => {
    logoutService();
    loadUserData(null);
  };

  const refreshProfile = () => {
    if (user) {
      setProfile(getProfile(user.id));
      setPlan(getPlan(user.id));
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
