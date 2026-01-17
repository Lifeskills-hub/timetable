// Initialize data structures
let modules = JSON.parse(localStorage.getItem('modules')) || [];
let lecturers = JSON.parse(localStorage.getItem('lecturers')) || [];
let classrooms = JSON.parse(localStorage.getItem('classrooms')) || [];
let priorities = JSON.parse(localStorage.getItem('priorities')) || {
  equalLoading: true,
  maxDifferentModulesPerLecturer: 4
};

// Initialize timetable for 5 days
let timetable = JSON.parse(localStorage.getItem('timetable')) || {
  'Monday': [
    { slot: '8-10am', moduleId: null, span: 1 },
    { slot: '10-12pm', moduleId: null, span: 1 },
    { slot: '1-3pm', moduleId: null, span: 1 },
    { slot: '3-5pm', moduleId: null, span: 1 }
  ],
  'Tuesday': [
    { slot: '8-10am', moduleId: null, span: 1 },
    { slot: '10-12pm', moduleId: null, span: 1 },
    { slot: '1-3pm', moduleId: null, span: 1 },
    { slot: '3-5pm', moduleId: null, span: 1 }
  ],
  'Wednesday': [
    { slot: '8-10am', moduleId: null, span: 1 },
    { slot: '10-12pm', moduleId: null, span: 1 },
    { slot: '1-3pm', moduleId: null, span: 1 },
    { slot: '3-5pm', moduleId: null, span: 1 }
  ],
  'Thursday': [
    { slot: '8-10am', moduleId: null, span: 1 },
    { slot: '10-12pm', moduleId: null, span: 1 },
    { slot: '1-3pm', moduleId: null, span: 1 },
    { slot: '3-5pm', moduleId: null, span: 1 }
  ],
  'Friday': [
    { slot: '8-10am', moduleId: null, span: 1 },
    { slot: '10-12pm', moduleId: null, span: 1 },
    { slot: '1-3pm', moduleId: null, span: 1 },
    { slot: '3-5pm', moduleId: null, span: 1 }
  ]
};

// Function to save all data to localStorage
function saveData() {
  localStorage.setItem('modules', JSON.stringify(modules));
  localStorage.setItem('lecturers', JSON.stringify(lecturers));
  localStorage.setItem('classrooms', JSON.stringify(classrooms));
  localStorage.setItem('priorities', JSON.stringify(priorities));
  localStorage.setItem('timetable', JSON.stringify(timetable));
}

// Function to update lists in UI
function updateLists() {
  document.getElementById('moduleList').innerHTML = modules.map(m => `<li>${m.name} (${m.duration} hours)</li>`).join('');
  document.getElementById('lecturerList').innerHTML = lecturers.map(l => `<li>${l.name} (Max: ${l.maxModules})</li>`).join('');
  document.getElementById('classroomList').innerHTML = classrooms.map(c => `<li>${c.name}</li>`).join('');
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
    timetable[day].forEach(slot => {
      slot.moduleId = null;
      slot.span = 1;
    });
  });
  lecturers.forEach(lec => lec.assignedModules = []);
  modules.forEach(mod => { mod.lecturerId = null; mod.classroomId = null; });

  // Sort modules: Handle 3-hour ones first (rare, so no special rarity logic yet)
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

    // Assign random classroom (expand later for availability)
    if (classrooms.length > 0) {
      mod.classroomId = classrooms[Math.floor(Math.random() * classrooms.length)].id;
    } else {
      alert('No classrooms available.');
      return;
    }
  });

  // Place modules into slots (simple round-robin, check for free slots)
  const days = Object.keys(timetable);
  let dayIndex = 0;
  for (let mod of modules) {
    let placed = false;
    for (let i = 0; i < days.length; i++) {
      const day = days[(dayIndex + i) % days.length];
      for (let j = 0; j < timetable[day].length; j++) {
        if (!timetable[day][j].moduleId) {
          timetable[day][j].moduleId = mod.id;
          if (mod.duration === 3 && j + 1 < timetable[day].length && !timetable[day][j + 1].moduleId) {
            timetable[day][j].span = 2;
            timetable[day][j + 1].moduleId = mod.id; // Mark next slot as occupied
            timetable[day][j + 1].span = 0; // Hidden span
          }
          placed = true;
          dayIndex = (dayIndex + 1) % days.length;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) {
      alert(`No slot available for module ${mod.name}. Add more days/slots if needed.`);
      return;
    }
  }

  saveData();
  renderTimetable();
}

// Render Timetable in UI
function renderTimetable() {
  const table = document.getElementById('timetableTable');
  table.innerHTML = '<tr><th>Day</th><th>8-10am</th><th>10-12pm</th><th>1-3pm</th><th>3-5pm</th></tr>';
  Object.keys(timetable).forEach(day => {
    let row = document.createElement('tr');
    row.innerHTML = `<td>${day}</td>`;
    timetable[day].forEach(slot => {
      if (slot.span === 0) return; // Skip hidden spanned slots
      const mod = modules.find(m => m.id === slot.moduleId);
      const content = mod ? `${mod.name} (${mod.duration}h)<br>Lect: ${lecturers.find(l => l.id === mod.lecturerId)?.name || 'N/A'}<br>Room: ${classrooms.find(c => c.id === mod.classroomId)?.name || 'N/A'}` : '';
      const td = document.createElement('td');
      td.innerHTML = content;
      if (slot.span > 1) td.colSpan = slot.span;
      row.appendChild(td);
    });
    table.appendChild(row);
  });
}

// Export to Excel
function exportToExcel() {
  const wb = XLSX.utils.book_new();
  const wsData = [['Day', 'Slot', 'Module', 'Duration', 'Lecturer', 'Classroom']];

  Object.keys(timetable).forEach(day => {
    timetable[day].forEach(slot => {
      if (slot.moduleId && slot.span > 0) {
        const mod = modules.find(m => m.id === slot.moduleId);
        const lec = lecturers.find(l => l.id === mod.lecturerId);
        const room = classrooms.find(c => c.id === mod.classroomId);
        wsData.push([
          day,
          slot.slot + (mod.duration === 3 ? ' to next' : ''),
          mod.name,
          mod.duration,
          lec ? lec.name : 'N/A',
          room ? room.name : 'N/A'
        ]);
      }
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
  XLSX.writeFile(wb, 'timetable.xlsx');
}

// Load initial data and render
updateLists();
renderTimetable();
