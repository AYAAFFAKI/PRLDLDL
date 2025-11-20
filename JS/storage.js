(function(){
  // Keys used in LocalStorage for tasks and notes
  const TASKS_KEY = 'todo_tasks_v1';
  const NOTES_KEY = 'todo_notes_v1'; // legacy single note
  const NOTES_LIST_KEY = 'todo_notes_v2';

  // Load all tasks array from LocalStorage
  function loadTasks(){
    try{const raw=localStorage.getItem(TASKS_KEY);return raw?JSON.parse(raw):[]}catch(e){return []}
  }
  // Save provided tasks array to LocalStorage
  function saveTasks(tasks){
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks||[]));
  }
  // Delete a task by id and return the updated tasks array
  function deleteTask(id){
    const tasks = loadTasks();
    const idx = tasks.findIndex(t=>t.id===id);
    if(idx>-1){tasks.splice(idx,1);saveTasks(tasks)}
    return tasks;
  }

  // Notes v2: list of notes with last-modified timestamp
  function migrateNotesIfNeeded(){
    const v2 = localStorage.getItem(NOTES_LIST_KEY);
    if (v2) return;
    const legacy = localStorage.getItem(NOTES_KEY);
    if (legacy && legacy.trim()){
      const arr = [{ id: Date.now().toString(36), text: legacy, updatedAt: Date.now() }];
      localStorage.setItem(NOTES_LIST_KEY, JSON.stringify(arr));
    } else {
      localStorage.setItem(NOTES_LIST_KEY, JSON.stringify([]));
    }
  }
  function loadNotesList(){
    try{ migrateNotesIfNeeded(); const raw = localStorage.getItem(NOTES_LIST_KEY); return raw? JSON.parse(raw): [];}catch(e){return []}
  }
  function saveNotesList(list){
    localStorage.setItem(NOTES_LIST_KEY, JSON.stringify(list||[]));
  }
  function upsertNote(note){
    const list = loadNotesList();
    if (note.id){
      const i = list.findIndex(n=>n.id===note.id);
      if (i>-1){ list[i] = { ...list[i], text: note.text||'', title: note.title||list[i].title||'', updatedAt: Date.now() }; }
      else { list.push({ id: note.id, text: note.text||'', title: note.title||'', updatedAt: Date.now() }); }
    } else {
      list.push({ id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), text: note.text||'', title: note.title||'', updatedAt: Date.now() });
    }
    saveNotesList(list);
    return list;
  }
  function deleteNote(id){
    const list = loadNotesList();
    const i = list.findIndex(n=>n.id===id);
    if (i>-1){ list.splice(i,1); saveNotesList(list); }
    return list;
  }

  // Legacy API (kept for compatibility, not used by new UI)
  function loadNotes(){ return localStorage.getItem(NOTES_KEY) || ''; }
  function saveNotes(text){ localStorage.setItem(NOTES_KEY, text||''); }

  // Expose storage API
  window.storage = { loadTasks, saveTasks, deleteTask, loadNotes, saveNotes, loadNotesList, saveNotesList, upsertNote, deleteNote };
})();
