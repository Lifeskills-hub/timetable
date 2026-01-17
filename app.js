// Define slots
const slots = ['8-10am', '10-12pm', '1-3pm', '3-5pm'];

// Initialize data structures
let modules = JSON.parse(localStorage.getItem('modules')) || [];
let lecturers = JSON.parse(localStorage.getItem('lecturers')) || [];
let classrooms = JSON.parse(localStorage.getItem('classrooms')) || [];
let priorities = JSON.parse(localStorage.getItem('priorities')) || {
  equalLoading: true,
  maxDifferentModulesPerLecturer: 4
};

// Initialize timetable
let timetable = JSON.parse(localStorage.getItem('timetable')) || {
  'Monday': { '8-10am': [], '10-12pm': [], '1-3pm': [], '3-5pm': [] },
  'Tuesday': { '8-10am': [], '10-12pm': [], '1-3pm': [], '3-5pm': [] },
  'Wednesday': { '8-10am': [], '10-12pm': [], '1-3pm': [], '3-5pm': [] },
  'Thursday': { '8-10am': [], '10-12pm': [], '1-3pm': [], '3-5pm': [] },
  'Friday': { '8-10am': [], '10-12pm': [], '1-3pm': [], '3-5pm': [] }
};

// Variables for editing
let editingDay = null;
let editingSlot = null;
let editingModuleId = null;

// Function to save all data to localStorage
function saveData() {
  localStorage.setItem('modules', JSON.stringify(modules));
  localStorage.setItem('lecturers', JSON.stringify(lecturers));
  localStorage.setItem('classrooms', JSON.stringify(classrooms));
  localStorage.setItem('priorities', JSON.stringify(priorities));
  localStorage.setItem('timetable', JSON.stringify(timetable));
}

// Helper to check if module is placed
function isModulePlaced(id) {
  return Object.keys(timetable).some(day => 
    Object.keys(timetable[day]).some(slot => timetable[day][slot].includes(id))
  );
}

// Helper to check if lecturer is free in a slot
function isLecturerFree(day, slot, lecturerId) {
  if (!lecturerId) return false;
  const moduleIds = timetable[day][slot];
  const modsInSlot = moduleIds.map(id => modules.find(m => m.id === id));
  return !modsInSlot.some(m => m.lecturerId === lecturerId);
}

// Helper to check if classroom is free in a slot
function isClassroomFree(day, slot, classroomId) {
  if (!classroomId) return false;
  const moduleIds = timetable[day][slot];
  const modsInSlot = moduleIds.map(id => modules.find(m => m.id === id));
  return !modsInSlot.some(m => m.classroomId === classroomId);
}

// Function to update lists in UI with delete and edit buttons
function updateLists() {
  document.getElementById('moduleList').innerHTML = modules.map(m => 
    `<li>${m.name} (${m.duration} hours) <button class="edit-btn" onclick="openModuleEditModal(${m.id})">Edit</button><button class="delete-btn" onclick="deleteModule(${m.id})">Delete</button></li>`
  ).join('');
  document.getElementById('lecturerList').innerHTML = lecturers.map(l => 
    `<li>${l.name} (Max: ${l.maxModules}) <button class="delete-btn" onclick="deleteLecturer(${l.id})">Delete</button></li>`
  ).join('');
  document.getElementById('classroomList').innerHTML = classrooms.map(c => 
    `<li>${c.name} <button class="delete-btn" onclick="deleteClassroom(${c.id})">Delete</button></li>`
  ).join('');
}

// Add Module
function addModule() {
  const name = document.getElementById('moduleName').value.trim();
  const duration = parseInt(document.getElementById('moduleDuration').value);
  if (name) {
    modules.push({ id: modules.length + 1, name, duration, lecturerId: null, classroomId: null });
    saveData();
    updateLists();
    document.getElementById('moduleName').value = '';
  } else {
    alert('Please enter a module name.');
  }
}

