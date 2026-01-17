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

  document.getElementById('lecturerList').innerHTML = lecturers.map(l => {
    const currentH = getLecturerWeeklyHours(l.id);
    const color = currentH > l.maxWeeklyHours ? 'color:red;font-weight:bold;' : '';
    return `<li>${l.name} (max ${l.maxDifferentClasses} diff) <span class="hours" style="${color}">${currentH} / ${l.maxWeeklyHours} h</span> <button class="delete-btn" onclick="deleteLecturer(${l.id})">Delete</button></li>`;
  }).join('');

  document.getElementById('classroomList').innerHTML = classrooms.map(r =>
    `<li>${r.name} <button class="delete-btn" onclick="deleteClassroom(${r.id})">Delete</button></li>`
  ).join('');
}

// ────────────────────────────────────────────────
// CRUD (addClass, deleteClass, addLecturer, etc.) remain the same
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
// GENERATE (with summary alerts)
// ────────────────────────────────────────────────

function generateTimetable() {
  Object.keys(timetable).forEach(d => {
    Object.keys(timetable[d]).forEach(s => timetable[d][s] = []);
  });
  lecturers.forEach(l => l.assignedClasses = []);
  classes.forEach(c => { c.lecturerId = null; c.classroomId = null; });

  classes.sort((a,b) => b.duration - a.duration);

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
      assignmentProblems.push(`${cls.name}: ${candidates.length === 0 ? 'no lecturer has capacity for another different class' : 'all possible lecturers exceed weekly hours'}`);
    }
  });

  if (assignmentProblems.length > 0) {
    alert("Lecturer assignment summary:\n\n" + assignmentProblems.join("\n"));
  }

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
  updateLists(); // refresh hours display
}

// ────────────────────────────────────────────────
// RENDER TIMETABLE (defensive)
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

// ────────────────────────────────────────────────
// MANUAL EDIT & REMOVE
// ────────────────────────────────────────────────

function removeClassFromSlot(day, slotName, cid) {
  if (!confirm('Remove?')) return;
  timetable[day][slotName] = timetable[day][slotName].filter(id => id !== cid);

  const idx = slots.indexOf(slotName);
  const cls = classes.find(c => c.id === cid);
  if (cls?.duration === 3) {
    if (idx < 3 && timetable[day][slots[idx+1]]?.includes(cid)) {
      timetable[day][slots[idx+1]] = timetable[day][slots[idx+1]].filter(id => id !== cid);
    } else if (idx > 0 && timetable[day][slots[idx-1]]?.includes(cid)) {
      timetable[day][slots[idx-1]] = timetable[day][slots[idx-1]].filter(id => id !== cid);
    }
  }

  saveData();
  renderTimetable();
  updateLists();
}

function openEditModal(day, slotName) {
  editingDay = day;
  editingSlot = slotName;

  const unplaced = classes.filter(c => !isClassPlaced(c.id));
  const sel = document.getElementById('editClass');
  sel.innerHTML = unplaced.length
    ? '<option value="">— select class —</option>' + unplaced.map(c => `<option value="${c.id}">${c.name} (${c.duration}h)</option>`).join('')
    : '<option value="">No unassigned classes</option>';

  document.getElementById('editModal').style.display = 'block';
}

function closeModal() {
  document.getElementById('editModal').style.display = 'none';
}

