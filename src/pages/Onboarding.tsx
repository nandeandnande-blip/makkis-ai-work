import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { setupUserOnboarding, OnboardingInput } from '../services/authService';
import { DayKey } from '../services/planService';
import { ACTIVITY_LABELS, GENDER_LABELS, CYCLE_STRATEGY } from '../utils/constants';
import { calculateCycleTargets } from '../utils/calculator';
import { ActivityLevel, CycleType, Gender } from '../types';

const DAY_KEYS: { key: DayKey; label: string }[] = [
  { key: 'monday', label: '周一' },
  { key: 'tuesday', label: '周二' },
  { key: 'wednesday', label: '周三' },
  { key: 'thursday', label: '周四' },
  { key: 'friday', label: '周五' },
  { key: 'saturday', label: '周六' },
  { key: 'sunday', label: '周日' },
];

const DEFAULT_WEEK_PLAN: Record<DayKey, CycleType> = {
  monday: 'high',
  tuesday: 'medium',
  wednesday: 'low',
  thursday: 'high',
  friday: 'medium',
  saturday: 'low',
  sunday: 'medium',
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  const [step, setStep] = useState<'form' | 'review'>('form');
  const [expandedDay, setExpandedDay] = useState<DayKey | null>(null);
  const [form, setForm] = useState<OnboardingInput>({
    gender: 'male',
    age: 28,
    height: 175,
    currentWeight: 78,
    targetWeight: 70,
    activityLevel: 'moderately_active',
  });
  const [currentWeightRaw, setCurrentWeightRaw] = useState(String(form.currentWeight));
  const [targetWeightRaw, setTargetWeightRaw] = useState(String(form.targetWeight));
  const [weekPlan, setWeekPlan] = useState<Record<DayKey, CycleType>>(DEFAULT_WEEK_PLAN);
  const [calcResult, setCalcResult] = useState<ReturnType<typeof calculateCycleTargets> | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 未登录用户不能填写资料
  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  const handleChange = (field: keyof OnboardingInput, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleWeightChange = (
    value: string,
    setter: (val: string) => void,
    field: 'currentWeight' | 'targetWeight'
  ) => {
    if (value === '' || /^\d+$/.test(value)) {
      setter(value);
      if (value !== '') {
        handleChange(field, Number(value));
      }
    }
  };

  const handleWeightBlur = (
    raw: string,
    setter: (val: string) => void,
    field: 'currentWeight' | 'targetWeight'
  ) => {
    if (raw === '') {
      setter(String(form[field]));
    }
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.currentWeight <= 0 || form.targetWeight <= 0 || form.height <= 0 || form.age <= 0) {
      setError('请填写有效的身体数据');
      return;
    }

    const calc = calculateCycleTargets(form as unknown as Parameters<typeof calculateCycleTargets>[0]);
    setCalcResult(calc);
    setStep('review');
  };

  const handleDayChange = (day: DayKey, type: CycleType) => {
    setWeekPlan((prev) => ({ ...prev, [day]: type }));
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await setupUserOnboarding(user.id, form, weekPlan);
      await refreshProfile();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'review' && calcResult) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-lg">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <h1 className="mb-2 text-2xl font-bold text-slate-800">你的碳循环计划</h1>
            <p className="mb-6 text-sm text-slate-500">基于你的身体数据生成，可点击下方日期调整</p>

            {/* 计算结果 */}
            <div className="mb-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p>基础代谢率（BMR）：{calcResult.bmr} kcal</p>
              <p>每日总消耗（TDEE）：{calcResult.tdee} kcal</p>
              <p>减脂目标热量：{calcResult.deficitCalories} kcal</p>
            </div>

            {/* 每日目标 */}
            <div className="mb-6 space-y-3">
              {(Object.keys(calcResult.cycleTargets) as CycleType[]).map((type) => {
                const target = calcResult.cycleTargets[type];
                const strategy = CYCLE_STRATEGY[type];
                const bgClass =
                  type === 'high'
                    ? 'bg-emerald-50'
                    : type === 'medium'
                    ? 'bg-amber-50'
                    : 'bg-rose-50';
                return (
                  <div
                    key={type}
                    className={`flex items-center justify-between rounded-xl ${bgClass} p-4`}
                  >
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${strategy.color}`}>
                      {strategy.label}
                    </span>
                    <span className="text-sm text-slate-700">
                      {target.calories} kcal · P{target.protein} · C{target.carbs} · F{target.fat}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 每周安排 */}
            <div className="mb-6 space-y-3">
              <p className="text-sm font-medium text-slate-700">每周安排</p>
              {DAY_KEYS.map(({ key, label }) => {
                const currentType = weekPlan[key];
                const target = calcResult.cycleTargets[currentType];
                const isExpanded = expandedDay === key;

                return (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-100 bg-white p-4"
                  >
                    <button
                      onClick={() => setExpandedDay(isExpanded ? null : key)}
                      className="flex w-full items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-slate-800">{label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${CYCLE_STRATEGY[currentType].color}`}>
                          {CYCLE_STRATEGY[currentType].label}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{isExpanded ? '收起' : '展开'}</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-4 gap-2 text-center text-sm">
                          <div className="rounded-lg bg-slate-50 p-2">
                            <p className="text-slate-500">热量</p>
                            <p className="font-semibold text-slate-800">{target.calories}</p>
                            <p className="text-xs text-slate-400">kcal</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2">
                            <p className="text-slate-500">蛋白质</p>
                            <p className="font-semibold text-slate-800">{target.protein}g</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2">
                            <p className="text-slate-500">碳水</p>
                            <p className="font-semibold text-slate-800">{target.carbs}g</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2">
                            <p className="text-slate-500">脂肪</p>
                            <p className="font-semibold text-slate-800">{target.fat}g</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {(Object.keys(CYCLE_STRATEGY) as CycleType[]).map((type) => (
                            <button
                              key={type}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDayChange(key, type);
                              }}
                              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                                currentType === type
                                  ? `${CYCLE_STRATEGY[type].color} text-white`
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {CYCLE_STRATEGY[type].label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('form')}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 font-medium text-slate-700 transition hover:bg-slate-50"
              >
                上一步
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:bg-emerald-400 disabled:opacity-70"
              >
                {isSubmitting ? '保存中...' : '确认并开始'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-slate-800">完善你的身体数据</h1>
        <p className="mb-8 text-sm text-slate-500">
          我们将根据这些信息自动计算 BMR、TDEE 和碳循环目标。
        </p>

        <form onSubmit={handleGenerate} className="space-y-5">
          {/* 性别 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">性别</label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(GENDER_LABELS) as Gender[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleChange('gender', value)}
                  className={`rounded-xl border px-4 py-3 text-center transition ${
                    form.gender === value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {GENDER_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          {/* 年龄 / 身高 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">年龄</label>
              <input
                type="number"
                min={10}
                max={100}
                required
                value={form.age}
                onChange={(e) => handleChange('age', Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">身高 (cm)</label>
              <input
                type="number"
                min={50}
                max={250}
                required
                value={form.height}
                onChange={(e) => handleChange('height', Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* 当前体重 / 目标体重 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">当前体重 (kg)</label>
              <input
                type="number"
                step="1"
                min={20}
                max={300}
                required
                inputMode="numeric"
                value={currentWeightRaw}
                onChange={(e) => handleWeightChange(e.target.value, setCurrentWeightRaw, 'currentWeight')}
                onBlur={() => handleWeightBlur(currentWeightRaw, setCurrentWeightRaw, 'currentWeight')}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">目标体重 (kg)</label>
              <input
                type="number"
                step="1"
                min={20}
                max={300}
                required
                inputMode="numeric"
                value={targetWeightRaw}
                onChange={(e) => handleWeightChange(e.target.value, setTargetWeightRaw, 'targetWeight')}
                onBlur={() => handleWeightBlur(targetWeightRaw, setTargetWeightRaw, 'targetWeight')}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* 活动水平 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">活动水平</label>
            <div className="space-y-2">
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleChange('activityLevel', value)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    form.activityLevel === value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {ACTIVITY_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700"
          >
            生成碳循环目标
          </button>
        </form>
      </div>
    </div>
  );
}