// Add Lecturer
function addLecturer() {
  const name = document.getElementById('lecturerName').value.trim();
  const maxModules = parseInt(document.getElementById('maxModules').value);
  if (name) {
    lecturers.push({ id: lecturers.length + 1, name, assignedModules: [], maxModules });
    saveData();
    updateLists();
    document.getElementById('lecturerName').value = '';
  } else {
    alert('Please enter a lecturer name.');
  }
}

// Add Classroom
function addClassroom() {
  const name = document.getElementById('classroomName').value.trim();
  if (name) {
    classrooms.push({ id: classrooms.length + 1, name });
    saveData();
    updateLists();
    document.getElementById('classroomName').value = '';
  } else {
    alert('Please enter a classroom name.');
  }
}

// Delete Module
function deleteModule(id) {
  if (confirm('Are you sure you want to delete this module? This will remove it from the timetable.')) {
    modules = modules.filter(m => m.id !== id);
    // Remove from timetable
    Object.keys(timetable).forEach(day => {
      Object.keys(timetable[day]).forEach(slot => {
        timetable[day][slot] = timetable[day][slot].filter(modId => modId !== id);
      });
    });
    lecturers.forEach(lec => {
      lec.assignedModules = lec.assignedModules.filter(modId => modId !== id);
    });
    saveData();
    updateLists();
    renderTimetable();
  }
}

// Delete Lecturer
function deleteLecturer(id) {
  if (confirm('Are you sure you want to delete this lecturer? This will reset assignments.')) {
    lecturers = lecturers.filter(l => l.id !== id);
    modules.forEach(mod => {
      if (mod.lecturerId === id) mod.lecturerId = null;
    });
    saveData();
    updateLists();
    renderTimetable();
  }
}

// Delete Classroom
function deleteClassroom(id) {
  if (confirm('Are you sure you want to delete this classroom? This will reset assignments.')) {
    classrooms = classrooms.filter(c => c.id !== id);
    modules.forEach(mod => {
      if (mod.classroomId === id) mod.classroomId = null;
    });
    saveData();
    updateLists();
    renderTimetable();
  }
}

// Save Priorities
function savePriorities() {
  priorities.equalLoading = document.getElementById('equalLoading').checked;
  priorities.maxDifferentModulesPerLecturer = parseInt(document.getElementById('globalMaxModules').value);
  saveData();
  alert('Priorities saved!');
}

// Generate Timetable
function generateTimetable() {
  // Reset timetable and assignments
  Object.keys(timetable).forEach(day => {
    Object.keys(timetable[day]).forEach(slot => {
      timetable[day][slot] = [];
    });
  });
  lecturers.forEach(lec => lec.assignedModules = []);
  modules.forEach(mod => { mod.lecturerId = null; mod.classroomId = null; });

  // Sort modules: Handle 3-hour ones first
  modules.sort((a, b) => b.duration - a.duration);

  // Assign lecturers with priorities
  modules.forEach(mod => {
    let availableLecturers = lecturers.filter(lec => 
      lec.assignedModules.length < Math.min(lec.maxModules, priorities.maxDifferentModulesPerLecturer) &&
      !lec.assignedModules.includes(mod.id)
    );
    if (priorities.equalLoading) {
      availableLecturers.sort((a, b) => a.assignedModules.length - b.assignedModules.length);
    }
    if (availableLecturers.length > 0) {
      const lec = availableLecturers[0];
      mod.lecturerId = lec.id;
      lec.assignedModules.push(mod.id);
    } else {
      alert(`No available lecturer for module ${mod.name}. Adjust priorities or add lecturers.`);
      return;
    }
  });

  // Place modules with classroom assignment and conflict checks
  const days = Object.keys(timetable);
  modules.forEach(mod => {
    let placed = false;
    let attempts = 0;
    const maxAttempts = days.length * slots.length * 2; // Avoid infinite loop
    while (!placed && attempts < maxAttempts) {
      const dayIdx = Math.floor(Math.random() * days.length);
      const day = days[dayIdx];
      const slotIdx = Math.floor(Math.random() * slots.length);
      if (mod.duration === 3 && slotIdx === 3) continue; // Can't place 3h in last slot
      const slot = slots[slotIdx];
      const nextSlot = mod.duration === 3 ? slots[slotIdx + 1] : null;

      // Check lecturer free in slot(s)
      if (!isLecturerFree(day, slot, mod.lecturerId)) { attempts++; continue; }
      if (nextSlot && !isLecturerFree(day, nextSlot, mod.lecturerId)) { attempts++; continue; }

      // Find available classrooms free in slot(s)
      const availableClassrooms = classrooms.filter(c => 
        isClassroomFree(day, slot, c.id) && (!nextSlot || isClassroomFree(day, nextSlot, c.id))
      );
      if (availableClassrooms.length === 0) { attempts++; continue; }

      // Assign random available classroom
      const chosen = availableClassrooms[Math.floor(Math.random() * availableClassrooms.length)];
      mod.classroomId = chosen.id;

      // Place module
      timetable[day][slot].push(mod.id);
      if (nextSlot) timetable[day][nextSlot].push(mod.id);
      placed = true;
    }
    if (!placed) {
      alert(`Could not place module ${mod.name} due to conflicts or insufficient slots/rooms.`);
      return;
    }
  });

  saveData();
  renderTimetable();
}

