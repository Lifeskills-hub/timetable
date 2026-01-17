const slots = ['8-10am', '10-12pm', '1-3pm', '3-5pm'];

let classes   = JSON.parse(localStorage.getItem('classes'))   || [];
let lecturers = JSON.parse(localStorage.getItem('lecturers')) || [];
let classrooms = JSON.parse(localStorage.getItem('classrooms')) || [];
let lockedIntakes = JSON.parse(localStorage.getItem('lockedIntakes')) || { Jan: false, Apr: false };

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
  localStorage.setItem('classes', JSON.stringify(classes));
  localStorage.setItem('lecturers', JSON.stringify(lecturers));
  localStorage.setItem('classrooms', JSON.stringify(classrooms));
  localStorage.setItem('timetable', JSON.stringify(timetable));
  localStorage.setItem('lockedIntakes', JSON.stringify(lockedIntakes));
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
  const janClasses = classes.filter(c => c.intake === 'Jan');
  const aprClasses = classes.filter(c => c.intake === 'Apr');

  // Jan intake
  document.getElementById('classListJan').innerHTML = janClasses.map(c => {
    const isAssigned = isClassPlaced(c.id);
    const check = isAssigned ? '<span style="color:#28a745; font-weight:bold;">✓ </span>' : '';
    return `<li>${check}${c.name} (${c.duration}h) <button class="edit-btn" onclick="openClassEditModal(${c.id})">Edit</button> <button class="delete-btn" onclick="deleteClass(${c.id})">Delete</button></li>`;
  }).join('');
  document.getElementById('classListJan').className = lockedIntakes.Jan ? 'locked' : '';

  // Apr intake
  document.getElementById('classListApr').innerHTML = aprClasses.map(c => {
    const isAssigned = isClassPlaced(c.id);
    const check = isAssigned ? '<span style="color:#28a745; font-weight:bold;">✓ </span>' : '';
    return `<li>${check}${c.name} (${c.duration}h) <button class="edit-btn" onclick="openClassEditModal(${c.id})">Edit</button> <button class="delete-btn" onclick="deleteClass(${c.id})">Delete</button></li>`;
  }).join('');
  document.getElementById('classListApr').className = lockedIntakes.Apr ? 'locked' : '';

  // Lock buttons
  document.getElementById('lockJanBtn').textContent = lockedIntakes.Jan ? 'Unlock Jan intake' : 'Lock Jan intake';
  document.getElementById('lockJanBtn').className = 'lock-btn' + (lockedIntakes.Jan ? ' locked' : '');

  document.getElementById('lockAprBtn').textContent = lockedIntakes.Apr ? 'Unlock Apr intake' : 'Lock Apr intake';
  document.getElementById('lockAprBtn').className = 'lock-btn' + (lockedIntakes.Apr ? ' locked' : '');

  // Lecturers
  document.getElementById('lecturerList').innerHTML = lecturers.map(l => {
    const h = getLecturerWeeklyHours(l.id);
    const style = h > l.maxWeeklyHours ? 'over-limit' : '';
    return `<li>${l.name} <span class="hours ${style}">${h} / ${l.maxWeeklyHours} h</span> <button class="delete-btn" onclick="deleteLecturer(${l.id})">Delete</button></li>`;
  }).join('');

  // Classrooms
  document.getElementById('classroomList').innerHTML = classrooms.map(r =>
    `<li>${r.name} <button class="delete-btn" onclick="deleteClassroom(${r.id})">Delete</button></li>`
  ).join('');
}

function toggleLock(intake) {
  lockedIntakes[intake] = !lockedIntakes[intake];
  saveData();
  updateLists();
}

function deleteUnlockedIntake(intake) {
  if (lockedIntakes[intake]) {
    alert(`${intake} intake is locked. Unlock first to delete.`);
    return;
  }
  if (!confirm(`Delete ALL classes in ${intake} intake? This cannot be undone.`)) return;

  const idsToDelete = classes.filter(c => c.intake === intake).map(c => c.id);

  // Remove from timetable
  Object.keys(timetable).forEach(d => {
    Object.keys(timetable[d]).forEach(s => {
      timetable[d][s] = timetable[d][s].filter(cid => !idsToDelete.includes(cid));
    });
  });

  // Remove from lecturers
  lecturers.forEach(l => {
    l.assignedClasses = l.assignedClasses.filter(cid => !idsToDelete.includes(cid));
  });

  // Delete classes
  classes = classes.filter(c => c.intake !== intake);

  saveData();
  updateLists();
  renderTimetable();
}

// ────────────────────────────────────────────────
// Add Class (now with intake)
// ────────────────────────────────────────────────

function addClass() {
  const name = document.getElementById('className').value.trim();
  const dur = parseInt(document.getElementById('classDuration').value);
  const intake = document.getElementById('classIntake').value;
  if (!name) return alert('Please enter class name');
  classes.push({
    id: classes.length + 1,
    name,
    duration: dur,
    lecturerId: null,
    classroomId: null,
    intake
  });
  saveData();
  updateLists();
  document.getElementById('className').value = '';
}

// ────────────────────────────────────────────────
// Edit Class (now also edit intake)
// ────────────────────────────────────────────────

function openClassEditModal(id) {
  editingClassId = id;
  const cls = classes.find(c => c.id === id);
  if (!cls) return;

  document.getElementById('editClassName').value = cls.name;
  document.getElementById('editClassDuration').value = cls.duration;
  document.getElementById('editClassIntake').value = cls.intake;

  const lecSelect = document.getElementById('editClassLecturer');
  lecSelect.innerHTML = '<option value="">— none —</option>' +
    lecturers.map(l => `<option value="${l.id}" ${cls.lecturerId === l.id ? 'selected' : ''}>${l.name}</option>`).join('');

  const roomSelect = document.getElementById('editClassClassroom');
  roomSelect.innerHTML = '<option value="">— none —</option>' +
    classrooms.map(r => `<option value="${r.id}" ${cls.classroomId === r.id ? 'selected' : ''}>${r.name}</option>`).join('');

  document.getElementById('classEditModal').style.display = 'block';
}

function saveClassEdit() {
  const cls = classes.find(c => c.id === editingClassId);
  cls.name      = document.getElementById('editClassName').value.trim() || cls.name;
  cls.duration  = parseInt(document.getElementById('editClassDuration').value);
  cls.intake    = document.getElementById('editClassIntake').value;
  cls.lecturerId   = parseInt(document.getElementById('editClassLecturer').value)   || null;
  cls.classroomId  = parseInt(document.getElementById('editClassClassroom').value)  || null;

  saveData();
  updateLists();
  renderTimetable();
  closeClassEditModal();
}

// ────────────────────────────────────────────────
// The rest of your code remains unchanged:
// generateTimetable, renderTimetable, drag/drop, removeClassFromSlot, modals, exportToExcel, etc.
// Make sure they are all present below this comment in your file.

function generateTimetable() {
  // ... your full generateTimetable function here ...
  // At the end:
  saveData();
  renderTimetable();
  updateLists();
}

// ... (paste your existing renderTimetable, allowDrop, drag, drop, removeClassFromSlot, openEditModal, saveSlotEdit, exportToExcel, etc.)

// INIT
updateLists();
renderTimetable();
