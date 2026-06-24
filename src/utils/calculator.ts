import {
  ActivityLevel,
  CalculationResult,
  CycleTarget,
  CycleType,
  Gender,
  UserProfile,
} from '../types';
import { ACTIVITY_MULTIPLIERS, CYCLE_STRATEGY, DEFICIT_CALORIES } from './constants';

/**
 * 使用 Mifflin-St Jeor 公式计算 BMR
 */
export function calculateBMR(
  gender: Gender,
  weight: number, // kg
  height: number, // cm
  age: number
): number {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(gender === 'male' ? base + 5 : base - 161);
}

/**
 * 计算 TDEE
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

/**
 * 根据用户档案计算碳循环目标
 *
 * 计算逻辑：
 * 1. BMR -> TDEE
 * 2. 减脂目标热量 = TDEE - 500
 * 3. 高碳日 = 减脂目标热量
 * 4. 中碳日 = 减脂目标热量 × 0.9
 * 5. 低碳日 = 减脂目标热量 × 0.75
 * 6. 蛋白质：按体重 × 各类型系数（g/kg）
 * 7. 脂肪：按体重 × 各类型系数（g/kg）
 * 8. 碳水 = （目标热量 - 蛋白质×4 - 脂肪×9） / 4
 */
export function calculateCycleTargets(profile: UserProfile): CalculationResult {
  const bmr = calculateBMR(profile.gender, profile.currentWeight, profile.height, profile.age);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const deficitCalories = Math.max(1200, tdee - DEFICIT_CALORIES); // 安全下限

  const cycleTargets = {} as Record<CycleType, CycleTarget>;

  (Object.keys(CYCLE_STRATEGY) as CycleType[]).forEach((type) => {
    const strategy = CYCLE_STRATEGY[type];
    const calories = Math.round(deficitCalories * strategy.calorieFactor);
    const protein = Math.round(profile.currentWeight * strategy.proteinFactor);
    const fat = Math.round(profile.currentWeight * strategy.fatFactor);
    const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

    cycleTargets[type] = {
      calories,
      protein,
      carbs: Math.max(0, carbs),
      fat,
    };
  });

  return {
    bmr,
    tdee,
    deficitCalories,
    cycleTargets,
  };
}

/**
 * 根据日期获取星期对应的碳循环类型
 */
export function getCycleTypeForDate(plan: {
  monday: CycleType;
  tuesday: CycleType;
  wednesday: CycleType;
  thursday: CycleType;
  friday: CycleType;
  saturday: CycleType;
  sunday: CycleType;
}, date: string): CycleType {
  const dayIndex = new Date(date).getDay(); // 0=周日, 1=周一...
  const map: CycleType[] = [
    plan.sunday,
    plan.monday,
    plan.tuesday,
    plan.wednesday,
    plan.thursday,
    plan.friday,
    plan.saturday,
  ];
  return map[dayIndex];
}

/**
 * 汇总营养摄入（Dashboard 使用）
 */
export function sumMacros(items: { calories: number; protein: number; carbs: number; fat: number }[]) {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
