const root = document.documentElement;
const themeButton = document.querySelector('#theme');
const request = document.querySelector('#travel-request');
const examples = document.querySelector('.examples');
const themeKey = 'resume-szu-theme';
const scenarios = new Map([
  ['shenzhen', '两人去深圳玩两天，每人预算 800 元，不含住宿。想逛博物馆、吃本地菜，尽量少走路，日期待定。'],
  ['hangzhou', '两人去杭州玩三天，其中一位是老人。每人预算 1500 元，不含住宿。喜欢历史文化和当地美食，每天步行不超过 3 公里，日期待定。'],
]);

function setTheme(theme) {
  root.dataset.theme = theme;
  themeButton.textContent = theme === 'light' ? '切换深色' : '切换亮色';
}

try {
  setTheme(localStorage.getItem(themeKey) === 'light' ? 'light' : 'dark');
} catch {
  setTheme('dark');
}
themeButton.hidden = false;
themeButton.addEventListener('click', () => {
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  setTheme(next);
  try { localStorage.setItem(themeKey, next); } catch { /* Theme still works for this page. */ }
});

function fillScenario(name) {
  const example = scenarios.get(name);
  if (example) request.value = example;
}

const selected = new URLSearchParams(location.search).get('scenario');
if (!request.value) fillScenario(selected);
examples.hidden = false;
for (const button of examples.querySelectorAll('button[data-scenario]')) {
  button.addEventListener('click', () => {
    fillScenario(button.dataset.scenario);
    request.focus();
  });
}
