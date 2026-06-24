import { useState, useMemo } from 'react';

// ===================== 类型 =====================
interface DeviceInfo {
  type: string;
  brand: string;
  os: string;
  browser?: string | null;
  isTouch?: boolean | null;
  screenResolution?: string | null;
  timezone?: string | null;
  colorDepth?: number | null;
  pixelRatio?: number | null;
  languages?: string | null;
}
interface LocationInfo { country: string; region: string; city: string; isp: string }
interface AdminResult {
  id: string;
  pathname?: string;
  answers: number[];
  avgA: number;
  avgB: number;
  types: { name: string; score: number; desc: string; color: string }[];
  finalType: { name: string; score: number; desc: string; color: string };
  submittedAt: string;
  ip: string | null;
  userId: string | null;
  device: DeviceInfo | null;
  location: LocationInfo | null;
}

const TYPE_BADGE: Record<string, string> = {
  '安全型': 'bg-green-100 text-green-700',
  '恐惧型': 'bg-red-100 text-red-700',
  '痴迷型': 'bg-yellow-100 text-yellow-700',
  '疏离型': 'bg-purple-100 text-purple-700',
};

const TYPE_OPTIONS = ['全部', '安全型', '恐惧型', '痴迷型', '疏离型'];

// ===================== CSV 导出 =====================
const exportCSV = (results: AdminResult[]) => {
  const headers = [
    'ID', '提交时间', '用户指纹', '设备类型', '设备品牌', '系统',
    '浏览器', '触屏', '屏幕', '时区', '色深', '像素比', '语言',
    '最终类型', '回避均分', '焦虑均分',
    '安全型', '恐惧型', '痴迷型', '疏离型',
    'IP', '国家', '地区', '城市', 'ISP',
    ...Array.from({ length: 36 }, (_, i) => `第${i + 1}题`),
  ];
  const rows = results.map((r) => {
    const ts: Record<string, number> = {};
    r.types.forEach((t) => { ts[t.name] = t.score; });
    return [
      r.id, r.submittedAt, r.userId || '', r.device?.type || '', r.device?.brand || '', r.device?.os || '',
      r.device?.browser || '', r.device?.isTouch != null ? (r.device.isTouch ? '是' : '否') : '',
      r.device?.screenResolution || '', r.device?.timezone || '',
      r.device?.colorDepth != null ? String(r.device.colorDepth) : '',
      r.device?.pixelRatio != null ? String(r.device.pixelRatio) : '',
      r.device?.languages || '',
      r.finalType.name, r.avgA.toFixed(2), r.avgB.toFixed(2),
      ts['安全型']?.toFixed(2) || '', ts['恐惧型']?.toFixed(2) || '',
      ts['痴迷型']?.toFixed(2) || '', ts['疏离型']?.toFixed(2) || '',
      r.ip || '',
      r.location?.country || '', r.location?.region || '',
      r.location?.city || '', r.location?.isp || '',
      ...r.answers.map(String),
    ];
  });
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `attachment-results-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};

// ===================== 管理面板 =====================
export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [results, setResults] = useState<AdminResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  // 筛选状态
  const [filterType, setFilterType] = useState('全部');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchUser, setSearchUser] = useState('');

  const handleAuth = async () => {
    if (!token.trim()) { setError('请输入管理员 Token'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/results', { headers: { Authorization: `Bearer ${token.trim()}` } });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '认证失败'); return; }
      setAuthed(true);
      setResults(data.results || []);
    } catch { setError('网络错误'); }
    finally { setLoading(false); }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/results', { headers: { Authorization: `Bearer ${token.trim()}` } });
      const data = await res.json();
      if (res.ok) setResults(data.results || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleDelete = async (pathname: string) => {
    if (!confirm('确定删除这条记录？此操作不可恢复。')) return;
    setDeleting(pathname);
    try {
      await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.trim()}` },
        body: JSON.stringify({ pathname }),
      });
      setResults((prev) => prev.filter((r: any) => r.pathname !== pathname));
    } catch { alert('删除失败'); }
    finally { setDeleting(null); }
  };

  // 前端筛选
  const filtered = useMemo(() => {
    let list = results;
    if (filterType !== '全部') list = list.filter((r) => r.finalType.name === filterType);
    if (dateFrom) list = list.filter((r) => r.submittedAt >= dateFrom);
    if (dateTo) list = list.filter((r) => r.submittedAt <= dateTo + 'T23:59:59');
    if (searchUser.trim()) {
      const q = searchUser.trim().toLowerCase();
      list = list.filter((r) =>
        (r.userId || '').toLowerCase().includes(q) ||
        (r.ip || '').includes(q) ||
        (r.location?.country || '').toLowerCase().includes(q) ||
        (r.location?.city || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [results, filterType, dateFrom, dateTo, searchUser]);

  // 统计
  const stats = useMemo(() => {
    const dist: Record<string, number> = {};
    filtered.forEach((r) => { dist[r.finalType.name] = (dist[r.finalType.name] || 0) + 1; });
    return dist;
  }, [filtered]);

  // ===================== 登录 =====================
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 font-sans">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gray-800 px-6 py-8 text-center text-white">
            <h1 className="text-2xl font-bold mb-1">🔒 管理员登录</h1>
            <p className="text-sm opacity-70">输入 Token 查看测试数据</p>
          </div>
          <div className="p-6 space-y-4">
            <input type="password" value={token} onChange={(e) => { setToken(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              placeholder="ADMIN_TOKEN" autoFocus
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">⚠️ {error}</div>}
            <button onClick={handleAuth} disabled={loading}
              className="w-full py-3 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50">
              {loading ? '验证中...' : '登录'}
            </button>
            <button onClick={onClose} className="w-full py-2 text-gray-400 text-sm hover:text-gray-600">返回测试</button>
          </div>
        </div>
      </div>
    );
  }

  // ===================== 数据面板 =====================
  return (
    <div className="min-h-screen bg-gray-50 py-4 px-2 sm:px-4 lg:px-6 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* 顶部栏 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">📊 测试数据</h1>
              <p className="text-sm text-gray-500">
                共 {results.length} 条 | 筛选 {filtered.length} 条
                {Object.entries(stats).map(([k, v]) => (
                  <span key={k} className="ml-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TYPE_BADGE[k] || 'bg-gray-100'}`}>{k}</span>
                    <span className="text-gray-600 ml-1">{v}</span>
                  </span>
                ))}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleRefresh} disabled={loading}
                className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600 disabled:opacity-50">🔄 刷新</button>
              <button onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50">📥 CSV</button>
              <button onClick={onClose}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50">✕ 返回</button>
            </div>
          </div>

          {/* 筛选栏 */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">依恋类型</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">起始日期</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">结束日期</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">用户/IP 搜索</label>
              <input type="text" value={searchUser} onChange={(e) => setSearchUser(e.target.value)}
                placeholder="IP/国家/城市" className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-48" />
            </div>
            {(filterType !== '全部' || dateFrom || dateTo || searchUser) && (
              <button onClick={() => { setFilterType('全部'); setDateFrom(''); setDateTo(''); setSearchUser(''); }}
                className="px-3 py-2 text-xs text-red-500 hover:text-red-700">清除筛选</button>
            )}
          </div>
        </div>

        {/* 数据表格 */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border">
            <div className="text-4xl mb-4">📭</div>
            <p>{results.length === 0 ? '暂无测试数据' : '无匹配结果'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs whitespace-nowrap">时间</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs whitespace-nowrap">类型</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs whitespace-nowrap">用户</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-600 text-xs whitespace-nowrap">回避</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-600 text-xs whitespace-nowrap">焦虑</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-600 text-xs whitespace-nowrap">安全</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-600 text-xs whitespace-nowrap">恐惧</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-600 text-xs whitespace-nowrap">痴迷</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-600 text-xs whitespace-nowrap">疏离</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-600 text-xs whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r: any) => {
                    const ts: Record<string, number> = {};
                    r.types.forEach((t: any) => { ts[t.name] = t.score; });
                    const uid = (r.userId || (r.ip ? r.ip.split(',')[0] : null) || '未知').slice(0, 12);

                    // 构建 hover tooltip 完整信息
                    const devInfoParts: string[] = [];
                    if (r.device) {
                      devInfoParts.push(`${r.device.type || ''} ${r.device.brand || ''} ${r.device.os || ''}`.trim());
                      if (r.device.browser) devInfoParts.push(`浏览器: ${r.device.browser}`);
                      if (r.device.screenResolution) devInfoParts.push(`屏幕: ${r.device.screenResolution}`);
                      if (r.device.isTouch) devInfoParts.push('触屏');
                      if (r.device.timezone) devInfoParts.push(`时区: ${r.device.timezone}`);
                      if (r.device.languages) devInfoParts.push(`语言: ${r.device.languages}`);
                    }
                    if (r.ip) {
                      const ipAddr = r.ip.split(',')[0].trim();
                      devInfoParts.push(`IP: ${ipAddr}`);
                    }
                    if (r.location) {
                      const locStr = [r.location.country, r.location.region, r.location.city].filter(Boolean).join(' ');
                      if (locStr) devInfoParts.push(`📍 ${locStr}`);
                      if (r.location.isp) devInfoParts.push(`ISP: ${r.location.isp}`);
                    }
                    const devTooltip = devInfoParts.join(' | ') || '未知';

                    // 行内简短显示
                    const shortIp = r.ip ? r.ip.split(',')[0].trim().slice(0, 15) : '';
                    const shortLocation = r.location
                      ? [r.location.country, r.location.city].filter(Boolean).join(' ')
                      : '';

                    return (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-2.5 text-gray-500 text-xs font-mono whitespace-nowrap">
                          {new Date(r.submittedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${TYPE_BADGE[r.finalType.name] || 'bg-gray-100'}`}>{r.finalType.name}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[200px] truncate" title={devTooltip}>
                          {uid}
                          {shortIp ? <><span className="text-gray-300"> | </span><span className="text-gray-400">{shortIp}</span></> : null}
                          {shortLocation ? <><span className="text-gray-300"> · </span><span className="text-gray-400">{shortLocation.slice(0, 16)}</span></> : null}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-xs text-gray-700">{r.avgA.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-xs text-gray-700">{r.avgB.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-xs text-gray-500">{ts['安全型']?.toFixed(1) || '-'}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-xs text-gray-500">{ts['恐惧型']?.toFixed(1) || '-'}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-xs text-gray-500">{ts['痴迷型']?.toFixed(1) || '-'}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-xs text-gray-500">{ts['疏离型']?.toFixed(1) || '-'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => handleDelete(r.pathname)}
                            disabled={deleting === r.pathname}
                            className="text-red-400 hover:text-red-600 text-xs disabled:opacity-30 px-2 py-1"
                          >
                            {deleting === r.pathname ? '...' : '🗑'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <footer className="text-center py-6 text-gray-400 text-xs">
          © {new Date().getFullYear()} tomz. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
