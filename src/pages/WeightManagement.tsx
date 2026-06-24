import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp, Target } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import {
  getWeightRecordsByUser,
  saveWeightRecord,
} from '../services/weightService';
import { updateTargetWeight } from '../services/authService';

type Range = '7' | '30';

export default function WeightManagement() {
  const { user, profile, refreshProfile } = useAuth();
  const [range, setRange] = useState<Range>('7');
  const [weightInput, setWeightInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [targetInput, setTargetInput] = useState(String(profile?.targetWeight ?? ''));
  const [refreshKey, setRefreshKey] = useState(0);

  const today = new Date().toISOString().slice(0, 10);

  const records = useMemo(() => {
    if (!user) return [];
    return getWeightRecordsByUser(user.id);
  }, [user, refreshKey]);

  const chartData = useMemo(() => {
    const limit = Number(range);
    return records.slice(-limit).map((r) => ({
      date: r.date.slice(5),
      weight: r.weight,
    }));
  }, [records, range]);

  const currentWeight = records[records.length - 1]?.weight ?? profile?.currentWeight ?? 0;
  const targetWeight = profile?.targetWeight ?? 0;
  const diff = currentWeight - targetWeight;
  const startWeight = records[0]?.weight ?? currentWeight;
  const totalChange = currentWeight - startWeight;

  const handleSaveWeight = () => {
    if (!user || !weightInput) return;
    saveWeightRecord(user.id, today, {
      weight: Number(weightInput),
      note: noteInput || undefined,
    });
    setWeightInput('');
    setNoteInput('');
    setRefreshKey((k) => k + 1);
  };

  const handleSaveTarget = () => {
    if (!user || !targetInput) return;
    updateTargetWeight(user.id, Number(targetInput));
    refreshProfile();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white px-6 pb-6 pt-12 shadow-sm">
        <div className="mx-auto max-w-3xl">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            ← 返回首页
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-800">体重</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-6">
        {/* 核心数据卡片 */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">当前体重</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{currentWeight.toFixed(1)} kg</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">目标体重</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{targetWeight.toFixed(1)} kg</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">距离目标</p>
            <p className={`mt-1 text-2xl font-bold ${diff > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {diff > 0 ? `-${diff.toFixed(1)}` : `+${Math.abs(diff).toFixed(1)}`} kg
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">阶段变化</p>
            <div className="mt-1 flex items-center gap-1">
              {totalChange <= 0 ? (
                <TrendingDown size={20} className="text-emerald-500" />
              ) : (
                <TrendingUp size={20} className="text-rose-500" />
              )}
              <p className={`text-2xl font-bold ${totalChange <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)} kg
              </p>
            </div>
          </div>
        </section>

        {/* 趋势图 */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">趋势</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setRange('7')}
                className={`rounded-lg px-3 py-1 text-sm ${
                  range === '7' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                近7天
              </button>
              <button
                onClick={() => setRange('30')}
                className={`rounded-lg px-3 py-1 text-sm ${
                  range === '30' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                近30天
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis
                  domain={['dataMin - 1', 'dataMax + 1']}
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <Tooltip />
                <ReferenceLine
                  y={targetWeight}
                  stroke="#10b981"
                  strokeDasharray="5 5"
                  label={{ value: '目标', position: 'right', fill: '#10b981', fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#6366f1' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 目标体重管理 */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
            <Target size={20} className="text-emerald-500" />
            目标体重
          </h2>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleSaveTarget}
              className="rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white transition hover:bg-emerald-700"
            >
              保存
            </button>
          </div>
        </section>

        {/* 记录体重 */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-800">记录今日体重</h2>
          <div className="space-y-3">
            <input
              type="number"
              step="0.1"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="输入今日体重"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="备注（可选）"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleSaveWeight}
              disabled={!weightInput}
              className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
            >
              记录体重
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
