import { ActivityLevel, CycleType, FoodCategory, MealType } from '../types';

/** 活动系数（Mifflin-St Jeor 常用乘数） */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  highly_active: 1.725,
};

/** 减脂热量赤字（kcal） */
export const DEFICIT_CALORIES = 500;

/** 碳循环类型默认营养比例与热量调整系数 */
export const CYCLE_STRATEGY: Record<
  CycleType,
  { calorieFactor: number; proteinFactor: number; fatFactor: number; label: string; color: string; tip: string }
> = {
  high: {
    calorieFactor: 1.0,
    proteinFactor: 2.0,
    fatFactor: 0.8,
    label: '高碳日',
    color: 'bg-emerald-500',
    tip: '建议安排腿部、背部等大肌群训练',
  },
  medium: {
    calorieFactor: 0.9,
    proteinFactor: 2.2,
    fatFactor: 0.9,
    label: '中碳日',
    color: 'bg-amber-500',
    tip: '建议安排胸、肩、手臂等训练',
  },
  low: {
    calorieFactor: 0.75,
    proteinFactor: 2.4,
    fatFactor: 1.0,
    label: '低碳日',
    color: 'bg-rose-500',
    tip: '建议作为休息日或低强度有氧日',
  },
};

/** 星期映射 */
export const WEEK_DAYS = [
  { key: 'sunday', label: '日' },
  { key: 'monday', label: '一' },
  { key: 'tuesday', label: '二' },
  { key: 'wednesday', label: '三' },
  { key: 'thursday', label: '四' },
  { key: 'friday', label: '五' },
  { key: 'saturday', label: '六' },
] as const;

/** 餐次配置 */
export const MEAL_CONFIG: Record<MealType, { label: string; order: number }> = {
  breakfast: { label: '早餐', order: 1 },
  lunch: { label: '午餐', order: 2 },
  dinner: { label: '晚餐', order: 3 },
  post_workout: { label: '练后餐', order: 4 },
};

/** 性别标签 */
export const GENDER_LABELS: Record<string, string> = {
  male: '男',
  female: '女',
};

/** 活动水平标签 */
export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: '久坐',
  lightly_active: '轻度活动',
  moderately_active: '中度活动',
  highly_active: '高活动',
};

/** 食物分类标签 */
export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  protein: '蛋白质',
  carb: '碳水',
  fat: '脂肪',
  vegetable: '蔬菜',
  fruit: '水果',
  dairy: '乳制品',
  other: '其他',
};

/** 食物分类颜色 */
export const FOOD_CATEGORY_COLORS: Record<FoodCategory, string> = {
  protein: 'bg-rose-100 text-rose-700',
  carb: 'bg-amber-100 text-amber-700',
  fat: 'bg-yellow-100 text-yellow-700',
  vegetable: 'bg-emerald-100 text-emerald-700',
  fruit: 'bg-orange-100 text-orange-700',
  dairy: 'bg-blue-100 text-blue-700',
  other: 'bg-slate-100 text-slate-700',
};
