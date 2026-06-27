import { User, UserProfile, CyclePlan, CycleType } from '../types';
import { getItem, setItem, STORAGE_KEYS } from './storage';
import { calculateCycleTargets } from '../utils/calculator';
import { supabase } from '../lib/supabase';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ==================== Supabase Auth ====================

export async function register(email: string, password: string, nickname: string): Promise<User> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw new Error(error.message);
  }
  const authUser = data.user;
  if (!authUser) {
    throw new Error('注册失败，请重试');
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: authUser.id,
    nickname,
    gender: null,
    height: null,
    current_weight: null,
    target_weight: null,
    activity_level: null,
    updated_at: new Date().toISOString(),
  });
  if (profileError) {
    throw new Error(profileError.message);
  }

  return {
    id: authUser.id,
    email: authUser.email ?? email,
    nickname,
    createdAt: authUser.created_at ?? new Date().toISOString(),
  };
}

export async function login(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message);
  }
  const authUser = data.user;
  if (!authUser) {
    throw new Error('登录失败，请重试');
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', authUser.id)
    .single();

  return {
    id: authUser.id,
    email: authUser.email ?? email,
    nickname: profileData?.nickname ?? authUser.user_metadata?.nickname ?? '',
    createdAt: authUser.created_at ?? new Date().toISOString(),
  };
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  const authUser = data.user;

  const { data: profileData } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', authUser.id)
    .single();

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    nickname: profileData?.nickname ?? authUser.user_metadata?.nickname ?? '',
    createdAt: authUser.created_at ?? new Date().toISOString(),
  };
}

// ==================== 用户档案与碳循环计划 ====================

export function getProfiles(): Record<string, UserProfile> {
  return getItem<Record<string, UserProfile>>(STORAGE_KEYS.PROFILES, {});
}

export function getProfile(userId: string): UserProfile | null {
  return getProfiles()[userId] ?? null;
}

export function saveProfile(profile: UserProfile): void {
  const profiles = getProfiles();
  profiles[profile.userId] = profile;
  setItem(STORAGE_KEYS.PROFILES, profiles);
}

export function getPlans(): Record<string, CyclePlan> {
  return getItem<Record<string, CyclePlan>>(STORAGE_KEYS.PLANS, {});
}

export function getPlan(userId: string): CyclePlan | null {
  return getPlans()[userId] ?? null;
}

export function savePlan(plan: CyclePlan): void {
  const plans = getPlans();
  plans[plan.userId] = plan;
  setItem(STORAGE_KEYS.PLANS, plans);
}

export type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** 更新碳循环计划中的某一天 */
export function updatePlanDay(
  userId: string,
  day: DayKey,
  cycleType: CycleType
): CyclePlan {
  const plan = getPlan(userId);
  if (!plan) {
    throw new Error('碳循环计划不存在');
  }
  const updated = { ...plan, [day]: cycleType, updatedAt: new Date().toISOString() };
  savePlan(updated);
  return updated;
}

/** 更新碳循环计划目标 */
export function updatePlanTargets(
  userId: string,
  targets: CyclePlan['targets']
): CyclePlan {
  const plan = getPlan(userId);
  if (!plan) {
    throw new Error('碳循环计划不存在');
  }
  const updated = { ...plan, targets, updatedAt: new Date().toISOString() };
  savePlan(updated);
  return updated;
}

/** 更新用户目标体重 */
export function updateTargetWeight(userId: string, targetWeight: number): UserProfile {
  const profile = getProfile(userId);
  if (!profile) {
    throw new Error('用户档案不存在');
  }
  const updated = { ...profile, targetWeight, updatedAt: new Date().toISOString() };
  saveProfile(updated);
  return updated;
}

export interface UpdateProfileInput {
  gender?: 'male' | 'female';
  age?: number;
  height?: number;
  currentWeight?: number;
  targetWeight?: number;
  activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'highly_active';
}

/** 更新用户档案 */
export function updateProfile(userId: string, input: UpdateProfileInput): UserProfile {
  const profile = getProfile(userId);
  if (!profile) {
    throw new Error('用户档案不存在');
  }
  const updated = {
    ...profile,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  saveProfile(updated);
  return updated;
}

/** 更新当前体重并按最新体重重新计算碳循环目标 */
export function updateCurrentWeightAndRecalcTargets(
  userId: string,
  currentWeight: number
): { profile: UserProfile; plan: CyclePlan } {
  const profile = getProfile(userId);
  if (!profile) {
    throw new Error('用户档案不存在');
  }
  const plan = getPlan(userId);
  if (!plan) {
    throw new Error('碳循环计划不存在');
  }

  const updatedProfile: UserProfile = {
    ...profile,
    currentWeight,
    updatedAt: new Date().toISOString(),
  };
  const calc = calculateCycleTargets(updatedProfile);
  const updatedPlan: CyclePlan = {
    ...plan,
    targets: calc.cycleTargets,
    updatedAt: new Date().toISOString(),
  };

  saveProfile(updatedProfile);
  savePlan(updatedPlan);

  return { profile: updatedProfile, plan: updatedPlan };
}

// ==================== Onboarding 初始化 ====================

const DEFAULT_CYCLE_PLAN: Record<DayKey, CycleType> = {
  monday: 'high',
  tuesday: 'medium',
  wednesday: 'low',
  thursday: 'high',
  friday: 'medium',
  saturday: 'low',
  sunday: 'medium',
};

export interface OnboardingInput {
  gender: 'male' | 'female';
  age: number;
  height: number;
  currentWeight: number;
  targetWeight: number;
  activityLevel: 'sedentary' | 'lightly_active' | 'moderately_active' | 'highly_active';
}

export function setupUserOnboarding(
  userId: string,
  input: OnboardingInput,
  dayOverrides?: Partial<Record<DayKey, CycleType>>
): { profile: UserProfile; plan: CyclePlan } {
  const profile: UserProfile = {
    id: generateId('profile'),
    userId,
    ...input,
    updatedAt: new Date().toISOString(),
  };

  const calc = calculateCycleTargets(profile);

  const plan: CyclePlan = {
    id: generateId('plan'),
    userId,
    monday: dayOverrides?.monday ?? DEFAULT_CYCLE_PLAN.monday,
    tuesday: dayOverrides?.tuesday ?? DEFAULT_CYCLE_PLAN.tuesday,
    wednesday: dayOverrides?.wednesday ?? DEFAULT_CYCLE_PLAN.wednesday,
    thursday: dayOverrides?.thursday ?? DEFAULT_CYCLE_PLAN.thursday,
    friday: dayOverrides?.friday ?? DEFAULT_CYCLE_PLAN.friday,
    saturday: dayOverrides?.saturday ?? DEFAULT_CYCLE_PLAN.saturday,
    sunday: dayOverrides?.sunday ?? DEFAULT_CYCLE_PLAN.sunday,
    targets: calc.cycleTargets,
    updatedAt: new Date().toISOString(),
  };

  saveProfile(profile);
  savePlan(plan);

  return { profile, plan };
}