// Render Timetable
function renderTimetable() {
  const table = document.getElementById('timetableTable');
  table.innerHTML = '<tr><th>Day</th><th>8-10am</th><th>10-12pm</th><th>1-3pm</th><th>3-5pm</th></tr>';
  Object.keys(timetable).forEach(day => {
    let row = document.createElement('tr');
    row.innerHTML = `<td>${day}</td>`;
    slots.forEach(slot => {
      const moduleIds = timetable[day][slot];
      const contents = moduleIds.map(id => {
        const mod = modules.find(m => m.id === id);
        const lec = lecturers.find(l => l.id === mod.lecturerId);
        const room = classrooms.find(c => c.id === mod.classroomId);
        return `${mod.name} (${mod.duration}h)<br>Lect: ${lec ? lec.name : 'N/A'}<br>Room: ${room ? room.name : 'N/A'} <button class="remove-btn" onclick="removeModuleFromSlot('${day}', '${slot}', ${id})">Remove</button>`;
      }).join('<hr>');
      const td = document.createElement('td');
      td.innerHTML = contents || 'Empty';
      td.classList.add('editable');
      td.setAttribute('onclick', `openEditModal('${day}', '${slot}')`);
      row.appendChild(td);
    });
    table.appendChild(row);
  });
}

// Remove Module from Slot
function removeModuleFromSlot(day, slot, moduleId) {
  if (confirm('Remove this module from the slot?')) {
    timetable[day][slot] = timetable[day][slot].filter(id => id !== moduleId);
    const slotIdx = slots.indexOf(slot);
    const mod = modules.find(m => m.id === moduleId);
    if (mod.duration === 3) {
      if (slotIdx < 3 && timetable[day][slots[slotIdx + 1]].includes(moduleId)) {
        timetable[day][slots[slotIdx + 1]] = timetable[day][slots[slotIdx + 1]].filter(id => id !== moduleId);
      } else if (slotIdx > 0 && timetable[day][slots[slotIdx - 1]].includes(moduleId)) {
        timetable[day][slots[slotIdx - 1]] = timetable[day][slots[slotIdx - 1]].filter(id => id !== moduleId);
      }
    }
    saveData();
    renderTimetable();
  }
}

// Open Add Modal
function openEditModal(day, slot) {
  editingDay = day;
  editingSlot = slot;
  const unplacedModules = modules.filter(m => !isModulePlaced(m.id));
  const moduleSelect = document.getElementById('editModule');
  moduleSelect.innerHTML = unplacedModules.length > 0 ? '<option value="">Select Module to Add</option>' + unplacedModules.map(m => `<option value="${m.id}">${m.name} (${m.duration}h)</option>`).join('') : '<option value="">No unplaced modules available</option>';
  document.getElementById('editModal').style.display = 'block';
}

