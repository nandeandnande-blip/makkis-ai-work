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

function buildPrompt(payload: DietPayload): string {
  const { date, cycleType, targets, intake, meals } = payload;
  const mealText = meals
    .filter((m) => m.foods.length > 0)
    .map((m) => {
      const foods = m.foods.map((f) => `${f.name} ${f.weight}g`).join('、');
      return `${m.mealType}：${foods}`;
    })
    .join('\n');

  return `你是一位碳循环饮食教练。请根据用户今天的饮食数据给出简洁分析（不超过300字），不要医疗诊断，不承诺减脂效果。

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

今日食物记录：
${mealText || '暂无记录'}

请按以下格式输出：
1. 今日整体评价
2. 当前主要偏差
3. 下一餐建议
4. 一句鼓励`;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
  }>;
}

function extractOutputText(data: unknown): string {
  const d = data as ChatCompletionResponse;
  const content = d.choices?.[0]?.message?.content;
  return content?.trim() ?? '';
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
        messages: [
          { role: 'user', content: buildPrompt(payload) },
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    if (!deepseekRes.ok) {
      const errorText = await deepseekRes.text();
      console.error('[analyze-diet] DeepSeek API error:', deepseekRes.status, errorText);
      return res.status(500).json({ error: 'AI服务调用失败，请稍后重试' });
    }

    const data = await deepseekRes.json();
    const analysis = extractOutputText(data);

    if (!analysis) {
      return res.status(500).json({ error: 'AI 返回结果为空，请稍后重试' });
    }

    return res.status(200).json({ analysis });
  } catch (err) {
    console.error('[analyze-diet] handler error:', err);
    return res.status(500).json({ error: 'AI 分析失败，请稍后重试' });
  }
}
