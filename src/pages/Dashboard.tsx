import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ChevronRight,
  Flame,
  Scale,
  Sparkles,
  Trash2,
  Utensils,
} from 'lucide-react';
import { CycleTarget, CycleType, DailyRecord, Food, MealType, UserProfile, WeightRecord } from '../types';
import { CYCLE_STRATEGY, MEAL_CONFIG } from '../utils/constants';
import { getTodayLocal } from '../utils/date';
import { calculateCycleTargets, getCycleTypeForDate, sumMacros } from '../utils/calculator';
import { useAuth } from '../contexts/AuthContext';
import { getDailyRecord, removeFoodFromMeal } from '../services/dailyRecordService';
import { getFoodMap } from '../services/foodService';
import ConfirmDialog from '../components/ConfirmDialog';
import FoodAvatar from '../components/FoodAvatar';
import { updateCurrentWeightAndRecalcTargets } from '../services/authService';
import {
  getWeightRecordByDate,
  getLatestWeightRecord,
  getRecentWeightRecords,
  saveWeightRecord,
} from '../services/weightService';

// ==================== Mock Data（未登录或未完成资料时展示）====================

const mockProfile: UserProfile = {
  id: 'profile-1',
  userId: 'user-1',
  gender: 'male',
  age: 28,
  height: 175,
  currentWeight: 78,
  targetWeight: 70,
  activityLevel: 'moderately_active',
  updatedAt: '2026-06-20T08:00:00Z',
};

interface NextMealSuggestion {
  food: string;
  amount: string;
  reason: string;
}

interface DietAnalysisResult {
  overall: string;
  issues: string[];
  nextMealSuggestions: NextMealSuggestion[];
  encouragement: string;
}

const mockPlan = {
  id: 'plan-1',
  userId: 'user-1',
  monday: 'high' as CycleType,
  tuesday: 'medium' as CycleType,
  wednesday: 'low' as CycleType,
  thursday: 'high' as CycleType,
  friday: 'medium' as CycleType,
  saturday: 'low' as CycleType,
  sunday: 'medium' as CycleType,
  targets: calculateCycleTargets(mockProfile).cycleTargets,
};

const mockTodayRecord: DailyRecord = {
  id: 'record-1',
  userId: 'user-1',
  date: '2026-06-24',
  cycleType: 'high',
  meals: [
    {
      id: 'meal-1',
      dailyRecordId: 'record-1',
      mealType: 'breakfast',
      foods: [
        { id: 'mf-1', mealId: 'meal-1', foodId: 'f-1', weight: 200, calories: 248, protein: 20, carbs: 46, fat: 2 },
        { id: 'mf-2', mealId: 'meal-1', foodId: 'f-2', weight: 50, calories: 86, protein: 6, carbs: 1, fat: 6 },
      ],
    },
    {
      id: 'meal-2',
      dailyRecordId: 'record-1',
      mealType: 'lunch',
      foods: [
        { id: 'mf-3', mealId: 'meal-2', foodId: 'f-3', weight: 150, calories: 165, protein: 31, carbs: 0, fat: 4 },
        { id: 'mf-4', mealId: 'meal-2', foodId: 'f-4', weight: 200, calories: 260, protein: 6, carbs: 58, fat: 0 },
      ],
    },
  ],
};



// ==================== 子组件 ====================