// Close Add Modal
function closeModal() {
  document.getElementById('editModal').style.display = 'none';
}

// Save Add to Slot
function saveSlotEdit() {
  const moduleId = parseInt(document.getElementById('editModule').value);
  if (!moduleId) {
    closeModal();
    return;
  }
  const mod = modules.find(m => m.id === moduleId);
  if (!mod.lecturerId || !mod.classroomId) {
    alert('Module must have a lecturer and classroom assigned. Edit the module first.');
    return;
  }
  const slotIdx = slots.indexOf(editingSlot);
  let slotsToOccupy = [editingSlot];
  if (mod.duration === 3) {
    if (slotIdx === 3) {
      alert('Cannot place 3-hour module in the last slot.');
      return;
    }
    const nextSlot = slots[slotIdx + 1];
    if (!isLecturerFree(editingDay, nextSlot, mod.lecturerId) || !isClassroomFree(editingDay, nextSlot, mod.classroomId)) {
      alert('Next slot has a conflict for this lecturer or classroom.');
      return;
    }
    slotsToOccupy.push(nextSlot);
  }
  if (!isLecturerFree(editingDay, editingSlot, mod.lecturerId) || !isClassroomFree(editingDay, editingSlot, mod.classroomId)) {
    alert('This slot has a conflict for this lecturer or classroom.');
    return;
  }
  slotsToOccupy.forEach(s => timetable[editingDay][s].push(moduleId));
  saveData();
  renderTimetable();
  closeModal();
}

// Open Module Edit Modal
function openModuleEditModal(id) {
  editingModuleId = id;
  const mod = modules.find(m => m.id === id);
  document.getElementById('editModuleName').value = mod.name;
  document.getElementById('editModuleDuration').value = mod.duration;
  const lecturerSelect = document.getElementById('editModuleLecturer');
  lecturerSelect.innerHTML = '<option value="">None</option>' + lecturers.map(l => `<option value="${l.id}" ${mod.lecturerId === l.id ? 'selected' : ''}>${l.name}</option>`).join('');
  const classroomSelect = document.getElementById('editModuleClassroom');
  classroomSelect.innerHTML = '<option value="">None</option>' + classrooms.map(c => `<option value="${c.id}" ${mod.classroomId === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
  document.getElementById('moduleEditModal').style.display = 'block';
}

// Close Module Edit Modal
function closeModuleEditModal() {
  document.getElementById('moduleEditModal').style.display = 'none';
}

// Save Module Edit
function saveModuleEdit() {
  const name = document.getElementById('editModuleName').value.trim();
  if (!name) {
    alert('Please enter a module name.');
    return;
  }
  const duration = parseInt(document.getElementById('editModuleDuration').value);
  const lecturerId = parseInt(document.getElementById('editModuleLecturer').value) || null;
  const classroomId = parseInt(document.getElementById('editModuleClassroom').value) || null;
  const mod = modules.find(m => m.id === editingModuleId);
  mod.name = name;
  mod.duration = duration;
  mod.lecturerId = lecturerId;
  mod.classroomId = classroomId;
  saveData();
  updateLists();
  renderTimetable();
  closeModuleEditModal();
}

// Export to Excel
function exportToExcel() {
  const wb = XLSX.utils.book_new();
  const wsData = [['Day', 'Slot', 'Module', 'Duration', 'Lecturer', 'Classroom']];
  Object.keys(timetable).forEach(day => {
    Object.keys(timetable[day]).forEach(slot => {
      timetable[day][slot].forEach(moduleId => {
        const mod = modules.find(m => m.id === moduleId);
        const lec = lecturers.find(l => l.id === mod.lecturerId);
        const room = classrooms.find(c => c.id === mod.classroomId);
        wsData.push([
          day,
          slot,
          mod.name,
          mod.duration,
          lec ? lec.name : 'N/A',
          room ? room.name : 'N/A'
        ]);
      });
    });
  });
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
  XLSX.writeFile(wb, 'timetable.xlsx');
}

// Load initial data and render
updateLists();
renderTimetable();
