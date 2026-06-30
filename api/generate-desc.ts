/**
 * POST /api/generate-desc
 * 调用 DeepSeek API 为四种依恋风格随机生成描述文案。
 * 请求体：{ typeScores: { name: string; score: number }[] }
 * 响应：  { descriptions: string[] }  (与 typeScores 顺序一致)
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { typeScores } = body;

    if (!typeScores || !Array.isArray(typeScores) || typeScores.length !== 4) {
      return Response.json({ error: "无效数据：需要 4 个类型的分数" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "DeepSeek API Key 未配置" }, { status: 500 });
    }

    // 构建 prompt
    const scoreLines = typeScores.map((t: { name: string; score: number }) => `${t.name}（模型得分: ${t.score.toFixed(2)}）`).join("\n");

    const prompt = `你是依恋理论（Attachment Theory）领域的中文心理学作家。请根据以下四种依恋风格及其模型得分，为每种风格分别撰写一段有洞察力的、人性化的描述。

当前得分：
${scoreLines}

要求：
1. 为每种风格写一段描述（40-80字），语气温暖但不失专业，让读者感到被理解而非被评判。
2. 描述应贴合该风格的得分水平——高分时突出该倾向的鲜明表现，低分时强调其柔和/反向的一面。
3. 四种描述的文风和切入点要有明显差异，避免雷同句式。
4. 输出格式：严格按以下顺序，每行一段，不要编号、不要前缀、不要空行：
安全型的描述
恐惧型的描述
痴迷型的描述
疏离型的描述

只输出四行纯文本描述，不要任何额外文字。`;

    // 调用 DeepSeek API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let aiRes: Response;
    try {
      aiRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.95,
          max_tokens: 800,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      console.error("DeepSeek API 错误:", aiRes.status, errText);
      return Response.json({ error: `DeepSeek API 返回错误 ${aiRes.status}` }, { status: 502 });
    }

    const aiData: any = await aiRes.json();
    const content: string = aiData?.choices?.[0]?.message?.content || "";

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
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return Response.json({ error: "请求超时，请重试" }, { status: 504 });
    }
    console.error("生成描述失败:", error?.message);
    return Response.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
