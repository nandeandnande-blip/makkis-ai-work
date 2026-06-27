import { Food, FoodCategory } from '../types';
import { getItem, setItem } from './storage';
import { SYSTEM_FOODS } from '../data/systemFoods';
import { supabase } from '../lib/supabase';

const FOOD_USAGE_KEY = 'cct_food_usage';

interface FoodUsage {
  lastUsedAt: number;
  useCount: number;
  lastWeight?: number;
}

function getFoodUsageMap(): Record<string, FoodUsage> {
  return getItem<Record<string, FoodUsage>>(FOOD_USAGE_KEY, {});
}

/** 获取某食物上次使用的重量，无记录返回 null */
export function getLastUsedWeight(foodId: string): number | null {
  return getFoodUsageMap()[foodId]?.lastWeight ?? null;
}

function saveFoodUsageMap(map: Record<string, FoodUsage>): void {
  setItem(FOOD_USAGE_KEY, map);
}

function mergeUsage(food: Food): Food {
  const usage = getFoodUsageMap()[food.id];
  if (!usage) return food;
  return { ...food, lastUsedAt: usage.lastUsedAt, useCount: usage.useCount };
}

interface FoodRow {
  id: string;
  user_id: string;
  name: string;
  category: FoodCategory;
  image: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  source: 'system' | 'custom';
  created_at: string;
}

function toFood(row: FoodRow): Food {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    category: row.category,
    image: row.image ?? undefined,
    caloriesPer100g: row.calories_per_100g,
    proteinPer100g: row.protein_per_100g,
    carbsPer100g: row.carbs_per_100g,
    fatPer100g: row.fat_per_100g,
    source: row.source,
    createdAt: row.created_at,
  };
}

// ==================== 前端缓存 ====================

interface FoodCacheEntry {
  foods: Food[];
  timestamp: number;
}

const foodCache: Record<string, FoodCacheEntry> = {};
const foodPromiseCache: Record<string, Promise<Food[]> | undefined> = {};
const FOOD_CACHE_TTL = 30_000; // 30 秒

function getFoodCacheKey(userId: string): string {
  return userId;
}

function getCachedFoods(userId: string): Food[] | undefined {
  const entry = foodCache[getFoodCacheKey(userId)];
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > FOOD_CACHE_TTL) {
    delete foodCache[getFoodCacheKey(userId)];
    delete foodPromiseCache[getFoodCacheKey(userId)];
    return undefined;
  }
  return entry.foods;
}

function setCachedFoods(userId: string, foods: Food[]): void {
  foodCache[getFoodCacheKey(userId)] = { foods, timestamp: Date.now() };
}

/** 手动清除食物缓存 */
export function invalidateFoodCache(userId?: string): void {
  if (userId) {
    const key = getFoodCacheKey(userId);
    delete foodCache[key];
    delete foodPromiseCache[key];
  } else {
    Object.keys(foodCache).forEach((key) => delete foodCache[key]);
    Object.keys(foodPromiseCache).forEach((key) => delete foodPromiseCache[key]);
  }
}

/** 获取所有食物：系统 + 当前用户自定义，并合并使用数据 */
export async function getAllFoods(userId: string): Promise<Food[]> {
  const cached = getCachedFoods(userId);
  if (cached) return cached;

  const key = getFoodCacheKey(userId);
  const inFlight = foodPromiseCache[key];
  if (inFlight) return inFlight;

  const promise = (async () => {
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .eq('user_id', userId)
      .eq('source', 'custom');

    if (error) {
      console.error('[foodService] getAllFoods error:', error);
      // 出错时至少返回系统食物，避免页面空白
      return SYSTEM_FOODS.map(mergeUsage);
    }

    const customFoods = (data as FoodRow[] | null ?? []).map(toFood);
    const foods = [...SYSTEM_FOODS, ...customFoods].map(mergeUsage);
    setCachedFoods(userId, foods);
    return foods.slice();
  })();

  foodPromiseCache[key] = promise;
  try {
    return await promise;
  } finally {
    // 请求结束后若缓存已写入则清除 promise；若未写入（异常）也清除，允许重试
    if (foodPromiseCache[key] === promise) {
      delete foodPromiseCache[key];
    }
  }
}

