import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getCycleTypeForDate } from '../utils/calculator';
import { CYCLE_STRATEGY, WEEK_DAYS } from '../utils/constants';

function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // 周一为起点

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
  return date.toISOString().slice(0, 10);
}

export default function Calendar() {
  const navigate = useNavigate();
  const { plan } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());

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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          ← 返回首页
        </Link>

        <div className="mt-4 rounded-3xl bg-white p-6 shadow-sm">
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

          <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium text-slate-500">
            {WEEK_DAYS.map((d) => (
              <div key={d.key}>{d.label}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {days.map((date, idx) => {
              const dateKey = formatDateKey(date);
              const isCurrentMonth = date.getMonth() === month;
              const cycleType = plan ? getCycleTypeForDate(plan, dateKey) : 'medium';
              const strategy = CYCLE_STRATEGY[cycleType];
              const isToday = dateKey === new Date().toISOString().slice(0, 10);

              const badgeClass =
                cycleType === 'high'
                  ? 'bg-emerald-100 text-emerald-700'
                  : cycleType === 'medium'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-rose-100 text-rose-700';

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectDate(date)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl border text-sm transition ${
                    isCurrentMonth ? 'bg-white text-slate-800' : 'bg-slate-50 text-slate-400'
                  } ${isToday ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-100'} hover:bg-slate-50`}
                >
                  <span className="font-medium">{date.getDate()}</span>
                  <span className={`mt-1 rounded px-1.5 py-0.5 text-[10px] ${badgeClass}`}>
                    {strategy.label}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
