import { WeightRecord } from '../types';
import { supabase } from '../lib/supabase';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface WeightRecordRow {
  id: string;
  user_id: string;
  date: string;
  weight: number;
  note: string | null;
  created_at: string;
}

function toWeightRecord(row: WeightRecordRow): WeightRecord {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    weight: row.weight,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

function isSupabaseError(error: unknown): error is SupabaseError {
  return typeof error === 'object' && error !== null && 'message' in error;
}

function handleError(operation: string, error: unknown): never {
  if (isSupabaseError(error)) {
    console.error(`[weightService] ${operation} failed:`, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`保存失败: ${error.message}${error.code ? ` (${error.code})` : ''}`);
  }
  console.error(`[weightService] ${operation} failed:`, error);
  throw new Error('保存失败');
}

/** 获取用户的全部体重记录，按日期升序 */
export async function getWeightRecordsByUser(userId: string): Promise<WeightRecord[]> {
  const { data, error } = await supabase
    .from('weight_records')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) {
    console.error('[weightService] getWeightRecordsByUser error:', error);
    return [];
  }

  return (data as WeightRecordRow[] | null)?.map(toWeightRecord) ?? [];
}

/** 获取某一天的体重记录 */
export async function getWeightRecordByDate(
  userId: string,
  date: string
): Promise<WeightRecord | null> {
  const { data, error } = await supabase
    .from('weight_records')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (error) {
    console.error('[weightService] getWeightRecordByDate error:', error);
    return null;
  }

  return data ? toWeightRecord(data as WeightRecordRow) : null;
}

/** 获取最新一条体重记录 */
export async function getLatestWeightRecord(userId: string): Promise<WeightRecord | null> {
  const { data, error } = await supabase
    .from('weight_records')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[weightService] getLatestWeightRecord error:', error);
    return null;
  }

  return data ? toWeightRecord(data as WeightRecordRow) : null;
}

/** 获取最近 N 条体重记录 */
export async function getRecentWeightRecords(
  userId: string,
  limit: number
): Promise<WeightRecord[]> {
  const { data, error } = await supabase
    .from('weight_records')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[weightService] getRecentWeightRecords error:', error);
    return [];
  }

  return ((data as WeightRecordRow[] | null) ?? []).map(toWeightRecord).reverse();
}

export interface SaveWeightInput {
  weight: number;
  note?: string;
}

/** 记录或更新某一天的体重 */
export async function saveWeightRecord(
  userId: string,
  date: string,
  input: SaveWeightInput
): Promise<WeightRecord> {
  // 1. 查询当天是否已有记录：使用 maybeSingle，data 为 null 只是说明没有记录，不是错误
  const { data: existing, error: selectError } = await supabase
    .from('weight_records')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (selectError) {
    handleError('saveWeightRecord-select', selectError);
  }

  const basePayload = {
    weight: input.weight,
    note: input.note ?? null,
  };

  // 2. 存在则更新，不存在则插入；均使用 .select() 但不使用 .single()，防止 406
  if (existing) {
    const { data, error } = await supabase
      .from('weight_records')
      .update(basePayload)
      .eq('id', existing.id)
      .select();

    if (error) {
      handleError('saveWeightRecord-update', error);
    }

    const row = (data as WeightRecordRow[] | null)?.[0];
    if (row) return toWeightRecord(row);
  } else {
    const { data, error } = await supabase
      .from('weight_records')
      .insert({
        user_id: userId,
        date,
        ...basePayload,
      })
      .select();

    if (error) {
      handleError('saveWeightRecord-insert', error);
    }

    const row = (data as WeightRecordRow[] | null)?.[0];
    if (row) return toWeightRecord(row);
  }

  // 3. 兜底：如果 insert/update 没有返回数据，再查一次；仍然查不到则构造本地对象返回，不抛错
  const { data: fallback } = await supabase
    .from('weight_records')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (fallback) {
    return toWeightRecord(fallback as WeightRecordRow);
  }

  console.warn('[weightService] saveWeightRecord: 写入后未读到记录，返回本地构造对象');
  return {
    id: generateId('weight'),
    userId,
    date,
    weight: input.weight,
    note: input.note,
    createdAt: new Date().toISOString(),
  };
}

/** 删除某一天的体重记录 */
export async function deleteWeightRecord(userId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('weight_records')
    .delete()
    .eq('user_id', userId)
    .eq('date', date);

  if (error) {
    handleError('deleteWeightRecord', error);
  }
}
