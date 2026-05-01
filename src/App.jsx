import { useState, useCallback } from 'react';

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';

async function fetchAllStars(token, username) {
  let page = 1;
  const all = [];
  while (true) {
    const headers = { Accept: 'application/vnd.github.v3+json' };
    if (token) headers['Authorization'] = 'token ' + token;
    const res = await fetch(
      'https://api.github.com/users/' + username + '/starred?per_page=100&page=' + page,
      { headers }
    );
    if (!res.ok) {
      const msg = await res.text();
      throw new Error('GitHub API ' + res.status + ': ' + msg);
    }
    const data = await res.json();
    if (!data.length) break;
    all.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return all;
}

async function callClaude(system, userMsg, apiKey) {
  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: system,
      messages: [{ role: 'user', content: userMsg }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

function Tag({ label }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, padding: '2px 7px', borderRadius: 99,
      border: '1px solid #2a9d3a', color: '#2a9d3a', marginRight: 4, marginBottom: 4,
    }}>
      {label}
    </span>
  );
}

function RepoCard({ repo, rank, source }) {
  const isExt = source === 'external';
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: isExt ? 'rgba(20,80,35,0.18)' : 'rgba(0,255,70,0.04)',
        border: '1px solid ' + (hov ? '#2a9d3a' : isExt ? '#1a6a2a' : '#1a3a22'),
        borderRadius: 10, padding: '14px 18px', marginBottom: 10,
        position: 'relative', transition: 'border-color .2s',
      }}
    >
      <span style={{
        position: 'absolute', top: -10, left: 14, background: '#0d1f11',
        border: '1px solid #2a9d3a', color: '#2a9d3a', fontSize: 10,
        padding: '1px 8px', borderRadius: 99,
      }}>
        {'#' + rank + (isExt ? ' · 新发现' : ' · 已收藏')}
      </span>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <a
          href={repo.html_url}
          target="_blank"
          rel="noreferrer"
          style={{ color: '#4ade80', fontWeight: 700, fontSize: 15, fontFamily: 'monospace', textDecoration: 'none' }}
        >
          {repo.full_name}
        </a>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {repo.stargazers_count != null && (
            <span style={{ color: '#888', fontSize: 11 }}>{'⭐ ' + Number(repo.stargazers_count).toLocaleString()}</span>
          )}
          {repo.language && <Tag label={repo.language} />}
        </div>
      </div>

      {repo.description && (
        <p style={{ margin: '7px 0 8px', color: '#a8d8b0', fontSize: 13, lineHeight: 1.55 }}>
          {repo.description}
        </p>
      )}
      {(repo.topics || []).length > 0 && (
        <div style={{ marginTop: 4 }}>
          {repo.topics.slice(0, 6).map((t) => <Tag key={t} label={t} />)}
        </div>
      )}
      {repo.reason && (
        <div style={{ marginTop: 8, padding: '7px 10px', background: 'rgba(0,255,70,0.06)', borderRadius: 6, fontSize: 12, color: '#7ecf90' }}>
          {'💡 ' + repo.reason}
        </div>
      )}
    </div>
  );
}

const SYSTEM_PROMPT = [
  'You are a GitHub project recommendation assistant. The user provides a requirement and their complete GitHub Stars list (JSON).',
  'Rules:',
  '1. from_stars: select at most 5 most relevant projects ONLY from the user Stars list provided. Give reason in Chinese.',
  '2. external: use web_search to find at most 5 high-quality GitHub projects NOT in the Stars list. Give reason in Chinese.',
  '3. Return ONLY a JSON object, no extra text, no markdown fences:',
  '{"summary":"one sentence in Chinese under 50 chars",',
  '"from_stars":[{"full_name":"owner/repo","html_url":"https://github.com/owner/repo","description":"...","language":"...","stargazers_count":0,"topics":[],"reason":"Chinese reason"}],',
  '"external":[{"full_name":"owner/repo","html_url":"https://github.com/owner/repo","description":"...","language":"...","stargazers_count":0,"topics":[],"reason":"Chinese reason"}]}',
].join('\n');

