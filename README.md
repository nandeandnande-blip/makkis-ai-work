# Carb Cycle Tracker

碳循环减脂管理系统 MVP。

## 技术栈

- React 18 + TypeScript
- Vite
- TailwindCSS
- React Router DOM
- Recharts
- LocalStorage（V1 数据存储）

## 项目目录结构

```
carb-cycle-tracker/
├── public/                         # 静态资源
│   └── foods/                      # 食物图片（可选）
├── src/
│   ├── components/                 # 可复用组件
│   │   ├── common/                 # 通用组件
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── MacroBar.tsx
│   │   │   └── PageLayout.tsx
│   │   ├── dashboard/              # Dashboard 相关组件
│   │   │   ├── TodayCycleType.tsx
│   │   │   ├── MacroSummary.tsx
│   │   │   ├── QuickActions.tsx
│   │   │   └── WeightShortcut.tsx
│   │   ├── calendar/               # 日历相关组件
│   │   │   ├── MonthCalendar.tsx
│   │   │   └── CycleLegend.tsx
│   │   ├── food/                   # 食物库相关组件
│   │   │   ├── FoodCard.tsx
│   │   │   ├── FoodForm.tsx
│   │   │   └── MealFoodList.tsx
│   │   ├── weight/                 # 体重管理相关组件
│   │   │   ├── WeightChart.tsx
│   │   │   ├── WeightStats.tsx
│   │   │   └── WeightForm.tsx
│   │   └── settings/               # 设置页相关组件
│   │       ├── ProfileForm.tsx
│   │       └── CyclePlanForm.tsx
│   ├── contexts/                   # React Context
│   │   ├── AuthContext.tsx         # 登录态
│   │   └── AppDataContext.tsx      # 全局数据（用户、计划、记录）
│   ├── hooks/                      # 自定义 Hooks
│   │   ├── useAuth.ts
│   │   ├── useCalcEngine.ts        # 碳循环计算引擎
│   │   └── useLocalStorage.ts
│   ├── pages/                      # 页面级组件
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Onboarding.tsx          # 首次资料填写
│   │   ├── Dashboard.tsx           # 首页
│   │   ├── Calendar.tsx            # 日历页
│   │   ├── DayDetail.tsx           # 单日详情
│   │   ├── DietRecord.tsx          # 饮食记录
│   │   ├── FoodLibrary.tsx         # 食物库
│   │   ├── NewFood.tsx             # 新建食物
│   │   ├── WeightManagement.tsx    # 体重管理
│   │   └── Settings.tsx            # 设置
│   ├── services/                   # 数据服务层
│   │   ├── storage.ts              # LocalStorage 封装
│   │   ├── authService.ts          # 登录注册逻辑
│   │   ├── foodService.ts          # 食物数据操作
│   │   ├── weightService.ts        # 体重记录操作
│   │   └── dailyRecordService.ts   # 每日记录操作
│   ├── types/                      # TypeScript 类型定义
│   │   └── index.ts                # 全量 Schema
│   ├── utils/                      # 工具函数
│   │   ├── calculator.ts           # BMR/TDEE/目标计算
│   │   ├── dateHelpers.ts          # 日期处理
│   │   └── constants.ts            # 常量（活动系数、餐次等）
│   ├── App.tsx                     # 根组件 + 路由
│   ├── main.tsx                    # 入口
│   └── index.css                   # Tailwind 入口
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## 路由设计

| 路径 | 页面 | 说明 |
|------|------|------|
| `/login` | 登录页 | 邮箱 + 密码登录 |
| `/register` | 注册页 | 注册新账号 |
| `/onboarding` | 首次资料填写 | 性别/年龄/身高/体重/目标体重/活动水平/碳循环计划 |
| `/` | Dashboard 首页 | 今日类型、推荐/已摄入/剩余摄入、今日体重、快速记录入口 |
| `/calendar` | 日历页 | 月历视图，标记高/中/低碳日 |
| `/calendar/:date` | 单日详情页 | 某一天的碳循环类型、饮食记录、体重 |
| `/diet/:date?meal=:mealType` | 饮食记录页 | 选择食物、输入克数、保存到指定日期和餐次 |
| `/foods` | 食物库页 | 系统食物 + 我的食物 |
| `/foods/new` | 新建食物页 | 新增自定义食物 |
| `/weight` | 体重管理页 | 体重记录、趋势图、周变化、月变化、累计/剩余减重、达成进度 |
| `/settings` | 设置页 | 基础信息、当前体重、目标体重、活动水平、碳循环计划 |

## 开发计划

1. 搭建 Vite + React + Tailwind 工程
2. 实现 TypeScript Schema 与 LocalStorage 服务层
3. 实现注册、登录、首次资料填写
4. 实现碳循环计算引擎
5. 实现 Dashboard 首页
6. 实现饮食记录与食物库
7. 实现日历与单日详情
8. 实现体重管理与减脂报表
9. 实现设置页（含自动重算目标）
