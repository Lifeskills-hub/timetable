const slots = ['8-10am', '10-12pm', '1-3pm', '3-5pm'];

let classes   = JSON.parse(localStorage.getItem('classes'))   || [];
let lecturers = JSON.parse(localStorage.getItem('lecturers')) || [];
let classrooms = JSON.parse(localStorage.getItem('classrooms')) || [];

// Removed: priorities object (no longer needed)

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

// ... (keep all helper functions: isClassPlaced, getLecturerWeeklyHours, isLecturerFree, isClassroomFree unchanged)

// Updated updateLists() – no priorities reference
function updateLists() {
  document.getElementById('classList').innerHTML = classes.map(c =>
    `<li>${c.name} (${c.duration}h) <button class="edit-btn" onclick="openClassEditModal(${c.id})">Edit</button> <button class="delete-btn" onclick="deleteClass(${c.id})">Delete</button></li>`
  ).join('');

  document.getElementById('lecturerList').innerHTML = lecturers.map(l => {
    const h = getLecturerWeeklyHours(l.id);
    const style = h > l.maxWeeklyHours ? 'over-limit' : '';
    return `<li>${l.name} <span class="hours ${style}">${h} / ${l.maxWeeklyHours} h</span> <button class="delete-btn" onclick="deleteLecturer(${l.id})">Delete</button></li>`;
  }).join('');

  document.getElementById('classroomList').innerHTML = classrooms.map(r =>
    `<li>${r.name} <button class="delete-btn" onclick="deleteClassroom(${r.id})">Delete</button></li>`
  ).join('');
}

// ────────────────────────────────────────────────
// CRUD – Classes
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

// ────────────────────────────────────────────────
// CRUD – Lecturers & Classrooms
// ────────────────────────────────────────────────

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

// Removed: savePriorities() function entirely

// ────────────────────────────────────────────────
// GENERATE TIMETABLE (updated: no priorities reference)
// ────────────────────────────────────────────────

function generateTimetable() {
  // Reset
  Object.keys(timetable).forEach(d => {
    Object.keys(timetable[d]).forEach(s => timetable[d][s] = []);
  });
  lecturers.forEach(l => l.assignedClasses = []);
  classes.forEach(c => { c.lecturerId = null; c.classroomId = null; });

  classes.sort((a,b) => b.duration - a.duration);

  // Lecturer assignment (no global priority – uses individual limits only)
  const assignmentProblems = [];

  classes.forEach(cls => {
    let candidates = lecturers.filter(l =>
      l.assignedClasses.length < l.maxDifferentClasses &&
      !l.assignedClasses.includes(cls.id)
    );

    // Optional: keep equal loading if you still want it (comment out if not needed)
    // candidates.sort((a,b) => a.assignedClasses.length - b.assignedClasses.length);

    let assigned = false;
    for (let lec of candidates) {
      if (getLecturerWeeklyHours(lec.id) + cls.duration <= lec.maxWeeklyHours) {
        cls.lecturerId = lec.id;
        lec.assignedClasses.push(cls.id);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      assignmentProblems.push(`${cls.name}: ${candidates.length === 0 ? 'no lecturer has capacity for another different class' : 'all possible lecturers exceed weekly hours'}`);
    }
  });

  if (assignmentProblems.length > 0) {
    alert("Lecturer assignment summary:\n\n" + assignmentProblems.join("\n"));
  }

  // Placement (unchanged)
  const placementProblems = [];
  const days = Object.keys(timetable);

  classes.forEach(cls => {
    if (!cls.lecturerId) return;

    let placed = false;
    let tries = 0;
    while (!placed && tries < 400) {
      tries++;
      const day = days[Math.floor(Math.random() * days.length)];
      const sIdx = Math.floor(Math.random() * slots.length);
      if (cls.duration === 3 && sIdx === 3) continue;

      const slot = slots[sIdx];
      const next = cls.duration === 3 ? slots[sIdx + 1] : null;

      if (!isLecturerFree(day, slot, cls.lecturerId)) continue;
      if (next && !isLecturerFree(day, next, cls.lecturerId)) continue;

      const freeRooms = classrooms.filter(r =>
        isClassroomFree(day, slot, r.id) &&
        (!next || isClassroomFree(day, next, r.id))
      );

      if (freeRooms.length === 0) continue;

      cls.classroomId = freeRooms[Math.floor(Math.random() * freeRooms.length)].id;

      timetable[day][slot].push(cls.id);
      if (next) timetable[day][next].push(cls.id);
      placed = true;
    }

    if (!placed) {
      placementProblems.push(`${cls.name} (${cls.duration}h)`);
    }
  });

  if (placementProblems.length > 0) {
    alert("Placement summary (could not schedule):\n\n" + placementProblems.join("\n"));
  }

  saveData();
  renderTimetable();
  updateLists();
}

// ... (keep renderTimetable, removeClassFromSlot, openEditModal, saveSlotEdit, openClassEditModal, saveClassEdit, exportToExcel unchanged)

function updateLists() {
  document.getElementById('classList').innerHTML = classes.map(c =>
    `<li>${c.name} (${c.duration}h) <button class="edit-btn" onclick="openClassEditModal(${c.id})">Edit</button> <button class="delete-btn" onclick="deleteClass(${c.id})">Delete</button></li>`
  ).join('');

  document.getElementById('lecturerList').innerHTML = lecturers.map(l => {
    const h = getLecturerWeeklyHours(l.id);
    const style = h > l.maxWeeklyHours ? 'over-limit' : '';
    return `<li>${l.name} <span class="hours ${style}">${h} / ${l.maxWeeklyHours} h</span> <button class="delete-btn" onclick="deleteLecturer(${l.id})">Delete</button></li>`;
  }).join('');

  document.getElementById('classroomList').innerHTML = classrooms.map(r =>
    `<li>${r.name} <button class="delete-btn" onclick="deleteClassroom(${r.id})">Delete</button></li>`
  ).join('');
}

// ────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────

updateLists();
renderTimetable();
