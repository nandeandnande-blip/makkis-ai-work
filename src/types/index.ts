/**
 * Carb Cycle Tracker - TypeScript Schema
 *
 * V1 使用 LocalStorage，本文件定义全部数据模型。
 */

// ==================== 枚举类型 ====================

/** 性别 */
export type Gender = 'male' | 'female';

/** 活动水平 */
export type ActivityLevel =
  | 'sedentary'      // 久坐
  | 'lightly_active' // 轻度活动
  | 'moderately_active' // 中度活动
  | 'highly_active'; // 高活动

/** 碳循环日类型 */
export type CycleType = 'high' | 'medium' | 'low';

/** 餐次 */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'post_workout';

/** 食物来源 */
export type FoodSource = 'system' | 'custom';

/** 食物分类 */
export type FoodCategory = 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'dairy' | 'other';

// ==================== 用户系统 ====================

export interface User {
  id: string;
  email: string;
  /** 本地存储使用简单哈希，V2 迁移到后端时替换；Supabase 阶段不再使用 */
  passwordHash?: string;
  nickname: string;
  createdAt: string;
}

// ==================== 用户档案 ====================

export interface UserProfile {
  id: string;
  userId: string;
  gender: Gender;
  age: number;
  height: number;        // cm
  currentWeight: number; // kg
  targetWeight: number;  // kg
  activityLevel: ActivityLevel;
  updatedAt: string;
}

// ==================== 碳循环计划 ====================

export interface CyclePlan {
  id: string;
  userId: string;
  /** 周一 ~ 周日对应的碳循环类型 */
  monday: CycleType;
  tuesday: CycleType;
  wednesday: CycleType;
  thursday: CycleType;
  friday: CycleType;
  saturday: CycleType;
  sunday: CycleType;
  /** 各类型日的营养目标配置 */
  targets: Record<CycleType, CycleTarget>;
  updatedAt: string;
}

/** 单日营养目标 */
export interface CycleTarget {
  calories: number;  // kcal
  protein: number;   // g
  carbs: number;     // g
  fat: number;       // g
}

// ==================== 食物库 ====================

export interface Food {
  id: string;
  /** 系统食物 userId 为空字符串 */
  userId: string;
  name: string;
  category: FoodCategory;
  /** 图片 URL，可为空 */
  image?: string;
  caloriesPer100g: number; // kcal
  proteinPer100g: number;  // g
  carbsPer100g: number;    // g
  fatPer100g: number;      // g
  source: FoodSource;
  /** 最近使用时间戳 */
  lastUsedAt?: number;
  /** 使用次数 */
  useCount?: number;
  createdAt: string;
}

// ==================== 体重记录 ====================

export interface WeightRecord {
  id: string;
  userId: string;
  /** 日期格式 YYYY-MM-DD */
  date: string;
  weight: number; // kg
  /** 备注，可选 */
  note?: string;
  createdAt: string;
}

// ==================== 每日饮食记录 ====================

export interface DailyRecord {
  id: string;
  userId: string;
  /** 日期格式 YYYY-MM-DD */
  date: string;
  /** 当日碳循环类型（允许用户临时修改单日计划） */
  cycleType: CycleType;
  meals: Meal[];
  /** 当日体重记录 ID，可选 */
  weightRecordId?: string;
}

export interface Meal {
  id: string;
  dailyRecordId: string;
  mealType: MealType;
  foods: MealFood[];
}

export interface MealFood {
  id: string;
  mealId: string;
  foodId?: string;
  /** 添加时保存的食物名称，用于展示（系统食物 food_id 可能为 null） */
  foodName?: string;
  /** 摄入克数 */
  weight: number;
  /** 基于 weight 自动计算 */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ==================== 计算引擎输出 ====================

export interface CalculationResult {
  bmr: number;         // 基础代谢率
  tdee: number;        // 每日总能量消耗
  deficitCalories: number; // 减脂目标热量（TDEE - 赤字）
  /** 高/中/低碳日目标 */
  cycleTargets: Record<CycleType, CycleTarget>;
}

// ==================== 应用级聚合数据（Dashboard / 报表使用）====================

export interface DailySummary {
  date: string;
  cycleType: CycleType;
  target: CycleTarget;
  intake: CycleTarget;
  remaining: CycleTarget;
  weight?: number;
}

export interface WeightReport {
  currentWeight: number;
  targetWeight: number;
  startWeight: number;
  totalLost: number;
  remaining: number;
  progressPercent: number; // 0 ~ 100
  weeklyChange: number;
  monthlyChange: number;
}
