(function () {
  'use strict';

  function safeSetHTML(element, htmlString) {
    element.textContent = '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    while (doc.body.firstChild) {
      element.appendChild(doc.body.firstChild);
    }
  }

  // ============================================================
  //  DATA
  // ============================================================
  const schedule = [
    ['I-a','II-a','III-a','IV-a','V-a','VI','LHR'],
    ['II-b','I-a','I-b','V-b','IV-b','VI','III-b'],
    ['III-a','II-a','IV-b','IV-a','V-a','V-b','I-b'],
    ['II-a','II-b','I-a','V-a','IV-a','III-b','VI-a'],
    ['III-b','II-b','VI','IV-b','V-b','I-b','III-a'],
  ];

  const allBlocks = ['I-a','I-b','II-a','II-b','III-a','III-b','IV-a','IV-b','V-a','V-b','VI','VI-a','LHR'];

  const defaultURLs = {};
  allBlocks.forEach(b => defaultURLs[b] = '#');

  const periods = [
    {label:'1限',start:[8,45],end:[9,35]},{label:'2限',start:[9,40],end:[10,30]},
    {label:'3限',start:[10,35],end:[11,25]},{label:'4限',start:[11,30],end:[12,20]},
    {label:'5限',start:[12,50],end:[13,40]},{label:'6限',start:[13,45],end:[14,35]},
    {label:'7限',start:[14,40],end:[15,30]},
  ];
  const specialSlots = [{label:'SHR',start:[8,30],end:[8,40]},{label:'昼休憩',start:[12,20],end:[12,50]}];
  const dayNames = ['日','月','火','水','木','金','土'];
  const dayNamesFull = ['日曜日','月曜日','火曜日','水曜日','木曜日','金曜日','土曜日'];

  const groupColors = {
    'I':'#6ec6ff','II':'#a78bfa','III':'#34d399',
    'IV':'#fbbf24','V':'#f472b6','VI':'#fb923c','LHR':'#94a3b8'
  };

  const legendItems = [
    {label:'I (I-a / I-b)',color:'#6ec6ff'},{label:'II (II-a / II-b)',color:'#a78bfa'},
    {label:'III (III-a / III-b)',color:'#34d399'},{label:'IV (IV / IV-a / IV-b)',color:'#fbbf24'},
    {label:'V (V-a / V-b)',color:'#f472b6'},{label:'VI (VI / VI-b)',color:'#fb923c'},
    {label:'LHR',color:'#94a3b8'},
  ];

  // ============================================================
  //  DATABASE (localStorage) & SYNC API
  // ============================================================
  const SYNC_API_URL = 'https://homescreen-gules.vercel.app/api';

  const DB = {
    _get(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } },
    _getArr(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
    _set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },

    get syncUsername() { return localStorage.getItem('hs_sync_username') || null; },
    set syncUsername(v) { if (v) localStorage.setItem('hs_sync_username', v); else localStorage.removeItem('hs_sync_username'); },
    get syncToken() { return localStorage.getItem('hs_sync_token') || null; },
    set syncToken(v) { if (v) localStorage.setItem('hs_sync_token', v); else localStorage.removeItem('hs_sync_token'); },

    get names() { return this._get('hs_names'); },
    set names(v) { this._set('hs_names', v); },
    get urls()  { return this._get('hs_urls'); },
    set urls(v) { this._set('hs_urls', v); },
    get tests() { return this._getArr('hs_tests'); },
    set tests(v) { this._set('hs_tests', v); },

    getName(id)  { return this.names[id] || null; },
    getURL(id)   { return this.urls[id] || null; },

    setName(id, name) { const n = this.names; if(name && name !== id) n[id]=name; else delete n[id]; this.names=n; },
    setURL(id, url)   { const u = this.urls;  if(url && url !== '#') u[id]=url; else delete u[id]; this.urls=u; },

    addTest(t)    { const ts = this.tests; t.id = crypto.randomUUID(); ts.push(t); this.tests=ts; return t; },
    updateTest(t) { const ts = this.tests; const i = ts.findIndex(x=>x.id===t.id); if(i>=0){ts[i]=t;this.tests=ts;} },
    deleteTest(id){ const ts = this.tests.filter(x=>x.id!==id); this.tests=ts; },

    // Bookmarks
    get bookmarks() { return this._getArr('hs_bookmarks'); },
    set bookmarks(v) { this._set('hs_bookmarks', v); },
    addBookmark(bm) { const bs = this.bookmarks; bm.id = crypto.randomUUID(); bs.push(bm); this.bookmarks = bs; return bm; },
    deleteBookmark(id) { this.bookmarks = this.bookmarks.filter(x => x.id !== id); },
    reorderBookmarks(ids) {
      const bs = this.bookmarks;
      const ordered = ids.map(id => bs.find(b => b.id === id)).filter(Boolean);
      this.bookmarks = ordered;
    },

    // Background
    get bg() { return localStorage.getItem('hs_bg') || null; },
    set bg(v) { if (v) localStorage.setItem('hs_bg', v); else localStorage.removeItem('hs_bg'); },

    // Theme Color
    get theme() { return localStorage.getItem('hs_theme_color') || '#ffffff'; },
    set theme(v) { if (v && v !== '#ffffff') localStorage.setItem('hs_theme_color', v); else localStorage.removeItem('hs_theme_color'); },

    // Dark Mode
    get darkMode() { return localStorage.getItem('hs_dark_mode') === 'true'; },
    set darkMode(v) { localStorage.setItem('hs_dark_mode', v ? 'true' : 'false'); },

    // Focus Mode
    get focusMode() { return localStorage.getItem('hs_focus_mode') === 'true'; },
    set focusMode(v) { localStorage.setItem('hs_focus_mode', v ? 'true' : 'false'); },
    
    // Glass Opacity
    get glassOpacity() { return localStorage.getItem('hs_glass_opacity') || '0.08'; },
    set glassOpacity(v) { localStorage.setItem('hs_glass_opacity', v); },
    
    // Clock Font
    get clockFont() { return localStorage.getItem('hs_clock_font') || 'inherit'; },
    set clockFont(v) { localStorage.setItem('hs_clock_font', v); },
    
    // Time Format
    get timeFormat() { return localStorage.getItem('hs_time_format') || '24h-sec'; },
    set timeFormat(v) { localStorage.setItem('hs_time_format', v); },
  };

  const CloudSync = {
    async login(username, password) {
      const res = await fetch(`${SYNC_API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      DB.syncToken = data.token;
      DB.syncUsername = username;
      return true;
    },
    logout() {
      DB.syncToken = null;
      DB.syncUsername = null;
      if (typeof updateSyncUI === 'function') updateSyncUI();
    },
    async pull() {
      if (!DB.syncToken) return false;
      try {
        const res = await fetch(`${SYNC_API_URL}/sync`, {
          headers: { 'Authorization': `Bearer ${DB.syncToken}` }
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) this.logout();
          throw new Error(data.error || 'Pull failed');
        }
        if (data.data && Object.keys(data.data).length > 0) {
          const r = data.data;
          if (r.names) DB.names = r.names;
          if (r.urls) DB.urls = r.urls;
          if (r.tests) DB.tests = r.tests;
          if (r.bookmarks) DB.bookmarks = r.bookmarks;
          if (r.theme) DB.theme = r.theme;
          if (r.darkMode !== undefined) DB.darkMode = r.darkMode;
          if (r.glassOpacity) DB.glassOpacity = r.glassOpacity;
          if (r.clockFont) DB.clockFont = r.clockFont;
          if (r.timeFormat) DB.timeFormat = r.timeFormat;
          return true;
        }
        return false;
      } catch (err) {
        console.error("Cloud pull error:", err);
        return false;
      }
    },
    async push() {
      if (!DB.syncToken) return false;
      try {
        const payload = {
          names: DB.names,
          urls: DB.urls,
          tests: DB.tests,
          bookmarks: DB.bookmarks,
          theme: DB.theme,
          darkMode: DB.darkMode,
          glassOpacity: DB.glassOpacity,
          clockFont: DB.clockFont,
          timeFormat: DB.timeFormat
        };
        const res = await fetch(`${SYNC_API_URL}/sync`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DB.syncToken}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) this.logout();
          throw new Error(data.error || 'Push failed');
        }
        return true;
      } catch (err) {
        console.error("Cloud push error:", err);
        return false;
      }
    }
  };

  // ============================================================
  //  INDEXED DB FOR BACKGROUND MEDIA (Video/GIF support)
  // ============================================================
  const IDB = {
    db: null,
    init() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('HomescreenMediaDB', 1);
        req.onupgradeneeded = e => {
          e.target.result.createObjectStore('media');
        };
        req.onsuccess = e => {
          this.db = e.target.result;
          resolve();
        };
        req.onerror = e => reject(e);
      });
    },
    saveBg(fileObj) {
      return new Promise((resolve) => {
        const tx = this.db.transaction('media', 'readwrite');
        tx.objectStore('media').put(fileObj, 'bgMedia');
        tx.oncomplete = () => resolve();
      });
    },
    getBg() {
      return new Promise((resolve) => {
        const tx = this.db.transaction('media', 'readonly');
        const req = tx.objectStore('media').get('bgMedia');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
    },
    deleteBg() {
      return new Promise((resolve) => {
        const tx = this.db.transaction('media', 'readwrite');
        tx.objectStore('media').delete('bgMedia');
        tx.oncomplete = () => resolve();
      });
    }
  };
  
  // Current Blob URL for background to avoid memory leaks
  let currentBgUrl = null;

  // ============================================================
  //  HELPERS
  // ============================================================
  function pad(n) { return String(n).padStart(2,'0'); }
  function toMin(h,m) { return h*60+m; }

  function isCustomized(bid) { return bid in DB.names; }
  function displayName(bid) { return DB.getName(bid) || bid; }
  function blockURL(bid) { return DB.getURL(bid) || '#'; }

  function getBase(bid) { return bid === 'LHR' ? 'LHR' : bid.replace(/-[ab]$/,''); }
  function getGroupClass(bid) {
    return isCustomized(bid) ? 'group-' + getBase(bid) : 'group-default';
  }
  function getColor(bid) {
    return groupColors[getBase(bid)] || '#94a3b8';
  }
  function getColorBg(bid) {
    const c = getColor(bid);
    return c.replace('#','');
  }

  // ============================================================
  //  TABS
  // ============================================================
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'calendar') renderCalendar();
    });
  });

  // ============================================================
  //  TIMETABLE
  // ============================================================
  function buildTable() {
    const tbody = document.getElementById('timetableBody');
    tbody.textContent = '';
    
    const todayTest = new Date();
    todayTest.setHours(0,0,0,0);
    const sevenDaysLater = new Date(todayTest.getTime() + 7 * 86400000);
    
    periods.forEach((p,pi) => {
      const tr = document.createElement('tr');
      tr.dataset.period = pi;
      const tdTime = document.createElement('td');
      safeSetHTML(tdTime, `<span class="period-num">${p.label}</span><span class="period-time">${pad(p.start[0])}:${pad(p.start[1])} – ${pad(p.end[0])}:${pad(p.end[1])}</span>`);
      tr.appendChild(tdTime);
      for (let d=0;d<5;d++) {
        const bid = schedule[d][pi];
        const td = document.createElement('td');
        td.className = getGroupClass(bid);
        td.dataset.day = d+1;
        const div = document.createElement('div');
        div.className = 'subject-cell';
        div.dataset.block = bid;
        div.dataset.dayIndex = d;
        div.dataset.periodIndex = pi;
        const a = document.createElement('a');
        a.className = 'subject-link';
        a.href = blockURL(bid);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = displayName(bid);
        a.title = `${dayNames[d+1]}曜 ${p.label}：${displayName(bid)}`;
        div.addEventListener('click', e => { 
          if (document.body.classList.contains('is-edit-mode')) {
            e.preventDefault(); 
            openSubjectModal(bid,d,pi); 
          } else {
            const url = blockURL(bid);
            if (!url || url === '#') {
              e.preventDefault(); // empty link doesn't do anything
            }
          }
        });
        const edit = document.createElement('span');
        edit.className = 'edit-icon';
        safeSetHTML(edit, '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>');
        div.appendChild(a);
        div.appendChild(edit);

        // Test indicator (1 week logic, including linked blocks)
        const linkedBids = getLinkedBlocks(bid);
        const activeTests = DB.tests.filter(t => {
          if (!linkedBids.includes(t.blockId)) return false;
          const d = new Date(t.date);
          return d >= todayTest && d <= sevenDaysLater;
        });

        if (activeTests.length > 0) {
          const dot = document.createElement('span');
          dot.className = 'test-dot';
          dot.title = `1週間以内のテスト ${activeTests.length}件`;
          div.appendChild(dot);
        }

        td.appendChild(div);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  }

  function refreshBlock(bid) {
    document.querySelectorAll(`.subject-cell[data-block="${bid}"]`).forEach(cell => {
      const td = cell.parentElement;
      td.className = td.className.replace(/group-\S+/g,'').trim();
      td.classList.add(getGroupClass(bid));
      const a = cell.querySelector('.subject-link');
      if (a) {
        a.textContent = displayName(bid);
        a.href = blockURL(bid);
        const d = parseInt(cell.dataset.dayIndex);
        const pi = parseInt(cell.dataset.periodIndex);
        a.title = `${dayNames[d+1]}曜 ${periods[pi].label}：${displayName(bid)}`;
      }
    });
  }

  // ============================================================
  //  SUBJECT MODAL
  // ============================================================
  let editBlockId = null;

  // Get linked blocks for a given block from DB
  function getLinkedBlocks(bid) {
    const links = DB._get('hs_links');
    return links[bid] || [bid];
  }
  function setLinkedBlocks(bid, group) {
    const links = DB._get('hs_links');
    // Clear old references pointing to bid
    Object.keys(links).forEach(k => {
      links[k] = links[k].filter(b => b !== bid);
      if (links[k].length <= 1) delete links[k];
    });
    // Set new group for all members
    if (group.length > 1) {
      group.forEach(b => { links[b] = [...group]; });
    } else {
      delete links[bid];
    }
    DB._set('hs_links', links);
  }

  function getSiblingBlocks(bid) {
    const base = getBase(bid);
    return allBlocks.filter(b => getBase(b) === base);
  }

  function buildLinkCheckboxes(bid) {
    const section = document.getElementById('twoCreditSection');
    const cb = document.getElementById('twoCreditCheck');
    const label = section.querySelector('.link-block-check');
    const siblings = getSiblingBlocks(bid);
    
    // Hide section if only 1 block in group (e.g. LHR)
    if (siblings.length <= 1) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';
    
    const linked = getLinkedBlocks(bid);
    // User requested default OFF. So if not explicitly linked, it's off.
    cb.checked = linked.length > 1;
    label.classList.toggle('checked', cb.checked);
    
    cb.onchange = () => {
      label.classList.toggle('checked', cb.checked);
    };
  }

  function getCheckedBlocks() {
    const cb = document.getElementById('twoCreditCheck');
    if (cb && cb.checked && editBlockId) {
      return getSiblingBlocks(editBlockId);
    }
    return [editBlockId];
  }

  function openSubjectModal(bid,dayIdx,perIdx) {
    editBlockId = bid;
    document.getElementById('subjModalTitle').textContent = `「${bid}」を編集`;
    document.getElementById('subjModalSub').textContent = `${dayNames[dayIdx+1]}曜 ${periods[perIdx].label}`;
    document.getElementById('inputName').value = displayName(bid) === bid ? '' : displayName(bid);
    const url = blockURL(bid);
    document.getElementById('inputURL').value = url === '#' ? '' : url;
    buildLinkCheckboxes(bid);
    openModal('modalSubject');
    setTimeout(()=>document.getElementById('inputName').focus(),100);
  }

  document.getElementById('btnSubjSave').addEventListener('click', () => {
    if (!editBlockId) return;
    const name = document.getElementById('inputName').value.trim();
    const url = document.getElementById('inputURL').value.trim();
    const checkedBlocks = getCheckedBlocks();

    // Save link group
    setLinkedBlocks(editBlockId, checkedBlocks);

    // Apply name and URL to all checked blocks
    checkedBlocks.forEach(bid => {
      if (name) {
        const n = DB.names; n[bid] = name; DB.names = n;
      } else {
        DB.setName(bid, null);
      }
      DB.setURL(bid, url);
    });

    buildTable(); // Rebuild table to sync test dots and names
    closeModal('modalSubject');
  });

  document.getElementById('btnSubjReset').addEventListener('click', () => {
    if (!editBlockId) return;
    const checkedBlocks = getCheckedBlocks();
    // Reset all linked blocks
    checkedBlocks.forEach(bid => {
      DB.setName(bid, null);
      DB.setURL(bid, null);
    });
    setLinkedBlocks(editBlockId, [editBlockId]);
    buildTable(); // Rebuild table to sync test dots and names
    closeModal('modalSubject');
  });

  // ============================================================
  //  TEST MODAL
  // ============================================================
  let editTestId = null;

  function populateBlockSelect(selectedBid, dateStr) {
    const sel = document.getElementById('testBlock');
    sel.textContent = '';
    
    let dayBlocks = [];
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d)) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5) {
          dayBlocks = [...new Set(schedule[dow - 1])];
        }
      }
    }

    if (dayBlocks.length > 0) {
      const groupDay = document.createElement('optgroup');
      groupDay.label = 'この日の授業';
      dayBlocks.forEach(bid => {
        const opt = document.createElement('option');
        opt.value = bid;
        opt.textContent = `${bid}${isCustomized(bid) ? ' ('+displayName(bid)+')' : ''}`;
        if (bid === selectedBid) opt.selected = true;
        groupDay.appendChild(opt);
      });
      sel.appendChild(groupDay);

      const groupOther = document.createElement('optgroup');
      groupOther.label = 'その他の授業';
      allBlocks.forEach(bid => {
        if (!dayBlocks.includes(bid)) {
          const opt = document.createElement('option');
          opt.value = bid;
          opt.textContent = `${bid}${isCustomized(bid) ? ' ('+displayName(bid)+')' : ''}`;
          if (bid === selectedBid) opt.selected = true;
          groupOther.appendChild(opt);
        }
      });
      sel.appendChild(groupOther);
    } else {
      allBlocks.forEach(bid => {
        const opt = document.createElement('option');
        opt.value = bid;
        opt.textContent = `${bid}${isCustomized(bid) ? ' ('+displayName(bid)+')' : ''}`;
        if (bid === selectedBid) opt.selected = true;
        sel.appendChild(opt);
      });
    }

    if (!selectedBid || sel.selectedIndex === -1) {
      sel.selectedIndex = 0;
    }
  }

  function openTestModal(blockId, dateStr, existingTest) {
    editTestId = existingTest ? existingTest.id : null;
    document.getElementById('testModalTitle').textContent = existingTest ? 'テストを編集' : 'テストを追加';
    document.getElementById('testModalSub').textContent = existingTest ? '日程・範囲を編集できます' : '科目と日程を選択してください';
    
    const initialDate = dateStr || (existingTest && existingTest.date) || '';
    document.getElementById('testDate').value = initialDate;
    
    populateBlockSelect(blockId || (existingTest && existingTest.blockId), initialDate);
    
    document.getElementById('testUnit').value = existingTest ? existingTest.unit : '';
    openModal('modalTest');
  }

  document.getElementById('testDate').addEventListener('change', (e) => {
    const currentBid = document.getElementById('testBlock').value;
    populateBlockSelect(currentBid, e.target.value);
  });

  document.getElementById('btnTestSave').addEventListener('click', () => {
    const bid = document.getElementById('testBlock').value;
    const date = document.getElementById('testDate').value;
    const unit = document.getElementById('testUnit').value.trim();
    if (!date) return;
    if (editTestId) {
      DB.updateTest({id:editTestId, blockId:bid, date:date, unit:unit||'未設定'});
    } else {
      DB.addTest({blockId:bid, date:date, unit:unit||'未設定'});
    }
    closeModal('modalTest');
    renderCalendar();
    renderUpcoming();
    buildTable(); // refresh dots
  });

  // ============================================================
  //  MODAL HELPERS
  // ============================================================
  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); editBlockId=null; editTestId=null; }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', e => { if(e.target===ov) closeModal(ov.id); });
  });
  document.addEventListener('keydown', e => {
    if (e.key==='Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m=>closeModal(m.id));
    }
    if (e.key==='Enter') {
      if (document.getElementById('modalSubject').classList.contains('open')) document.getElementById('btnSubjSave').click();
      else if (document.getElementById('modalTest').classList.contains('open')) document.getElementById('btnTestSave').click();
    }
  });

  // ============================================================
  //  CALENDAR
  // ============================================================
  let calYear, calMonth;
  (function initCal() {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
  })();

  document.getElementById('calPrev').addEventListener('click', () => { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCalendar(); });
  document.getElementById('calNext').addEventListener('click', () => { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCalendar(); });

  function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    grid.textContent = '';
    document.getElementById('calTitle').textContent = `${calYear}年${calMonth+1}月`;

    const headers = ['月','火','水','木','金','土','日'];
    headers.forEach(h => {
      const d = document.createElement('div');
      d.className='cal-day-header';d.textContent=h;grid.appendChild(d);
    });

    const firstDay = new Date(calYear, calMonth, 1);
    let startDow = firstDay.getDay(); // 0=Sun
    startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon=0
    const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
    const daysInPrev = new Date(calYear, calMonth, 0).getDate();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

    const tests = DB.tests;

    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

    for (let i=0; i<totalCells; i++) {
      const dayNum = i - startDow + 1;
      let realYear = calYear, realMonth = calMonth, realDay = dayNum;
      let otherMonth = false;
      if (dayNum < 1) {
        realMonth = calMonth - 1;
        if (realMonth < 0) { realMonth=11; realYear--; }
        realDay = daysInPrev + dayNum;
        otherMonth = true;
      } else if (dayNum > daysInMonth) {
        realMonth = calMonth + 1;
        if (realMonth > 11) { realMonth=0; realYear++; }
        realDay = dayNum - daysInMonth;
        otherMonth = true;
      }

      const dateStr = `${realYear}-${pad(realMonth+1)}-${pad(realDay)}`;
      const cell = document.createElement('div');
      cell.className = 'cal-day';
      if (otherMonth) cell.classList.add('other-month');
      if (dateStr === todayStr) cell.classList.add('today');

      const num = document.createElement('div');
      num.className = 'cal-day-num';
      num.textContent = realDay;
      cell.appendChild(num);

      // Tests on this day
      const dayTests = tests.filter(t => t.date === dateStr);
      dayTests.forEach(t => {
        const tag = document.createElement('span');
        tag.className = 'cal-test-tag';
        const c = getColor(t.blockId);
        tag.style.background = c + '22';
        tag.style.color = c;
        tag.style.border = `1px solid ${c}44`;
        tag.textContent = `${displayName(t.blockId)}`;
        tag.title = t.unit;
        tag.addEventListener('click', e => { e.stopPropagation(); openTestModal(null, null, t); });
        cell.appendChild(tag);
      });

      // + button
      const addBtn = document.createElement('span');
      addBtn.className = 'add-test-btn';
      addBtn.textContent = '＋';
      cell.appendChild(addBtn);

      cell.addEventListener('click', () => openTestModal(null, dateStr, null));
      grid.appendChild(cell);
    }

    renderUpcoming();
  }

  function renderUpcoming() {
    const list = document.getElementById('testList');
    const today = new Date();
    today.setHours(0,0,0,0);
    const tests = DB.tests
      .filter(t => new Date(t.date) >= today)
      .sort((a,b) => a.date.localeCompare(b.date));

    if (tests.length === 0) {
      safeSetHTML(list, '<div class="empty-msg">今後のテストはまだ登録されていません。<br>カレンダーの日付をクリックして追加できます。</div>');
      return;
    }

    list.textContent = '';
    tests.forEach(t => {
      const item = document.createElement('div');
      item.className = 'test-item';
      const c = getColor(t.blockId);
      const d = new Date(t.date);
      const dateLabel = `${d.getMonth()+1}/${d.getDate()}（${dayNames[d.getDay()]}）`;
      const daysUntil = Math.ceil((d - today) / 86400000);
      const svgWarning = '<svg class="svg-icon" style="color:#ffb347" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
      const svgPin = '<svg class="svg-icon" style="color:#6ec6ff" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
      const urgency = daysUntil <= 3 ? ` · ${svgWarning}` : daysUntil <= 7 ? ` · ${svgPin}` : '';

      safeSetHTML(item, `
        <div class="test-item-color" style="background:${c}"></div>
        <div class="test-item-info">
          <div class="test-item-subject">${displayName(t.blockId)}</div>
          <div class="test-item-unit">${t.unit}</div>
        </div>
        <div class="test-item-date">${dateLabel}${urgency}</div>
        <button class="test-item-delete" title="削除">
          <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `);
      item.querySelector('.test-item-delete').addEventListener('click', e => {
        e.stopPropagation();
        DB.deleteTest(t.id);
        renderCalendar();
        buildTable();
      });
      item.addEventListener('click', () => openTestModal(null, null, t));
      list.appendChild(item);
    });
  }

  // ============================================================
  //  LEGEND
  // ============================================================
  function buildLegend() {
    safeSetHTML(document.getElementById('legend'), legendItems.map(it =>
      `<span class="legend-item"><span class="legend-dot" style="background:${it.color}"></span>${it.label}</span>`
    ).join(''));
  }

  // ============================================================
  //  CLOCK & HIGHLIGHT
  // ============================================================
  function updateClock() {
    const now = new Date();
    const h=now.getHours(), m=now.getMinutes(), s=now.getSeconds();
    const dow = now.getDay();

    const fmt = DB.timeFormat;
    let ampm = '';
    let disp_h = h;
    if (fmt.startsWith('12h')) {
      ampm = h >= 12 ? ' PM' : ' AM';
      disp_h = h % 12 || 12;
    }
    
    let timeStr = '';
    if (fmt.endsWith('-sec')) {
      timeStr = `${pad(disp_h)}:${pad(m)}:${pad(s)}${ampm}`;
    } else {
      timeStr = `${pad(disp_h)}:${pad(m)}${ampm}`;
    }

    document.getElementById('clock').textContent = timeStr;
    const y=now.getFullYear(), mo=now.getMonth()+1, da=now.getDate();
    document.getElementById('dateDisplay').textContent = `${y}年${mo}月${da}日（${dayNamesFull[dow]}）`;

    const nowMin = toMin(h,m);
    const isWeekday = dow>=1 && dow<=5;

    document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
    document.querySelectorAll('.active-cell').forEach(el=>el.classList.remove('active-cell'));
    document.querySelectorAll('.today-header').forEach(el=>el.classList.remove('today-header'));
    document.querySelectorAll('.today-col').forEach(el=>el.classList.remove('today-col'));

    const statusEl = document.getElementById('currentStatus');
    const linkBtn = document.getElementById('btnOpenLink');

    if (isWeekday) {
      const todayTh = document.querySelector(`th[data-day="${dow}"]`);
      if (todayTh) todayTh.classList.add('today-header');
      document.querySelectorAll(`td[data-day="${dow}"]`).forEach(td=>td.classList.add('today-col'));
    }

    let foundPeriod = -1, foundSpecial = '';
    if (isWeekday) {
      for (let i=0;i<periods.length;i++) {
        if (nowMin >= toMin(...periods[i].start) && nowMin < toMin(...periods[i].end)) { foundPeriod=i; break; }
      }
      if (foundPeriod===-1) {
        for (const sp of specialSlots) {
          if (nowMin >= toMin(...sp.start) && nowMin < toMin(...sp.end)) { foundSpecial=sp.label; break; }
        }
      }
    }

    // Link button
    linkBtn.classList.remove('visible');

    if (!isWeekday) {
      safeSetHTML(statusEl, '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg> 休日'); statusEl.classList.remove('active');
    } else if (foundPeriod>=0) {
      const bid = schedule[dow-1][foundPeriod];
      safeSetHTML(statusEl, `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg> ${periods[foundPeriod].label}｜${displayName(bid)}`);
      statusEl.classList.add('active');
      // Show link button if URL is set
      const url = blockURL(bid);
      if (url && url !== '#') {
        linkBtn.href = url;
        linkBtn.classList.add('visible');
      }
    } else if (foundSpecial) {
      safeSetHTML(statusEl, foundSpecial==='SHR' ? '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg> ショートホームルーム' : `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line></svg> ${foundSpecial}`);
      statusEl.classList.add('active');
    } else if (nowMin < toMin(8,30)) {
      safeSetHTML(statusEl, '<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg> 授業前'); statusEl.classList.remove('active');
    } else if (nowMin >= toMin(15,30)) {
      safeSetHTML(statusEl, '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M17 18a5 5 0 0 0-10 0"></path><line x1="12" y1="2" x2="12" y2="9"></line><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"></line><line x1="1" y1="18" x2="3" y2="18"></line><line x1="21" y1="18" x2="23" y2="18"></line><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"></line></svg> 放課後'); statusEl.classList.remove('active');
    } else {
      safeSetHTML(statusEl, '<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 休憩時間'); statusEl.classList.remove('active');
    }

    if (foundPeriod>=0 && isWeekday) {
      const row = document.querySelector(`tr[data-period="${foundPeriod}"]`);
      if (row) {
        row.classList.add('highlight');
        row.querySelectorAll(`td[data-day="${dow}"] .subject-cell`).forEach(c=>c.classList.add('active-cell'));
      }
    }
  }

  // ============================================================
  //  EDIT MODE
  // ============================================================
  const editModeSwitch = document.getElementById('editModeSwitch');
  const editModeToggleContainer = document.getElementById('editModeToggleContainer');
  const timetableFooter = document.getElementById('timetableFooter');
  
  editModeSwitch.addEventListener('change', () => {
    if (editModeSwitch.checked) {
      document.body.classList.add('is-edit-mode');
      timetableFooter.textContent = 'セルをクリックして授業名・URLを編集してください';
    } else {
      document.body.classList.remove('is-edit-mode');
      timetableFooter.textContent = '編集モードをオンにすると授業名やリンクを設定できます';
    }
  });

  // Hide edit mode toggle when in calendar tab
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'timetable') {
        editModeToggleContainer.style.display = 'flex';
      } else {
        editModeToggleContainer.style.display = 'none';
      }
    });
  });

  // ============================================================
  //  BOOKMARKS
  // ============================================================
  const bookmarksBar = document.getElementById('bookmarksBar');
  let dragSrcId = null;

  function renderBookmarks() {
    bookmarksBar.textContent = '';
    
    // Add a placeholder to perfectly balance the center of the bookmarks 
    // against the '+' button on the right.
    const placeholder = document.createElement('div');
    placeholder.style.width = '28px';
    placeholder.style.height = '28px';
    placeholder.style.flexShrink = '0';
    placeholder.style.pointerEvents = 'none';
    placeholder.style.visibility = 'hidden';
    bookmarksBar.appendChild(placeholder);

    const bms = DB.bookmarks;
    bms.forEach(bm => {
      const a = document.createElement('a');
      a.className = 'bookmark-item';
      a.href = bm.url;
      a.draggable = true;
      a.dataset.id = bm.id;
      let domain;
      try { domain = new URL(bm.url).hostname; } catch { domain = ''; }
      const favicon = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : '';
      safeSetHTML(a, (favicon ? `<img src="${favicon}" alt="">` : '') + `<span>${bm.title}</span>`);

      // Menu button
      const menuBtn = document.createElement('div');
      menuBtn.className = 'bookmark-menu-btn';
      safeSetHTML(menuBtn, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>');
      menuBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const rect = menuBtn.getBoundingClientRect();
        showBookmarkCtxMenu(rect.right + 5, rect.top, bm);
      });
      a.appendChild(menuBtn);

      // Drag & drop
      a.addEventListener('dragstart', e => {
        dragSrcId = bm.id;
        a.classList.add('bookmark-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      a.addEventListener('dragend', () => { a.classList.remove('bookmark-dragging'); dragSrcId = null; });
      a.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      a.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragSrcId || dragSrcId === bm.id) return;
        const ids = DB.bookmarks.map(b => b.id);
        const fromIdx = ids.indexOf(dragSrcId);
        const toIdx = ids.indexOf(bm.id);
        if (fromIdx < 0 || toIdx < 0) return;
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, dragSrcId);
        DB.reorderBookmarks(ids);
        renderBookmarks();
      });

      // Context menu (right click)
      a.addEventListener('contextmenu', e => {
        e.preventDefault();
        showBookmarkCtxMenu(e.clientX, e.clientY, bm);
      });

      bookmarksBar.appendChild(a);
    });

    // Add button
    const addBtn = document.createElement('div');
    addBtn.className = 'bookmark-add';
    safeSetHTML(addBtn, '+');
    addBtn.title = 'ブックマークを追加';
    addBtn.addEventListener('click', () => {
      document.getElementById('bmTitle').value = '';
      document.getElementById('bmURL').value = '';
      document.getElementById('modalBookmark').classList.add('open');
    });
    bookmarksBar.appendChild(addBtn);
  }

  function showBookmarkCtxMenu(x, y, bm) {
    closeBookmarkCtxMenu();
    const menu = document.createElement('div');
    menu.className = 'bookmark-ctx-menu';
    menu.id = 'bookmarkCtxMenu';
    menu.style.left = Math.min(x, window.innerWidth - 160) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 100) + 'px';

    const editBtn = document.createElement('button');
    safeSetHTML(editBtn, '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> 編集');
    editBtn.addEventListener('click', () => {
      closeBookmarkCtxMenu();
      document.getElementById('bmTitle').value = bm.title;
      document.getElementById('bmURL').value = bm.url;
      document.getElementById('btnBmSave').dataset.editId = bm.id;
      document.getElementById('modalBookmark').classList.add('open');
    });
    menu.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    safeSetHTML(delBtn, '<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> 削除');
    delBtn.addEventListener('click', () => {
      closeBookmarkCtxMenu();
      DB.deleteBookmark(bm.id);
      renderBookmarks();
    });
    menu.appendChild(delBtn);

    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', closeBookmarkCtxMenu, { once: true }), 0);
  }

  function closeBookmarkCtxMenu() {
    const m = document.getElementById('bookmarkCtxMenu');
    if (m) m.remove();
  }

  // Bookmark save
  document.getElementById('btnBmSave').addEventListener('click', () => {
    const title = document.getElementById('bmTitle').value.trim();
    const url = document.getElementById('bmURL').value.trim();
    if (!title || !url) return;
    const editId = document.getElementById('btnBmSave').dataset.editId;
    if (editId) {
      const bms = DB.bookmarks;
      const bm = bms.find(b => b.id === editId);
      if (bm) { bm.title = title; bm.url = url; DB.bookmarks = bms; }
      delete document.getElementById('btnBmSave').dataset.editId;
    } else {
      DB.addBookmark({ title, url });
    }
    document.getElementById('modalBookmark').classList.remove('open');
    renderBookmarks();
  });

  // ============================================================
  //  BACKGROUND SETTINGS
  // ============================================================
  const settingsBtn = document.getElementById('settingsBtn');
  const bgPreview = document.getElementById('bgPreview');
  const bgUploadBtn = document.getElementById('bgUploadBtn');
  const bgFileInput = document.getElementById('bgFileInput');
  const btnBgReset = document.getElementById('btnBgReset');

  settingsBtn.addEventListener('click', () => {
    updateBgPreview();
    
    // Set current values for new settings
    const go = document.getElementById('glassOpacitySlider');
    const goVal = document.getElementById('glassOpacityVal');
    if (go) {
      go.value = DB.glassOpacity;
      if (goVal) goVal.textContent = DB.glassOpacity;
    }
    const cf = document.getElementById('clockFontSelect');
    if (cf) cf.value = DB.clockFont;
    const tf = document.getElementById('timeFormatSelect');
    if (tf) tf.value = DB.timeFormat;

    document.getElementById('modalBgSettings').classList.add('open');
  });

  // Settings Events
  const glassSlider = document.getElementById('glassOpacitySlider');
  if (glassSlider) {
    glassSlider.addEventListener('input', (e) => {
      const v = e.target.value;
      document.getElementById('glassOpacityVal').textContent = v;
      DB.glassOpacity = v;
      document.documentElement.style.setProperty('--glass-opacity-light', v);
      document.documentElement.style.setProperty('--glass-opacity-dark', v);
    });
  }
  
  const clockFontSelect = document.getElementById('clockFontSelect');
  if (clockFontSelect) {
    clockFontSelect.addEventListener('change', (e) => {
      DB.clockFont = e.target.value;
      document.documentElement.style.setProperty('--clock-font', e.target.value);
    });
  }
  
  const timeFormatSelect = document.getElementById('timeFormatSelect');
  if (timeFormatSelect) {
    timeFormatSelect.addEventListener('change', (e) => {
      DB.timeFormat = e.target.value;
      updateClock();
    });
  }

  bgUploadBtn.addEventListener('click', () => bgFileInput.click());

  bgFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      await IDB.saveBg(file);
      if (currentBgUrl) URL.revokeObjectURL(currentBgUrl);
      
      currentBgUrl = URL.createObjectURL(file);
      if (file.type.startsWith('video/')) {
        DB.bg = 'video:' + currentBgUrl;
      } else {
        DB.bg = currentBgUrl;
      }
      applyBg();
      updateBgPreview();
    } catch (err) {
      console.error(err);
      alert('ファイルの保存に失敗しました。');
    }
    bgFileInput.value = '';
  });

  btnBgReset.addEventListener('click', async () => {
    await IDB.deleteBg();
    if (currentBgUrl) { URL.revokeObjectURL(currentBgUrl); currentBgUrl = null; }
    DB.bg = null;
    DB.theme = '#ffffff';
    DB.darkMode = false;
    applyBg();
    applyTheme();
    applyDarkMode();
    updateBgPreview();
  });

  const themeColorPicker = document.getElementById('themeColorPicker');
  if (themeColorPicker) {
    themeColorPicker.addEventListener('input', (e) => {
      document.documentElement.style.setProperty('--accent-color', e.target.value);
    });
    themeColorPicker.addEventListener('change', (e) => {
      DB.theme = e.target.value;
      applyTheme();
    });
  }

  const darkModeToggle = document.getElementById('darkModeToggle');
  const darkModeQuickToggle = document.getElementById('darkModeQuickToggle');

  function toggleDarkMode() {
    DB.darkMode = !DB.darkMode;
    applyDarkMode();
  }

  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', (e) => {
      DB.darkMode = e.target.checked;
      applyDarkMode();
    });
  }
  
  if (darkModeQuickToggle) {
    darkModeQuickToggle.addEventListener('click', () => {
      toggleDarkMode();
    });
  }

  const fabMainBtn = document.getElementById('fabMainBtn');
  const fabContainer = document.getElementById('fabContainer');
  if (fabMainBtn && fabContainer) {
    fabMainBtn.addEventListener('click', () => {
      fabContainer.classList.toggle('open');
    });
    // Close FAB when clicking outside
    document.addEventListener('click', (e) => {
      if (!fabContainer.contains(e.target)) {
        fabContainer.classList.remove('open');
      }
    });
  }

  const focusToggleBtn = document.getElementById('focusToggleBtn');
  if (focusToggleBtn) {
    focusToggleBtn.addEventListener('click', () => {
      DB.focusMode = !DB.focusMode;
      applyFocusMode();
    });
  }

  function applyBg() {
    const bg = DB.bg;
    const videoEl = document.getElementById('bgVideo');
    if (bg) {
      document.body.classList.add('has-bg-image');
      if (bg.startsWith('video:')) {
        document.body.style.backgroundImage = 'none';
        if (videoEl) {
          videoEl.src = bg.replace('video:', '');
          videoEl.style.display = 'block';
          videoEl.play().catch(e => console.error('Video play error', e));
        }
      } else {
        if (videoEl) {
          videoEl.style.display = 'none';
          videoEl.src = '';
        }
        document.body.style.backgroundImage = `url(${bg})`;
      }
    } else {
      document.body.classList.remove('has-bg-image');
      document.body.style.backgroundImage = '';
      if (videoEl) {
        videoEl.style.display = 'none';
        videoEl.src = '';
      }
    }
  }

  function applyGlassOpacity() {
    const v = DB.glassOpacity;
    document.documentElement.style.setProperty('--glass-opacity-light', v);
    document.documentElement.style.setProperty('--glass-opacity-dark', v);
    const go = document.getElementById('glassOpacitySlider');
    const goVal = document.getElementById('glassOpacityVal');
    if (go) go.value = v;
    if (goVal) goVal.textContent = v;
  }

  function applyClockFont() {
    const v = DB.clockFont;
    document.documentElement.style.setProperty('--clock-font', v);
    const cf = document.getElementById('clockFontSelect');
    if (cf) cf.value = v;
  }

  function applyTheme() {
    document.documentElement.style.setProperty('--accent-color', DB.theme);
    const themeColorPicker = document.getElementById('themeColorPicker');
    if (themeColorPicker) {
      themeColorPicker.value = DB.theme;
    }
  }

  function applyDarkMode() {
    if (DB.darkMode) {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
    }
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.checked = DB.darkMode;

    const quickToggle = document.getElementById('darkModeQuickToggle');
    if (quickToggle) {
      const moon = quickToggle.querySelector('.moon-icon');
      const sun = quickToggle.querySelector('.sun-icon');
      if (moon && sun) {
        if (DB.darkMode) {
          moon.style.display = 'none';
          sun.style.display = 'block';
        } else {
          moon.style.display = 'block';
          sun.style.display = 'none';
        }
      }
    }
  }

  function applyFocusMode() {
    const btn = document.getElementById('focusToggleBtn');
    if (DB.focusMode) {
      document.body.classList.add('focus-mode');
      if (btn) {
        btn.querySelector('.eye-open').style.display = 'none';
        btn.querySelector('.eye-closed').style.display = 'block';
      }
    } else {
      document.body.classList.remove('focus-mode');
      if (btn) {
        btn.querySelector('.eye-open').style.display = 'block';
        btn.querySelector('.eye-closed').style.display = 'none';
      }
    }
  }

  function updateBgPreview() {
    const bg = DB.bg;
    if (bg) {
      if (bg.startsWith('video:')) {
        safeSetHTML(bgPreview, `<video src="${bg.replace('video:', '')}" style="width:100%;height:100%;object-fit:cover;" autoplay loop muted></video>`);
      } else {
        safeSetHTML(bgPreview, `<img src="${bg}" alt="背景プレビュー">`);
      }
    } else {
      safeSetHTML(bgPreview, 'プレビュー');
    }
  }

  // ============================================================
  //  INIT
  // ============================================================
  buildTable();
  buildLegend();
  
  // Smart Search & Commands
  const COMMANDS = [
    { cmd: '/docs', url: 'https://docs.google.com/document/', label: 'Google ドキュメント' },
    { cmd: '/mail', url: 'https://mail.google.com/', label: 'Gmail' },
    { cmd: '/mails', url: 'https://mail.google.com/', label: 'Gmail' },
    { cmd: '/slides', url: 'https://docs.google.com/presentation/', label: 'Google スライド' },
    { cmd: '/sheets', url: 'https://docs.google.com/spreadsheets/', label: 'Google スプレッドシート' },
    { cmd: '/spreadsheet', url: 'https://docs.google.com/spreadsheets/', label: 'Google スプレッドシート' },
    { cmd: '/sheet', url: 'https://docs.google.com/spreadsheets/', label: 'Google スプレッドシート' },
    { cmd: '/spreadsheets', url: 'https://docs.google.com/spreadsheets/', label: 'Google スプレッドシート' },
    { cmd: '/class', url: 'https://classroom.google.com/', label: 'Google Classroom' },
    { cmd: '/school', url: 'https://classroom.google.com/', label: 'Google Classroom' },
    { cmd: '/classroom', url: 'https://classroom.google.com/', label: 'Google Classroom' },
    { cmd: '/youtube', url: 'https://www.youtube.com/', label: 'YouTube' }
  ];

  const searchForm = document.querySelector('.search-bar');
  if (searchForm) {
    const qInput = document.getElementById('searchInput');
    const suggestionsBox = document.getElementById('searchSuggestions');
    let selectedIndex = -1;
    let currentSuggestions = [];

    function renderSuggestions(query) {
      if (!query.startsWith('/')) {
        suggestionsBox.classList.remove('active');
        return;
      }
      currentSuggestions = COMMANDS.filter(c => c.cmd.startsWith(query.toLowerCase()));
      if (currentSuggestions.length === 0) {
        suggestionsBox.classList.remove('active');
        return;
      }
      
      suggestionsBox.innerHTML = '';
      currentSuggestions.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        const cmdSpan = document.createElement('span');
        cmdSpan.className = 'suggestion-cmd';
        cmdSpan.textContent = item.cmd;
        
        const labelSpan = document.createElement('span');
        labelSpan.textContent = item.label;
        
        div.appendChild(cmdSpan);
        div.appendChild(labelSpan);
        div.addEventListener('click', () => {
          window.location.href = item.url;
        });
        suggestionsBox.appendChild(div);
      });
      selectedIndex = -1;
      suggestionsBox.classList.add('active');
    }

    qInput.addEventListener('input', (e) => {
      renderSuggestions(e.target.value.trim());
    });

    qInput.addEventListener('keydown', (e) => {
      if (suggestionsBox.classList.contains('active')) {
        const items = suggestionsBox.querySelectorAll('.suggestion-item');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIndex = (selectedIndex + 1) % items.length;
          updateSelection(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIndex = (selectedIndex - 1 + items.length) % items.length;
          updateSelection(items);
        }
      }
    });

    function updateSelection(items) {
      items.forEach(item => item.classList.remove('selected'));
      if (selectedIndex >= 0 && items[selectedIndex]) {
        items[selectedIndex].classList.add('selected');
      }
    }

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchForm.contains(e.target)) {
        suggestionsBox.classList.remove('active');
      }
    });

    searchForm.addEventListener('submit', (e) => {
      const q = qInput.value.trim();
      if (!q) {
        e.preventDefault();
        return;
      }
      
      // If a suggestion is selected via keyboard
      if (suggestionsBox.classList.contains('active') && selectedIndex >= 0) {
        e.preventDefault();
        window.location.href = currentSuggestions[selectedIndex].url;
        return;
      }

      // Check for exact command match
      const exactCmd = COMMANDS.find(c => c.cmd === q.toLowerCase());
      if (exactCmd) {
        e.preventDefault();
        window.location.href = exactCmd.url;
        return;
      }

      // Check URL match
      if (/^https?:\/\//i.test(q) || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(q)) {
        e.preventDefault();
        window.location.href = /^https?:\/\//i.test(q) ? q : 'https://' + q;
      }
    });
  }

  // Ctrl+L / Cmd+L Focus Search
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    }
  });

  // Force focus on the search bar when opening a new tab
  window.addEventListener('load', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 50);
    }
  });

  // Load BG from IndexedDB if not found in localStorage
  IDB.init().then(() => {
    return IDB.getBg();
  }).then(bgData => {
    if (bgData) {
      const fileBlob = bgData.data || bgData;
      if (fileBlob instanceof Blob) {
        currentBgUrl = URL.createObjectURL(fileBlob);
        if (fileBlob.type && fileBlob.type.startsWith('video/')) {
          DB.bg = 'video:' + currentBgUrl; // Flag to applyBg that it's a video
        } else {
          DB.bg = currentBgUrl;
        }
      } else {
        console.warn("bgData is not a Blob. Fallback handling.");
        if (typeof fileBlob === 'string') {
          currentBgUrl = fileBlob;
          DB.bg = currentBgUrl;
        } else {
          IDB.deleteBg(); // Remove corrupted data
        }
      }
    }
    applyBg();
    updateBgPreview();
  }).catch(e => {
    console.error("IDB init error", e);
    applyBg();
    updateBgPreview();
  });
  // ============================================================
  //  CLOUD SYNC UI & LOGIC
  // ============================================================
  const authOverlay = document.getElementById('authOverlay');
  const syncLoginSection = document.getElementById('syncLoginSection');
  const syncActiveSection = document.getElementById('syncActiveSection');
  const syncUsernameInput = document.getElementById('syncUsername');
  const syncPasswordInput = document.getElementById('syncPassword');
  const btnSyncLogin = document.getElementById('btnSyncLogin');
  const btnSyncNow = document.getElementById('btnSyncNow');
  const btnSyncLogout = document.getElementById('btnSyncLogout');
  const syncErrorMsg = document.getElementById('syncErrorMsg');
  const syncStatusMsg = document.getElementById('syncStatusMsg');
  
  const btnSyncPush = document.getElementById('btnSyncPush');
  const btnSyncPull = document.getElementById('btnSyncPull');
  const syncStatusMsgMain = document.getElementById('syncStatusMsgMain');
  const syncActiveUsername = document.getElementById('syncActiveUsername');

  function updateSyncUI() {
    if (DB.syncToken && DB.syncUsername) {
      // Logged in
      if (authOverlay) authOverlay.style.display = 'none';
      if (syncActiveSection) {
        syncActiveSection.style.display = 'block';
        if (syncActiveUsername) syncActiveUsername.textContent = DB.syncUsername;
      }
    } else {
      // Not logged in (Lock Screen)
      if (authOverlay) authOverlay.style.display = 'flex';
      if (syncActiveSection) syncActiveSection.style.display = 'none';
      if (syncPasswordInput) syncPasswordInput.value = '';
      if (syncStatusMsg) syncStatusMsg.style.display = 'none';
      if (syncErrorMsg) syncErrorMsg.style.display = 'none';
    }
  }

  if (btnSyncLogin) {
    btnSyncLogin.addEventListener('click', async () => {
      const u = syncUsernameInput.value.trim();
      const p = syncPasswordInput.value;
      if (!u || !p) {
        syncErrorMsg.textContent = 'ユーザー名とパスワードを入力してください';
        syncErrorMsg.style.display = 'block';
        syncStatusMsg.style.display = 'none';
        return;
      }
      btnSyncLogin.textContent = '通信中...';
      btnSyncLogin.disabled = true;
      try {
        const res = await fetch(`${SYNC_API_URL}/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        
        if (res.status === 202 || (res.status === 403 && data.pending)) {
          // Waiting for approval
          syncStatusMsg.textContent = data.message || data.error;
          syncStatusMsg.style.display = 'block';
          syncErrorMsg.style.display = 'none';
        } else if (!res.ok) {
          throw new Error(data.error || 'Login failed');
        } else {
          // Success
          DB.syncToken = data.token;
          DB.syncUsername = u;
          updateSyncUI();
          
          // Initial pull to fetch data approved by admin
          syncStatusMsgMain.textContent = '初回データを取得中...';
          const updated = await CloudSync.pull();
          if (updated) {
            location.reload();
          } else {
            syncStatusMsgMain.textContent = 'ログインしました！(初回)';
          }
        }
      } catch (err) {
        syncErrorMsg.textContent = err.message;
        syncErrorMsg.style.display = 'block';
        syncStatusMsg.style.display = 'none';
      } finally {
        btnSyncLogin.textContent = 'ログイン / 登録';
        btnSyncLogin.disabled = false;
      }
    });
  }

  if (btnSyncLogout) {
    btnSyncLogout.addEventListener('click', () => {
      CloudSync.logout();
      updateSyncUI();
    });
  }

  if (btnSyncPush) {
    btnSyncPush.addEventListener('click', async () => {
      btnSyncPush.textContent = '保存中...';
      btnSyncPush.disabled = true;
      syncStatusMsgMain.textContent = '';
      try {
        await CloudSync.push();
        syncStatusMsgMain.textContent = '✅ クラウドに保存しました！(' + new Date().toLocaleTimeString() + ')';
      } catch (err) {
        syncStatusMsgMain.textContent = '❌ 保存失敗: ' + err.message;
      } finally {
        btnSyncPush.textContent = '↑ クラウドに保存';
        btnSyncPush.disabled = false;
      }
    });
  }

  if (btnSyncPull) {
    btnSyncPull.addEventListener('click', async () => {
      btnSyncPull.textContent = '反映中...';
      btnSyncPull.disabled = true;
      syncStatusMsgMain.textContent = '';
      try {
        const updated = await CloudSync.pull();
        if (updated) {
          syncStatusMsgMain.textContent = '✅ クラウドから反映しました！ページを更新します...';
          setTimeout(() => location.reload(), 1000);
        } else {
          syncStatusMsgMain.textContent = 'クラウド上にデータがありません。';
        }
      } catch (err) {
        syncStatusMsgMain.textContent = '❌ 反映失敗: ' + err.message;
      } finally {
        btnSyncPull.textContent = '↓ クラウドから反映';
        btnSyncPull.disabled = false;
      }
    });
  }

  updateSyncUI();

  renderCalendar();
  renderBookmarks();
  applyBg();
  applyTheme();
  applyDarkMode();
  applyFocusMode();
  applyGlassOpacity();
  applyClockFont();
  updateClock();
  setInterval(updateClock, 1000);

  // Force focus on the search bar when opening a new tab
  // Chrome natively forces focus to the omnibox on new tab override pages.
  // We use a query parameter redirect hack to bypass this restriction.
  if (location.search !== "?focus") {
    location.replace(location.pathname + "?focus");
  } else {
    window.addEventListener('load', () => {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.focus();
      }
    });
  }

})();
