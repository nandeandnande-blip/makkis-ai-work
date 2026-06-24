/**
 * LocalStorage 统一封装
 *
 * V1 阶段所有数据存储在浏览器本地。
 */

const STORAGE_KEYS = {
  USERS: 'cct_users',
  CURRENT_USER: 'cct_current_user',
  PROFILES: 'cct_profiles',
  PLANS: 'cct_plans',
  FOODS: 'cct_foods',
  WEIGHT_RECORDS: 'cct_weight_records',
  DAILY_RECORDS: 'cct_daily_records',
} as const;

export function getItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

export { STORAGE_KEYS };
