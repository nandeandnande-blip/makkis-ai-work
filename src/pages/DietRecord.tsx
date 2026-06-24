import { useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Search, Plus, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { filterFoods, getRecentFoods, getFrequentFoods } from '../services/foodService';
import { addFoodToMeal } from '../services/dailyRecordService';
import { getCycleTypeForDate } from '../utils/calculator';
import { FOOD_CATEGORY_LABELS, FOOD_CATEGORY_COLORS, MEAL_CONFIG } from '../utils/constants';
import { Food, FoodCategory, MealType } from '../types';

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

function FoodImage({ src, name, category }: { src?: string; name: string; category: FoodCategory }) {
  const initials = name.slice(0, 1);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-12 w-12 rounded-xl object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white ${FOOD_CATEGORY_COLORS[category].split(' ')[0]}`}>
      {initials}
    </div>
  );
}

function FoodCard({
  food,
  onSelect,
}: {
  food: Food;
  onSelect: (food: Food) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm transition hover:bg-slate-50">
      <FoodImage src={food.image} name={food.name} category={food.category} />
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-slate-800">{food.name}</p>
        <p className="text-xs text-slate-500">
          {food.caloriesPer100g} kcal/100g · {FOOD_CATEGORY_LABELS[food.category]}
        </p>
      </div>
      <button
        onClick={() => onSelect(food)}
        className="rounded-full bg-emerald-50 p-2 text-emerald-600 transition hover:bg-emerald-100"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

function FoodSection({ title, foods, onSelect }: { title: string; foods: Food[]; onSelect: (food: Food) => void }) {
  if (foods.length === 0) return null;
  return (
    <div className="mb-6">
      <h3 className="mb-3 text-sm font-medium text-slate-700">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {foods.map((food) => (
          <FoodCard key={food.id} food={food} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

export default function DietRecord() {
  const navigate = useNavigate();
  const { date } = useParams<{ date: string }>();
  const [searchParams] = useSearchParams();
  const mealType = (searchParams.get('meal') as MealType) ?? 'breakfast';

  const { user, plan } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<FoodCategory | 'all'>('all');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [weight, setWeight] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  if (!user || !date) {
    navigate('/', { replace: true });
    return null;
  }

  const allFoods = useMemo(
    () => filterFoods(user.id, { keyword, category }),
    [user.id, keyword, category, refreshKey]
  );
  const recentFoods = useMemo(() => getRecentFoods(user.id, 10), [user.id, refreshKey]);
  const frequentFoods = useMemo(() => getFrequentFoods(user.id, 5), [user.id, refreshKey]);

  const cycleType = plan ? getCycleTypeForDate(plan, date) : 'medium';

  const calculated = useMemo(() => {
    if (!selectedFood || !weight) return null;
    const gram = Number(weight);
    if (gram <= 0) return null;
    const ratio = gram / 100;
    return {
      calories: Math.round(selectedFood.caloriesPer100g * ratio * 10) / 10,
      protein: Math.round(selectedFood.proteinPer100g * ratio * 10) / 10,
      carbs: Math.round(selectedFood.carbsPer100g * ratio * 10) / 10,
      fat: Math.round(selectedFood.fatPer100g * ratio * 10) / 10,
    };
  }, [selectedFood, weight]);

  const handleSelect = (food: Food) => {
    setSelectedFood(food);
    setWeight('');
  };

  const handleSave = () => {
    if (!selectedFood || !calculated) return;

    addFoodToMeal(user.id, date, mealType, {
      food: selectedFood,
      weight: Number(weight),
    }, cycleType);

    setRefreshKey((k) => k + 1);
    setSelectedFood(null);
    setWeight('');
  };

  const handleQuickSave = (food: Food) => {
    addFoodToMeal(user.id, date, mealType, { food, weight: 100 }, cycleType);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white px-6 pb-6 pt-12 shadow-sm">
        <div className="mx-auto max-w-3xl">
          <Link
            to="/"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={16} />
            ← 返回首页
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {MEAL_CONFIG[mealType].label} · {date}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {selectedFood ? `已选择：${selectedFood.name}` : '选择食物并输入重量'}
              </p>
            </div>
            <Link
              to={`/foods/new?returnTo=${encodeURIComponent(`/diet/${date}?meal=${mealType}`)}`}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
            >
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
        {/* 最近使用 / 常用 */}
        {keyword === '' && category === 'all' && (
          <>
            <FoodSection title="最近使用" foods={recentFoods} onSelect={handleSelect} />
            <FoodSection title="常用食物" foods={frequentFoods} onSelect={handleSelect} />
          </>
        )}

        {/* 全部食物 */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-slate-700">
            {keyword || category !== 'all' ? '搜索结果' : '全部食物'}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {allFoods.map((food) => (
              <FoodCard key={food.id} food={food} onSelect={handleSelect} />
            ))}
          </div>
        </div>

        {allFoods.length === 0 && (
          <div className="py-12 text-center text-slate-500">未找到匹配的食物</div>
        )}
      </main>

      {/* 克数输入弹窗 */}
      {selectedFood && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FoodImage src={selectedFood.image} name={selectedFood.name} category={selectedFood.category} />
                <div>
                  <h3 className="font-bold text-slate-800">{selectedFood.name}</h3>
                  <p className="text-xs text-slate-500">{selectedFood.caloriesPer100g} kcal/100g</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFood(null)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mb-2 block text-sm font-medium text-slate-700">重量 (g)</label>
            <input
              type="number"
              min={1}
              step="1"
              autoFocus
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="例如：200"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-2xl font-bold outline-none focus:border-emerald-500"
            />

            {calculated && (
              <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-slate-500">热量</p>
                  <p className="font-semibold text-slate-800">{calculated.calories}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-slate-500">蛋白质</p>
                  <p className="font-semibold text-slate-800">{calculated.protein}g</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-slate-500">碳水</p>
                  <p className="font-semibold text-slate-800">{calculated.carbs}g</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-slate-500">脂肪</p>
                  <p className="font-semibold text-slate-800">{calculated.fat}g</p>
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => handleQuickSave(selectedFood)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 font-medium text-slate-700 transition hover:bg-slate-50"
              >
                默认 100g
              </button>
              <button
                onClick={handleSave}
                disabled={!calculated}
                className="flex-1 rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
