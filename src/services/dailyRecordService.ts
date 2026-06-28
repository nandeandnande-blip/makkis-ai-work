import { DailyRecord, Meal, MealFood, MealType, CycleType, Food } from '../types';
import { recordFoodUsage } from './foodService';
import { supabase } from '../lib/supabase';

interface DailyRecordRow {
  id: string;
  user_id: string;
  date: string;
  cycle_type: CycleType;
  created_at: string;
}

interface MealFoodRow {
  id: string;
  daily_record_id: string;
  meal_type: MealType;
  food_id: string;
  food_name: string;
  weight: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toMealFood(row: MealFoodRow): MealFood {
  return {
    id: row.id,
    mealId: row.daily_record_id,
    foodId: row.food_id ?? undefined,
    foodName: row.food_name ?? undefined,
    weight: row.weight,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
  };
}

function buildMeals(recordId: string, mealFoodRows: MealFoodRow[]): Meal[] {
  const grouped: Record<MealType, MealFood[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    post_workout: [],
  };

  mealFoodRows.forEach((row) => {
    grouped[row.meal_type].push(toMealFood(row));
  });

  return (Object.keys(grouped) as MealType[])
    .filter((mealType) => grouped[mealType].length > 0)
    .map((mealType) => ({
      id: `${recordId}_${mealType}`,
      dailyRecordId: recordId,
      mealType,
      foods: grouped[mealType],
    }));
}

function toDailyRecord(recordRow: DailyRecordRow, mealFoodRows: MealFoodRow[]): DailyRecord {
  return {
    id: recordRow.id,
    userId: recordRow.user_id,
    date: recordRow.date,
    cycleType: recordRow.cycle_type,
    meals: buildMeals(recordRow.id, mealFoodRows),
  };
}

async function fetchMealFoods(recordId: string): Promise<MealFoodRow[]> {
  const { data, error } = await supabase
    .from('meal_foods')
    .select('*')
    .eq('daily_record_id', recordId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[dailyRecordService] fetchMealFoods error:', error);
    return [];
  }

  return (data as MealFoodRow[] | null) ?? [];
}

// ==================== 前端缓存 ====================

const dailyRecordCache: Record<string, DailyRecord> = {};
const dailyRecordPromiseCache: Record<string, Promise<DailyRecord | null> | undefined> = {};
const dailyRecordCreatePromiseCache: Record<string, Promise<DailyRecord> | undefined> = {};

function getCacheKey(userId: string, date: string): string {
  return `${userId}_${date}`;
}

function getCachedRecord(userId: string, date: string): DailyRecord | undefined {
  return dailyRecordCache[getCacheKey(userId, date)];
}

function setCachedRecord(userId: string, date: string, record: DailyRecord | null): void {
  const key = getCacheKey(userId, date);
  if (record) {
    dailyRecordCache[key] = record;
  } else {
    delete dailyRecordCache[key];
  }
}

/** 手动清除缓存；不传参数则清除全部 */
export function invalidateDailyRecordCache(
  userId?: string,
  date?: string
): void {
  if (userId && date) {
    const key = getCacheKey(userId, date);
    delete dailyRecordCache[key];
    delete dailyRecordPromiseCache[key];
    delete dailyRecordCreatePromiseCache[key];
  } else {
    Object.keys(dailyRecordCache).forEach((key) => delete dailyRecordCache[key]);
    Object.keys(dailyRecordPromiseCache).forEach((key) => delete dailyRecordPromiseCache[key]);
    Object.keys(dailyRecordCreatePromiseCache).forEach((key) => delete dailyRecordCreatePromiseCache[key]);
  }
}

/** 获取某天的记录，不存在则返回 null */
export async function getDailyRecord(
  userId: string,
  date: string
): Promise<DailyRecord | null> {
  const cached = getCachedRecord(userId, date);
  if (cached) return cached;

  const key = getCacheKey(userId, date);
  const inFlight = dailyRecordPromiseCache[key];
  if (inFlight) return inFlight;

  const promise = (async (): Promise<DailyRecord | null> => {
    const { data, error } = await supabase
      .from('daily_records')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (error) {
      console.error('[dailyRecordService] getDailyRecord error:', error);
      return null;
    }

    if (!data) return null;

    const recordRow = data as DailyRecordRow;
    const mealFoodRows = await fetchMealFoods(recordRow.id);
    const record = toDailyRecord(recordRow, mealFoodRows);
    setCachedRecord(userId, date, record);
    return record;
  })();

  dailyRecordPromiseCache[key] = promise;
  try {
    return await promise;
  } finally {
    if (dailyRecordPromiseCache[key] === promise) {
      delete dailyRecordPromiseCache[key];
    }
  }
}

export interface CalendarDayData {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meals: Meal[];
}

/** 获取日期范围内的每日记录（包含 meal_foods），返回 date -> CalendarDayData 映射 */
export async function getDailyRecordsByDateRange(
  userId: string,
  start: string,
  end: string
): Promise<Record<string, CalendarDayData>> {
  console.log('[dailyRecordService] query range:', { userId, start, end });

  const { data, error } = await supabase
    .from('daily_records')
    .select('*')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end);

  if (error || !data) {
    console.error('[dailyRecordService] getDailyRecordsByDateRange error:', error);
    return {};
  }

  const recordRows = data as DailyRecordRow[];
  console.log('[dailyRecordService] daily_records count:', recordRows.length, recordRows.map((r) => r.date));

  if (recordRows.length === 0) return {};

