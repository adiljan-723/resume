(() => {
  const $ = (selector) => document.querySelector(selector);
  const configured = $('meta[name="travel-api-origin"]').content.trim();
  const localPreview = ['127.0.0.1', 'localhost'].includes(location.hostname);
  const origin = configured.startsWith('https://') ? configured.replace(/\/$/, '') : localPreview ? location.origin : '';
  if (!origin) return;
  if (localPreview) $('.back').href = 'https://adiljan-723.github.io/resume/#projects';

  const form = $('#travel-form');
  const input = $('#travel-request');
  const send = $('#send');
  const askGuide = $('#ask-guide');
  const confirmGuide = $('#confirm-guide');
  const generate = $('#generate');
  const newTrip = $('#new-trip');
  const notice = $('#service-note');
  const error = $('#action-error');
  const resultBox = $('#plan-result');
  const key = `travel-web-session:${origin}`;
  let token;
  try { token = sessionStorage.getItem(key); } catch { token = null; }
  let state = null;
  let available = false;
  let pending = false;
  let timer;
  let renderedPlan;
  let renderedGuide;
  let activeAction = '';
  const selectedThemes = new Set();

  const busy = () => ['reading', 'guiding', 'queued', 'running'].includes(state?.status);
  const yuan = (value) => `${new Intl.NumberFormat('zh-CN').format(value)} 元`;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function setToken(value) {
    token = value;
    try { if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key); } catch { /* In-memory session is still available. */ }
  }

  function showError(message) {
    error.textContent = message || '';
    error.hidden = !message;
  }

  async function request(path, {method = 'GET', body, download = false} = {}) {
    const headers = token ? {Authorization: `Bearer ${token}`} : {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetch(`${origin}/api/${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store',
        signal: AbortSignal.timeout(120000),
      });
    } catch {
      throw new Error('暂时无法连接实时服务，请稍后再试。');
    }
    if (!response.ok) {
      if (response.status === 401) { setToken(null); state = null; }
      const details = await response.json().catch(() => null);
      throw new Error(details?.error || '实时服务暂时不可用。');
    }
    return download ? response.blob() : response.json();
  }

  function actionButton(label, action) {
    const button = element('button', label, 'submit');
    button.type = 'button';
    button.disabled = busy() || pending;
    button.addEventListener('click', action);
    return button;
  }

  function reconcileRows(container, items, textFor, classFor = () => '') {
    const existing = new Map([...container.children].map((node) => [node.dataset.rowKey, node]));
    const occurrences = new Map();
    const fragment = document.createDocumentFragment();
    const added = [];
    for (const item of items) {
      const text = textFor(item);
      const count = occurrences.get(text) || 0;
      occurrences.set(text, count + 1);
      const rowKey = JSON.stringify([text, count]);
      let row = existing.get(rowKey);
      if (!row) {
        row = element('li', text, classFor(item));
        row.dataset.rowKey = rowKey;
        added.push(row);
      }
      fragment.append(row);
    }
    container.replaceChildren(fragment);
    added.forEach((row, index) => window.TravelMotion?.entrance(row, Math.min(index * 55, 220)));
    return added.length;
  }

  function renderPlan(result) {
    const renderKey = result?.id || '';
    if (renderKey === renderedPlan) {
      for (const button of resultBox.querySelectorAll('button')) button.disabled = busy() || pending;
      return;
    }
    renderedPlan = renderKey;
    resultBox.replaceChildren();
    resultBox.hidden = !result;
    $('#plan-placeholder').hidden = Boolean(result);
    $('#plan-intro').hidden = Boolean(result);
    if (!result) return;

    const {plan, budget, walks, routes} = result;
    resultBox.append(element('h3', `${plan.destination} · ${plan.days.length} 天草案`));
    if (budget) resultBox.append(element('p', `全团预算 ${yuan(budget.total_budget_yuan)} · ${plan.budget_includes_accommodation ? '含住宿' : '住宿另计'}`, 'plan-note'));
    for (const day of plan.days) {
      const card = element('details', undefined, 'day-plan');
      card.open = day.day_index === 1;
      card.append(element('summary', `第 ${day.day_index} 天 · ${day.date || '日期待定'}`));
      const dayBody = element('div', undefined, 'details-body');
      const walk = walks[day.day_index];
      dayBody.append(element('p', `已知候选转场步行 ${walk == null ? '待核实' : `${walk} 米`} · 全天步行待核实`, 'plan-note'));
      const items = element('ul');
      const located = day.activities.filter((activity) => activity.poi_id).length;
      for (const activity of day.activities) {
        const item = element('li');
        item.append(element('strong', `${activity.period} · ${activity.title}`), element('p', activity.reason));
        if (located > 1 && result.dining_poi_ids.includes(activity.poi_id)) {
          item.append(actionButton('改为就近用餐', () => mutate('meal', {day: day.day_index, period: activity.period})));
        }
        items.append(item);
      }
      dayBody.append(items);
      for (const segment of routes[day.day_index] || []) {
        const distance = segment.walk_m == null ? '步行距离待核实' : `候选步行 ${segment.walk_m} 米`;
        dayBody.append(element('p', `${segment.from} → ${segment.to} · ${distance}${segment.source ? ` · ${segment.source}` : ''}`, 'plan-note'));
      }
      card.append(dayBody);
      resultBox.append(card);
      window.TravelMotion?.entrance(card, Math.min((day.day_index - 1) * 80, 280));
    }
    const reviewNote = result.issue_count != null ? `本轮内容评审意见 ${result.issue_count} 项` : '本版尚未取得有效内容评审';
    resultBox.append(element('p', reviewNote, 'plan-note'));
    const checks = element('details');
    const list = element('ul');
    for (const note of [...result.route_violations, ...plan.pending_confirmations]) list.append(element('li', note));
    const checkBody = element('div', undefined, 'details-body');
    checkBody.append(list);
    checks.append(element('summary', '出发前待确认'), checkBody);
    resultBox.append(checks);
    const actions = element('div', undefined, 'request-footer');
    if (result.has_failed_routes) actions.append(actionButton('重查失败路线', () => mutate('retry')));
    actions.append(actionButton('下载行程简报', downloadBrief));
    resultBox.append(actions);
  }

  function renderGuide(locked) {
    const guide = state?.guide;
    const panel = $('#guide-menu');
    const options = $('#guide-options');
    panel.hidden = !guide;
    if (guide?.id !== renderedGuide) {
      renderedGuide = guide?.id;
      selectedThemes.clear();
      options.querySelectorAll('label').forEach((label) => label.remove());
      guide?.options.forEach((option, index) => {
        const label = element('label', undefined, 'guide-option');
        const checkbox = element('input');
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) selectedThemes.add(index);
          else selectedThemes.delete(index);
          confirmGuide.disabled = !selectedThemes.size;
        });
        const copy = element('span');
        copy.append(element('strong', option.title), element('small', option.reason));
        label.append(checkbox, copy);
        options.append(label);
        window.TravelMotion?.entrance(label, index * 65);
      });
      if (guide) window.TravelMotion?.reveal(panel);
    }
    options.disabled = locked;
    confirmGuide.disabled = locked || !selectedThemes.size;
  }

  function render() {
    const locked = pending || busy();
    window.TravelMotion?.activity(locked, ['queued', 'running'].includes(state?.status));
    for (const [button, loading] of [[send, state?.status === 'reading' || (pending && activeAction === 'messages')],
      [askGuide, state?.status === 'guiding' || (pending && activeAction === 'guide')],
      [confirmGuide, pending && activeAction === 'guide/selection'],
      [generate, ['queued', 'running'].includes(state?.status) || (pending && activeAction === 'plans')]]) {
      button.dataset.loading = String(Boolean(loading));
    }
    send.disabled = !available || locked || !input.value.trim();
    askGuide.hidden = !state?.requirements.destination || Boolean(state.guide);
    askGuide.disabled = !available || locked;
    generate.disabled = !available || locked || !state || Boolean(state.question) || (state.status === 'done' && Boolean(state.result));
    newTrip.hidden = !token;
    newTrip.disabled = locked;
    input.disabled = locked;
    const history = state?.history || [];
    const dialogue = $('#dialogue');
    const addedMessages = reconcileRows(dialogue, history,
      (turn) => `${turn.role === 'user' ? '你' : '助手'} · ${turn.content}`, (turn) => turn.role);
    dialogue.hidden = !history.length;
    if (addedMessages) dialogue.scrollTop = dialogue.scrollHeight;
    const confirmed = state?.requirements;
    const requirements = $('#requirements');
    const facts = confirmed ? [confirmed.destination, confirmed.days && `${confirmed.days} 天`, confirmed.travelers && `${confirmed.travelers} 人`,
      confirmed.budget_per_person_yuan != null && `每人 ${yuan(confirmed.budget_per_person_yuan)}`,
      confirmed.budget_includes_accommodation === false && '住宿另计', confirmed.budget_includes_accommodation === true && '含住宿',
      ...(confirmed.preferences || [])] : [];
    const values = facts.filter(Boolean);
    if (requirements.dataset.values !== JSON.stringify(values)) {
      requirements.dataset.values = JSON.stringify(values);
      requirements.replaceChildren(...values.map((value) => element('span', value, 'requirement-chip')));
      requirements.hidden = !values.length;
      [...requirements.children].forEach((chip, index) => window.TravelMotion?.entrance(chip, Math.min(index * 35, 160)));
    }

    if (available) {
      const labels = {reading: '正在理解旅行需求', guiding: '导游正在准备玩法建议', queued: '规划任务已提交，正在等待执行', running: '正在调用模型与工具，稍后会显示行程',
        done: '行程草案已更新', failed: '本次处理未完成'};
      const next = labels[state?.status] || state?.question || (state ? '条件已齐，可以生成行程' : '实时服务已连接 · 先发送旅行需求');
      const statusText = pending && !busy() ? '正在提交请求…' : next;
      if (notice.textContent !== statusText) {
        notice.textContent = statusText;
        window.TravelMotion?.animate(notice, [{opacity: .3, transform: 'translateY(3px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 220});
      }
    }
    renderPlan(state?.result);
    renderGuide(locked);
    const events = state?.trace || [];
    $('#trace').hidden = !events.length;
    reconcileRows($('#trace-list'), events, (event) => `${event.name} · ${event.outcome === 'returned' ? '已返回' : '调用失败'} · ${Math.round(event.elapsed_ms)} ms`);
  }

  async function poll() {
    clearTimeout(timer);
    if (!token || pending || !busy()) return;
    timer = setTimeout(async () => {
      try { state = await request('session'); showError(state.error); }
      catch (err) { showError(err.message); }
      render();
      poll();
    }, 1800);
  }

  async function mutate(path, body) {
    if (pending || busy()) return false;
    activeAction = path;
    pending = true;
    showError();
    render();
    try {
      if (!token) {
        state = await request('sessions', {method: 'POST'});
        setToken(state.token);
      }
      state = await request(path, {method: 'POST', body});
      if (path === 'messages') input.value = '';
      return true;
    } catch (err) {
      showError(err.message);
      return false;
    } finally {
      pending = false;
      activeAction = '';
      render();
      poll();
    }
  }

  async function downloadBrief() {
    try {
      const blob = await request('brief', {download: true});
      const url = URL.createObjectURL(blob);
      const link = element('a');
      link.href = url;
      link.download = 'travel-plan.md';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { showError(err.message); }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (text && !send.disabled) mutate('messages', {text});
  });
  input.addEventListener('input', render);
  askGuide.addEventListener('click', () => mutate('guide'));
  confirmGuide.addEventListener('click', () => {
    if (state?.guide && selectedThemes.size) {
      mutate('guide/selection', {menu_id: state.guide.id, choices: [...selectedThemes]});
    }
  });
  generate.addEventListener('click', () => mutate('plans'));
  newTrip.addEventListener('click', () => {
    setToken(null);
    state = null;
    input.value = '';
    showError();
    render();
    input.focus();
  });

  async function connect() {
    try {
      const status = await request('health');
      available = status.ready === true;
      if (available && token) {
        state = await request('session');
        showError(state.error);
      }
    } catch (err) {
      if (!available) notice.textContent = err.message;
      else showError(err.message);
    }
    render();
    poll();
  }
  connect();
})();
