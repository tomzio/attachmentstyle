import { del, head } from '@vercel/blob';

export async function POST(request: Request): Promise<Response> {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token || token !== process.env.ADMIN_TOKEN) {
      return Response.json({ error: '未授权访问' }, { status: 401 });
    }

    const { pathname } = await request.json();
    if (!pathname || typeof pathname !== 'string') {
      return Response.json({ error: '缺少 pathname' }, { status: 400 });
    }

    // 验证 blob 存在
    const blob = await head(pathname);
    if (!blob) {
      return Response.json({ error: '记录不存在' }, { status: 404 });
    }

    await del(pathname);
    return Response.json({ success: true });
  } catch (error: any) {
    console.error('删除失败:', error?.message);
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
