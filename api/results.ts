import { list } from '@vercel/blob';

export async function GET(request: Request): Promise<Response> {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token || token !== process.env.ADMIN_TOKEN) {
      return Response.json({ error: '未授权访问' }, { status: 401 });
    }

    const { blobs } = await list({ prefix: 'results/' });

    const results = await Promise.all(
      blobs.map(async (blob: any) => {
        try {
          const res = await fetch(blob.url, {
            headers: {
              Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
            },
          });
          if (!res.ok) return null;
          const data = await res.json();
          // 注入 pathname 供删除使用
          data.pathname = blob.pathname;
          return data;
        } catch {
          return null;
        }
      })
    );

    const valid = results
      .filter(Boolean)
      .sort((a: any, b: any) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );

    return Response.json({ total: valid.length, results: valid });
  } catch (error: any) {
    console.error('获取失败:', error?.message);
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
