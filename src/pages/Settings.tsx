import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile } from '../services/authService';
import { calculateCycleTargets } from '../utils/calculator';
import { updatePlanTargets } from '../services/authService';
import { ACTIVITY_LABELS, GENDER_LABELS } from '../utils/constants';
import { ActivityLevel, Gender } from '../types';

export default function Settings() {
  const { user, profile, plan, refreshProfile, logout } = useAuth();

  const [form, setForm] = useState({
    gender: profile?.gender ?? 'male',
    age: profile?.age ?? 28,
    height: profile?.height ?? 175,
    currentWeight: profile?.currentWeight ?? 78,
    targetWeight: profile?.targetWeight ?? 70,
    activityLevel: profile?.activityLevel ?? 'moderately_active',
  });
  const [saved, setSaved] = useState(false);

  if (!user || !profile || !plan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">加载中...</p>
      </div>
    );
  }

  const handleChange = (field: keyof typeof form, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    const updatedProfile = updateProfile(user.id, {
      gender: form.gender as Gender,
      age: Number(form.age),
      height: Number(form.height),
      currentWeight: Number(form.currentWeight),
      targetWeight: Number(form.targetWeight),
      activityLevel: form.activityLevel as ActivityLevel,
    });

    // 身体数据变化后重算碳循环目标
    const calc = calculateCycleTargets(updatedProfile);
    updatePlanTargets(user.id, calc.cycleTargets);

    refreshProfile();
    setSaved(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-lg">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          ← 返回首页
        </Link>

        <div className="mt-4 rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-slate-800">设置</h1>
          <p className="mb-8 text-sm text-slate-500">管理你的个人信息和减脂目标</p>

          <div className="space-y-5">
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
                  value={form.age}
                  onChange={(e) => handleChange('age', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">身高 (cm)</label>
                <input
                  type="number"
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
                  step="0.1"
                  value={form.currentWeight}
                  onChange={(e) => handleChange('currentWeight', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">目标体重 (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.targetWeight}
                  onChange={(e) => handleChange('targetWeight', Number(e.target.value))}
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

            {/* 碳循环策略入口 */}
            <Link
              to="/cycle-planner"
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-800">碳循环计划</p>
                <p className="text-xs text-slate-500">编辑高/中/低碳日安排</p>
              </div>
              <span className="text-slate-400">→</span>
            </Link>

            {saved && <p className="text-sm text-emerald-600">保存成功</p>}

            <button
              onClick={handleSave}
              className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700"
            >
              保存设置
            </button>

            <button
              onClick={logout}
              className="w-full rounded-xl border border-rose-200 bg-white py-3 font-semibold text-rose-500 transition hover:bg-rose-50"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
