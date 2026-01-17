const slots = ['8-10am', '10-12pm', '1-3pm', '3-5pm'];

let classes   = JSON.parse(localStorage.getItem('classes'))   || [];
let lecturers = JSON.parse(localStorage.getItem('lecturers')) || [];
let classrooms = JSON.parse(localStorage.getItem('classrooms')) || [];

let timetable = JSON.parse(localStorage.getItem('timetable')) || {
  'Monday':    { '8-10am':[], '10-12pm':[], '1-3pm':[], '3-5pm':[] },
  'Tuesday':   { '8-10am':[], '10-12pm':[], '1-3pm':[], '3-5pm':[] },
  'Wednesday': { '8-10am':[], '10-12pm':[], '1-3pm':[], '3-5pm':[] },
  'Thursday':  { '8-10am':[], '10-12pm':[], '1-3pm':[], '3-5pm':[] },
  'Friday':    { '8-10am':[], '10-12pm':[], '1-3pm':[], '3-5pm':[] }
};

// Force repair timetable structure
const requiredDays = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
requiredDays.forEach(day => {
  if (!timetable[day] || typeof timetable[day] !== 'object') timetable[day] = {};
  slots.forEach(slot => {
    if (!Array.isArray(timetable[day][slot])) timetable[day][slot] = [];
  });
});
saveData();

let editingDay = null;
let editingSlot = null;
let editingClassId = null;

function saveData() {
  localStorage.setItem('classes',   JSON.stringify(classes));
  localStorage.setItem('lecturers', JSON.stringify(lecturers));
  localStorage.setItem('classrooms', JSON.stringify(classrooms));
  localStorage.setItem('timetable', JSON.stringify(timetable));
}

function isClassPlaced(id) {
  return Object.values(timetable).some(dayObj =>
    Object.values(dayObj).some(arr => arr.includes(id))
  );
}

function getLecturerWeeklyHours(lectId) {
  const seen = new Set();
  Object.values(timetable).forEach(dayObj => {
    Object.values(dayObj).forEach(slotArr => {
      slotArr.forEach(cid => {
        const cls = classes.find(c => c.id === cid);
        if (cls && cls.lecturerId === lectId) seen.add(cid);
      });
    });
  });
  return Array.from(seen).reduce((sum, cid) => {
    const c = classes.find(cc => cc.id === cid);
    return sum + (c ? c.duration : 0);
  }, 0);
}

function isLecturerFree(day, slotName, lectId) {
  if (!lectId) return false;
  const dayObj = timetable[day] || {};
  const arr = dayObj[slotName] || [];
  return !arr.some(cid => {
    const c = classes.find(cc => cc.id === cid);
    return c && c.lecturerId === lectId;
  });
}

function isClassroomFree(day, slotName, roomId) {
  if (!roomId) return false;
  const dayObj = timetable[day] || {};
  const arr = dayObj[slotName] || [];
  return !arr.some(cid => {
    const c = classes.find(cc => cc.id === cid);
    return c && c.classroomId === roomId;
  });
}

function updateLists() {
  // Classes – numbered list + checkmark for assigned classes
  document.getElementById('classList').innerHTML = classes.map((c, index) => {
    const isAssigned = isClassPlaced(c.id);
    const checkMark = isAssigned ? '<span style="color:#28a745; font-weight:bold;">✓ </span>' : '';
    return `<li>${checkMark}${c.name} (${c.duration}h) <button class="edit-btn" onclick="openClassEditModal(${c.id})">Edit</button> <button class="delete-btn" onclick="deleteClass(${c.id})">Delete</button></li>`;
  }).join('');

  // Lecturers – numbered list
  document.getElementById('lecturerList').innerHTML = lecturers.map((l, index) => {
    const h = getLecturerWeeklyHours(l.id);
    const style = h > l.maxWeeklyHours ? 'over-limit' : '';
    return `<li>${l.name} <span class="hours ${style}">${h} / ${l.maxWeeklyHours} h</span> <button class="delete-btn" onclick="deleteLecturer(${l.id})">Delete</button></li>`;
  }).join('');

  // Classrooms – keep as bullets
  document.getElementById('classroomList').innerHTML = classrooms.map(r =>
    `<li>${r.name} <button class="delete-btn" onclick="deleteClassroom(${r.id})">Delete</button></li>`
  ).join('');
}

// ────────────────────────────────────────────────
// CRUD functions (unchanged)
// ────────────────────────────────────────────────

function addClass() {
  const name = document.getElementById('className').value.trim();
  const dur = parseInt(document.getElementById('classDuration').value);
  if (!name) return alert('Please enter class name');
  classes.push({ id: classes.length + 1, name, duration: dur, lecturerId: null, classroomId: null });
  saveData();
  updateLists();
  document.getElementById('className').value = '';
}

function deleteClass(id) {
  if (!confirm('Delete class?')) return;
  classes = classes.filter(c => c.id !== id);
  Object.keys(timetable).forEach(d => {
    Object.keys(timetable[d] || {}).forEach(s => {
      timetable[d][s] = (timetable[d][s] || []).filter(cid => cid !== id);
    });
  });
  lecturers.forEach(l => l.assignedClasses = l.assignedClasses.filter(cid => cid !== id));
  saveData();
  updateLists();
  renderTimetable();
}

function addLecturer() {
  const name = document.getElementById('lecturerName').value.trim();
  if (!name) return alert('Enter name');
  const maxDiff = parseInt(document.getElementById('maxDifferent').value) || 5;
  const maxH = parseInt(document.getElementById('maxWeeklyHours').value) || 18;
  lecturers.push({
    id: lecturers.length + 1,
    name,
    assignedClasses: [],
    maxDifferentClasses: maxDiff,
    maxWeeklyHours: maxH
  });
  saveData();
  updateLists();
  document.getElementById('lecturerName').value = '';
}

function deleteLecturer(id) {
  if (!confirm('Delete lecturer?')) return;
  lecturers = lecturers.filter(l => l.id !== id);
  classes.forEach(c => { if (c.lecturerId === id) c.lecturerId = null; });
  saveData();
  updateLists();
  renderTimetable();
}

function addClassroom() {
  const name = document.getElementById('classroomName').value.trim();
  if (!name) return alert('Enter room name');
  classrooms.push({ id: classrooms.length + 1, name });
  saveData();
  updateLists();
  document.getElementById('classroomName').value = '';
}

function deleteClassroom(id) {
  if (!confirm('Delete room?')) return;
  classrooms = classrooms.filter(r => r.id !== id);
  classes.forEach(c => { if (c.classroomId === id) c.classroomId = null; });
  saveData();
  updateLists();
  renderTimetable();
}

// ────────────────────────────────────────────────
// GENERATE, RENDER, DRAG & DROP, MODALS, EXPORT (unchanged)
// ────────────────────────────────────────────────
// (Paste your existing generateTimetable, renderTimetable, drag/drop functions, 
//  removeClassFromSlot, openEditModal, saveSlotEdit, openClassEditModal, 
//  saveClassEdit, exportToExcel here – they remain exactly the same)

function generateTimetable() {
  // ... your existing generateTimetable code ...
  // Make sure to call updateLists() at the end if you want hours/checkmarks refreshed
  saveData();
  renderTimetable();
  updateLists();
}

// ... (rest of your code: renderTimetable with drag/drop, allowDrop, drag, drop, etc.)

// INIT
updateLists();
renderTimetable();
