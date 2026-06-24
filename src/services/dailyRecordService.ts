import { DailyRecord, Meal, MealFood, MealType, CycleType, Food } from '../types';
import { getItem, setItem, STORAGE_KEYS } from './storage';
import { recordFoodUsage } from './foodService';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getRecords(): Record<string, DailyRecord> {
  return getItem<Record<string, DailyRecord>>(STORAGE_KEYS.DAILY_RECORDS, {});
}

function saveRecords(records: Record<string, DailyRecord>): void {
  setItem(STORAGE_KEYS.DAILY_RECORDS, records);
}

function getRecordKey(userId: string, date: string): string {
  return `${userId}_${date}`;
}

/** 获取某天的记录，不存在则返回 null */
export function getDailyRecord(userId: string, date: string): DailyRecord | null {
  return getRecords()[getRecordKey(userId, date)] ?? null;
}

/** 获取或创建某天的记录 */
export function getOrCreateDailyRecord(
  userId: string,
  date: string,
  defaultCycleType: CycleType
): DailyRecord {
  const records = getRecords();
  const key = getRecordKey(userId, date);
  if (records[key]) return records[key];

  const newRecord: DailyRecord = {
    id: generateId('record'),
    userId,
    date,
    cycleType: defaultCycleType,
    meals: [],
  };
  records[key] = newRecord;
  saveRecords(records);
  return newRecord;
}

/** 获取某餐，不存在则创建 */
function getOrCreateMeal(record: DailyRecord, mealType: MealType): Meal {
  let meal = record.meals.find((m) => m.mealType === mealType);
  if (!meal) {
    meal = {
      id: generateId('meal'),
      dailyRecordId: record.id,
      mealType,
      foods: [],
    };
    record.meals.push(meal);
  }
  return meal;
}

export interface AddFoodInput {
  food: Food;
  weight: number;
}

/** 向某天的某餐添加食物 */
export function addFoodToMeal(
  userId: string,
  date: string,
  mealType: MealType,
  input: AddFoodInput,
  defaultCycleType: CycleType
): DailyRecord {
  const records = getRecords();
  const key = getRecordKey(userId, date);
  let record = records[key];

  if (!record) {
    record = {
      id: generateId('record'),
      userId,
      date,
      cycleType: defaultCycleType,
      meals: [],
    };
    records[key] = record;
  }

  const meal = getOrCreateMeal(record, mealType);
  const { food, weight } = input;
  const ratio = weight / 100;

  const mealFood: MealFood = {
    id: generateId('mf'),
    mealId: meal.id,
    foodId: food.id,
    weight,
    calories: Math.round(food.caloriesPer100g * ratio * 10) / 10,
    protein: Math.round(food.proteinPer100g * ratio * 10) / 10,
    carbs: Math.round(food.carbsPer100g * ratio * 10) / 10,
    fat: Math.round(food.fatPer100g * ratio * 10) / 10,
  };

  meal.foods.push(mealFood);
  saveRecords(records);
  recordFoodUsage(food.id, weight);
  return record;
}

/** 从某餐中删除食物 */
export function removeFoodFromMeal(
  userId: string,
  date: string,
  mealType: MealType,
  mealFoodId: string
): DailyRecord | null {
  const records = getRecords();
  const key = getRecordKey(userId, date);
  const record = records[key];
  if (!record) return null;

  const meal = record.meals.find((m) => m.mealType === mealType);
  if (!meal) return record;

  meal.foods = meal.foods.filter((f) => f.id !== mealFoodId);
  saveRecords(records);
  return record;
}

/** 更新某天记录的碳循环类型 */
export function updateDailyCycleType(
  userId: string,
  date: string,
  cycleType: CycleType
): DailyRecord | null {
  const records = getRecords();
  const key = getRecordKey(userId, date);
  const record = records[key];
  if (!record) return null;

  record.cycleType = cycleType;
  saveRecords(records);
  return record;
}