function saveSlotEdit() {
  const cid = parseInt(document.getElementById('editClass').value);
  if (!cid) return closeModal();

  const cls = classes.find(c => c.id === cid);
  if (!cls.lecturerId || !cls.classroomId) {
    alert('Assign lecturer and room first (edit class).');
    return;
  }

  const sIdx = slots.indexOf(editingSlot);
  let slotsToFill = [editingSlot];

  if (cls.duration === 3) {
    if (sIdx === 3) return alert('3h class cannot start in last slot');
    const nextS = slots[sIdx + 1];
    if (!isLecturerFree(editingDay, nextS, cls.lecturerId) ||
        !isClassroomFree(editingDay, nextS, cls.classroomId)) {
      return alert('Conflict in next slot');
    }
    slotsToFill.push(nextS);
  }

  if (!isLecturerFree(editingDay, editingSlot, cls.lecturerId)) {
    return alert('Lecturer already teaching here');
  }
  if (!isClassroomFree(editingDay, editingSlot, cls.classroomId)) {
    return alert('Room already booked');
  }

  const lec = lecturers.find(l => l.id === cls.lecturerId);
  const currH = getLecturerWeeklyHours(cls.lecturerId);
  if (currH + cls.duration > lec.maxWeeklyHours) {
    alert(`Exceeds ${lec.name}'s limit (${currH} → ${currH + cls.duration} > ${lec.maxWeeklyHours})`);
    return;
  }

  slotsToFill.forEach(s => timetable[editingDay][s].push(cid));
  saveData();
  renderTimetable();
  updateLists();
  closeModal();
}

function openClassEditModal(id) {
  editingClassId = id;
  const cls = classes.find(c => c.id === id);

  document.getElementById('editClassName').value = cls.name;
  document.getElementById('editClassDuration').value = cls.duration;

  document.getElementById('editClassLecturer').innerHTML =
    '<option value="">— none —</option>' +
    lecturers.map(l => `<option value="${l.id}" ${cls.lecturerId === l.id ? 'selected' : ''}>${l.name}</option>`).join('');

  document.getElementById('editClassClassroom').innerHTML =
    '<option value="">— none —</option>' +
    classrooms.map(r => `<option value="${r.id}" ${cls.classroomId === r.id ? 'selected' : ''}>${r.name}</option>`).join('');

  document.getElementById('classEditModal').style.display = 'block';
}

function closeClassEditModal() {
  document.getElementById('classEditModal').style.display = 'none';
}

function saveClassEdit() {
  const cls = classes.find(c => c.id === editingClassId);
  cls.name      = document.getElementById('editClassName').value.trim() || cls.name;
  cls.duration  = parseInt(document.getElementById('editClassDuration').value);
  cls.lecturerId   = parseInt(document.getElementById('editClassLecturer').value)   || null;
  cls.classroomId  = parseInt(document.getElementById('editClassClassroom').value)  || null;

  saveData();
  updateLists();
  renderTimetable();
  closeClassEditModal();
}

// ────────────────────────────────────────────────
// NEW EXPORT – Lecturers + Classes
// ────────────────────────────────────────────────

function exportToExcel() {
  const wb = XLSX.utils.book_new();

  // ── Lecturers sheet ──────────────────────────────────────
  const lecturersData = [['Lecturer', 'Max different classes', 'Max weekly hours', 'Current hours', 'Assigned classes']];

  lecturers.forEach(l => {
    const currentH = getLecturerWeeklyHours(l.id);
    const assignedNames = l.assignedClasses
      .map(cid => classes.find(c => c.id === cid)?.name || '—')
      .filter(Boolean)
      .join(', ');
    lecturersData.push([
      l.name,
      l.maxDifferentClasses,
      l.maxWeeklyHours,
      currentH,
      assignedNames
    ]);
  });

  const wsLect = XLSX.utils.aoa_to_sheet(lecturersData);
  XLSX.utils.book_append_sheet(wb, wsLect, 'Lecturers');

  // ── Classes sheet ────────────────────────────────────────
  const classesData = [['Class', 'Duration', 'Lecturer', 'Classroom', 'Placed?']];

  classes.forEach(c => {
    const lec = lecturers.find(l => l.id === c.lecturerId)?.name || '—';
    const room = classrooms.find(r => r.id === c.classroomId)?.name || '—';
    const placed = isClassPlaced(c.id) ? 'Yes' : 'No';
    classesData.push([c.name, c.duration, lec, room, placed]);
  });

  const wsClasses = XLSX.utils.aoa_to_sheet(classesData);
  XLSX.utils.book_append_sheet(wb, wsClasses, 'Classes');

  XLSX.writeFile(wb, 'lecturers_and_classes.xlsx');
}

// ────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────

updateLists();
renderTimetable();
