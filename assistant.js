(() => {
  const $ = (selector) => document.querySelector(selector);
  const mic = $('#mic-button'), stage = $('#listening-stage'), statusText = $('#status-text');
  const hint = $('#mic-hint'), transcript = $('#transcript'), responseText = $('#response-text');
  const responseAction = $('#response-action'), input = $('#command-input');
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const jokes = [
    'Why did the computer go to the doctor? It had a virus.',
    'Why was the computer cold? It left its Windows open.',
    'Why did the smartphone need glasses? It lost all its contacts.',
    'What do you call a computer that sings? A Dell.',
    'Why did the keyboard get promoted? It had all the right keys.',
    'Why was the robot tired after its road trip? It had a hard drive.',
    'What is a computer’s favourite snack? Microchips.',
    'Why did the web developer leave the restaurant? The table had no space.',
    'What did the Wi-Fi say to the phone? We have a connection.',
    'Why did the computer sit near the window? It wanted better bytes.'
  ];
  let recognition, previousJoke = -1, lastResponse = responseText.textContent;
  const storage = {
    get(key) { try { return JSON.parse(localStorage.getItem(`voice-assistant-${key}`) || '[]'); } catch { return []; } },
    set(key, value) { try { localStorage.setItem(`voice-assistant-${key}`, JSON.stringify(value)); } catch { /* storage may be unavailable */ } }
  };
  const notes = storage.get('notes'), todos = storage.get('todos'), reminders = storage.get('reminders');

  function refreshSaved() {
    const noteList = $('#notes-list'), todoList = $('#todos-list');
    if (!noteList || !todoList) return;
    noteList.textContent = notes.length ? notes.map((x, i) => `${i + 1}. ${x}`).join(' · ') : 'None yet';
    todoList.textContent = todos.length ? todos.map((x, i) => `${i + 1}. ${x}`).join(' · ') : 'None yet';
  }
  function say(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-ZA';
    window.speechSynthesis.speak(utterance);
  }
  function setAnswer(text, options = {}) {
    responseText.textContent = text;
    lastResponse = text;
    responseAction.replaceChildren();
    if (options.link) {
      const link = document.createElement('a');
      link.href = options.link; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.className = 'response-link'; link.textContent = options.linkText || 'Open link ↗';
      responseAction.append(link);
    }
    if (options.speak !== false) say(text);
  }

  function calculate(source) {
    let expression = source.toLowerCase()
      .replace(/^(calculate|what is|what's|work out|compute)\s+/i, '')
      .replace(/\?/g, '').replace(/\b(divided by|over)\b/g, '/').replace(/\b(multiplied by|times)\b/g, '*')
      .replace(/\b(plus|added to)\b/g, '+').replace(/\b(minus|take away)\b/g, '-')
      .replace(/\b(to the power of|power)\b/g, '**').replace(/\b(point)\b/g, '.').replace(/\s+/g, '');
    if (!/^[\d.+*/()%-]+$/.test(expression) || !/\d/.test(expression) || expression.length > 80) return null;
    try {
      // Parse arithmetic without eval: only numbers, parentheses and basic operators are accepted.
      const tokens = expression.match(/\d*\.?\d+|\*\*|[()+\-*/%]/g) || [];
      if (tokens.join('') !== expression) return null;
      let i = 0;
      function primary() {
        if (tokens[i] === '+') { i++; return primary(); }
        if (tokens[i] === '-') { i++; return -primary(); }
        if (tokens[i] === '(') { i++; const value = sum(); if (tokens[i++] !== ')') throw Error(); return value; }
        const value = Number(tokens[i++]); if (!Number.isFinite(value)) throw Error(); return value;
      }
      function power() { let value = primary(); if (tokens[i] === '**') { i++; value **= power(); } return value; }
      function product() { let value = power(); while (['*', '/', '%'].includes(tokens[i])) { const op = tokens[i++], rhs = power(); value = op === '*' ? value * rhs : op === '/' ? value / rhs : value % rhs; } return value; }
      function sum() { let value = product(); while (['+', '-'].includes(tokens[i])) { const op = tokens[i++], rhs = product(); value = op === '+' ? value + rhs : value - rhs; } return value; }
      const result = sum();
      if (i !== tokens.length || !Number.isFinite(result)) return null;
      return Number(result.toPrecision(10)).toLocaleString();
    } catch { return null; }
  }

  async function weatherFor(place) {
    const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
    geoUrl.search = new URLSearchParams({ name: place, count: '1', language: 'en', format: 'json' });
    const geoRes = await fetch(geoUrl); if (!geoRes.ok) throw Error('Location search failed');
    const location = (await geoRes.json()).results?.[0];
    if (!location) return `I couldn’t find ${place}. Try a nearby city or include the country.`;
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({ latitude: location.latitude, longitude: location.longitude, current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m', timezone: 'auto' });
    const weatherRes = await fetch(url); if (!weatherRes.ok) throw Error('Weather lookup failed');
    const data = await weatherRes.json(), current = data.current;
    const descriptions = {0:'clear sky',1:'mainly clear',2:'partly cloudy',3:'overcast',45:'foggy',48:'foggy',51:'light drizzle',53:'drizzle',55:'heavy drizzle',61:'light rain',63:'rain',65:'heavy rain',71:'light snow',73:'snow',75:'heavy snow',80:'rain showers',81:'rain showers',82:'heavy rain showers',95:'thunderstorms',96:'thunderstorms with hail',99:'thunderstorms with hail'};
    return `In ${location.name}, it’s ${Math.round(current.temperature_2m)}°C and ${descriptions[current.weather_code] || 'conditions are variable'}. Feels like ${Math.round(current.apparent_temperature)}°C, humidity ${current.relative_humidity_2m}%, wind ${Math.round(current.wind_speed_10m)} km/h.`;
  }

  function notify(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body });
    say(body);
  }
  function durationFrom(q) {
    const match = q.match(/(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i);
    if (!match) return null;
    const n = Number(match[1]), unit = match[2].toLowerCase();
    return n * (unit.startsWith('h') ? 3600000 : unit.startsWith('m') ? 60000 : 1000);
  }
  function scheduleTimer(ms, label) {
    const id = `${Date.now()}-${Math.random()}`;
    const item = { id, label, at: Date.now() + ms };
    reminders.push(item); storage.set('reminders', reminders);
    setTimeout(() => {
      const index = reminders.findIndex((r) => r.id === id);
      if (index >= 0) reminders.splice(index, 1);
      storage.set('reminders', reminders);
      notify('Voice Assistant reminder', label);
    }, ms);
    setAnswer(`Okay. I’ll remind you to ${label} in ${Math.round(ms / 60000) || 1} minute(s).`);
  }
  function runCommand(command) {
    const text = command.trim(); if (!text) return;
    transcript.textContent = `“${text}”`;
    const q = text.toLowerCase().replace(/[’]/g, "'");

    let match;
    if ((match = q.match(/(?:search (?:the web )?for|google|look up)\s+(.+)/))) {
      const term = match[1].replace(/[?.!]+$/, '').trim();
      setAnswer(`Here are web results for ${term}.`, { link: `https://www.google.com/search?q=${encodeURIComponent(term)}`, linkText: 'Open search results ↗' }); return;
    }
    if ((match = q.match(/(?:open|go to|launch)\s+(youtube|google|gmail|google maps|maps|wikipedia|spotify)/))) {
      const sites = { youtube:'https://www.youtube.com', google:'https://www.google.com', gmail:'https://mail.google.com', 'google maps':'https://maps.google.com', maps:'https://maps.google.com', wikipedia:'https://www.wikipedia.org', spotify:'https://open.spotify.com' };
      const name = match[1]; setAnswer(`I can open ${name} in a browser tab.`, { link: sites[name], linkText: `Open ${name} ↗` }); return;
    }
    if (/\b(open|launch|start)\s+(an?\s+)?(desktop\s+)?(application|app|program|calculator|notepad|camera)\b/.test(q)) { setAnswer('A web page cannot launch programs on your computer because the browser blocks that for security. I can open supported websites in a new tab, or help with a calculation here.'); return; }
    if (/\b(weather|temperature|forecast)\b/.test(q)) {
      const placeMatch = q.match(/\b(?:in|at|for)\s+(.+?)(?:\?|$)/);
      if (!placeMatch) { setAnswer('Which city should I check? For example, say “What is the weather in Johannesburg?”'); return; }
      setAnswer(`Checking the weather for ${placeMatch[1]}…`, { speak:false });
      weatherFor(placeMatch[1].replace(/[?.!]+$/, '').trim()).then((answer) => setAnswer(answer)).catch(() => setAnswer('I could not reach the weather service. Check your connection and try again.')); return;
    }
    if (/\b(timer|remind me|reminder)\b/.test(q)) {
      const ms = durationFrom(q);
      if (!ms) { setAnswer('Tell me a duration, such as “Set a timer for 5 minutes” or “Remind me in 10 minutes to stretch.”'); return; }
      const task = q.match(/\bto\s+(.+?)(?:\s+in\s+\d+\s*(?:seconds?|secs?|minutes?|mins?|hours?|hrs?))?(?:\?|$)/);
      scheduleTimer(ms, task ? task[1].replace(/[?.!]+$/, '') : 'your timer is finished'); return;
    }
    if ((match = q.match(/^(?:add )?(?:a )?note(?: that)?\s+(.+)/)) || (match = q.match(/^remember\s+(.+)/))) {
      const item = match[1].replace(/[?.!]+$/, '').trim(); notes.push(item); storage.set('notes', notes); refreshSaved(); setAnswer(`Saved a note: ${item}`); return;
    }
    if (/\b(read|show|list)\s+(my\s+)?notes\b/.test(q)) { setAnswer(notes.length ? `Your notes: ${notes.join('; ')}.` : 'You don’t have any saved notes yet. Say “Add a note…” to save one.'); return; }
    if (/\b(clear|delete|remove)\s+(all\s+)?notes\b/.test(q)) { notes.splice(0); storage.set('notes', notes); refreshSaved(); setAnswer('All notes cleared.'); return; }
    if ((match = q.match(/^(?:add )?(?:a )?to[- ]?do(?: item)?\s+(.+)/)) || (match = q.match(/^add to my list\s+(.+)/))) {
      const item = match[1].replace(/[?.!]+$/, '').trim(); todos.push(item); storage.set('todos', todos); refreshSaved(); setAnswer(`Added to your to-do list: ${item}`); return;
    }
    if (/\b(read|show|list)\s+(my\s+)?(to[- ]?do|tasks|list)\b/.test(q)) { setAnswer(todos.length ? `Your to-do list: ${todos.join('; ')}.` : 'Your to-do list is empty. Say “Add a to-do…” to add an item.'); return; }
    if (/\b(clear|delete|remove)\s+(all\s+)?(my\s+)?(to[- ]?dos|tasks|list)\b/.test(q)) { todos.splice(0); storage.set('todos', todos); refreshSaved(); setAnswer('Your to-do list is clear.'); return; }
    if (/\b(calculat|compute|work out)\b/.test(q) || /^what is\s+[-\d(]/.test(q)) {
      const result = calculate(text); setAnswer(result === null ? 'I couldn’t parse that calculation. Try “Calculate 25 times 8” or “What is (12 + 4) divided by 2?”' : `The answer is ${result}.`); return;
    }
    if (/\b(time|clock)\b/.test(q)) { setAnswer(`It’s ${new Intl.DateTimeFormat(undefined, { hour:'numeric', minute:'2-digit' }).format(new Date())}.`); return; }
    if (/\b(date|day|today)\b/.test(q)) { setAnswer(`Today is ${new Intl.DateTimeFormat(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' }).format(new Date())}.`); return; }
    if (/\b(joke|funny)\b/.test(q)) {
      let index; do { index = Math.floor(Math.random() * jokes.length); } while (jokes.length > 1 && index === previousJoke);
      previousJoke = index; setAnswer(jokes[index]); return;
    }
    if (/\b(project|assignment|portfolio|comprehension|course|how does it work|technology|technologies|objective)\b/.test(q)) {
      setAnswer('This CP 81 Comprehension 2 project is a browser-based voice assistant. It uses HTML, CSS, JavaScript, the Web Speech API, and Open-Meteo for weather. The portfolio includes an overview, interactive demo, and project documentation.'); return;
    }
    if (/\b(help|what can you do|capabilities|commands)\b/.test(q)) {
      setAnswer('I can tell the time and date, tell jokes, check weather, calculate, search the web, open selected websites, set timers and reminders, save notes and to-do items in this browser, and answer questions about this project. Try “Help” or read the Project Notes page for examples.'); return;
    }
    if (/\b(hello|hi|hey|good morning|good afternoon)\b/.test(q)) { setAnswer('Hello! I’m ready to help. Ask for the weather, set a timer, calculate something, or ask me for a joke.'); return; }
    setAnswer('I don’t know that one yet. Say “help” to hear what I can do.');
  }

  // Restore timers/reminders that are still pending after a page refresh.
  reminders.slice().forEach((item) => {
    const delay = item.at - Date.now();
    if (delay <= 0) { notify('Voice Assistant reminder', item.label); reminders.splice(reminders.indexOf(item), 1); }
    else setTimeout(() => { notify('Voice Assistant reminder', item.label); reminders.splice(reminders.indexOf(item), 1); storage.set('reminders', reminders); }, delay);
  });
  storage.set('reminders', reminders); refreshSaved();

  function setListening(on) {
    stage.classList.toggle('is-listening', on); statusText.textContent = on ? 'LISTENING' : 'READY';
    hint.textContent = on ? 'Listening… tap to stop' : 'Tap to speak';
    mic.setAttribute('aria-label', on ? 'Stop voice input' : 'Start voice input');
  }
  if (Recognition) {
    recognition = new Recognition(); recognition.lang = 'en-ZA'; recognition.interimResults = true; recognition.continuous = false;
    recognition.onstart = () => setListening(true); recognition.onend = () => setListening(false);
    recognition.onerror = (event) => { setListening(false); if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { hint.textContent = 'Microphone blocked — type a command below'; setAnswer('Microphone access was blocked. You can still type commands below.', { speak:false }); } else if (!['no-speech','aborted'].includes(event.error)) hint.textContent = 'Voice input unavailable — try typing'; };
    recognition.onresult = (event) => { const result = event.results[event.results.length - 1]; transcript.textContent = `“${result[0].transcript}”`; if (result.isFinal) runCommand(result[0].transcript); };
    mic.addEventListener('click', () => { if (stage.classList.contains('is-listening')) recognition.stop(); else { try { recognition.start(); } catch { /* recognition is already starting */ } } });
  } else { mic.disabled = true; mic.title = 'Voice input is not supported in this browser'; hint.textContent = 'Voice input unavailable — type below'; statusText.textContent = 'TYPE A COMMAND'; }
  $('#command-form').addEventListener('submit', (event) => { event.preventDefault(); runCommand(input.value); input.value = ''; });
  document.querySelectorAll('.example-command').forEach((button) => button.addEventListener('click', () => runCommand(button.dataset.command)));
  $('#speak-button').addEventListener('click', () => say(lastResponse));
})();
