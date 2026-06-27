import { User, UserProfile, CyclePlan, CycleType } from '../types';
import { getItem, setItem, STORAGE_KEYS } from './storage';
import { supabase } from '../lib/supabase';
import { createPlan, getPlan, DayKey } from './planService';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ==================== Supabase Auth ====================

interface ProfileRow {
  id: string;
  nickname: string | null;
  gender: string | null;
  height: number | null;
  current_weight: number | null;
  target_weight: number | null;
  activity_level: string | null;
  updated_at: string | null;
}

async function upsertProfile(userId: string, nickname: string): Promise<void> {
  const row: ProfileRow = {
    id: userId,
    nickname,
    gender: null,
    height: null,
    current_weight: null,
    target_weight: null,
    activity_level: null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('[upsertProfile] 写入 profiles 失败:', error);
    throw new Error(`写入用户资料失败：${error.message}`);
  }
}

async function ensureProfile(userId: string, nickname: string): Promise<void> {
  const { data, error: selectError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (selectError) {
    console.error('[ensureProfile] 查询 profiles 失败:', selectError);
    throw new Error(`查询用户资料失败：${selectError.message}`);
  }

  if (!data) {
    await upsertProfile(userId, nickname);
  }
}

export async function register(email: string, password: string, nickname: string): Promise<User> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  });
  if (error) {
    console.error('[register] signUp error:', error);
    throw new Error(error.message);
  }
  const authUser = data.user;
  if (!authUser) {
    console.error('[register] signUp returned no user', data);
    throw new Error('注册失败，请重试');
  }

  console.log('[register] signUp success, user id:', authUser.id, 'session:', data.session ? '有' : '无');

  // 如果注册后直接拿到 session（邮箱验证关闭场景），立即写入 profile
  // 如果 session 为空（邮箱验证开启场景），跳过写入，由 login 成功后兜底创建
  if (data.session) {
    try {
      await upsertProfile(authUser.id, nickname);
      console.log('[register] profile upserted');
    } catch (err) {
      console.error('[register] profile upsert failed:', err);
      throw err;
    }
  } else {
    console.log('[register] session 为空，跳过 profile 写入，将在 login 后补写');
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
    console.error('[login] signIn error:', error);
    throw new Error(error.message);
  }
  const authUser = data.user;
  if (!authUser) {
    throw new Error('登录失败，请重试');
  }

  const nickname = (authUser.user_metadata?.nickname as string) ?? '';

  // 登录成功后兜底：如果 profiles 不存在则自动创建
  try {
    await ensureProfile(authUser.id, nickname);
    console.log('[login] profile ensured');
  } catch (err) {
    console.error('[login] ensure profile failed:', err);
    throw err;
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', authUser.id)
    .maybeSingle();

  return {
    id: authUser.id,
    email: authUser.email ?? email,
    nickname: profileData?.nickname ?? nickname,
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
    .maybeSingle();

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    nickname: profileData?.nickname ?? (authUser.user_metadata?.nickname as string) ?? '',
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
export async function updateCurrentWeightAndRecalcTargets(
  userId: string,
  currentWeight: number
): Promise<{ profile: UserProfile; plan: CyclePlan }> {
  const profile = getProfile(userId);
  if (!profile) {
    throw new Error('用户档案不存在');
  }

  const updatedProfile: UserProfile = {
    ...profile,
    currentWeight,
    updatedAt: new Date().toISOString(),
  };

  saveProfile(updatedProfile);
  const plan = await getPlan(userId, updatedProfile);

  return { profile: updatedProfile, plan };
}

// ==================== Onboarding 初始化 ====================

export interface OnboardingInput {
  gender: 'male' | 'female';
  age: number;
  height: number;
  currentWeight: number;
  targetWeight: number;
  activityLevel: 'sedentary' | 'lightly_active' | 'moderately_active' | 'highly_active';
}

export async function setupUserOnboarding(
  userId: string,
  input: OnboardingInput,
  dayOverrides?: Partial<Record<DayKey, CycleType>>
): Promise<{ profile: UserProfile; plan: CyclePlan }> {
  const profile: UserProfile = {
    id: generateId('profile'),
    userId,
    ...input,
    updatedAt: new Date().toISOString(),
  };

  saveProfile(profile);
  const plan = await createPlan(userId, profile, dayOverrides);

  return { profile, plan };
}
