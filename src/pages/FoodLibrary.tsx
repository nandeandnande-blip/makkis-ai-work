import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { filterFoods, deleteCustomFood } from '../services/foodService';
import { FOOD_CATEGORY_LABELS, FOOD_CATEGORY_COLORS } from '../utils/constants';
import { Food, FoodCategory } from '../types';

function FoodImage({ food }: { food: Food }) {
  const initials = food.name.slice(0, 1);
  if (food.image) {
    return (
      <img
        src={food.image}
        alt={food.name}
        className="h-12 w-12 rounded-xl object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white ${FOOD_CATEGORY_COLORS[food.category].split(' ')[0]}`}>
      {initials}
    </div>
  );
}

const CATEGORIES: (FoodCategory | 'all')[] = [
  'all',
  'protein',
  'carb',
  'fat',
  'vegetable',
  'fruit',
  'dairy',
  'other',
];

export default function FoodLibrary() {
  const { user } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<FoodCategory | 'all'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const foods = useMemo(() => {
    if (!user) return [];
    return filterFoods(user.id, { keyword, category });
  }, [user, keyword, category, refreshKey]);

  const handleDelete = (foodId: string) => {
    if (!user) return;
    if (confirm('确定删除这个自定义食物吗？')) {
      deleteCustomFood(user.id, foodId);
      setRefreshKey((k) => k + 1);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white px-6 pb-6 pt-12 shadow-sm">
        <div className="mx-auto max-w-3xl">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            ← 返回首页
          </Link>
          <div className="mt-2 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-800">饮食</h1>
            <Link
              to="/foods/new"
              className="flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
            >
              <Plus size={16} />
              新增食物
            </Link>
          </div>

          {/* 搜索 */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索食物"
              className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 outline-none focus:border-emerald-500"
            />
          </div>

          {/* 分类筛选 */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition ${
                  category === c
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c === 'all' ? '全部' : FOOD_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6">
        <div className="space-y-3">
          {foods.map((food) => (
            <div
              key={food.id}
              className="rounded-2xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <FoodImage food={food} />
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800">{food.name}</h3>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${
                      FOOD_CATEGORY_COLORS[food.category]
                    }`}
                  >
                    {FOOD_CATEGORY_LABELS[food.category]}
                  </span>
                </div>
                {food.source === 'custom' && (
                  <button
                    onClick={() => handleDelete(food.id)}
                    className="text-sm text-rose-500 hover:text-rose-700"
                  >
                    删除
                  </button>
                )}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-slate-500">热量</p>
                  <p className="font-semibold text-slate-800">{food.caloriesPer100g}</p>
                  <p className="text-xs text-slate-400">kcal/100g</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-slate-500">蛋白质</p>
                  <p className="font-semibold text-slate-800">{food.proteinPer100g}g</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-slate-500">碳水</p>
                  <p className="font-semibold text-slate-800">{food.carbsPer100g}g</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-slate-500">脂肪</p>
                  <p className="font-semibold text-slate-800">{food.fatPer100g}g</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {foods.length === 0 && (
          <div className="py-12 text-center text-slate-500">未找到匹配的食物</div>
        )}
      </main>
    </div>
  );
}
