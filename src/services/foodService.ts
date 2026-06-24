import { Food, FoodCategory } from '../types';
import { getItem, setItem, STORAGE_KEYS } from './storage';
import { SYSTEM_FOODS } from '../data/systemFoods';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getCustomFoods(): Food[] {
  return getItem<Food[]>(STORAGE_KEYS.FOODS, []);
}

function saveCustomFoods(foods: Food[]): void {
  setItem(STORAGE_KEYS.FOODS, foods);
}

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

/** 获取所有食物：系统 + 自定义，并合并使用数据 */
export function getAllFoods(userId: string): Food[] {
  const customFoods = getCustomFoods().filter((f) => f.userId === userId);
  return [...SYSTEM_FOODS, ...customFoods].map(mergeUsage);
}

/** 根据 ID 查找食物 */
export function getFoodById(userId: string, foodId: string): Food | undefined {
  return getAllFoods(userId).find((f) => f.id === foodId);
}

/** 搜索并筛选食物 */
export function filterFoods(
  userId: string,
  options: { keyword?: string; category?: FoodCategory | 'all' }
): Food[] {
  const { keyword = '', category = 'all' } = options;
  const lowerKeyword = keyword.trim().toLowerCase();

  return getAllFoods(userId).filter((food) => {
    const matchKeyword = food.name.toLowerCase().includes(lowerKeyword);
    const matchCategory = category === 'all' || food.category === category;
    return matchKeyword && matchCategory;
  });
}

/** 获取最近使用食物 */
export function getRecentFoods(userId: string, limit = 10): Food[] {
  return getAllFoods(userId)
    .filter((f) => f.lastUsedAt)
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
    .slice(0, limit);
}

/** 获取常用食物 */
export function getFrequentFoods(userId: string, limit = 5): Food[] {
  return getAllFoods(userId)
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

/** 新增自定义食物 */
export function createCustomFood(userId: string, input: CreateFoodInput): Food {
  const foods = getCustomFoods();
  const newFood: Food = {
    id: generateId('food'),
    userId,
    name: input.name,
    category: input.category,
    image: input.image || placeholderImage(input.name, input.category),
    caloriesPer100g: input.caloriesPer100g,
    proteinPer100g: input.proteinPer100g,
    carbsPer100g: input.carbsPer100g,
    fatPer100g: input.fatPer100g,
    source: 'custom',
    createdAt: new Date().toISOString(),
  };
  saveCustomFoods([...foods, newFood]);
  return newFood;
}

/** 删除自定义食物 */
export function deleteCustomFood(userId: string, foodId: string): void {
  const foods = getCustomFoods().filter((f) => !(f.id === foodId && f.userId === userId));
  saveCustomFoods(foods);
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
