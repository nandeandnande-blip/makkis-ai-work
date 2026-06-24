import { WeightRecord } from '../types';
import { getItem, setItem, STORAGE_KEYS } from './storage';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getRecords(): WeightRecord[] {
  return getItem<WeightRecord[]>(STORAGE_KEYS.WEIGHT_RECORDS, []);
}

function saveRecords(records: WeightRecord[]): void {
  setItem(STORAGE_KEYS.WEIGHT_RECORDS, records);
}

/** 获取用户的全部体重记录，按日期升序 */
export function getWeightRecordsByUser(userId: string): WeightRecord[] {
  return getRecords()
    .filter((r) => r.userId === userId)
    .sort((a, b) => (a.date > b.date ? 1 : -1));
}

/** 获取某一天的体重记录 */
export function getWeightRecordByDate(userId: string, date: string): WeightRecord | null {
  return getRecords().find((r) => r.userId === userId && r.date === date) ?? null;
}

/** 获取最新一条体重记录 */
export function getLatestWeightRecord(userId: string): WeightRecord | null {
  const records = getWeightRecordsByUser(userId);
  return records[records.length - 1] ?? null;
}

/** 获取最近 N 条体重记录 */
export function getRecentWeightRecords(userId: string, limit: number): WeightRecord[] {
  const records = getWeightRecordsByUser(userId);
  return records.slice(-limit);
}

export interface SaveWeightInput {
  weight: number;
  note?: string;
}

/** 记录或更新某一天的体重 */
export function saveWeightRecord(
  userId: string,
  date: string,
  input: SaveWeightInput
): WeightRecord {
  const records = getRecords();
  const existingIndex = records.findIndex((r) => r.userId === userId && r.date === date);

  const record: WeightRecord = {
    id: existingIndex >= 0 ? records[existingIndex].id : generateId('weight'),
    userId,
    date,
    weight: input.weight,
    note: input.note,
    createdAt: existingIndex >= 0 ? records[existingIndex].createdAt : new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.push(record);
  }

  saveRecords(records);
  return record;
}

/** 删除某一天的体重记录 */
export function deleteWeightRecord(userId: string, date: string): void {
  const records = getRecords().filter((r) => !(r.userId === userId && r.date === date));
  saveRecords(records);
}
