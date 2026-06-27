import { supabase } from '../lib/supabase';
import { CyclePlan, CycleType, CycleTarget, UserProfile } from '../types';
import { calculateCycleTargets } from '../utils/calculator';

export type DayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

interface CyclePlanRow {
  id: string;
  user_id: string;
  monday_type: CycleType;
  tuesday_type: CycleType;
  wednesday_type: CycleType;
  thursday_type: CycleType;
  friday_type: CycleType;
  saturday_type: CycleType;
  sunday_type: CycleType;
  created_at: string;
  updated_at: string;
}

const DAY_KEYS: DayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const DEFAULT_DAY_TYPE: CycleType = 'low';

function toCyclePlan(row: CyclePlanRow, profile: UserProfile): CyclePlan {
  const calc = calculateCycleTargets(profile);
  return {
    id: row.id,
    userId: row.user_id,
    monday: row.monday_type,
    tuesday: row.tuesday_type,
    wednesday: row.wednesday_type,
    thursday: row.thursday_type,
    friday: row.friday_type,
    saturday: row.saturday_type,
    sunday: row.sunday_type,
    targets: calc.cycleTargets,
    updatedAt: row.updated_at,
  };
}

function buildRow(
  userId: string,
  overrides?: Partial<Record<DayKey, CycleType>>
): Record<string, unknown> {
  const row: Record<string, unknown> = { user_id: userId };
  DAY_KEYS.forEach((day) => {
    row[`${day}_type`] = overrides?.[day] ?? DEFAULT_DAY_TYPE;
  });
  return row;
}

/** 查询当前用户的 cycle_plan；不存在时自动创建默认配置 */
export async function getPlan(userId: string, profile: UserProfile): Promise<CyclePlan> {
  const { data, error } = await supabase
    .from('cycle_plans')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[planService] getPlan query error:', error);
    throw new Error(`查询碳循环计划失败：${error.message}`);
  }

  if (data) {
    return toCyclePlan(data as CyclePlanRow, profile);
  }

  // 没有记录则创建默认配置
  const { data: inserted, error: insertError } = await supabase
    .from('cycle_plans')
    .insert(buildRow(userId))
    .select()
    .maybeSingle();

  if (insertError) {
    console.error('[planService] getPlan create default error:', insertError);
    throw new Error(`创建默认碳循环计划失败：${insertError.message}`);
  }

  return toCyclePlan(inserted as CyclePlanRow, profile);
}

/** 创建一条新的 cycle_plan */
export async function createPlan(
  userId: string,
  profile: UserProfile,
  dayOverrides?: Partial<Record<DayKey, CycleType>>
): Promise<CyclePlan> {
  const { data, error } = await supabase
    .from('cycle_plans')
    .insert(buildRow(userId, dayOverrides))
    .select()
    .maybeSingle();

  if (error || !data) {
    console.error('[planService] createPlan error:', error);
    throw new Error(`创建碳循环计划失败：${error?.message ?? 'no data'}`);
  }

  return toCyclePlan(data as CyclePlanRow, profile);
}

/** 更新某一天的高/中/低碳类型 */
export async function updatePlanDay(
  userId: string,
  profile: UserProfile,
  day: DayKey,
  cycleType: CycleType
): Promise<CyclePlan> {
  const { data: existing, error: selectError } = await supabase
    .from('cycle_plans')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (selectError) {
    console.error('[planService] updatePlanDay query error:', selectError);
    throw new Error(`查询碳循环计划失败：${selectError.message}`);
  }

  if (!existing) {
    return createPlan(userId, profile, { [day]: cycleType });
  }

  const { data, error } = await supabase
    .from('cycle_plans')
    .update({
      [`${day}_type`]: cycleType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select()
    .maybeSingle();

  if (error || !data) {
    console.error('[planService] updatePlanDay update error:', error);
    throw new Error(`更新碳循环计划失败：${error?.message ?? 'no data'}`);
  }

  return toCyclePlan(data as CyclePlanRow, profile);
}

/** cycle_plans 表不存储 targets，targets 根据 profile 实时计算 */
export async function updatePlanTargets(
  userId: string,
  profile: UserProfile,
  _targets: Record<CycleType, CycleTarget>
): Promise<CyclePlan> {
  return getPlan(userId, profile);
}
