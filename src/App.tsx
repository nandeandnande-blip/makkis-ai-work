import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import FoodLibrary from './pages/FoodLibrary';
import NewFood from './pages/NewFood';
import DietRecord from './pages/DietRecord';
import Calendar from './pages/Calendar';
import WeightManagement from './pages/WeightManagement';
import Settings from './pages/Settings';
import CyclePlanner from './pages/CyclePlanner';

// 原型阶段未实现页面占位
function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <h1 className="mb-2 text-2xl font-bold text-slate-800">{name}</h1>
      <p className="text-slate-500">该页面为原型占位页，尚未实现。</p>
      <a href="/" className="mt-6 text-emerald-600 hover:underline">
        返回首页
      </a>
    </div>
  );
}

/** 已登录用户不可访问（登录/注册） */
function GuestOnly() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return user ? <Navigate to="/" replace /> : <Outlet />;
}

/** 必须登录且尚未完成资料填写 */
function RequireOnboarding() {
  const { user, profile, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (profile) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** 必须登录且已完成资料填写 */
function RequireProfile() {
  const { user, profile, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

function App() {
  return (
    <Routes>
      {/* 未登录可访问 */}
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* 已登录但未填写资料 */}
      <Route element={<RequireOnboarding />}>
        <Route path="/onboarding" element={<Onboarding />} />
      </Route>

      {/* 已登录且已填写资料 */}
      <Route element={<RequireProfile />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/calendar/:date" element={<Placeholder name="单日详情" />} />
        <Route path="/diet/:date" element={<DietRecord />} />
        <Route path="/foods" element={<FoodLibrary />} />
        <Route path="/foods/new" element={<NewFood />} />
        <Route path="/weight" element={<WeightManagement />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/cycle-planner" element={<CyclePlanner />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
