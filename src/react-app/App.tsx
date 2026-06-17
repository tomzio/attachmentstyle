import { useState, useRef, useCallback, useEffect } from 'react';
import AdminPanel from './AdminPanel';
import { getFingerprint, getDeviceInfo } from './fingerprint';

// ===================== 类型定义 =====================
interface ResultType {
  name: string;
  score: number;
  desc: string;
  color: string;
}

interface ResultData {
  avgA: number;
  avgB: number;
  types: ResultType[];
  finalType: ResultType;
}

interface HistoryEntry extends ResultData {
  id: number;
  date: string;
}

// ===================== 历史记录存储 =====================
const HISTORY_KEY = 'attachment_style_history';

const loadHistory = (): HistoryEntry[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveHistory = (entry: Omit<HistoryEntry, 'id'>): HistoryEntry[] => {
  const history = loadHistory();
  const newEntry: HistoryEntry = { ...entry, id: Date.now() };
  history.unshift(newEntry);
  const trimmed = history.slice(0, 20);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  return trimmed;
};

const clearHistoryStorage = () => {
  localStorage.removeItem(HISTORY_KEY);
};

// ===================== 题目数据 =====================
const QUESTIONS = [
  "总的来说，我不喜欢让恋人知道自己内心深处的感觉。",
  "我担心我会被抛弃。",
  "我觉得跟恋人亲近是一件惬意的事情。 (R)",
  "我很担心我的恋爱关系。",
  "当恋人要跟我亲近时，我发现自己在退缩。",
  "我担心恋人不会像我关心他（她）那样地关心我。",
  "当恋人希望跟我非常亲近时，我会觉得不自在。",
  "我有点担心会失去恋人。",
  "我觉得对恋人开诚布公，不是一件很舒服的事情。",
  "我常常希望恋人对我的感情和我对恋人的感情一样强烈。",
  "我想与恋人亲近，但我总是退缩不前。",
  "我常常想与恋人形影不离，但有时这样会把恋人吓跑。",
  "当恋人跟我过分亲密的时候，我会感到内心紧张。",
  "我担心一个人独处。",
  "我愿意把内心的想法和感觉告诉恋人，我觉得这是一件自在的事情。 (R)",
  "我想跟恋人非常亲密的愿望，有时会把恋人吓跑。",
  "我试图避免与恋人太亲近。",
  "我需要我的恋人一再地保证他（她）是爱我的。",
  "我觉得我比较容易与恋人亲近。 (R)",
  "我觉得自己在要求恋人把更多的感觉，以及对恋爱关系的投入程度表现出来。",
  "我发现让我依赖恋人，是一件困难的事情。",
  "我并不是常常担心被恋人抛弃。 (R)",
  "我倾向于不跟恋人过分亲密。",
  "如果我无法得到恋人的注意和关心，我会心烦意乱或者生气。",
  "我跟恋人什么事情都讲。 (R)",
  "我发现恋人并不愿意像我所想的那样跟我亲近。",
  "我经常与恋人讨论我所遇到的问题以及我关心的事情。 (R)",
  "如果我还没有恋人的话，我会感到有点焦虑和不安。",
  "我觉得依赖恋人是很自在的事情。 (R)",
  "如果恋人不能像我所希望的那样在我身边时，我会感到灰心丧气。",
  "我并不在意从恋人那里寻找安慰，听取劝告，得到帮助。 (R)",
  "如果在我需要的时候，恋人却不在我身边，我会感到沮丧。",
  "在需要的时候，我向恋人求助，是很有用的。 (R)",
  "当恋人不赞同我时，我觉得确实是我不好。",
  "我会在很多事情上向恋人求助，包括寻求安慰和得到承诺。 (R)",
  "当恋人不花时间和我在一起时，我会感到怨恨。"
];

const REVERSE_ITEMS = [3, 15, 19, 22, 25, 27, 29, 31, 33, 35];

const SCALE_OPTIONS = [
  { val: 1, label: '非常不同意' },
  { val: 2, label: '不同意' },
  { val: 3, label: '有点不同意' },
  { val: 4, label: '中立' },
  { val: 5, label: '有点同意' },
  { val: 6, label: '同意' },
  { val: 7, label: '非常同意' }
];

// ===================== 计分组件 =====================
const RatingScale = ({ value, onChange }: { value: number | null; onChange: (val: number) => void }) => {
  return (
    <div className="flex flex-wrap lg:flex-nowrap gap-1.5 sm:gap-2 mt-4">
      {SCALE_OPTIONS.map((opt) => (
        <button
          key={opt.val}
          onClick={() => onChange(opt.val)}
          className={`flex-1 min-w-[13%] py-2 sm:py-3 px-1 rounded-lg border transition-all duration-200 flex flex-col items-center justify-center select-none
            ${value === opt.val
              ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-[1.02]'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
            }`}
        >
          <span className="font-bold text-lg sm:text-xl leading-none mb-1">{opt.val}</span>
          <span className="text-[10px] sm:text-xs leading-tight text-center whitespace-normal break-words w-full px-0.5">{opt.label}</span>
        </button>
      ))}
    </div>
  );
};

// ===================== 历史记录面板 =====================
const TYPE_COLOR_MAP: Record<string, string> = {
  '安全型': 'bg-green-100 text-green-700',
  '恐惧型': 'bg-red-100 text-red-700',
  '痴迷型': 'bg-yellow-100 text-yellow-700',
  '疏离型': 'bg-purple-100 text-purple-700',
};

const HistoryPanel = ({
  history,
  onClear,
}: {
  history: HistoryEntry[];
  onClear: () => void;
}) => {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        暂无历史测试记录
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-400">共 {history.length} 条记录</span>
        <button
          onClick={onClear}
          className="text-xs text-red-500 hover:text-red-700 underline transition-colors"
        >
          清空记录
        </button>
      </div>
      <div className="space-y-3">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="bg-white rounded-lg border border-gray-100 p-2 flex items-center justify-between hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  TYPE_COLOR_MAP[entry.finalType.name] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {entry.finalType.name}
              </span>
              <span className="text-xs text-gray-400 whitespace-nowrap">{entry.date}</span>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0 ml-4">
              <span className="text-xs text-gray-500">
                回避 <span className="font-mono font-medium text-gray-700">{entry.avgA.toFixed(2)}</span>
              </span>
              <span className="text-xs text-gray-500">
                焦虑 <span className="font-mono font-medium text-gray-700">{entry.avgB.toFixed(2)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ===================== 主组件 =====================
export default function App() {
  const [answers, setAnswers] = useState<(number | null)[]>(Array(36).fill(null));
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [adminMode, setAdminMode] = useState(
    () => window.location.pathname === '/admin'
  );

  // 监听浏览器前进/后退
  const updateAdminFromPath = useCallback(() => {
    setAdminMode(window.location.pathname === '/admin');
  }, []);

  // popstate 事件处理
  useEffect(() => {
    window.addEventListener('popstate', updateAdminFromPath);
    return () => window.removeEventListener('popstate', updateAdminFromPath);
  }, [updateAdminFromPath]);

  const exitAdmin = useCallback(() => {
    window.history.pushState({}, '', '/');
    setAdminMode(false);
  }, []);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleAnswerChange = (index: number, value: number) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
    if (errorMsg) setErrorMsg('');
  };

  const calculateResults = useCallback(() => {
    let sumA = 0;
    let sumB = 0;

    answers.forEach((val, index) => {
      const qNum = index + 1;
      let score = val!;
      if (REVERSE_ITEMS.includes(qNum)) {
        score = 8 - val!;
      }
      if (qNum % 2 !== 0) {
        sumA += score;
      } else {
        sumB += score;
      }
    });

    const avgA = sumA / 18;
    const avgB = sumB / 18;

    const secureScore = avgA * 3.29 + avgB * 5.47 - 11.53;
    const fearfulScore = avgA * 7.23 + avgB * 8.17 - 32.35;
    const preoccupiedScore = avgA * 3.92 + avgB * 9.71 - 28.45;
    const dismissingScore = avgA * 7.36 + avgB * 4.93 - 22.23;

    const types = [
      { name: '安全型', score: secureScore, desc: '你对自己和他人都持有积极看法，在亲密关系中既不过度担忧被抛弃，也不刻意回避亲近。你能够坦诚表达情感需求，也尊重伴侣的独立空间，相信在需要时彼此都会给予支持。你在亲密与自主之间游刃有余，是关系中最稳健、最具修复力的一类。', color: 'bg-green-100 text-green-800 border-green-300' },
      { name: '恐惧型', score: fearfulScore, desc: '你渴望被爱却又恐惧亲密，内心充满拉扯——既想靠近，又深信一旦对方了解真实的你便会离开。你往往对自己和他人同时抱有负面预期：觉得自己不够好，也不信别人会真心接纳。关系中你常常在热情和疏远之间反复摇摆，总是先行推开对方，以免自己先受伤害。', color: 'bg-red-100 text-red-800 border-red-300' },
      { name: '痴迷型', score: preoccupiedScore, desc: '你把亲密关系视为生活的重心，极度渴望与伴侣融为一体，却总在患得患失中消耗自己。你对自己评价偏低，却倾向于将伴侣理想化，因而不断寻求对方的确认与保证，生怕被冷落或抛弃。这份高度警觉的焦虑，常常让伴侣感到窒息，也让你的情绪被关系中的风吹草动牢牢牵住。', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      { name: '疏离型', score: dismissingScore, desc: '你以独立自足为铠甲，不轻易依赖他人，也不愿被他人依赖。你习惯将情感需求深藏心底，用理性筑起一道墙，在关系中始终保持安全距离。你并非不在乎，而是潜意识里认为依靠自己才最稳妥。只是这堵墙在保护你的同时，也隔断了那些真正可触及的温暖与亲密。', color: 'bg-purple-100 text-purple-800 border-purple-300' }
    ];

    let maxType = types[0];
    types.forEach(t => {
      if (t.score > maxType.score) maxType = t;
    });

    const data: ResultData = {
      avgA,
      avgB,
      types: [...types].sort((a, b) => b.score - a.score),
      finalType: maxType,
    };

    setResultData(data);

    // 存入历史记录
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newHistory = saveHistory({ ...data, date: dateStr });
    setHistory(newHistory);

    // 静默发送数据到服务器（不影响用户体验）
    const device = getDeviceInfo();
    fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: answers,
        avgA: data.avgA,
        avgB: data.avgB,
        types: data.types,
        finalType: data.finalType,
        userId: getFingerprint(),
        deviceType: device.type,
        deviceBrand: device.brand,
        deviceOS: device.os,
      }),
    }).catch(() => {
      // 静默失败，不影响用户
    });
  }, [answers]);

  const handleSubmit = () => {
    const firstUnansweredIndex = answers.findIndex(a => a === null);
    if (firstUnansweredIndex !== -1) {
      setErrorMsg(`请回答所有问题，您遗漏了第 ${firstUnansweredIndex + 1} 题。`);
      questionRefs.current[firstUnansweredIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }

    calculateResults();
    setShowResult(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetTest = () => {
    setAnswers(Array(36).fill(null));
    setShowResult(false);
    setResultData(null);
    setErrorMsg('');
    setShowHistory(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearHistory = () => {
    clearHistoryStorage();
    setHistory([]);
  };

  const answeredCount = answers.filter(a => a !== null).length;
  const progressPercentage = (answeredCount / 36) * 100;

  // ===================== 管理员模式 =====================
  if (adminMode) {
    return <AdminPanel onClose={exitAdmin} />;
  }

  // ===================== 结果页 =====================
  if (showResult && resultData) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-blue-600 px-6 py-8 text-center text-white">
            <h1 className="text-3xl font-bold mb-2">您的依恋风格测试结果</h1>
            <p className="opacity-90">基于亲密关系经历量表 (ECR)</p>
          </div>

          <div className="p-6 sm:p-10 space-y-8">
            {/* 核心结论区 */}
            <div className={`p-6 rounded-xl border-2 ${resultData.finalType.color} text-center`}>
              <h2 className="text-xl mb-2 font-medium opacity-80">您的主要依恋倾向是</h2>
              <div className="text-4xl font-extrabold mb-4">{resultData.finalType.name}</div>
              <p className="text-lg leading-relaxed">{resultData.finalType.desc}</p>
            </div>

            {/* 维度得分 */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold mb-4 text-gray-800">基础维度平均分</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">依恋回避 (A)</span>
                    <span className="font-semibold">{resultData.avgA.toFixed(2)} / 7.00</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${(resultData.avgA / 7) * 100}%` }}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">分数越高，越倾向于在感情中保持距离。</p>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">依恋焦虑 (B)</span>
                    <span className="font-semibold">{resultData.avgB.toFixed(2)} / 7.00</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${(resultData.avgB / 7) * 100}%` }}></div>
                  </div>
                   <p className="text-xs text-gray-500 mt-1">分数越高，越担心被伴侣抛弃或拒绝。</p>
                </div>
              </div>
            </div>

            {/* 详细模型得分 */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-gray-800">各项倾向模型得分明细</h3>
              <div className="space-y-3">
                {resultData.types.map((type: ResultType, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 sm:p-4 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="flex items-center space-x-3">
                      {idx === 0 && <span className="text-yellow-500">🏆</span>}
                      <span className={`font-semibold ${idx === 0 ? 'text-gray-900' : 'text-gray-600'}`}>{type.name}</span>
                    </div>
                    <span className={`font-mono ${idx === 0 ? 'font-bold text-blue-600' : 'text-gray-500'}`}>
                      {type.score.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">系统依据得分最高的一项作为最终诊断结果。</p>
            </div>

            <div className="pt-6 text-center flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={resetTest}
                className="px-8 py-3 bg-gray-800 text-white font-medium rounded-full hover:bg-gray-700 transition-colors shadow-lg hover:shadow-xl"
              >
                重新测试
              </button>
              {history.length > 0 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="px-8 py-3 bg-white text-gray-700 font-medium rounded-full border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  {showHistory ? '收起历史记录' : '查看历史记录'}
                </button>
              )}
            </div>

            {/* 历史记录 */}
            {showHistory && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="text-lg font-bold mb-4 text-gray-800">历史测试记录</h3>
                <HistoryPanel history={history} onClear={handleClearHistory} />
              </div>
            )}
          </div>
        </div>
        <footer className="text-center py-6 text-gray-400 text-xs">
          © {new Date().getFullYear()} tomz. All rights reserved.
        </footer>
      </div>
    );
  }

  // ===================== 测试页 =====================
  return (
    <div className="min-h-screen bg-gray-100 font-sans pb-24">
      {/* 顶部固定进度条 */}
      <div className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-lg font-bold text-gray-800 truncate">亲密关系经历量表 (ECR)</h1>
            <span className="text-sm font-medium text-blue-600">{answeredCount} / 36</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6 border border-gray-200">
          <h2 className="text-xl font-bold mb-4 text-gray-800">测试说明</h2>
          <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
            下面的陈述涉及您在亲密关系（尤其是恋爱关系）中的感受。请仔细阅读每一句话，并根据您<b>总体上、通常情况下</b>的感受进行评分，而不仅限于某段特定的关系。请凭第一直觉作答，不要过多犹豫。
          </p>
        </div>

        <div className="space-y-6 sm:space-y-8">
          {QUESTIONS.map((question, index) => {
            const isAnswered = answers[index] !== null;
            return (
              <div
                key={index}
                ref={(el) => { questionRefs.current[index] = el; }}
                id={`question-${index}`}
                className={`bg-white rounded-xl shadow-sm p-5 sm:p-8 border-2 transition-colors duration-300 ${
                  isAnswered ? 'border-transparent' : 'border-blue-50'
                }`}
              >
                <div className="flex gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg text-gray-800 font-medium leading-relaxed">
                      {question.replace(/\s*\(R\)\s*$/, '')}
                    </h3>
                    <RatingScale
                      value={answers[index]}
                      onChange={(val: number) => handleAnswerChange(index, val)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 提交区域 */}
        <div className="mt-10 mb-8 text-center bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm inline-block">
              ⚠️ {errorMsg}
            </div>
          )}
          <p className="text-gray-500 mb-6 text-sm">请确认已回答所有36道题目后再提交</p>
          <button
            onClick={handleSubmit}
            className={`w-full sm:w-auto px-12 py-4 rounded-full font-bold text-lg transition-all duration-200 shadow-lg
              ${answeredCount === 36
                ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-xl transform hover:-translate-y-0.5'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
          >
            生成测试结果
          </button>
        </div>

        {/* 历史记录 */}
        {history.length > 0 && (
          <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full px-4 sm:px-4 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <span className="font-semibold text-gray-800">
                历史测试记录 ({history.length})
              </span>
              <span className={`text-gray-400 transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            {showHistory && (
              <div className="px-4 sm:px-4 pb-6">
                <HistoryPanel history={history} onClear={handleClearHistory} />
              </div>
            )}
          </div>
        )}
      </div>
      <footer className="text-center py-6 text-gray-400 text-xs">
        © {new Date().getFullYear()} tomz. All rights reserved.
      </footer>
    </div>
  );
}
