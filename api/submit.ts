import { put } from '@vercel/blob';

/** IP 地理定位 —— 调用 ip-api.com 免费 API（无需 Key） */
async function geoLookup(ip: string): Promise<object | null> {
  // 跳过私有/本地 IP
  if (
    ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' ||
    ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.16.')
  ) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,isp,query`,
      { signal: controller.signal },
    );
    const data: any = await res.json();
    if (data.status === 'success') {
      return {
        country: data.country || '',
        region: data.regionName || '',
        city: data.city || '',
        isp: data.isp || '',
      };
    }
    return null;
  } catch {
    // 超时或网络错误 —— 不阻塞提交流程
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const {
      answers, avgA, avgB, types, finalType, userId,
      deviceType, deviceBrand, deviceOS,
      browser, isTouch, screenResolution, timezone, colorDepth, pixelRatio, languages,
    } = body;

    if (!answers || !Array.isArray(answers) || answers.length !== 36) {
      return Response.json({ error: '无效数据' }, { status: 400 });
    }
    if (avgA == null || avgB == null || !types || !finalType) {
      return Response.json({ error: '无效数据' }, { status: 400 });
    }

    // 提取客户端 IP（x-forwarded-for 可能包含多个逗号分隔的 IP）
    const rawIp = request.headers.get('x-forwarded-for');
    const clientIp = rawIp ? rawIp.split(',')[0].trim() : null;

    // IP 地理定位（并行执行，不阻塞）
    const geoPromise = clientIp ? geoLookup(clientIp) : Promise.resolve(null);

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 等待地理定位结果
    const locationData = await geoPromise;

    await put(`results/${id}.json`, JSON.stringify({
      id, answers, avgA, avgB, types, finalType,
      userId: userId || null,
      device: deviceType ? {
        type: deviceType,
        brand: deviceBrand || null,
        os: deviceOS || null,
        browser: browser || null,
        isTouch: isTouch != null ? isTouch : null,
        screenResolution: screenResolution || null,
        timezone: timezone || null,
        colorDepth: colorDepth != null ? colorDepth : null,
        pixelRatio: pixelRatio != null ? pixelRatio : null,
        languages: languages || null,
      } : null,
      ip: clientIp,
      location: locationData,
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
