import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getCycleTypeForDate } from '../utils/calculator';
import { CYCLE_STRATEGY, WEEK_DAYS } from '../utils/constants';
import { formatLocalDate, getTodayLocal } from '../utils/date';
import { getDailyRecordsByDateRange, CalendarDayData } from '../services/dailyRecordService';

function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay(); // 周日为起点
  const totalCells = startPadding + lastDay.getDate();
  const endPadding = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

  const days: Date[] = [];
  for (let i = startPadding - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  for (let i = 1; i <= endPadding; i++) {
    days.push(new Date(year, month + 1, i));
  }
  return days;
}

function formatDateKey(date: Date): string {
  return formatLocalDate(date);
}

const MACRO_COLORS = {
  protein: '#FDBA74',
  carbs: '#A5B4FC',
  fat: '#FCA5A5',
};

function MacroBar({ current, target, color }: { current: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return (
    <div className="relative h-2 w-[95%] self-center sm:h-2.5 sm:w-[90%]">
      <div className="absolute inset-0 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium tabular-nums text-slate-700 sm:text-[11px]">
        {Math.round(current)}
      </span>
    </div>
  );
}

export default function Calendar() {
  const navigate = useNavigate();
  const { user, plan } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyRecords, setDailyRecords] = useState<Record<string, CalendarDayData>>({});

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
    if (!user || !plan) return;
    let cancelled = false;
    const loadRecords = async () => {
      try {
        const start = formatLocalDate(new Date(year, month, 1));
        const end = formatLocalDate(new Date(year, month + 1, 0));
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
  }, [user, plan, year, month]);

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="mx-auto w-full max-w-none sm:max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          ← 返回首页
        </Link>

        <div className="mt-4 rounded-3xl bg-white p-3 sm:p-6 shadow-sm">
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

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 sm:gap-2 sm:text-sm">
            {WEEK_DAYS.map((d) => (
              <div key={d.key}>{d.label}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
            {days.map((date, idx) => {
              const dateKey = formatDateKey(date);
              const isCurrentMonth = date.getMonth() === month;
              const record = dailyRecords[dateKey];
              const cycleType = plan ? getCycleTypeForDate(plan, dateKey) : 'medium';
              const strategy = CYCLE_STRATEGY[cycleType];
              const isToday = dateKey === getTodayLocal();
              const target = plan?.targets[cycleType];

              const hasIntake =
                !!record &&
                (record.totalCalories > 0 ||
                  record.totalProtein > 0 ||
                  record.totalCarbs > 0 ||
                  record.totalFat > 0);

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectDate(date)}
                  className={`flex min-h-[6.5rem] flex-col items-start rounded-xl border p-1 text-sm transition sm:min-h-[8rem] sm:p-1.5 ${
                    isCurrentMonth ? 'bg-white text-slate-800' : 'bg-slate-50 text-slate-400'
                  } ${isToday ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-100'} hover:bg-slate-50`}
                >
                  <span className={`text-lg font-medium leading-none ${isToday ? 'text-emerald-600' : ''}`}>
                    {date.getDate()}
                  </span>

                  <span
                    className={`mt-1 flex h-5 w-[80%] items-center justify-center self-center rounded text-[10px] font-medium text-white sm:w-[70%] ${strategy.color}`}
                  >
                    {strategy.label}
                  </span>

                  {hasIntake && target && (
                    <div className="mt-1.5 flex w-full flex-1 flex-col justify-center gap-1.5 sm:mt-2">
                      <MacroBar current={record.totalProtein} target={target.protein} color={MACRO_COLORS.protein} />
                      <MacroBar current={record.totalCarbs} target={target.carbs} color={MACRO_COLORS.carbs} />
                      <MacroBar current={record.totalFat} target={target.fat} color={MACRO_COLORS.fat} />
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
