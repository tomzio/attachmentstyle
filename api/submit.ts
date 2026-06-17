import { put } from '@vercel/blob';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { answers, avgA, avgB, types, finalType, userId, deviceType, deviceBrand, deviceOS } = body;

    if (!answers || !Array.isArray(answers) || answers.length !== 36) {
      return Response.json({ error: '无效数据' }, { status: 400 });
    }
    if (avgA == null || avgB == null || !types || !finalType) {
      return Response.json({ error: '无效数据' }, { status: 400 });
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await put(`results/${id}.json`, JSON.stringify({
      id, answers, avgA, avgB, types, finalType,
      userId: userId || null,
      device: deviceType ? { type: deviceType, brand: deviceBrand, os: deviceOS } : null,
      ip: request.headers.get('x-forwarded-for') || null,
      userAgent: request.headers.get('user-agent') || null,
      submittedAt: new Date().toISOString(),
    }), {
      access: 'private',
      contentType: 'application/json',
    });

    return Response.json({ success: true, id });
  } catch (error: any) {
    console.error('存储失败:', error?.message, error?.code);
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
