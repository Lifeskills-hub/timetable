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

// Force repair timetable structure on load
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
  // Classes – numbered list + green checkmark for assigned classes
  document.getElementById('classList').innerHTML = classes.map(c => {
    const isAssigned = isClassPlaced(c.id);
    const checkMark = isAssigned ? '<span style="color:#28a745; font-weight:bold;">✓ </span>' : '';
    return `<li>${checkMark}${c.name} (${c.duration}h) <button class="edit-btn" onclick="openClassEditModal(${c.id})">Edit</button> <button class="delete-btn" onclick="deleteClass(${c.id})">Delete</button></li>`;
  }).join('');

  // Lecturers – numbered list
  document.getElementById('lecturerList').innerHTML = lecturers.map(l => {
    const h = getLecturerWeeklyHours(l.id);
    const style = h > l.maxWeeklyHours ? 'over-limit' : '';
    return `<li>${l.name} <span class="hours ${style}">${h} / ${l.maxWeeklyHours} h</span> <button class="delete-btn" onclick="deleteLecturer(${l.id})">Delete</button></li>`;
  }).join('');

  // Classrooms – bullet list
  document.getElementById('classroomList').innerHTML = classrooms.map(r =>
    `<li>${r.name} <button class="delete-btn" onclick="deleteClassroom(${r.id})">Delete</button></li>`
  ).join('');
}

// ────────────────────────────────────────────────
// CRUD
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
// GENERATE TIMETABLE
// ────────────────────────────────────────────────

