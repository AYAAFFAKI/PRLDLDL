(function(){
  // Editing state (index page)
  let editingId = null;
  // Utility: get element by ID
  function id(x){return document.getElementById(x)}
  // Utility: query selector scoped
  function qs(x,root){return (root||document).querySelector(x)}
  // Utility: normalize strings for comparison
  function norm(s){ return (s||'').trim().toLowerCase().replace(/\s+/g,' '); }

  // Render a list of tasks into a given container using the shared template
  function renderTasks(container, tasks){
    container.innerHTML = '';
    const tmpl = document.getElementById('task-item-template');
    const frag = document.createDocumentFragment();
    // Determine context date: tasks page uses selected filter date; index uses today
    const dateInputEl = document.getElementById('filter-date');
    const contextDate = dateInputEl && dateInputEl.value ? dateInputEl.value : new Date().toISOString().slice(0,10);
    tasks.forEach(t=>{
      const el = tmpl.content.firstElementChild.cloneNode(true);
      el.dataset.id = t.id;
      qs('.task-icon', el).textContent = t.icon || '📝';
      qs('.task-title', el).textContent = t.title;
      // Star if important
      const starEl = qs('.task-star', el);
      if (starEl) starEl.textContent = t.important ? '*' : '';
      // Owner removed; keep compatibility if template lacks element
      qs('.task-duration', el).textContent = t.duration? (t.duration+" min") : '';
      qs('.task-date', el).textContent = t.date || '';
      // Range and repeat badges
      const rangeEl = qs('.task-range', el);
      const repeatEl = qs('.task-repeat', el);
      if (rangeEl) {
        const s = t.startDate || '';
        const e = t.endDate || '';
        rangeEl.textContent = (s || e) ? `${s||''}${s||e ? ' → ' : ''}${e||''}` : '';
      }
      if (repeatEl) {
        if (t.repeat && t.repeat !== 'none') {
          const occ = t.occurrences ? ` x${t.occurrences}` : '';
          let detail = '';
          if (t.repeat === 'weekly' && Array.isArray(t.weeklyDays) && t.weeklyDays.length){
            const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            detail = ' ' + t.weeklyDays.sort((a,b)=>a-b).map(d=>names[d]).join(',');
          }
          if (t.repeat === 'monthly' && Array.isArray(t.monthlyDays) && t.monthlyDays.length){
            detail = ' ' + t.monthlyDays.sort((a,b)=>a-b).join(',');
          }
          repeatEl.textContent = `${t.repeat.charAt(0).toUpperCase()+t.repeat.slice(1)}${detail}${occ}`;
        } else {
          repeatEl.textContent = '';
        }
      }
      // Completion UI (per-day tracking)
      const completeWrap = qs('.task-complete', el);
      if (completeWrap) {
        // Common initial completed class
        const byDate = t.completedByDate || {};
        const doneMinutes = byDate[contextDate];
        const isDoneToday = (typeof t.duration === 'number' && typeof doneMinutes === 'number' && doneMinutes >= t.duration) || (typeof t.duration !== 'number' && doneMinutes === true);
        if (isDoneToday) el.classList.add('completed');

        const sel = qs('.complete-select', el);
        const checkWrap = qs('.complete-check-wrap', el);
        const check = qs('.complete-check', el);

        if (typeof t.duration === 'number' && t.duration > 0) {
          // Timed task: show select
          completeWrap.hidden = false;
          checkWrap.hidden = true;
          sel.innerHTML = '';
          const step = 15;
          for (let m = step; m <= t.duration; m += step) {
            const opt = document.createElement('option');
            opt.value = String(m);
            opt.textContent = `${m} min`;
            sel.appendChild(opt);
          }
          // Ensure exact duration option exists (if not multiple of step)
          if (t.duration % 15 !== 0){
            const exact = document.createElement('option');
            exact.value = String(t.duration);
            exact.textContent = `${t.duration} min`;
            sel.appendChild(exact);
          }
          if (typeof doneMinutes === 'number') sel.value = String(doneMinutes);
          sel.addEventListener('change', () => {
            const minutes = parseInt(sel.value, 10);
            const all = storage.loadTasks();
            const idx = all.findIndex(x => x.id === t.id);
            if (idx !== -1) {
              const map = all[idx].completedByDate || {};
              map[contextDate] = minutes;
              all[idx].completedByDate = map;
              storage.saveTasks(all);
              if (minutes >= (all[idx].duration||0)) el.classList.add('completed');
              else el.classList.remove('completed');
              const statusSel = document.getElementById('filter-status');
              if (statusSel) statusSel.dispatchEvent(new Event('change'));
            }
          });
        } else {
          // No duration: show checkbox to mark done
          completeWrap.hidden = false;
          sel.hidden = true;
          checkWrap.hidden = false;
          if (check) check.checked = doneMinutes === true;
          if (check) check.addEventListener('change', () => {
            const all = storage.loadTasks();
            const idx = all.findIndex(x => x.id === t.id);
            if (idx !== -1) {
              const map = all[idx].completedByDate || {};
              map[contextDate] = check.checked === true ? true : undefined;
              if (check.checked) map[contextDate] = true; else delete map[contextDate];
              all[idx].completedByDate = map;
              storage.saveTasks(all);
              if (check.checked) el.classList.add('completed');
              else el.classList.remove('completed');
              const statusSel = document.getElementById('filter-status');
              if (statusSel) statusSel.dispatchEvent(new Event('change'));
            }
          });
        }
      }

      // Edit handler
      const editBtn = qs('.btn-edit', el);
      if (editBtn){
        const hasForm = !!document.getElementById('task-form');
        editBtn.addEventListener('click', ()=>{
          if (hasForm){
            // Prefill form on index page
            prefillForm(t);
          } else {
            // On tasks page, redirect to index to edit
            window.location.href = `index.html?edit=${encodeURIComponent(t.id)}`;
          }
        });
      }

      // Delete handler
      qs('.btn-delete', el).addEventListener('click',()=>{
        storage.deleteTask(t.id);
        renderTasks(container, storage.loadTasks());
        if(window.animations) animations.flashRed();
      });
      frag.appendChild(el);
    });
    container.appendChild(frag);
  }

  // Create a new normalized task object
  function makeTask(obj){
    return {
      id: Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      title: obj.title.trim(),
      duration: obj.duration || null,
      date: obj.date || '',
      icon: obj.icon || '📝',
      startDate: obj.startDate || '',
      endDate: obj.endDate || '',
      repeat: obj.repeat || 'none',
      occurrences: obj.occurrences || null,
      weeklyDays: Array.isArray(obj.weeklyDays)? obj.weeklyDays : [],
      monthlyDays: Array.isArray(obj.monthlyDays)? obj.monthlyDays : [],
      important: !!obj.important,
      createdAt: Date.now()
    };
  }

  // Index page: handle Add Task and show recent tasks
  function onIndex(){
    const form = id('task-form');
    const title = id('task-title');
    const duration = id('task-duration');
    const date = id('task-date');
    const startDate = id('task-start');
    const endDate = id('task-end');
    const repeatSel = id('task-repeat');
    const occurrences = id('task-occurrences');
    const weeklyWrap = id('weekly-days-wrap');
    const monthlyWrap = id('monthly-days-wrap');
    const weeklyBoxes = document.querySelectorAll('#weekly-days-wrap .weekday');
    const monthGrid = id('month-grid');
    const icon = id('task-icon');
    const important = id('task-important');
    const error = id('form-error');
    const container = id('tasks-container');
    const addBtn = id('add-btn');

    renderTasks(container, storage.loadTasks());

    function setEditingMode(on){
      if (!addBtn) return;
      addBtn.textContent = on ? 'Save Changes' : 'Add Task';
    }

    // Prefill helper
    window.prefillForm = function(task){
      editingId = task.id;
      title.value = task.title || '';
      duration.value = task.duration || '';
      date.value = task.date || '';
      icon.value = task.icon || '📝';
      important.checked = !!task.important;
      const s = id('task-start'); const e = id('task-end');
      const r = id('task-repeat'); const o = id('task-occurrences');
      if (s) s.value = task.startDate || '';
      if (e) e.value = task.endDate || '';
      if (r) r.value = task.repeat || 'none';
      if (o) o.value = task.occurrences || '';
      if (weeklyBoxes){
        weeklyBoxes.forEach(cb => { cb.checked = Array.isArray(task.weeklyDays) && task.weeklyDays.includes(parseInt(cb.value,10)); });
      }
      if (monthGrid){ setMonthlySelected(task.monthlyDays || []); }
      toggleRepeatUI();
      setEditingMode(true);
      title.focus();
    }

    form.addEventListener('submit', e=>{
      e.preventDefault();
      const t = title.value.trim();
      if(!t){ error.textContent='Attention: veuillez saisir un titre.'; title.focus(); return; }
      const weeklyDays = weeklyBoxes? Array.from(weeklyBoxes).filter(cb=>cb.checked).map(cb=>parseInt(cb.value,10)) : [];
      const monthlyDays = monthGrid? getMonthlySelected() : [];
      const task = makeTask({
        title: t,
        duration: duration.value? parseInt(duration.value,10): null,
        date: date.value? new Date(date.value).toISOString().slice(0,10): '',
        icon: icon.value || '📝',
        startDate: startDate && startDate.value ? new Date(startDate.value).toISOString().slice(0,10) : '',
        endDate: endDate && endDate.value ? new Date(endDate.value).toISOString().slice(0,10) : '',
        repeat: repeatSel ? repeatSel.value : 'none',
        occurrences: occurrences && occurrences.value ? parseInt(occurrences.value,10) : null,
        weeklyDays,
        monthlyDays,
        important: important? important.checked : false
      });
      const tasks = storage.loadTasks();
      // Prevent duplicates: same title + same date (case-insensitive on title), excluding current when editing
      const isDup = tasks.some(x => x.id !== editingId && norm(x.title)===norm(task.title) && (x.date||'')===(task.date||''));
      if(isDup){
        error.textContent = 'Attention: cette tâche existe déjà.';
        title.focus();
        return;
      }
      if (editingId){
        const idx = tasks.findIndex(x=>x.id===editingId);
        if (idx !== -1){ tasks[idx] = { ...tasks[idx], ...task, id: editingId }; }
      } else {
        tasks.push(task);
      }
      storage.saveTasks(tasks);
      renderTasks(container, tasks);
      form.reset(); icon.value='📝'; error.textContent=''; editingId=null; setEditingMode(false);
      if(window.animations) animations.flashGreen();
    });

    // Toggle weekly/monthly UI based on repeat selection
    function toggleRepeatUI(){
      if (!repeatSel) return;
      if (weeklyWrap) weeklyWrap.hidden = repeatSel.value !== 'weekly';
      if (monthlyWrap) monthlyWrap.hidden = repeatSel.value !== 'monthly';
    }
    if (repeatSel){ repeatSel.addEventListener('change', toggleRepeatUI); toggleRepeatUI(); }

    // Build monthly grid (1..31) once and wire selection toggles
    function buildMonthGrid(){
      if (!monthGrid || monthGrid.dataset.built==='1') return;
      for(let d=1; d<=31; d++){
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'day';
        btn.textContent = String(d);
        btn.dataset.day = String(d);
        btn.addEventListener('click', ()=>{
          btn.classList.toggle('selected');
        });
        monthGrid.appendChild(btn);
      }
      monthGrid.dataset.built = '1';
    }
    function getMonthlySelected(){
      if (!monthGrid) return [];
      return Array.from(monthGrid.querySelectorAll('.day.selected')).map(el=>parseInt(el.dataset.day,10)).sort((a,b)=>a-b);
    }
    function setMonthlySelected(days){
      buildMonthGrid();
      const set = new Set(Array.isArray(days)? days: []);
      monthGrid.querySelectorAll('.day').forEach(el=>{
        const d = parseInt(el.dataset.day,10);
        if (set.has(d)) el.classList.add('selected'); else el.classList.remove('selected');
      });
    }
    buildMonthGrid();

    // If redirected with ?edit=ID, prefill
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    if (editId){
      const t = storage.loadTasks().find(x=>x.id===editId);
      if (t) prefillForm(t);
      // Clean URL
      history.replaceState({}, '', 'index.html');
    }
  }

  // Helpers for date math (UTC, day-precision)
  function toDay(dateStr){
    if(!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  function addDays(d, n){ const x = new Date(d); x.setUTCDate(x.getUTCDate()+n); return x; }
  function daysBetween(a,b){ return Math.floor((b - a)/86400000); }

  function countWeeklyOccurrences(start, target, daysSet){
    let count = 0;
    for (let d = new Date(start); d <= target; d = addDays(d,1)){
      if (daysSet.has(d.getUTCDay())) count++;
    }
    return count;
  }
  function countMonthlyOccurrences(start, target, daysArr){
    let count = 0;
    const sYear = start.getUTCFullYear();
    const sMonth = start.getUTCMonth();
    let d = new Date(Date.UTC(sYear, sMonth, 1));
    if (start.getUTCDate() > 1) d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    while (d <= target){
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      for (const day of daysArr){
        const candidate = new Date(Date.UTC(y, m, day));
        if (candidate >= start && candidate <= target) count++;
      }
      d = new Date(Date.UTC(y, m+1, 1));
    }
    return count;
  }
  function minDate(a,b){ if(!a) return b; if(!b) return a; return a<b?a:b; }

  // Determine if a task occurs on a specific date considering repeat/range/occurrences
  function occursOnDate(t, dateStr){
    const target = toDay(dateStr);
    if(!target) return false;

    const baseDate = t.date ? toDay(t.date) : null;
    const start = t.startDate ? toDay(t.startDate) : baseDate;
    const endByRange = t.endDate ? toDay(t.endDate) : null;
    const repeat = t.repeat || 'none';
    const occ = typeof t.occurrences === 'number' ? t.occurrences : null;

    // No repeat: match explicit date or within start-end if provided
    if (repeat === 'none'){
      if (baseDate) return +baseDate === +target;
      if (start && endByRange) return target >= start && target <= endByRange;
      return false;
    }

    if (!start) return false; // cannot evaluate repeat without start
    if (repeat === 'daily'){
      const step = 1;
      const endByOcc = occ ? addDays(start, step*(occ-1)) : null;
      const end = minDate(endByRange, endByOcc);
      if (end && target > end) return false;
      if (target < start) return false;
      const diff = daysBetween(start, target);
      return diff % step === 0;
    }
    if (repeat === 'weekly'){
      const daysArr = Array.isArray(t.weeklyDays) && t.weeklyDays.length ? t.weeklyDays : null;
      const end = endByRange; // end by range applies
      if (end && target > end) return false;
      if (target < start) return false;
      if (daysArr){
        const inSet = new Set(daysArr);
        if (!inSet.has(target.getUTCDay())) return false;
        if (occ){
          const count = countWeeklyOccurrences(start, target, inSet);
          return count <= occ; // target counts
        }
        return true;
      } else {
        // fallback to every 7 days from start
        const diff = daysBetween(start, target);
        return diff % 7 === 0;
      }
    }
    if (repeat === 'monthly'){
      const daysArr = Array.isArray(t.monthlyDays) && t.monthlyDays.length ? t.monthlyDays : [];
      const end = endByRange;
      if (end && target > end) return false;
      if (target < start) return false;
      const dom = target.getUTCDate();
      if (!daysArr.includes(dom)) return false;
      if (occ){
        const count = countMonthlyOccurrences(start, target, daysArr);
        return count <= occ;
      }
      return true;
    }
    return false;
  }

  // Apply filters (by date, urgent, and status) considering repeats
  function filterTasks(all){
    const dateInput = id('filter-date');
    const statusSel = id('filter-status');
    let out = all.slice();
    if(dateInput && dateInput.value){
      const d = dateInput.value; // keep as YYYY-MM-DD to avoid timezone shifts
      out = out.filter(t=> occursOnDate(t, d));
    }
    if(statusSel){
      if (dateInput && dateInput.value){
        const d = dateInput.value;
        out = out.filter(t=>{
          const byDate = t.completedByDate || {};
          const minutes = byDate[d];
          const isDone = (typeof t.duration === 'number') ? (typeof minutes === 'number' && minutes >= (t.duration||0)) : (minutes === true);
          if (statusSel.value === 'finished') return isDone;
          if (statusSel.value === 'not') return !isDone;
          return true;
        });
      } else {
        if(statusSel.value === 'finished') out = out.filter(t=> !!t.completed);
        else if(statusSel.value === 'not') out = out.filter(t=> !t.completed);
      }
    }
    return out;
  }

  // Tasks page: render and wire filter controls
  function onTasks(){
    const container = id('tasks-container');
    const dateInput = id('filter-date');
    const statusSel = id('filter-status');
    function apply(){ renderTasks(container, filterTasks(storage.loadTasks())); }
    [dateInput].forEach(el=> el && el.addEventListener('input', apply));
    if (statusSel){ statusSel.addEventListener('change', apply); statusSel.addEventListener('input', apply); }
    apply();
  }

  // Notes page: CRUD with last modified date
  function onNotes(){
    const form = id('note-form');
    const inputId = id('note-id');
    const inputTitle = id('note-title');
    const ta = id('note-text');
    const listEl = id('notes-list');
    const cancelBtn = id('note-cancel');
    const sortSel = id('notes-sort');

    function fmt(ts){
      try{ return new Date(ts).toLocaleString(); }catch(e){ return ''; }
    }

    // Simple modal helpers
    let modal, modalTitle, modalBody, modalMeta;
    function ensureModal(){
      if (modal) return;
      modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal">
          <div class="modal-header"><div class="modal-title"></div><button class="modal-close" aria-label="Close">✕</button></div>
          <div class="modal-content"></div>
          <div class="modal-meta"></div>
        </div>`;
      document.body.appendChild(modal);
      modalTitle = modal.querySelector('.modal-title');
      modalBody = modal.querySelector('.modal-content');
      modalMeta = modal.querySelector('.modal-meta');
      modal.addEventListener('click', (e)=>{ if (e.target===modal || e.target.classList.contains('modal-close')) closeModal(); });
    }
    function openModal(title, text, updatedAt){
      ensureModal();
      modalTitle.textContent = title || '(Untitled)';
      modalBody.textContent = text || '';
      modalMeta.textContent = 'Last updated: ' + fmt(updatedAt);
      modal.classList.add('open');
    }
    function closeModal(){ if (modal) modal.classList.remove('open'); }

    function render(){
      const notes = storage.loadNotesList();
      listEl.innerHTML = '';
      if (!notes.length){
        const empty = document.createElement('p');
        empty.textContent = 'No notes yet.';
        listEl.appendChild(empty);
        return;
      }
      const frag = document.createDocumentFragment();
      const mode = sortSel ? sortSel.value : 'last';
      notes.sort((a,b)=> mode==='title' ? ( (a.title||'').localeCompare(b.title||'') || (b.updatedAt - a.updatedAt) ) : (b.updatedAt - a.updatedAt)).forEach(n=>{
        const item = document.createElement('div');
        item.className = 'note-item';
        const title = document.createElement('div');
        title.className = 'note-title';
        title.textContent = n.title || '(Untitled)';
        const meta = document.createElement('div');
        meta.className = 'note-meta';
        meta.textContent = 'Last updated: ' + fmt(n.updatedAt);
        const actions = document.createElement('div');
        actions.className = 'note-item-actions';
        const btnEdit = document.createElement('button');
        btnEdit.type = 'button'; btnEdit.className='btn-edit'; btnEdit.title='Edit'; btnEdit.textContent='✎';
        const btnDel = document.createElement('button');
        btnDel.type = 'button'; btnDel.className='btn-delete'; btnDel.title='Delete'; btnDel.textContent='✕';
        btnEdit.addEventListener('click', ()=>{
          inputId.value = n.id;
          if (inputTitle) inputTitle.value = n.title || '';
          ta.value = n.text || '';
          ta.focus();
        });
        btnDel.addEventListener('click', ()=>{
          storage.deleteNote(n.id);
          render();
          if(window.animations) animations.flashRed();
        });
        actions.appendChild(btnEdit); actions.appendChild(btnDel);
        item.appendChild(title); item.appendChild(meta); item.appendChild(actions);
        // Click to open modal with full content
        item.addEventListener('click', (e)=>{
          // avoid when clicking action buttons
          if ((e.target instanceof HTMLElement) && (e.target.closest('.note-item-actions'))) return;
          openModal(n.title, n.text, n.updatedAt);
        });
        frag.appendChild(item);
      });
      listEl.appendChild(frag);
    }

    if (form){
      form.addEventListener('submit', (e)=>{
        e.preventDefault();
        const text = (ta.value||'').trim();
        const title = (inputTitle && inputTitle.value || '').trim();
        if (!text && !title){ return; }
        const idVal = inputId.value || null;
        storage.upsertNote({ id: idVal, text, title });
        inputId.value = '';
        if (inputTitle) inputTitle.value = '';
        ta.value = '';
        render();
        if(window.animations) animations.flashGreen();
      });
    }
    if (cancelBtn){ cancelBtn.addEventListener('click', ()=>{ inputId.value=''; if(inputTitle) inputTitle.value=''; ta.value=''; ta.focus(); }); }
    if (sortSel){ sortSel.addEventListener('change', ()=> render()); }
    render();
  }

  // Contact page: validate form inputs
  function onContact(){
    const form = id('contact-form');
    const err = id('contact-error');
    if(!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      err.textContent = '';
      const name = id('name').value.trim();
      const email = id('email').value.trim();
      const message = id('message').value.trim();
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if(!name){ err.textContent = 'Please enter your name.'; return; }
      if(!emailOk){ err.textContent = 'Please enter a valid email address.'; return; }
      if(!message){ err.textContent = 'Please enter a message.'; return; }
      // Simulate send success
      form.reset();
      err.style.color = '#1b5e20';
      err.textContent = 'Message sent!';
      setTimeout(()=>{ err.textContent=''; err.style.color=''; }, 3000);
    });
  }

  // Boot per page
  document.addEventListener('DOMContentLoaded', function(){
    const page = document.body.dataset.page;
    if(page==='index') onIndex();
    if(page==='tasks') onTasks();
    if(page==='notes') onNotes();
    if(page==='contact') onContact();

    // Site-wide search form: redirect to tasks with query
    const searchForm = document.getElementById('site-search');
    const searchInput = document.getElementById('search-input');
    if (searchForm){
      searchForm.addEventListener('submit', (e)=>{
        e.preventDefault();
        const q = (searchInput && searchInput.value || '').trim();
        const url = q ? `tasks.html?q=${encodeURIComponent(q)}` : 'tasks.html';
        if (page==='tasks'){
          // stay on page and apply
          const params = new URLSearchParams(window.location.search);
          if (q) params.set('q', q); else params.delete('q');
          history.replaceState({}, '', `tasks.html?${params.toString()}`);
          const apply = ()=>{
            const container = document.getElementById('tasks-container');
            const filtered = filterTasks(storage.loadTasks()).filter(t=> q? (t.title||'').toLowerCase().includes(q.toLowerCase()): true);
            if (container) renderTasks(container, filtered);
          };
          apply();
        } else {
          window.location.href = url;
        }
      });
    }

    // On tasks page, initialize search from URL
    if (page==='tasks'){
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q') || '';
      if (searchInput) searchInput.value = q;
      const origOnTasks = onTasks; // no-op to avoid re-binding
      // Re-render after tasks init to include query filter
      setTimeout(()=>{
        const container = document.getElementById('tasks-container');
        const apply = ()=>{
          const base = filterTasks(storage.loadTasks());
          const filtered = q ? base.filter(t=> (t.title||'').toLowerCase().includes(q.toLowerCase())) : base;
          if (container) renderTasks(container, filtered);
        };
        apply();
      }, 0);
    }
  });
})();
