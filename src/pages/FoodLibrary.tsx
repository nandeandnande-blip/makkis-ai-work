import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { filterFoods, deleteCustomFood } from '../services/foodService';
import ConfirmDialog from '../components/ConfirmDialog';
import FoodAvatar from '../components/FoodAvatar';
import { FOOD_CATEGORY_LABELS, FOOD_CATEGORY_COLORS } from '../utils/constants';
import { Food, FoodCategory } from '../types';

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
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadFoods = async () => {
      try {
        setError('');
        const data = await filterFoods(user.id, { keyword, category });
        if (!cancelled) setFoods(data);
      } catch (err) {
        console.error('[FoodLibrary] load foods error:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败');
      }
    };
    loadFoods();
    return () => {
      cancelled = true;
    };
  }, [user, keyword, category]);

  const handleDelete = (foodId: string) => {
    if (!user || isDeleting) return;
    setDeleteTargetId(foodId);
  };

  const handleConfirmDelete = async () => {
    if (!user || !deleteTargetId || isDeleting) return;
    setIsDeleting(true);
    setError('');
    try {
      await deleteCustomFood(user.id, deleteTargetId);
      setFoods((prev) => prev.filter((f) => f.id !== deleteTargetId));
    } catch (err) {
      console.error('[FoodLibrary] delete food error:', err);
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
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
        {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
        <div className="space-y-3">
          {foods.map((food) => (
            <div
              key={food.id}
              className="rounded-2xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <FoodAvatar image={food.image} name={food.name} category={food.category} className="h-12 w-12" />
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
                    disabled={isDeleting}
                    className="text-sm text-rose-500 hover:text-rose-700 disabled:text-rose-300"
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

      <ConfirmDialog
        isOpen={!!deleteTargetId}
        title="删除自定义食物"
        message="确定删除这个自定义食物吗？删除后不会影响已记录的饮食数据。"
        confirmText="删除"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