  // 逐条查询 meal_foods：与 Dashboard 的 fetchMealFoods 保持一致，避免 RLS 对 .in 查询的限制
  const records = await Promise.all(
    recordRows.map(async (row) => {
      const mealFoodRows = await fetchMealFoods(row.id);
      return toDailyRecord(row, mealFoodRows);
    })
  );

  const map: Record<string, CalendarDayData> = {};
  records.forEach((record) => {
    const allFoods = record.meals.flatMap((m) => m.foods);
    const totals = allFoods.reduce(
      (acc, f) => ({
        calories: acc.calories + f.calories,
        protein: acc.protein + f.protein,
        carbs: acc.carbs + f.carbs,
        fat: acc.fat + f.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const dayData: CalendarDayData = {
      totalCalories: Math.round(totals.calories),
      totalProtein: Math.round(totals.protein),
      totalCarbs: Math.round(totals.carbs),
      totalFat: Math.round(totals.fat),
      meals: record.meals,
    };

    setCachedRecord(userId, record.date, record);
    map[record.date] = dayData;
  });

  console.log('[dailyRecordService] meal_foods total count:', records.reduce((sum, r) => sum + r.meals.flatMap((m) => m.foods).length, 0));
  console.log('[dailyRecordService] final calendarData:', map);

  return map;
}

/** 获取或创建某天的记录 */
export async function getOrCreateDailyRecord(
  userId: string,
  date: string,
  defaultCycleType: CycleType
): Promise<DailyRecord> {
  const cached = getCachedRecord(userId, date);
  if (cached) return cached;

  const key = getCacheKey(userId, date);
  const inFlight = dailyRecordCreatePromiseCache[key];
  if (inFlight) return inFlight;

  const promise = (async (): Promise<DailyRecord> => {
    const existing = await getDailyRecord(userId, date);
    if (existing) return existing;

    const { data, error } = await supabase
      .from('daily_records')
      .insert({
        user_id: userId,
        date,
        cycle_type: defaultCycleType,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[dailyRecordService] getOrCreateDailyRecord error:', error);
      throw new Error(error?.message ?? '创建每日记录失败');
    }

    const record = toDailyRecord(data as DailyRecordRow, []);
    setCachedRecord(userId, date, record);
    return record;
  })();

  dailyRecordCreatePromiseCache[key] = promise;
  try {
    return await promise;
  } finally {
    if (dailyRecordCreatePromiseCache[key] === promise) {
      delete dailyRecordCreatePromiseCache[key];
    }
  }
}

export interface AddFoodInput {
  food: Food;
  weight: number;
}

/** 向某天的某餐添加食物 */
export async function addFoodToMeal(
  userId: string,
  date: string,
  mealType: MealType,
  input: AddFoodInput,
  defaultCycleType: CycleType
): Promise<DailyRecord> {
  const record = await getOrCreateDailyRecord(userId, date, defaultCycleType);
  const { food, weight } = input;
  const ratio = weight / 100;

  const { error } = await supabase.from('meal_foods').insert({
    daily_record_id: record.id,
    meal_type: mealType,
    food_id: isUuid(food.id) ? food.id : null,
    food_name: food.name,
    weight,
    calories: Math.round(food.caloriesPer100g * ratio * 10) / 10,
    protein: Math.round(food.proteinPer100g * ratio * 10) / 10,
    carbs: Math.round(food.carbsPer100g * ratio * 10) / 10,
    fat: Math.round(food.fatPer100g * ratio * 10) / 10,
  });

  if (error) {
    console.error('[dailyRecordService] addFoodToMeal error:', error);
    throw new Error(error.message);
  }

  recordFoodUsage(food.id, weight);

  const mealFoodRows = await fetchMealFoods(record.id);
  const updated = toDailyRecord(
    {
      id: record.id,
      user_id: record.userId,
      date: record.date,
      cycle_type: record.cycleType,
      created_at: record.id,
    } as DailyRecordRow,
    mealFoodRows
  );
  setCachedRecord(userId, date, updated);
  return updated;
}

/** 从某餐中删除食物 */
export async function removeFoodFromMeal(
  userId: string,
  date: string,
  mealType: MealType,
  mealFoodId: string
): Promise<DailyRecord | null> {
  const record = await getDailyRecord(userId, date);
  if (!record) return null;

  const { error } = await supabase
    .from('meal_foods')
    .delete()
    .eq('id', mealFoodId)
    .eq('daily_record_id', record.id)
    .eq('meal_type', mealType);

  if (error) {
    console.error('[dailyRecordService] removeFoodFromMeal error:', error);
    throw new Error(error.message);
  }

  const mealFoodRows = await fetchMealFoods(record.id);
  const updated = toDailyRecord(
    {
      id: record.id,
      user_id: record.userId,
      date: record.date,
      cycle_type: record.cycleType,
      created_at: record.id,
    } as DailyRecordRow,
    mealFoodRows
  );
  setCachedRecord(userId, date, updated);
  return updated;
}

/** 更新某天记录的碳循环类型 */
export async function updateDailyCycleType(
  userId: string,
  date: string,
  cycleType: CycleType
): Promise<DailyRecord | null> {
  const record = await getDailyRecord(userId, date);
  if (!record) return null;

  const { error } = await supabase
    .from('daily_records')
    .update({ cycle_type: cycleType })
    .eq('id', record.id)
    .eq('user_id', userId);

  if (error) {
    console.error('[dailyRecordService] updateDailyCycleType error:', error);
    throw new Error(error.message);
  }

  const updated = { ...record, cycleType };
  setCachedRecord(userId, date, updated);
  return updated;
}
