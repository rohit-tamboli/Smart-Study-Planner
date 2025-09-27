(() => {
            const formCard = document.getElementById('formCard');
            const newTaskBtn = document.getElementById('newTaskBtn');
            const form = document.getElementById('taskForm');
            const titleInput = document.getElementById('title');
            const descInput = document.getElementById('desc');
            const dueDateInput = document.getElementById('dueDate');
            const reminderInput = document.getElementById('reminder');
            const hoursInput = document.getElementById('hours');
            const saveBtn = document.getElementById('saveBtn');
            const taskList = document.getElementById('taskList');
            const clearBtn = document.getElementById('clearBtn');
            const clearAllBtn = document.getElementById('clearAll');
            const counts = document.getElementById('counts');
            const filter = document.getElementById('filter');
            const search = document.getElementById('search');
            const timelineEl = document.getElementById('timeline');
            const overallBar = document.getElementById('overallBar');
            const overallPct = document.getElementById('overallPct');

            const STORAGE_KEY = 'smart_study_tasks_v1';
            let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            let editingId = null;

            const saveTasks = () => {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
                render();
            };

            const escapeHtml = str => str ? str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) : '';
            const formatDateISO = dStr => dStr ? (new Date(dStr).toLocaleString() || '—') : '—';
            const debounce = (fn, wait = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; };
            const saveBtnText = txt => { saveBtn.textContent = txt; };

            function render() {
                let list = tasks.slice();
                const f = filter.value;
                list = list.filter(t => {
                    if (f === 'active') return !t.completed;
                    if (f === 'completed') return t.completed;
                    if (f === 'today') {
                        if (!t.dueDate) return false;
                        const d = new Date(t.dueDate); const now = new Date();
                        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
                    }
                    return true;
                });

                const q = search.value.trim().toLowerCase();
                if (q) list = list.filter(t => t.title.toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q));

                list.sort((a, b) => {
                    if (a.completed !== b.completed) return a.completed ? 1 : -1;
                    const da = a.dueDate ? new Date(a.dueDate) : new Date(8640000000000000);
                    const db = b.dueDate ? new Date(b.dueDate) : new Date(8640000000000000);
                    return da - db;
                });

                taskList.innerHTML = '';
                list.forEach(t => {
                    const li = document.createElement('li');
                    li.className = 'task-item';
                    const now = new Date();
                    if (t.dueDate) {
                        const due = new Date(t.dueDate);
                        if (!t.completed && due < now) li.classList.add('overdue');
                        else if (!t.completed && due.toDateString() === now.toDateString()) li.classList.add('today');
                    }

                    li.innerHTML = `
<div class="task-left">
  <input type="checkbox" ${t.completed ? 'checked' : ''} data-id="${t.id}" class="mark-complete" />
  <div>
    <div class="task-title">${escapeHtml(t.title)}</div>
    <div class="task-meta">
      Due: ${formatDateISO(t.dueDate)} • 
      Reminder: ${t.reminder ? new Date(t.reminder).toLocaleString() : '—'} • 
      Est: ${t.hours || '—'}h
    </div>
    <div class="task-desc">${t.desc && t.desc.trim() ? escapeHtml(t.desc) : 'No notes'}</div>
  </div>
</div>
<div class="task-actions">
  <button class="small-btn ghost" data-action="edit" data-id="${t.id}">Edit</button>
  <button class="small-btn danger" data-action="delete" data-id="${t.id}">Delete</button>
</div>
`;

                    taskList.appendChild(li);
                });

                counts.textContent = `${tasks.filter(t => t.completed).length} / ${tasks.length} completed`;
                renderTimeline();
                renderOverallProgress();
            }

            function renderTimeline() {
                timelineEl.innerHTML = '';
                if (!tasks.length) { timelineEl.innerHTML = '<div style="color:var(--muted)">No tasks yet.</div>'; overallBar.style.width = '0%'; overallPct.textContent = '0% complete'; return; }
                const sorted = tasks.slice().sort((a, b) => { const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity; const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity; return da - db; });
                const now = Date.now();
                const maxFuture = Math.max(...sorted.map(t => t.dueDate ? new Date(t.dueDate).getTime() : now));
                const minPast = Math.min(...sorted.map(t => t.dueDate ? new Date(t.dueDate).getTime() : now));
                sorted.forEach(t => {
                    const row = document.createElement('div'); row.className = 'timeline-row';
                    const label = document.createElement('div'); label.className = 'timeline-label'; label.textContent = `${t.title} ${t.completed ? '✓' : ''}`;
                    const barWrap = document.createElement('div'); barWrap.className = 'timeline-bar-wrap';
                    const bar = document.createElement('div'); bar.className = 'timeline-bar';
                    const seg = document.createElement('div'); seg.className = 'timeline-seg';
                    let pct = t.dueDate ? Math.round(((new Date(t.dueDate).getTime() - minPast) / Math.max(1, Math.abs(maxFuture - minPast))) * 100) : 5;
                    seg.style.width = (t.completed ? 100 : Math.max(6, pct)) + '%';
                    if (t.completed) seg.style.opacity = 0.5;
                    bar.appendChild(seg); barWrap.appendChild(bar); row.appendChild(label); row.appendChild(barWrap); timelineEl.appendChild(row);
                });
            }

            function renderOverallProgress() {
                const total = tasks.length || 1;
                const completed = tasks.filter(t => t.completed).length;
                const pct = Math.round((completed / total) * 100);
                overallBar.style.width = pct + '%';
                overallPct.textContent = `${pct}% complete`;
            }

            newTaskBtn.addEventListener('click', () => {
                formCard.classList.remove('hidden');
                form.scrollIntoView({ behavior: 'smooth', block: 'start' });
                editingId = null;
                form.reset();
                [...form.elements].forEach(el => el.disabled = false);
                saveBtnText('Save Task');
            });

            form.addEventListener('submit', e => {
                e.preventDefault();
                if (!titleInput.value.trim()) return alert('Title required');
                const payload = {
                    id: editingId || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
                    title: titleInput.value.trim(),
                    desc: descInput.value.trim(),
                    dueDate: dueDateInput.value || null,
                    reminder: reminderInput.value || null,
                    hours: hoursInput.value || null,
                    completed: false,
                    createdAt: new Date().toISOString()
                };
                if (editingId) { tasks = tasks.map(t => t.id === editingId ? { ...t, ...payload } : t); editingId = null; }
                else { tasks.push(payload); }
                saveTasks();
                formCard.classList.add('hidden');
            });

            clearBtn.addEventListener('click', () => {
                form.reset();
                editingId = null;
                [...form.elements].forEach(el => el.disabled = false);
                saveBtnText('Save Task');
            });

            taskList.addEventListener('click', e => {
                const action = e.target.dataset.action, id = e.target.dataset.id;
                if (!action) return;
                if (action === 'delete') { if (confirm('Delete this task?')) { tasks = tasks.filter(t => t.id !== id); saveTasks(); } }
                else if (action === 'edit') {
                    const t = tasks.find(x => x.id === id); if (!t) return;
                    editingId = id;
                    titleInput.value = t.title; descInput.value = t.desc || ''; dueDateInput.value = t.dueDate || ''; reminderInput.value = t.reminder || ''; hoursInput.value = t.hours || '';
                    formCard.classList.remove('hidden');
                    [...form.elements].forEach(el => el.disabled = false);
                    saveBtnText('Update Task');
                    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });

            taskList.addEventListener('change', e => {
                if (!e.target.classList.contains('mark-complete')) return;
                const id = e.target.dataset.id;
                tasks = tasks.map(t => t.id === id ? { ...t, completed: e.target.checked } : t);
                saveTasks();
            });

            clearAllBtn.addEventListener('click', () => {
                if (confirm('Clear ALL tasks?')) { tasks = []; saveTasks(); }
            });

            filter.addEventListener('change', render);
            search.addEventListener('input', debounce(render, 200));

            if (!tasks.length) {
                tasks.push({ id: 'sample1', title: 'Math - Chapter 3 Revise', desc: 'Practice examples and exercise set A', dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), reminder: new Date(Date.now() + 43200000).toISOString().slice(0, 16), hours: '2', completed: false, createdAt: new Date().toISOString(), remNotified: false });
                saveTasks();
            }
            render();
        })();