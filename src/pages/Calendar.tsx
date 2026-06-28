import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getCycleTypeForDate } from '../utils/calculator';
import { CYCLE_STRATEGY, WEEK_DAYS } from '../utils/constants';
import { formatLocalDate, getTodayLocal } from '../utils/date';
import { getDailyRecordsByDateRange } from '../services/dailyRecordService';
import { sumMacros } from '../utils/calculator';
import { DailyRecord } from '../types';

function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay(); // 周日为起点

  const days: Date[] = [];
  for (let i = startPadding - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function formatDateKey(date: Date): string {
  return formatLocalDate(date);
}

function MacroBar({
  current,
  target,
  color,
}: {
  current: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="relative h-5 w-full overflow-hidden rounded-md bg-slate-100">
      <div className={`absolute left-0 top-0 h-full rounded-md ${color}`} style={{ width: `${pct}%` }} />
      <span className="absolute inset-0 flex items-center px-1 text-[10px] font-medium text-slate-700">
        {Math.round(current)}
      </span>
    </div>
  );
}

export default function Calendar() {
  const navigate = useNavigate();
  const { user, plan } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyRecords, setDailyRecords] = useState<Record<string, DailyRecord>>({});

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = useMemo(() => getMonthDays(year, month), [year, month]);
  const monthLabel = `${year}年 ${month + 1}月`;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleSelectDate = (date: Date) => {
    navigate(`/?date=${formatDateKey(date)}`);
  };

  useEffect(() => {
    if (!user || !plan || days.length === 0) return;
    let cancelled = false;
    const loadRecords = async () => {
      try {
        const start = formatLocalDate(days[0]);
        const end = formatLocalDate(days[days.length - 1]);
        const map = await getDailyRecordsByDateRange(user.id, start, end);
        if (!cancelled) setDailyRecords(map);
      } catch (err) {
        console.error('[Calendar] load records error:', err);
      }
    };
    loadRecords();
    return () => {
      cancelled = true;
    };
  }, [user, plan, days]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-none sm:max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          ← 返回首页
        </Link>

        <div className="mt-4 rounded-3xl bg-white p-4 sm:p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-800">{monthLabel}</h1>
            <div className="flex gap-2">
              <button
                onClick={handlePrevMonth}
                className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={handleNextMonth}
                className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-slate-500 sm:gap-2 sm:text-sm">
            {WEEK_DAYS.map((d) => (
              <div key={d.key}>{d.label}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
            {days.map((date, idx) => {
              const dateKey = formatDateKey(date);
              const isCurrentMonth = date.getMonth() === month;
              const record = dailyRecords[dateKey];
              const cycleType = record?.cycleType ?? (plan ? getCycleTypeForDate(plan, dateKey) : 'medium');
              const strategy = CYCLE_STRATEGY[cycleType];
              const isToday = dateKey === getTodayLocal();

              const allFoods = record ? record.meals.flatMap((m) => m.foods) : [];
              const intake = allFoods.length > 0 ? sumMacros(allFoods) : null;
              const hasIntake = intake && (intake.calories > 0 || intake.protein > 0 || intake.carbs > 0 || intake.fat > 0);
              const target = plan?.targets[cycleType];

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectDate(date)}
                  className={`flex min-h-[7rem] flex-col items-start justify-start rounded-xl border p-1.5 text-sm transition ${
                    isCurrentMonth ? 'bg-white text-slate-800' : 'bg-slate-50 text-slate-400'
                  } ${isToday ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-100'} hover:bg-slate-50`}
                >
                  <span className="text-lg font-medium leading-none">{date.getDate()}</span>
                  {hasIntake && (
                    <div className="mt-1.5 flex w-full flex-col gap-1">
                      <span className="rounded-md bg-slate-900 px-1 py-0.5 text-center text-[10px] text-white">
                        {strategy.label}
                      </span>
                      {target && (
                        <>
                          <MacroBar current={intake.protein} target={target.protein} color="bg-yellow-300" />
                          <MacroBar current={intake.carbs} target={target.carbs} color="bg-blue-300" />
                          <MacroBar current={intake.fat} target={target.fat} color="bg-red-300" />
                        </>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