export interface FoodMap {
  byId: Record<string, Food>;
  byName: Record<string, Food>;
}

/** 获取食物 id / name -> Food 的映射，方便 Dashboard 等食物列表展示 */
export async function getFoodMap(userId: string): Promise<FoodMap> {
  const foods = await getAllFoods(userId);
  const byId: Record<string, Food> = {};
  const byName: Record<string, Food> = {};
  foods.forEach((food) => {
    byId[food.id] = food;
    byName[food.name] = food;
  });
  return { byId, byName };
}

/** 根据 ID 查找食物 */
export async function getFoodById(
  userId: string,
  foodId: string
): Promise<Food | undefined> {
  const foods = await getAllFoods(userId);
  return foods.find((f) => f.id === foodId);
}

/** 搜索并筛选食物 */
export async function filterFoods(
  userId: string,
  options: { keyword?: string; category?: FoodCategory | 'all' }
): Promise<Food[]> {
  const { keyword = '', category = 'all' } = options;
  const lowerKeyword = keyword.trim().toLowerCase();

  const foods = await getAllFoods(userId);
  return foods.filter((food) => {
    const matchKeyword = food.name.toLowerCase().includes(lowerKeyword);
    const matchCategory = category === 'all' || food.category === category;
    return matchKeyword && matchCategory;
  });
}

/** 获取最近使用食物 */
export async function getRecentFoods(
  userId: string,
  limit = 10
): Promise<Food[]> {
  const foods = await getAllFoods(userId);
  return foods
    .filter((f) => f.lastUsedAt)
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
    .slice(0, limit);
}

/** 获取常用食物 */
export async function getFrequentFoods(
  userId: string,
  limit = 5
): Promise<Food[]> {
  const foods = await getAllFoods(userId);
  return foods
    .filter((f) => (f.useCount ?? 0) > 0)
    .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0))
    .slice(0, limit);
}

/** 记录食物使用 */
export function recordFoodUsage(foodId: string, weight?: number): void {
  const map = getFoodUsageMap();
  const existing = map[foodId] ?? { lastUsedAt: 0, useCount: 0 };
  map[foodId] = {
    lastUsedAt: Date.now(),
    useCount: existing.useCount + 1,
    lastWeight: weight ?? existing.lastWeight,
  };
  saveFoodUsageMap(map);
}

export interface CreateFoodInput {
  name: string;
  category: FoodCategory;
  image?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

function placeholderImage(name: string, category: FoodCategory): string {
  const colors: Record<FoodCategory, string> = {
    protein: 'f87171',
    carb: 'fbbf24',
    fat: 'facc15',
    vegetable: '4ade80',
    fruit: 'fb923c',
    dairy: '60a5fa',
    other: '94a3b8',
  };
  return `https://placehold.co/80x80/${colors[category]}/ffffff?text=${encodeURIComponent(name.slice(0, 2))}`;
}

/** 新增自定义食物 */
export async function createCustomFood(
  userId: string,
  input: CreateFoodInput
): Promise<Food> {
  const image = input.image || placeholderImage(input.name, input.category);

  const { data, error } = await supabase
    .from('foods')
    .insert({
      user_id: userId,
      name: input.name,
      category: input.category,
      image,
      calories_per_100g: input.caloriesPer100g,
      protein_per_100g: input.proteinPer100g,
      carbs_per_100g: input.carbsPer100g,
      fat_per_100g: input.fatPer100g,
      source: 'custom',
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[foodService] createCustomFood error:', error);
    throw new Error(error?.message ?? '创建食物失败');
  }

  const food = toFood(data as FoodRow);
  invalidateFoodCache(userId);
  return food;
}

/** 删除自定义食物（仅删除当前用户自己的 custom food） */
export async function deleteCustomFood(
  userId: string,
  foodId: string
): Promise<void> {
  const { error } = await supabase
    .from('foods')
    .delete()
    .eq('id', foodId)
    .eq('user_id', userId)
    .eq('source', 'custom');

  if (error) {
    console.error('[foodService] deleteCustomFood error:', error);
    throw new Error(error.message);
  }
  invalidateFoodCache(userId);
}