function MacroCard({
  label,
  value,
  total,
  unit,
  colorClass,
}: {
  label: string;
  value: number;
  total: number;
  unit: string;
  colorClass: string;
}) {
  const percent = Math.min(100, Math.round((value / total) * 100));
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-slate-500 sm:text-sm">{label}</span>
        <span className="text-[10px] font-medium text-slate-400 sm:text-xs">{unit}</span>
      </div>
      <div className="mb-3 flex items-baseline gap-1">
        <span className="text-xl font-bold text-slate-800 sm:text-2xl">{Math.round(value)}</span>
        <span className="text-xs text-slate-400 sm:text-sm">/ {total}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// ==================== Dashboard 页面 ====================

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile: realProfile, plan: realPlan, logout, refreshProfile } = useAuth();
  const [weightInput, setWeightInput] = useState('');
  const [weightNote, setWeightNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ mealType: MealType; mealFoodId: string } | null>(null);
  const [recentWeightRecords, setRecentWeightRecords] = useState<WeightRecord[]>([]);
  const [displayWeight, setDisplayWeight] = useState(realProfile?.currentWeight ?? mockProfile.currentWeight);
  const [weightDiff, setWeightDiff] = useState<number | null>(null);
  const [weightError, setWeightError] = useState('');
  const [foodMap, setFoodMap] = useState<{ byId: Record<string, Food>; byName: Record<string, Food> }>({
    byId: {},
    byName: {},
  });
  const [isDeletingMealFood, setIsDeletingMealFood] = useState(false);
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [aiResult, setAiResult] = useState<DietAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // 支持通过 URL ?date= 切换日期，默认今天
  const selectedDate = useMemo(
    () => searchParams.get('date') ?? getTodayLocal(),
    [searchParams]
  );
  const isToday = selectedDate === getTodayLocal();

  // 优先使用真实用户数据，否则回退到 Mock
  const profile = realProfile ?? mockProfile;
  const plan = realPlan ?? mockPlan;

  const calcResult = useMemo(() => calculateCycleTargets(profile), [profile]);
  const cycleType = useMemo(() => getCycleTypeForDate(plan, selectedDate), [plan, selectedDate]);
  const strategy = CYCLE_STRATEGY[cycleType];

  const [dailyRecord, setDailyRecord] = useState<DailyRecord>({
    id: 'empty',
    userId: '',
    date: selectedDate,
    cycleType,
    meals: [],
  });
  const target = realPlan ? realPlan.targets[cycleType] : calcResult.cycleTargets[cycleType];

  // 读取真实饮食记录；已登录用户没有记录时显示空记录，未登录时回退到 Mock
  useEffect(() => {
    if (!user) {
      setDailyRecord(isToday ? mockTodayRecord : { id: 'empty', userId: '', date: selectedDate, cycleType, meals: [] });
      return;
    }
    let cancelled = false;
    const loadDailyRecord = async () => {
      try {
        const record = await getDailyRecord(user.id, selectedDate);
        if (!cancelled) {
          setDailyRecord(
            record ?? {
              id: 'empty',
              userId: user.id,
              date: selectedDate,
              cycleType,
              meals: [],
            }
          );
        }
      } catch (err) {
        console.error('[Dashboard] load daily record error:', err);
      }
    };
    loadDailyRecord();
    return () => {
      cancelled = true;
    };
  }, [user, selectedDate, cycleType, isToday]);

  const handleDeleteMealFood = (mealType: MealType, mealFoodId: string) => {
    if (!user || isDeletingMealFood) return;
    setDeleteTarget({ mealType, mealFoodId });
  };

  const handleConfirmDelete = async () => {
    if (!user || !deleteTarget || isDeletingMealFood) return;
    setIsDeletingMealFood(true);
    try {
      const record = await removeFoodFromMeal(user.id, selectedDate, deleteTarget.mealType, deleteTarget.mealFoodId);
      if (record) {
        setDailyRecord(record);
      }
    } catch (err) {
      console.error('[Dashboard] delete meal food error:', err);
    } finally {
      setIsDeletingMealFood(false);
      setDeleteTarget(null);
    }
  };

  const allMealFoods = dailyRecord.meals.flatMap((m) => m.foods);
  const intake = useMemo(() => sumMacros(allMealFoods), [allMealFoods]);
  const remaining: CycleTarget = {
    calories: target.calories - intake.calories,
    protein: target.protein - intake.protein,
    carbs: target.carbs - intake.carbs,
    fat: target.fat - intake.fat,
  };

  // 食物映射（用于展示已添加食物名称/图片）
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadFoodMap = async () => {
      try {
        const map = await getFoodMap(user.id);
        if (!cancelled) setFoodMap(map);
      } catch (err) {
        console.error('[Dashboard] load food map error:', err);
      }
    };
    loadFoodMap();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // 体重数据
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadWeightData = async () => {
      try {
        setWeightError('');
        const selected = await getWeightRecordByDate(user.id, selectedDate);
        const latest = await getLatestWeightRecord(user.id);
        const recent = await getRecentWeightRecords(user.id, 7);
        const display = selected?.weight ?? latest?.weight ?? profile.currentWeight;
        const diff = latest ? latest.weight - profile.targetWeight : null;
        if (!cancelled) {
          setRecentWeightRecords(recent);
          setDisplayWeight(display);
          setWeightDiff(diff);
        }
      } catch (err) {
        console.error('[Dashboard] load weight data error:', err);
      }
    };
    loadWeightData();
    return () => {
      cancelled = true;
    };
  }, [user, selectedDate, profile.currentWeight, profile.targetWeight]);

  const handleWeightSave = async () => {
    if (!weightInput || !user || isSavingWeight) return;
    setIsSavingWeight(true);
    setWeightError('');
    try {
      const weight = Number(weightInput);
      const saved = await saveWeightRecord(user.id, selectedDate, { weight, note: weightNote || undefined });
      // 记录今日体重时，同步更新档案当前体重并重新计算摄入目标
      if (selectedDate === getTodayLocal()) {
        await updateCurrentWeightAndRecalcTargets(user.id, weight);
        await refreshProfile();
      }
      setWeightInput('');
      setWeightNote('');
      // 局部刷新体重展示，避免重新请求整页数据
      setDisplayWeight(saved.weight);
      setRecentWeightRecords((prev) => {
        const next = prev.filter((r) => r.date !== saved.date);
        next.push(saved);
        next.sort((a, b) => a.date.localeCompare(b.date));
        return next;
      });
      setWeightDiff(saved.weight - profile.targetWeight);
    } catch (err) {
      console.error('[Dashboard] save weight error:', err);
      setWeightError('保存失败');
    } finally {
      setIsSavingWeight(false);
    }
  };

  const navigateToDiet = (mealType: MealType) => {
    navigate(`/diet/${selectedDate}?meal=${mealType}`);
  };

  const handleAnalyzeDiet = async () => {
    if (!user || aiLoading) return;
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const meals = dailyRecord.meals
        .filter((m) => m.foods.length > 0)
        .map((m) => ({
          mealType: MEAL_CONFIG[m.mealType].label,
          foods: m.foods.map((mf) => {
            const foodById = mf.foodId ? foodMap.byId[mf.foodId] : undefined;
            const foodName = mf.foodName ?? foodById?.name ?? '未知食物';
            return {
              name: foodName,
              weight: mf.weight,
              calories: mf.calories,
              protein: mf.protein,
              carbs: mf.carbs,
              fat: mf.fat,
            };
          }),
        }));

      const payload = {
        date: selectedDate,
        cycleType: strategy.label,
        targets: target,
        intake,
        meals,
      };

      const res = await fetch('/api/analyze-diet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI 分析失败');
      }
      setAiResult(data.result as DietAnalysisResult);
    } catch (err) {
      console.error('[Dashboard] AI analyze error:', err);
      setAiError(err instanceof Error ? err.message : 'AI分析失败，请稍后重试');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-emerald-500 to-teal-600 px-4 pb-6 pt-8 text-white sm:px-6 sm:pb-8 sm:pt-12">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold leading-tight sm:text-2xl">
                {user?.nickname ? `${user.nickname}，你好` : '你好'}
                <span className="block text-sm font-normal opacity-90 sm:text-base">今天也要加油</span>
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => navigate('/calendar')}
                  className="flex flex-col gap-1 rounded-lg bg-white/20 px-3 py-2 text-left transition hover:bg-white/30 sm:flex-row sm:items-center sm:gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-sm font-medium opacity-90">{selectedDate}</span>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold text-white sm:rounded-full ${strategy.color}`}>
                      {strategy.label}
                    </span>
                  </div>
                  <span className="text-xs opacity-90">{strategy.tip}</span>
                </button>
                {!isToday && (
                  <button
                    onClick={() => navigate('/', { replace: true })}
                    className="rounded-lg bg-white/30 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/40"
                  >
                    回到今日
                  </button>
                )}
                <button
                  onClick={() => navigate('/cycle-planner')}
                  className="rounded-lg bg-white/20 px-3 py-2 text-sm text-white transition hover:bg-white/30"
                >
                  碳循环设置
                </button>
              </div>
            </div>
            <button
              onClick={logout}
              className="shrink-0 self-start rounded-lg bg-white/20 px-3 py-1 text-sm text-white hover:bg-white/30 sm:self-auto"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl -mt-6 space-y-6 px-4">
        {/* 热量总览 */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Flame size={20} className="text-orange-500" />
              今日摄入
            </h2>
            <span className="text-sm text-slate-500">
              剩余 <span className="font-bold text-emerald-600">{Math.round(remaining.calories)}</span> kcal
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MacroCard label="热量" value={intake.calories} total={target.calories} unit="kcal" colorClass="bg-orange-500" />
            <MacroCard label="蛋白质" value={intake.protein} total={target.protein} unit="g" colorClass="bg-blue-500" />
            <MacroCard label="碳水" value={intake.carbs} total={target.carbs} unit="g" colorClass="bg-emerald-500" />
            <MacroCard label="脂肪" value={intake.fat} total={target.fat} unit="g" colorClass="bg-amber-500" />
          </div>
        </section>

        {/* 今日体重 */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Scale size={20} className="text-indigo-500" />
              {isToday ? '今日体重' : '当日体重'}
            </h2>
            <Link
              to="/weight"
              className="text-sm font-medium text-emerald-600 hover:underline"
            >
              管理 →
            </Link>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-slate-800">{displayWeight}</span>
            <span className="mb-1 text-slate-500">kg</span>
          </div>
          {weightDiff !== null && (
            <p className="mt-2 text-sm text-slate-500">
              距离目标体重（{profile.targetWeight}kg）
              <span className={weightDiff > 0 ? 'text-rose-500' : 'text-emerald-500'}>
                {weightDiff > 0 ? ` 还需减 ${weightDiff.toFixed(1)}kg` : ` 已低 ${Math.abs(weightDiff).toFixed(1)}kg`}
              </span>
            </p>
          )}

          {/* 7天趋势 */}
          {recentWeightRecords.length > 1 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">7天趋势</p>
              <div className="flex items-end gap-1">
                {recentWeightRecords.map((r) => {
                  const heightPercent = Math.min(
                    100,
                    Math.max(10, (r.weight / (profile.targetWeight + 10)) * 100)
                  );
                  return (
                    <div key={r.id} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-indigo-200"
                        style={{ height: `${heightPercent}px` }}
                      />
                      <span className="text-[10px] text-slate-400">{r.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-3">
            <input
              type="number"
              step="0.1"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="输入今日体重"
              className="w-full rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={weightNote}
              onChange={(e) => setWeightNote(e.target.value)}
              placeholder="备注（可选）"
              className="w-full rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleWeightSave}
              disabled={isSavingWeight}
              className="w-full rounded-xl bg-emerald-600 px-5 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:bg-emerald-400 disabled:opacity-70"
            >
              {isSavingWeight ? '保存中...' : '记录体重'}
            </button>
            {weightError && <p className="text-sm text-rose-500">{weightError}</p>}
          </div>
        </section>

        {/* 今日饮食记录 */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
            <Utensils size={20} className="text-emerald-500" />
            今日饮食记录
          </h2>
          <div className="space-y-5">
            {(Object.keys(MEAL_CONFIG) as MealType[]).map((mealType) => {
              const meal = dailyRecord.meals.find((m) => m.mealType === mealType);
              const mealFoods = meal?.foods ?? [];
              const mealIntake = mealFoods.length > 0 ? sumMacros(mealFoods) : null;
              return (
                <div key={mealType} className="rounded-2xl border border-slate-100 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">{MEAL_CONFIG[mealType].label}</h3>
                    <button
                      onClick={() => navigateToDiet(mealType)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-600 transition hover:bg-emerald-100"
                    >
                      <span className="text-lg leading-none">+</span>
                      添加食物
                    </button>
                  </div>

                  {mealFoods.length === 0 ? (
                    <p className="text-sm text-slate-400">暂无记录</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {mealFoods.map((mf) => {
                          const foodById = user && mf.foodId ? foodMap.byId[mf.foodId] : undefined;
                          const foodName = mf.foodName ?? foodById?.name ?? '未知食物';
                          const food = foodById ?? foodMap.byName[foodName];
                          return (
                            <div
                              key={mf.id}
                              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"
                            >
                              <div className="flex items-center gap-3">
                                <FoodAvatar
                                  image={food?.image}
                                  name={foodName}
                                  category={food?.category ?? 'other'}
                                  className="h-10 w-10"
                                />
                                <div>
                                  <p className="font-medium text-slate-800">{foodName}</p>
                                  <p className="text-xs text-slate-500">
                                    蛋白质 {Math.round(mf.protein)}g · 碳水 {Math.round(mf.carbs)}g · 脂肪 {Math.round(mf.fat)}g
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500">
                                  {mf.weight}g · {Math.round(mf.calories)} kcal
                                </span>
                                <button
                                  onClick={() => handleDeleteMealFood(mealType, mf.id)}
                                  className="rounded-full p-1.5 text-rose-500 transition hover:bg-rose-50"
                                  title="删除"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {mealIntake && (
                        <div className="mt-3 rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-600">
                          <span className="font-medium">{MEAL_CONFIG[mealType].label}合计：</span>
                          {Math.round(mealIntake.calories)} kcal · 蛋白质 {Math.round(mealIntake.protein)}g · 碳水 {Math.round(mealIntake.carbs)}g · 脂肪 {Math.round(mealIntake.fat)}g
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* AI 今日饮食分析 */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
            <Sparkles size={20} className="text-amber-500" />
            AI 今日饮食分析
          </h2>
          <button
            onClick={handleAnalyzeDiet}
            disabled={!user || aiLoading}
            className="w-full rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:bg-slate-400 disabled:opacity-70"
          >
            {aiLoading ? 'AI正在分析...' : aiResult ? '重新分析今日饮食' : 'AI 分析今日饮食'}
          </button>
          {aiError && <p className="mt-3 text-sm text-rose-500">{aiError}</p>}
          {aiResult && (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <h3 className="mb-1 text-sm font-bold text-slate-800">今日整体评价</h3>
                <p className="text-sm text-slate-700">{aiResult.overall}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <h3 className="mb-2 text-sm font-bold text-slate-800">当前主要偏差</h3>
                {aiResult.issues.length === 0 ? (
                  <p className="text-sm text-slate-500">暂无显著偏差</p>
                ) : (
                  <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
                    {aiResult.issues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <h3 className="mb-2 text-sm font-bold text-slate-800">下一餐建议</h3>
                <div className="space-y-2">
                  {aiResult.nextMealSuggestions.map((s, idx) => (
                    <div key={idx} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{s.food}</span>
                        <span className="text-xs font-medium text-emerald-600">{s.amount}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{s.reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 p-4">
                <h3 className="mb-1 text-sm font-bold text-emerald-800">鼓励语</h3>
                <p className="text-sm text-emerald-700">{aiResult.encouragement}</p>
              </div>
            </div>
          )}
        </section>

        {/* 导航入口 */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Link
            to="/calendar"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <Activity size={24} className="text-emerald-600" />
            <span className="text-sm font-medium text-slate-700">日历</span>
          </Link>
          <Link
            to="/foods"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <Utensils size={24} className="text-blue-600" />
            <span className="text-sm font-medium text-slate-700">饮食</span>
          </Link>
          <Link
            to="/weight"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <Scale size={24} className="text-indigo-600" />
            <span className="text-sm font-medium text-slate-700">体重</span>
          </Link>
          <Link
            to="/settings"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <ChevronRight size={24} className="text-slate-600" />
            <span className="text-sm font-medium text-slate-700">设置</span>
          </Link>
        </section>

        {/* 计算参考 */}
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p>基础代谢率（BMR）：{calcResult.bmr} kcal</p>
          <p>每日总消耗（TDEE）：{calcResult.tdee} kcal</p>
          <p>减脂目标热量：{calcResult.deficitCalories} kcal</p>
          {realProfile && (
            <p className="mt-1 text-xs text-slate-400">已基于你的真实身体数据计算</p>
          )}
        </section>
      </main>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="删除食物记录"
        message="确定删除该食物记录？"
        confirmText="删除"
        variant="danger"
        loading={isDeletingMealFood}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
