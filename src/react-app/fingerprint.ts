/**
 * 生成匿名用户指纹（不涉及个人隐私，仅用于去重和统计）
 */
export function getFingerprint(): string {
  const parts = [
    navigator.userAgent.replace(/\([^)]*\)/g, '').slice(0, 60),  // 去括号内容，精简 UA
    navigator.platform || '',
    `${screen.width}x${screen.height}`,
    navigator.language || '',
    navigator.hardwareConcurrency || '',
    new Date().getTimezoneOffset().toString(),
  ];
  return simpleHash(parts.join('|'));
}

/** 提取设备友好名称 */
export function getDeviceInfo(): { type: string; brand: string; os: string } {
  const ua = navigator.userAgent;
  // 设备类型
  let type = 'Desktop';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) type = 'Mobile';
  else if (/Tablet|iPad/i.test(ua)) type = 'Tablet';
  // 品牌
  let brand = 'Unknown';
  if (/iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(ua)) brand = 'Apple';
  else if (/Android/i.test(ua)) {
    const m = ua.match(/;\s*([^;]+?)\s*Build/);
    if (m) brand = m[1].trim();
    else brand = 'Android';
  } else if (/Windows/i.test(ua)) brand = 'Windows';
  else if (/Linux/i.test(ua) && !/Android/i.test(ua)) brand = 'Linux';
  // OS
  let os = 'Unknown';
  if (/Windows NT 10/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT ([0-9.]+)/i.test(ua)) os = `Windows ${RegExp.$1}`;
  else if (/Mac OS X ([0-9_]+)/i.test(ua)) os = `macOS ${RegExp.$1.replace(/_/g, '.')}`;
  else if (/Android ([0-9.]+)/i.test(ua)) os = `Android ${RegExp.$1}`;
  else if (/iPhone OS ([0-9_]+)/i.test(ua)) os = `iOS ${RegExp.$1.replace(/_/g, '.')}`;
  else if (/Linux/i.test(ua)) os = 'Linux';
  return { type, brand, os };
}

function simpleHash(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
