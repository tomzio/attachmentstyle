/**
 * POST /api/generate-desc
 * 调用 DeepSeek API 为四种依恋风格随机生成描述文案。
 * 请求体：{ typeScores: { name: string; score: number }[] }
 * 响应：  { descriptions: string[] }  (与 typeScores 顺序一致)
 */
import OpenAI from "openai";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { typeScores?: { name: string; score: number }[] };
    const { typeScores } = body;

    if (!typeScores || !Array.isArray(typeScores) || typeScores.length !== 4) {
      return Response.json({ error: "无效数据：需要 4 个类型的分数" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "DeepSeek API Key 未配置" }, { status: 500 });
    }

    const openai = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey,
      timeout: 15000,
    });

    // 构建 prompt
    const scoreLines = typeScores.map((t: { name: string; score: number }) => `${t.name}（模型得分: ${t.score.toFixed(2)}）`).join("\n");

    const prompt = `基于亲密关系经历量表 (ECR)，请根据以下四种依恋风格及其模型得分，为每种风格分别撰写一段性格相关的描述。

当前得分：
${scoreLines}

要求：
1. 为每种风格写一段描述（40-80字），真实反应性格特点，让读者感到专业被理解而非被评判。
2. 描述应贴合该风格的得分水平——高分时突出该倾向的鲜明表现，低分时强调其柔和/反向的一面。
3. 四种描述的文风和切入点要有明显差异，避免雷同句式。
4. 输出格式：严格按以下顺序，每行一段，不要编号、不要前缀、不要空行：

只输出四行纯文本描述，不要任何额外文字。`;

    const completion = await openai.chat.completions.create({
      model: "deepseek-v4-pro",
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content || "";

    // 解析四行描述
    const lines = content
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 5);

    if (lines.length !== 4) {
      console.error("DeepSeek 返回格式异常:", content);
      return Response.json({ error: "AI 生成格式异常，请重试" }, { status: 502 });
    }

    return Response.json({ descriptions: lines });
  } catch (error: unknown) {
    console.error("生成描述失败:", error instanceof Error ? error.message : String(error));
    return Response.json({ error: "AI 生成失败，请重试" }, { status: 500 });
  }
}
