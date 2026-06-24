import { User, UserProfile, CyclePlan, CycleType } from '../types';
import { getItem, setItem, removeItem, STORAGE_KEYS } from './storage';
import { calculateCycleTargets } from '../utils/calculator';

// ==================== 用户注册 / 登录 ====================

export function getUsers(): User[] {
  return getItem<User[]>(STORAGE_KEYS.USERS, []);
}

function saveUsers(users: User[]): void {
  setItem(STORAGE_KEYS.USERS, users);
}

function hashPassword(password: string): string {
  // V1 仅做简单字符串混淆，后续接入后端时替换为 bcrypt
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return String(hash);
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function register(email: string, password: string, nickname: string): User {
  const users = getUsers();
  if (users.some((u) => u.email === email)) {
    throw new Error('该邮箱已被注册');
  }

  const newUser: User = {
    id: generateId('user'),
    email,
    passwordHash: hashPassword(password),
    nickname,
    createdAt: new Date().toISOString(),
  };

  saveUsers([...users, newUser]);
  setItem(STORAGE_KEYS.CURRENT_USER, newUser);
  return newUser;
}

export function login(email: string, password: string): User {
  const users = getUsers();
  const user = users.find((u) => u.email === email && u.passwordHash === hashPassword(password));
  if (!user) {
    throw new Error('邮箱或密码错误');
  }
  setItem(STORAGE_KEYS.CURRENT_USER, user);
  return user;
}

export function logout(): void {
  removeItem(STORAGE_KEYS.CURRENT_USER);
}

export function getCurrentUser(): User | null {
  const user = getItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
  if (!user) return null;
  // 确保缓存的当前用户仍存在于用户列表中，防止数据被清理后仍显示登录
  const users = getUsers();
  return users.find((u) => u.id === user.id) ? user : null;
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
