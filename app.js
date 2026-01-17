const slots = ['8-10am', '10-12pm', '1-3pm', '3-5pm'];

let classes   = JSON.parse(localStorage.getItem('classes'))   || [];
let lecturers = JSON.parse(localStorage.getItem('lecturers')) || [];
let classrooms = JSON.parse(localStorage.getItem('classrooms')) || [];
let priorities = JSON.parse(localStorage.getItem('priorities')) || {
  equalLoading: true,
  maxDifferentClassesPerLecturer: 4
};

let timetable = JSON.parse(localStorage.getItem('timetable')) || {
  'Monday':    { '8-10am':[], '10-12pm':[], '1-3pm':[], '3-5pm':[] },
  'Tuesday':   { '8-10am':[], '10-12pm':[], '1-3pm':[], '3-5pm':[] },
  'Wednesday': { '8-10am':[], '10-12pm':[], '1-3pm':[], '3-5pm':[] },
  'Thursday':  { '8-10am':[], '10-12pm':[], '1-3pm':[], '3-5pm':[] },
  'Friday':    { '8-10am':[], '10-12pm':[], '1-3pm':[], '3-5pm':[] }
};

// ────────────────────────────────────────────────
// Force repair timetable structure on every load
// This prevents undefined slots and .map() crashes
// ────────────────────────────────────────────────
const requiredDays = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
requiredDays.forEach(day => {
  if (!timetable[day] || typeof timetable[day] !== 'object') {
    timetable[day] = {};
  }
  slots.forEach(slot => {
    if (!Array.isArray(timetable[day][slot])) {
      timetable[day][slot] = [];
    }
  });
});
saveData();  // persist the repaired structure

let editingDay = null;
let editingSlot = null;
let editingClassId = null;

function saveData() {
  localStorage.setItem('classes',   JSON.stringify(classes));
  localStorage.setItem('lecturers', JSON.stringify(lecturers));
  localStorage.setItem('classrooms', JSON.stringify(classrooms));
  localStorage.setItem('priorities', JSON.stringify(priorities));
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
  document.getElementById('classList').innerHTML = classes.map(c =>
    `<li>${c.name} (${c.duration}h) <button class="edit-btn" onclick="openClassEditModal(${c.id})">Edit</button> <button class="delete-btn" onclick="deleteClass(${c.id})">Delete</button></li>`
  ).join('');

  document.getElementById('lecturerList').innerHTML = lecturers.map(l =>
    `<li>${l.name} (max ${l.maxDifferentClasses} diff • ${l.maxWeeklyHours} h/wk) <button class="delete-btn" onclick="deleteLecturer(${l.id})">Delete</button></li>`
  ).join('');

  document.getElementById('classroomList').innerHTML = classrooms.map(r =>
    `<li>${r.name} <button class="delete-btn" onclick="deleteClassroom(${r.id})">Delete</button></li>`
  ).join('');
}

// ────────────────────────────────────────────────
// CRUD functions (unchanged except deleteClass calls saveData)
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

function savePriorities() {
  priorities.equalLoading = document.getElementById('equalLoading').checked;
  priorities.maxDifferentClassesPerLecturer = parseInt(document.getElementById('globalMaxDifferent').value) || 999;
  saveData();
  alert('Priorities updated.');
}

// ────────────────────────────────────────────────
// GENERATE – now with single summary alerts
// ────────────────────────────────────────────────

function generateTimetable() {
  // Reset timetable and assignments
  Object.keys(timetable).forEach(d => {
    Object.keys(timetable[d]).forEach(s => {
      timetable[d][s] = [];
    });
  });
  lecturers.forEach(l => l.assignedClasses = []);
  classes.forEach(c => { c.lecturerId = null; c.classroomId = null; });

  classes.sort((a,b) => b.duration - a.duration);

  // ── Lecturer assignment ────────────────────────────────────────
  const assignmentProblems = [];

  classes.forEach(cls => {
    let candidates = lecturers.filter(l =>
      l.assignedClasses.length < Math.min(l.maxDifferentClasses, priorities.maxDifferentClassesPerLecturer) &&
      !l.assignedClasses.includes(cls.id)
    );

    if (priorities.equalLoading) {
      candidates.sort((a,b) => a.assignedClasses.length - b.assignedClasses.length);
    }

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
      if (candidates.length === 0) {
        assignmentProblems.push(`${cls.name}: no lecturer has capacity for another different class`);
      } else {
        assignmentProblems.push(`${cls.name}: all possible lecturers exceed weekly hours limit`);
      }
    }
  });

  if (assignmentProblems.length > 0) {
    alert("Lecturer assignment issues:\n\n" + assignmentProblems.join("\n"));
  }

  // ── Placement ──────────────────────────────────────────────────
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
    alert("Placement issues (could not find free slot + room + lecturer):\n\n" + placementProblems.join("\n"));
  }

  saveData();
  renderTimetable();
}

// ────────────────────────────────────────────────
// RENDER (defensive version)
// ────────────────────────────────────────────────

function renderTimetable() {
  const tbody = document.querySelector('#timetableTable tbody');
  tbody.innerHTML = '';

  Object.keys(timetable).forEach(day => {
    const dayObj = timetable[day] || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${day}</td>`;

    slots.forEach(slotName => {
      const arr = Array.isArray(dayObj[slotName]) ? dayObj[slotName] : [];

      let content = arr.map(cid => {
        const cls = classes.find(c => c.id === cid);
        if (!cls) return '';
        const lec = lecturers.find(l => l.id === cls.lecturerId);
        const room = classrooms.find(r => r.id === cls.classroomId);
        return `${cls.name} (${cls.duration}h)<br>L: ${lec?.name||'—'}<br>R: ${room?.name||'—'} <button class="remove-btn" onclick="removeClassFromSlot('${day}','${slotName}',${cid})">×</button>`;
      }).filter(Boolean).join('<hr>') || '—';

      const td = document.createElement('td');
      td.innerHTML = content;
      td.classList.add('editable');
      td.onclick = () => openEditModal(day, slotName);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// The rest of the functions (removeClassFromSlot, openEditModal, saveSlotEdit, openClassEditModal, saveClassEdit, exportToExcel) remain unchanged from previous version

// ────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────

updateLists();
renderTimetable();
