import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { updatePlanDay, DayKey } from '../services/planService';
import { CYCLE_STRATEGY } from '../utils/constants';
import { CycleType } from '../types';

const DAY_KEYS: { key: DayKey; label: string }[] = [
  { key: 'monday', label: '周一' },
  { key: 'tuesday', label: '周二' },
  { key: 'wednesday', label: '周三' },
  { key: 'thursday', label: '周四' },
  { key: 'friday', label: '周五' },
  { key: 'saturday', label: '周六' },
  { key: 'sunday', label: '周日' },
];

const TEMPLATES: Record<string, Record<DayKey, CycleType>> = {
  default: {
    monday: 'high',
    tuesday: 'medium',
    wednesday: 'low',
    thursday: 'high',
    friday: 'medium',
    saturday: 'low',
    sunday: 'medium',
  },
  high_focus: {
    monday: 'high',
    tuesday: 'high',
    wednesday: 'medium',
    thursday: 'high',
    friday: 'medium',
    saturday: 'low',
    sunday: 'low',
  },
  low_focus: {
    monday: 'medium',
    tuesday: 'low',
    wednesday: 'low',
    thursday: 'medium',
    friday: 'low',
    saturday: 'high',
    sunday: 'high',
  },
};

export default function CyclePlanner() {
  const { user, profile, plan, refreshProfile } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedDay, setExpandedDay] = useState<DayKey | null>(null);
  const [saveError, setSaveError] = useState('');
  const [savingDay, setSavingDay] = useState<DayKey | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  if (!user || !profile || !plan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">加载中...</p>
      </div>
    );
  }

  const handleDayChange = async (day: DayKey, type: CycleType) => {
    if (savingDay || savingTemplate) return;
    setSavingDay(day);
    setSaveError('');
    try {
      await updatePlanDay(user.id, profile, day, type);
      await refreshProfile();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('[CyclePlanner] handleDayChange error:', err);
      setSaveError('保存失败');
    } finally {
      setSavingDay(null);
    }
  };

  const applyTemplate = async (template: Record<DayKey, CycleType>) => {
    if (savingTemplate || savingDay) return;
    setSavingTemplate(true);
    setSaveError('');
    try {
      await Promise.all(
        (Object.keys(template) as DayKey[]).map((day) =>
          updatePlanDay(user.id, profile, day, template[day])
        )
      );
      await refreshProfile();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('[CyclePlanner] applyTemplate error:', err);
      setSaveError('保存失败');
    } finally {
      setSavingTemplate(false);
    }
  };

  const currentPlan = { ...plan };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-lg">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          ← 返回首页
        </Link>

        <div className="mt-4 rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-slate-800">碳循环计划</h1>
          <p className="mb-8 text-sm text-slate-500">点击每一天可展开查看推荐摄入，点击标签切换高/中/低碳日</p>
          {saveError && <p className="mb-4 text-sm text-rose-500">{saveError}</p>}

          {/* 整周模板 */}
          <div className="mb-6 space-y-2">
            <p className="text-sm font-medium text-slate-700">快速模板</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => applyTemplate(TEMPLATES.default)}
                disabled={savingTemplate}
                className="rounded-xl bg-slate-100 px-2 py-2 text-sm text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
              >
                {savingTemplate ? '保存中...' : '默认模板'}
              </button>
              <button
                onClick={() => applyTemplate(TEMPLATES.high_focus)}
                disabled={savingTemplate}
                className="rounded-xl bg-slate-100 px-2 py-2 text-sm text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
              >
                {savingTemplate ? '保存中...' : '高碳侧重'}
              </button>
              <button
                onClick={() => applyTemplate(TEMPLATES.low_focus)}
                disabled={savingTemplate}
                className="rounded-xl bg-slate-100 px-2 py-2 text-sm text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
              >
                {savingTemplate ? '保存中...' : '低碳侧重'}
              </button>
            </div>
          </div>

          {/* 单日编辑 */}
          <div className="space-y-3" key={refreshKey}>
            {DAY_KEYS.map(({ key, label }) => {
              const currentType = currentPlan[key];
              const target = plan.targets[currentType];
              const isExpanded = expandedDay === key;

              return (
                <div
                  key={key}
                  className="rounded-xl border border-slate-100 bg-white p-4 transition"
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
                    <span className="text-xs text-slate-400">
                      {isExpanded ? '收起' : '展开'}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="mt-4 space-y-4">
                      {/* 推荐摄入 */}
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

                      {/* 切换按钮 */}
                      <div className="flex gap-2">
                        {(Object.keys(CYCLE_STRATEGY) as CycleType[]).map((type) => (
                          <button
                            key={type}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDayChange(key, type);
                            }}
                            disabled={savingDay === key || savingTemplate}
                            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
                              currentType === type
                                ? `${CYCLE_STRATEGY[type].color} text-white`
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {savingDay === key ? '保存中...' : CYCLE_STRATEGY[type].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
