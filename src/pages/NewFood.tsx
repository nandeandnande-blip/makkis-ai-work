import { useState, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createCustomFood } from '../services/foodService';
import { FOOD_CATEGORY_LABELS } from '../utils/constants';
import { FoodCategory } from '../types';

const CATEGORIES: FoodCategory[] = [
  'protein',
  'carb',
  'fat',
  'vegetable',
  'fruit',
  'dairy',
  'other',
];

export default function NewFood() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/foods';
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '',
    category: 'protein' as FoodCategory,
    image: '',
    caloriesPer100g: '',
    proteinPer100g: '',
    carbsPer100g: '',
    fatPer100g: '',
  });
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setForm((prev) => ({ ...prev, image: dataUrl }));
      setError('');
    };
    reader.onerror = () => setError('图片读取失败，请重试');
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setForm((prev) => ({ ...prev, image: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const calories = Number(form.caloriesPer100g);
    const protein = Number(form.proteinPer100g);
    const carbs = Number(form.carbsPer100g);
    const fat = Number(form.fatPer100g);

    if (!form.name.trim()) {
      setError('请输入食物名称');
      return;
    }
    if ([calories, protein, carbs, fat].some((v) => v < 0)) {
      setError('营养数据不能为负数');
      return;
    }

    createCustomFood(user.id, {
      name: form.name.trim(),
      category: form.category,
      image: form.image.trim() || undefined,
      caloriesPer100g: calories,
      proteinPer100g: protein,
      carbsPer100g: carbs,
      fatPer100g: fat,
    });

    navigate(returnTo, { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-lg">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={16} />
          返回首页
        </Link>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-slate-800">新增自定义食物</h1>
          <p className="mb-8 text-sm text-slate-500">填写每 100g 的营养数据</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">食物名称</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                placeholder="例如：去皮鸡腿肉"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">图片（可选）</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {form.image ? (
                <div className="relative inline-block">
                  <img
                    src={form.image}
                    alt="食物预览"
                    className="h-32 w-32 rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-32 w-32 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-emerald-500 hover:text-emerald-600"
                >
                  <span className="text-2xl">+</span>
                  <span className="mt-1 text-xs">选择图片</span>
                </button>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">分类</label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleChange('category', c)}
                    className={`rounded-xl border px-2 py-2 text-sm transition ${
                      form.category === c
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {FOOD_CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">热量 (kcal/100g)</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  required
                  value={form.caloriesPer100g}
                  onChange={(e) => handleChange('caloriesPer100g', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">蛋白质 (g/100g)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  required
                  value={form.proteinPer100g}
                  onChange={(e) => handleChange('proteinPer100g', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">碳水 (g/100g)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  required
                  value={form.carbsPer100g}
                  onChange={(e) => handleChange('carbsPer100g', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">脂肪 (g/100g)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  required
                  value={form.fatPer100g}
                  onChange={(e) => handleChange('fatPer100g', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {error && <p className="text-sm text-rose-500">{error}</p>}

            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700"
            >
              保存食物
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
