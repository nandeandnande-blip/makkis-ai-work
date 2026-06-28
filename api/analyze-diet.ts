import type { VercelRequest, VercelResponse } from '@vercel/node';

interface FoodItem {
  name: string;
  weight: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealGroup {
  mealType: string;
  foods: FoodItem[];
}

interface DietPayload {
  date: string;
  cycleType: string;
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  intake: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  meals: MealGroup[];
}

interface NextMealSuggestion {
  food: string;
  amount: string;
  reason: string;
}

interface DietAnalysisResult {
  overall: string;
  issues: string[];
  nextMealSuggestions: NextMealSuggestion[];
  encouragement: string;
}

const RESPONSE_SCHEMA = `{
  "overall": "今日整体评价（简短）",
  "issues": ["主要偏差1", "主要偏差2"],
  "nextMealSuggestions": [
    { "food": "鸡胸肉", "amount": "150g", "reason": "补充优质蛋白，脂肪较低" }
  ],
  "encouragement": "一句鼓励"
}`;

function buildPrompt(payload: DietPayload): string {
  const { date, cycleType, targets, intake, meals } = payload;
  const mealText = meals
    .filter((m) => m.foods.length > 0)
    .map((m) => {
      const foods = m.foods.map((f) => `${f.name} ${f.weight}g`).join('、');
      return `${m.mealType}：${foods}`;
    })
    .join('\n');

  const gaps = [];
  if (intake.protein < targets.protein) gaps.push(`蛋白质缺口约 ${Math.round(targets.protein - intake.protein)}g`);
  if (intake.carbs < targets.carbs) gaps.push(`碳水缺口约 ${Math.round(targets.carbs - intake.carbs)}g`);
  if (intake.fat < targets.fat) gaps.push(`脂肪缺口约 ${Math.round(targets.fat - intake.fat)}g`);
  if (intake.calories < targets.calories) gaps.push(`热量缺口约 ${Math.round(targets.calories - intake.calories)} kcal`);

  return `你是一位碳循环饮食教练。请根据用户今天的饮食数据生成分析，并严格以 JSON 对象返回，不要输出 Markdown、代码块或任何 JSON 以外的文本。

返回格式必须匹配以下 JSON Schema：
${RESPONSE_SCHEMA}

约束：
1. 结合当前碳循环类型（${cycleType}）和今日已摄入与目标的差距给出下一餐建议。
2. 下一餐建议必须包含：具体食物名称、建议克数、原因。建议 1-3 条。
3. 如果是低碳日，不要优先推荐米饭、面条、红薯、燕麦等高碳水食物；优先推荐鸡胸肉、鱼虾、蛋清、低脂牛肉、蔬菜、健康脂肪。
4. 如果蛋白质不足，优先推荐鸡胸肉、鱼虾、蛋清、低脂牛肉。
5. 如果脂肪不足，可推荐坚果、橄榄油、牛油果，但要控制克数。
6. 如果是高碳日，可适量推荐米饭、红薯、燕麦等优质碳水。
7. 不做医疗诊断，不承诺减脂效果。
8. overall 和 encouragement 简洁，整体 JSON 内容精炼。

日期：${date}
碳循环类型：${cycleType}

今日目标：
- 热量：${targets.calories} kcal
- 蛋白质：${targets.protein}g
- 碳水：${targets.carbs}g
- 脂肪：${targets.fat}g

今日已摄入：
- 热量：${intake.calories} kcal
- 蛋白质：${intake.protein}g
- 碳水：${intake.carbs}g
- 脂肪：${intake.fat}g

当前主要差距：
${gaps.length > 0 ? gaps.join('\n') : '暂无'}

今日食物记录：
${mealText || '暂无记录'}

请直接返回 JSON：`;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
  }>;
}

function extractContent(data: unknown): string {
  const d = data as ChatCompletionResponse;
  return d.choices?.[0]?.message?.content?.trim() ?? '';
}

function cleanJsonContent(content: string): string {
  return content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseAnalysis(content: string): DietAnalysisResult | null {
  try {
    const cleaned = cleanJsonContent(content);
    const parsed = JSON.parse(cleaned) as Partial<DietAnalysisResult>;

    if (
      typeof parsed.overall !== 'string' ||
      !Array.isArray(parsed.issues) ||
      !Array.isArray(parsed.nextMealSuggestions) ||
      typeof parsed.encouragement !== 'string'
    ) {
      return null;
    }

    const suggestions = parsed.nextMealSuggestions.filter(
      (s): s is NextMealSuggestion =>
        typeof (s as NextMealSuggestion).food === 'string' &&
        typeof (s as NextMealSuggestion).amount === 'string' &&
        typeof (s as NextMealSuggestion).reason === 'string'
    );

    return {
      overall: parsed.overall,
      issues: parsed.issues.filter((i): i is string => typeof i === 'string'),
      nextMealSuggestions: suggestions,
      encouragement: parsed.encouragement,
    };
  } catch (err) {
    console.error('[analyze-diet] parse analysis error:', err, 'content:', content);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DeepSeek API Key 未配置' });
  }

  const payload = req.body as DietPayload;
  if (
    !payload?.date ||
    !payload?.cycleType ||
    !payload?.targets ||
    !payload?.intake
  ) {
    return res.status(400).json({ error: '请求参数不完整' });
  }

  try {
    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: buildPrompt(payload) }],
        response_format: { type: 'json_object' },
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!deepseekRes.ok) {
      const errorText = await deepseekRes.text();
      console.error('[analyze-diet] DeepSeek API error:', deepseekRes.status, errorText);
      return res.status(500).json({ error: 'AI服务调用失败，请稍后重试' });
    }

    const data = await deepseekRes.json();
    const content = extractContent(data);

    if (!content) {
      return res.status(500).json({ error: 'AI 返回结果为空，请稍后重试' });
    }

    const result = parseAnalysis(content);
    if (!result) {
      return res.status(500).json({ error: 'AI 返回格式异常，请稍后重试' });
    }

    return res.status(200).json({ result });
  } catch (err) {
    console.error('[analyze-diet] handler error:', err);
    return res.status(500).json({ error: 'AI 分析失败，请稍后重试' });
  }
}