export default function App() {
  const [claudeKey, setClaudeKey]         = useState(() => localStorage.getItem('claudeKey') || '');
  const [username, setUsername]           = useState('');
  const [token, setToken]                 = useState('');
  const [stars, setStars]                 = useState([]);
  const [starsLoaded, setStarsLoaded]     = useState(false);
  const [loadingStars, setLoadingStars]   = useState(false);
  const [starsError, setStarsError]       = useState('');

  const [query, setQuery]                       = useState('');
  const [searching, setSearching]               = useState(false);
  const [starResults, setStarResults]           = useState([]);
  const [externalResults, setExternalResults]   = useState([]);
  const [summary, setSummary]                   = useState('');
  const [searchError, setSearchError]           = useState('');

  const loadStars = useCallback(async () => {
    if (!username.trim()) return;
    setLoadingStars(true);
    setStarsError('');
    setStarsLoaded(false);
    setStars([]);
    setStarResults([]);
    setExternalResults([]);
    setSummary('');
    try {
      const data = await fetchAllStars(token.trim(), username.trim());
      setStars(data);
      setStarsLoaded(true);
    } catch (e) {
      setStarsError(e.message);
    } finally {
      setLoadingStars(false);
    }
  }, [username, token]);

  const search = useCallback(async () => {
    if (!query.trim() || !starsLoaded) return;
    setSearching(true);
    setStarResults([]);
    setExternalResults([]);
    setSummary('');
    setSearchError('');
    try {
      const snapshot = stars.map((r) => ({
        full_name: r.full_name,
        html_url: r.html_url,
        description: r.description || '',
        language: r.language || '',
        topics: r.topics || [],
        stargazers_count: r.stargazers_count,
      }));

      const userMsg =
        'Requirement: ' + query.trim() +
        '\n\nStars list (' + snapshot.length + ' total, from_stars MUST only come from here):\n' +
        JSON.stringify(snapshot);

      const raw = await callClaude(SYSTEM_PROMPT, userMsg, claudeKey.trim());
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI returned unexpected format, please retry');
      const parsed = JSON.parse(match[0]);
      setSummary(parsed.summary || '');
      setStarResults(parsed.from_stars || []);
      setExternalResults(parsed.external || []);
    } catch (e) {
      setSearchError(e.message);
    } finally {
      setSearching(false);
    }
  }, [query, stars, starsLoaded, claudeKey]);

  const hasResults = starResults.length > 0 || externalResults.length > 0;

  const lbl = { fontSize: 11, color: '#4a7a55', letterSpacing: 2, marginBottom: 12 };
  const inp = {
    background: '#0d1f13', border: '1px solid #1a3a22', borderRadius: 7,
    color: '#c8e6c9', padding: '9px 12px', fontSize: 13,
    fontFamily: 'Courier New, monospace', outline: 'none',
  };
  const bt = (dis) => ({
    background: dis ? '#0d1f13' : '#1a4a25',
    border: '1px solid ' + (dis ? '#1a3a22' : '#2a9d3a'),
    borderRadius: 7, color: dis ? '#3a5a45' : '#4ade80',
    padding: '9px 18px', fontSize: 13,
    cursor: dis ? 'not-allowed' : 'pointer',
    fontFamily: 'Courier New, monospace', fontWeight: 700,
    whiteSpace: 'nowrap', transition: 'all .15s',
  });
  const er = {
    marginTop: 8, color: '#f87171', fontSize: 12,
    background: 'rgba(248,113,113,0.08)', padding: '7px 12px',
    borderRadius: 6, border: '1px solid rgba(248,113,113,0.2)',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a1510', fontFamily: 'Courier New, monospace', color: '#c8e6c9', paddingBottom: 60 }}>

      <div style={{ borderBottom: '1px solid #1a3a22', padding: '18px 28px 14px', display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(180deg,#0d1f13,#0a1510)' }}>
        <span style={{ fontSize: 24 }}>🔭</span>
        <div>
          <h1 style={{ margin: 0, fontSize: 17, color: '#4ade80', letterSpacing: 2, fontWeight: 900 }}>GITHUB STARS FINDER</h1>
          <p style={{ margin: '2px 0 0', fontSize: 10, color: '#4a7a55', letterSpacing: 1.5 }}>AI-POWERED · 检索你的 Stars · 发现新项目</p>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px 0' }}>

        <section style={{ marginBottom: 28, padding: '14px 18px', background: 'rgba(0,255,70,0.03)', border: '1px solid #1a3a22', borderRadius: 10 }}>
          <div style={{ ...lbl, marginBottom: 8 }}>⚙ AI 设置 · Claude API Key</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="password"
              placeholder="sk-ant-api03-..."
              value={claudeKey}
              onChange={(e) => {
                setClaudeKey(e.target.value);
                localStorage.setItem('claudeKey', e.target.value);
              }}
              style={{ ...inp, flex: 1, minWidth: 260 }}
            />
            {claudeKey && (
              <span style={{ fontSize: 11, color: '#4ade80' }}>✓ 已设置</span>
            )}
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: '#3a5a45' }}>
            前往{' '}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: '#2a9d3a' }}>
              console.anthropic.com
            </a>{' '}
            获取 API Key。Key 仅保存在本地浏览器中。
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <div style={lbl}>STEP 01 · 连接 GitHub</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="GitHub 用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadStars()}
              style={{ ...inp, flex: 1, minWidth: 140 }}
            />
            <input
              type="password"
              placeholder="Personal Access Token（可选）"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadStars()}
              style={{ ...inp, flex: 2, minWidth: 200 }}
            />
            <button onClick={loadStars} disabled={loadingStars || !username.trim()} style={bt(loadingStars || !username.trim())}>
              {loadingStars ? ('加载中… ' + (stars.length > 0 ? stars.length + '个' : '')) : '加载 Stars'}
            </button>
            </div>
          {starsError && <div style={er}>{starsError}</div>}
          {starsLoaded && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#4ade80' }}>
              {'✓ 成功加载 '}
              <strong>{stars.length}</strong>
              {' 个 Stars 项目'}
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 11, color: '#3a5a45' }}>
            Token 仅在浏览器本地使用。前往{' '}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" style={{ color: '#2a9d3a' }}>
              github.com/settings/tokens
            </a>{' '}
            生成（read:user 权限）。
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <div style={{ ...lbl, color: starsLoaded ? '#4a7a55' : '#2a3a2e' }}>STEP 02 · 描述你的需求</div>
          <textarea
            placeholder={starsLoaded ? '例如：我想做一个 CLI 工具批量处理图片，需要 Python 库\n或：需要一个轻量级 React 状态管理方案' : '请先加载 Stars'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!starsLoaded}
            rows={4}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) search(); }}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: starsLoaded ? '#0d1f13' : '#090f0b',
              border: '1px solid #1a3a22', borderRadius: 8,
              color: '#c8e6c9', padding: '12px 14px', fontSize: 13,
              fontFamily: 'inherit', resize: 'vertical', outline: 'none',
              opacity: starsLoaded ? 1 : 0.4,
            }}
          />
          <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={search} disabled={!starsLoaded || !query.trim() || searching || !claudeKey.trim()} style={{ ...bt(!starsLoaded || !query.trim() || searching || !claudeKey.trim()), padding: '10px 28px' }}>
              {searching ? '🔍 AI 分析中…' : !claudeKey.trim() ? '请先设置 API Key' : '🔍 搜索匹配项目'}
            </button>
            <span style={{ fontSize: 11, color: '#3a5a45' }}>⌘ + Enter 快捷提交</span>
          </div>
          {searchError && <div style={er}>{searchError}</div>}
        </section>

        {searching && (
          <div style={{ textAlign: 'center', padding: '36px 0', color: '#4a7a55' }}>
            <div style={{ fontSize: 30, marginBottom: 10, display: 'inline-block', animation: 'spin 1.4s linear infinite' }}>◌</div>
            <div style={{ fontSize: 12, letterSpacing: 2 }}>{'AI 正在从 ' + stars.length + ' 个 Stars 中匹配，并搜索新项目…'}</div>
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
        {hasResults && (
          <div>
            {starResults.length > 0 ? (
              <section style={{ marginBottom: 30 }}>
                <div style={lbl}>{'⭐ 来自你的 STARS — ' + starResults.length + ' 个匹配'}</div>
                {starResults.map((r, i) => <RepoCard key={r.full_name || i} repo={r} rank={i + 1} source="stars" />)}
              </section>
            ) : (
              <div style={{ marginBottom: 20, fontSize: 12, color: '#4a7a55' }}>⚠ 你的 Stars 中未找到强相关项目</div>
            )}
            {externalResults.length > 0 && (
              <section>
                <div style={lbl}>{'🌐 AI 新发现 — ' + externalResults.length + ' 个推荐（未收藏）'}</div>
                {externalResults.map((r, i) => <RepoCard key={r.full_name || i} repo={r} rank={i + 1} source="external" />)}
              </section>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
