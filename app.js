const $ = (id) => document.getElementById(id);
const fromEl = $('from'), toEl = $('to'), input = $('input'), output = $('output');
const statusEl = $('status'), translateBtn = $('translate');
const RTL = ['ar'];
const MAX_HISTORY = 30;

const languages = {
  auto: 'Detect language',
  en: 'English', fr: 'French', ar: 'Arabic', es: 'Spanish', de: 'German',
  it: 'Italian', pt: 'Portuguese', nl: 'Dutch', ru: 'Russian', tr: 'Turkish',
  'zh-CN': 'Chinese', ja: 'Japanese', ko: 'Korean', hi: 'Hindi'
};

function getHistory() {
  try { return JSON.parse(localStorage.getItem('lf_history')) || []; }
  catch { return []; }
}
function saveHistory(items) {
  try { localStorage.setItem('lf_history', JSON.stringify(items)); } catch {}
}

function chunk(text, size = 450) {
  const parts = text.match(/[^.!?\u061F\n]+[.!?\u061F\n]*/g) || [text];
  const out = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + p).length > size) { if (cur) out.push(cur); cur = p; }
    else cur += p;
  }
  if (cur) out.push(cur);
  return out;
}

async function translateChunk(q, from, to) {
  const pair = `${from === 'auto' ? 'Autodetect' : from}|${to}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(pair)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Translation service is unavailable. Try again.');
  const data = await res.json();
  if (Number(data.responseStatus) !== 200) throw new Error(data.responseDetails || 'Translation failed.');
  return data.responseData.translatedText;
}

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', isError);
}

function setOutput(text, placeholder = false) {
  output.textContent = text;
  output.classList.toggle('placeholder', placeholder);
  output.dir = RTL.includes(toEl.value) ? 'rtl' : 'ltr';
}

function init() {
  $('year').textContent = new Date().getFullYear();
  for (const [code, name] of Object.entries(languages)) {
    fromEl.add(new Option(name, code));
    if (code !== 'auto') toEl.add(new Option(name, code));
  }
  fromEl.value = localStorage.getItem('lf_from') || 'auto';
  toEl.value = localStorage.getItem('lf_to') || 'fr';
  setOutput('Your translation appears here.', true);
  loadHistory();
}

async function translate() {
  const text = input.value.trim();
  const from = fromEl.value, to = toEl.value;
  if (!text) return setStatus('Enter some text to translate.', true);
  if (from === to) { setOutput(text); return; }

  translateBtn.disabled = true;
  translateBtn.textContent = 'Translating...';
  setStatus('');
  try {
    const pieces = [];
    for (const c of chunk(text)) pieces.push(await translateChunk(c, from, to));
    const translation = pieces.join(' ').trim();
    setOutput(translation);

    const history = getHistory();
    history.unshift({ id: Date.now(), from, to, text, translation });
    saveHistory(history.slice(0, MAX_HISTORY));
    loadHistory();
  } catch (err) {
    setStatus(err.message || 'Could not translate. Check your connection and try again.', true);
  } finally {
    translateBtn.disabled = false;
    translateBtn.textContent = 'Translate';
  }
}

function swap() {
  if (fromEl.value === 'auto') return setStatus('Choose a source language before swapping.', true);
  const result = output.classList.contains('placeholder') ? '' : output.textContent;
  [fromEl.value, toEl.value] = [toEl.value, fromEl.value];
  input.value = result;
  setOutput('Your translation appears here.', true);
  updateCount();
  setStatus('');
}

function speak(text, lang) {
  if (!('speechSynthesis' in window)) return setStatus('Your browser cannot read text aloud.', true);
  if (!text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (lang && lang !== 'auto') u.lang = lang;
  speechSynthesis.speak(u);
}

function updateCount() { $('count').textContent = `${input.value.length} / 1000`; }

function loadHistory() {
  const items = getHistory();
  const list = $('historyList');
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<li class="empty">No translations yet. Your recent ones will show up here.</li>';
    return;
  }
  for (const h of items) {
    const li = document.createElement('li');
    const load = document.createElement('button');
    load.className = 'load';
    const meta = document.createElement('small');
    meta.textContent = `${languages[h.from] || h.from} to ${languages[h.to] || h.to}`;
    const line = document.createElement('span');
    line.textContent = `${h.text.slice(0, 60)}${h.text.length > 60 ? '...' : ''}  ->  ${h.translation.slice(0, 60)}`;
    load.append(meta, line);
    load.onclick = () => {
      fromEl.value = h.from; toEl.value = h.to; input.value = h.text;
      updateCount(); setOutput(h.translation);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = '\u00d7'; del.setAttribute('aria-label', 'Delete this translation');
    del.onclick = () => { saveHistory(getHistory().filter((x) => x.id !== h.id)); loadHistory(); };
    li.append(load, del);
    list.append(li);
  }
}

translateBtn.onclick = translate;
$('swap').onclick = swap;
input.addEventListener('input', updateCount);
input.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'Enter') translate(); });
$('clear').onclick = () => { input.value = ''; updateCount(); setOutput('Your translation appears here.', true); setStatus(''); input.focus(); };
$('copy').onclick = async () => {
  if (output.classList.contains('placeholder')) return;
  await navigator.clipboard.writeText(output.textContent);
  setStatus('Copied to clipboard.');
};
$('speakIn').onclick = () => speak(input.value, fromEl.value);
$('speakOut').onclick = () => speak(output.classList.contains('placeholder') ? '' : output.textContent, toEl.value);
fromEl.onchange = () => localStorage.setItem('lf_from', fromEl.value);
toEl.onchange = () => { localStorage.setItem('lf_to', toEl.value); output.dir = RTL.includes(toEl.value) ? 'rtl' : 'ltr'; };
$('historyToggle').onclick = (e) => {
  const panel = $('historyPanel');
  panel.hidden = !panel.hidden;
  e.target.setAttribute('aria-expanded', String(!panel.hidden));
  if (!panel.hidden) panel.scrollIntoView({ behavior: 'smooth' });
};
$('clearHistory').onclick = () => { saveHistory([]); loadHistory(); };

init();