function generateTimetable() {
  // Reset everything
  Object.keys(timetable).forEach(d => {
    Object.keys(timetable[d]).forEach(s => timetable[d][s] = []);
  });
  lecturers.forEach(l => l.assignedClasses = []);
  classes.forEach(c => { c.lecturerId = null; c.classroomId = null; });

  classes.sort((a,b) => b.duration - a.duration);

  const assignmentProblems = [];

  classes.forEach(cls => {
    let candidates = lecturers.filter(l =>
      l.assignedClasses.length < l.maxDifferentClasses &&
      !l.assignedClasses.includes(cls.id)
    );

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
  updateLists();  // This line ensures checkmarks and hours update after generation
}

// ────────────────────────────────────────────────
// RENDER TIMETABLE (with drag & drop)
// ────────────────────────────────────────────────

function renderTimetable() {
  const tbody = document.querySelector('#timetableTable tbody');
  tbody.innerHTML = '';

  Object.keys(timetable).forEach(day => {
    const dayObj = timetable[day] || {};
    const tr = document.createElement('tr');

    const dayCell = document.createElement('td');
    dayCell.textContent = day;
    dayCell.style.fontWeight = 'bold';
    dayCell.style.background = '#f1f3f5';
    tr.appendChild(dayCell);

    slots.forEach(slotName => {
      const arr = Array.isArray(dayObj[slotName]) ? dayObj[slotName] : [];
      const td = document.createElement('td');

      td.ondragover = allowDrop;
      td.ondrop = drop;

      if (arr.length === 0) {
        td.textContent = '—';
        td.style.color = '#adb5bd';
      } else {
        const blocks = arr.map(cid => {
          const cls = classes.find(c => c.id === cid);
          if (!cls) return '';

          const lec = lecturers.find(l => l.id === cls.lecturerId);
          const room = classrooms.find(r => r.id === cls.classroomId);

          const div = document.createElement('div');
          div.className = 'class-block';
          div.draggable = true;
          div.ondragstart = drag;
          div.dataset.classId = cid;
          div.dataset.day = day;
          div.dataset.slot = slotName;
          div.dataset.duration = cls.duration;

          div.innerHTML = `
            <span class="code" title="${cls.name}">${cls.name}</span>
            <span class="lect" title="${lec?.name || '—'}">${lec?.name?.substring(0, 18) || '—'}</span>
            <span class="room">${room?.name || '—'}</span>
            <button class="remove-btn" onclick="event.stopPropagation(); removeClassFromSlot('${day}','${slotName}',${cid})">×</button>
          `;
          return div.outerHTML;
        }).join('');
        td.innerHTML = blocks;
      }

      td.classList.add('editable');
      td.onclick = (e) => {
        if (e.target.tagName !== 'BUTTON' && !e.target.draggable) {
          openEditModal(day, slotName);
        }
      };
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// ────────────────────────────────────────────────
// Drag & Drop handlers
// ────────────────────────────────────────────────

function allowDrop(ev) {
  ev.preventDefault();
}

function drag(ev) {
  const block = ev.target.closest('.class-block');
  if (!block) return;
  const data = `${block.dataset.classId}|${block.dataset.day}|${block.dataset.slot}|${block.dataset.duration}`;
  ev.dataTransfer.setData("text/plain", data);
}

function drop(ev) {
  ev.preventDefault();
  const data = ev.dataTransfer.getData("text/plain").split("|");
  if (data.length !== 4) return;

  const [classIdStr, sourceDay, sourceSlot, durationStr] = data;
  const cid = parseInt(classIdStr);
  const duration = parseInt(durationStr);

  const targetTd = ev.target.closest('td');
  if (!targetTd || !targetTd.classList.contains('editable')) return;

  const targetRow = targetTd.closest('tr');
  const targetDay = targetRow.cells[0].textContent.trim();
  const cellIndex = Array.from(targetRow.cells).indexOf(targetTd);
  const targetSlot = slots[cellIndex - 1];

  if (!targetSlot) return;

  const cls = classes.find(c => c.id === cid);
  if (!cls) return;

  // Conflict check
  let slotsToCheck = [targetSlot];
  if (duration === 3) {
    const targetIdx = slots.indexOf(targetSlot);
    if (targetIdx === 3) {
      alert("Cannot place 3-hour class in the last slot.");
      return;
    }
    const nextSlot = slots[targetIdx + 1];
    slotsToCheck.push(nextSlot);
  }

  let conflictMsg = "";
  const lecId = cls.lecturerId;
  const roomId = cls.classroomId;

  slotsToCheck.forEach(s => {
    if (!isLecturerFree(targetDay, s, lecId)) {
      conflictMsg += `Lecturer conflict at ${targetDay} ${s}\n`;
    }
    if (!isClassroomFree(targetDay, s, roomId)) {
      conflictMsg += `Classroom conflict at ${targetDay} ${s}\n`;
    }
  });

  if (conflictMsg) {
    alert("Move rejected due to conflict:\n\n" + conflictMsg.trim());
    return;
  }

  // Remove from source
  timetable[sourceDay][sourceSlot] = timetable[sourceDay][sourceSlot].filter(id => id !== cid);

  if (duration === 3) {
    const sourceIdx = slots.indexOf(sourceSlot);
    if (sourceIdx < 3) {
      const nextS = slots[sourceIdx + 1];
      timetable[sourceDay][nextS] = timetable[sourceDay][nextS].filter(id => id !== cid);
    }
  }

  // Add to target
  timetable[targetDay][targetSlot].push(cid);
  if (duration === 3) {
    const targetIdx = slots.indexOf(targetSlot);
    const nextS = slots[targetIdx + 1];
    timetable[targetDay][nextS].push(cid);
  }

  saveData();
  renderTimetable();
  updateLists();
}

// ────────────────────────────────────────────────
// Other functions (remove, modals, export)
// ────────────────────────────────────────────────

function removeClassFromSlot(day, slotName, cid) {
  if (!confirm('Remove?')) return;
  timetable[day][slotName] = timetable[day][slotName].filter(id => id !== cid);

  const idx = slots.indexOf(slotName);
  const cls = classes.find(c => c.id === cid);
  if (cls?.duration === 3) {
    if (idx < 3) {
      const nextS = slots[idx + 1];
      timetable[day][nextS] = timetable[day][nextS].filter(id => id !== cid);
    } else if (idx > 0) {
      const prevS = slots[idx - 1];
      timetable[day][prevS] = timetable[day][prevS].filter(id => id !== cid);
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
  if (!cls) return;

  document.getElementById('editClassName').value = cls.name;
  document.getElementById('editClassDuration').value = cls.duration;

  const lecSelect = document.getElementById('editClassLecturer');
  lecSelect.innerHTML = '<option value="">— none —</option>' +
    lecturers.map(l => `<option value="${l.id}" ${cls.lecturerId === l.id ? 'selected' : ''}>${l.name}</option>`).join('');

  const roomSelect = document.getElementById('editClassClassroom');
  roomSelect.innerHTML = '<option value="">— none —</option>' +
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

function exportToExcel() {
  const wb = XLSX.utils.book_new();

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
