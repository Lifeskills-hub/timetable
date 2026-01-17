const slots = ['8-10am', '10-12pm', '1-3pm', '3-5pm'];
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Data structures
let classes = JSON.parse(localStorage.getItem('classes')) || [];
let lecturers = JSON.parse(localStorage.getItem('lecturers')) || [];
let classrooms = JSON.parse(localStorage.getItem('classrooms')) || [];
let lockedIntakes = JSON.parse(localStorage.getItem('lockedIntakes')) || { Jan: false, Apr: false };
let timetable = JSON.parse(localStorage.getItem('timetable')) || {};
let currentTab = 'Jan';

// Initialize Timetable structure
days.forEach(day => {
    if (!timetable[day]) timetable[day] = {};
    slots.forEach(slot => {
        if (!Array.isArray(timetable[day][slot])) timetable[day][slot] = [];
    });
});

let editingDay = null, editingSlot = null, editingClassId = null;

function saveData() {
    localStorage.setItem('classes', JSON.stringify(classes));
    localStorage.setItem('lecturers', JSON.stringify(lecturers));
    localStorage.setItem('classrooms', JSON.stringify(classrooms));
    localStorage.setItem('timetable', JSON.stringify(timetable));
    localStorage.setItem('lockedIntakes', JSON.stringify(lockedIntakes));
}

// --- HELPERS ---
function isClassPlaced(id) {
    return Object.values(timetable).some(dayObj => 
        Object.values(dayObj).some(arr => arr.includes(id))
    );
}

function getLecturerWeeklyHours(lectId) {
    return classes.filter(c => c.lecturerId === lectId).reduce((sum, c) => sum + c.duration, 0);
}

function getLecturerUniqueModules(lectId) {
    return new Set(classes.filter(c => c.lecturerId === lectId).map(c => c.module)).size;
}

function isLecturerFree(day, slotName, lectId) {
    if (!lectId) return true;
    return !timetable[day][slotName].some(cid => {
        const cls = classes.find(c => c.id === cid);
        return cls && cls.lecturerId === lectId;
    });
}

function isClassroomFree(day, slotName, roomId) {
    if (!roomId) return true;
    return !timetable[day][slotName].some(cid => {
        const cls = classes.find(c => c.id === cid);
        return cls && cls.classroomId === roomId;
    });
}

// --- UI / TABS ---
function switchIntakeTab(intake) {
    currentTab = intake;
    document.getElementById('tabJan').classList.toggle('active', intake === 'Jan');
    document.getElementById('tabApr').classList.toggle('active', intake === 'Apr');
    updateLists();
}

function toggleCurrentLock() { 
    lockedIntakes[currentTab] = !lockedIntakes[currentTab]; 
    saveData(); 
    updateLists(); 
}

function deleteCurrentUnlocked() {
    if (lockedIntakes[currentTab]) return alert("This intake is locked!");
    if (!confirm(`Delete all classes in ${currentTab} intake?`)) return;
    
    const toDelIds = classes.filter(c => c.intake === currentTab).map(c => c.id);
    classes = classes.filter(c => c.intake !== currentTab);
    
    // Clean from timetable
    days.forEach(d => slots.forEach(s => {
        timetable[d][s] = timetable[d][s].filter(id => !toDelIds.includes(id));
    }));
    
    saveData(); updateLists(); renderTimetable();
}

function updateLists() {
    const searchTerm = document.getElementById('classSearch').value.toLowerCase();
    const tableBody = document.getElementById('classTableBody');
    const lockBtn = document.getElementById('lockIntakeBtn');
    
    lockBtn.textContent = lockedIntakes[currentTab] ? `Unlock ${currentTab}` : `Lock ${currentTab}`;
    lockBtn.className = lockedIntakes[currentTab] ? 'lock-btn locked-active' : 'lock-btn';

    const filteredClasses = classes.filter(c => 
        c.intake === currentTab && 
        (c.module.toLowerCase().includes(searchTerm) || c.school.toLowerCase().includes(searchTerm))
    );

    tableBody.innerHTML = filteredClasses.map(c => {
        const placed = isClassPlaced(c.id);
        return `
            <tr class="${lockedIntakes[currentTab] ? 'locked-row' : ''}">
                <td><strong>${c.module}</strong><br><small>${c.school}</small></td>
                <td>${c.group}</td>
                <td style="text-align:center">${c.duration}h</td>
                <td style="text-align:center">
                    <span class="status-dot ${placed ? 'status-placed' : 'status-pending'}"></span>
                </td>
                <td style="text-align:right">
                    <button class="edit-btn compact-action-btn" onclick="openClassEditModal(${c.id})">Edit</button>
                    <button class="delete-btn compact-action-btn" onclick="deleteClass(${c.id})">Del</button>
                </td>
            </tr>
        `;
    }).join('');

    // Lecturer List
    document.getElementById('lecturerList').innerHTML = lecturers.map(l => {
        const h = getLecturerWeeklyHours(l.id);
        const m = getLecturerUniqueModules(l.id);
        return `<div style="margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:4px;">
            <strong>${l.name}</strong> <button class="delete-btn compact-action-btn" onclick="deleteLecturer(${l.id})">Del</button><br>
            <small>M: ${m}/${l.maxModules} | H: ${h}/${l.maxWeeklyHours}h</small>
        </div>`;
    }).join('') || '<small>No lecturers added</small>';

    // Room List
    document.getElementById('classroomList').innerHTML = classrooms.map(r => 
        `<div style="margin-bottom:4px;">${r.name} <button class="delete-btn compact-action-btn" onclick="deleteClassroom(${r.id})">Del</button></div>`
    ).join('') || '<small>No rooms added</small>';
}

// --- CRUD LOGIC ---
function addClass() {
    const intake = document.getElementById('classIntake').value;
    if (lockedIntakes[intake]) return alert("Intake is locked!");
    
    const moduleCode = document.getElementById('moduleCode').value.trim();
    const school = document.getElementById('schoolName').value;
    const group = document.getElementById('classGroup').value.trim();
    if (!moduleCode || !group) return alert("Enter Module and Group");
    
    classes.push({ 
        id: Date.now(), module: moduleCode, school, group, 
        duration: parseInt(document.getElementById('classDuration').value), 
        intake, name: `${moduleCode} (${group})`, lecturerId: null, classroomId: null 
    });
    
    saveData(); updateLists();
    document.getElementById('classGroup').value = '';
    document.getElementById('classGroup').focus();
}

function deleteClass(id) {
    if(!confirm("Delete this class?")) return;
    classes = classes.filter(c => c.id !== id);
    days.forEach(d => slots.forEach(s => { timetable[d][s] = timetable[d][s].filter(cid => cid !== id); }));
    saveData(); updateLists(); renderTimetable();
}

function addLecturer() {
    const name = document.getElementById('lecturerName').value.trim();
    if (!name) return;
    lecturers.push({ 
        id: Date.now(), name, 
        maxModules: parseInt(document.getElementById('maxModules').value), 
        maxWeeklyHours: parseInt(document.getElementById('maxWeeklyHours').value) 
    });
    saveData(); updateLists();
    document.getElementById('lecturerName').value = '';
}

function deleteLecturer(id) {
    if(!confirm("Delete lecturer? All their assigned classes will be unassigned.")) return;
    classes.forEach(c => { if (c.lecturerId === id) c.lecturerId = null; });
    lecturers = lecturers.filter(l => l.id !== id);
    saveData(); updateLists(); renderTimetable();
}

function addClassroom() {
    const name = document.getElementById('classroomName').value.trim();
    if (!name) return;
    classrooms.push({ id: Date.now(), name });
    saveData(); updateLists();
    document.getElementById('classroomName').value = '';
}

function deleteClassroom(id) {
    if(!confirm("Delete room?")) return;
    classes.forEach(c => { if (c.classroomId === id) c.classroomId = null; });
    classrooms = classrooms.filter(r => r.id !== id);
    saveData(); updateLists(); renderTimetable();
}

// --- SCHEDULING ---
function clearTimetable() {
    if (!confirm("Clear schedule for UNLOCKED intakes?")) return;
    days.forEach(day => {
        slots.forEach(slot => {
            timetable[day][slot] = timetable[day][slot].filter(cid => {
                const cls = classes.find(c => c.id === cid);
                return cls && lockedIntakes[cls.intake];
            });
        });
    });
    saveData(); renderTimetable(); updateLists();
}

function generateTimetable() {
    // 1. Clear unlocked
    days.forEach(d => slots.forEach(s => {
        timetable[d][s] = timetable[d][s].filter(cid => {
            const cls = classes.find(c => c.id === cid);
            return cls && lockedIntakes[cls.intake];
        });
    }));

    // 2. Reset assignments for unlocked classes
    classes.forEach(c => { if (!lockedIntakes[c.intake]) { c.lecturerId = null; c.classroomId = null; } });
    
    // 3. To Place
    const toPlace = classes.filter(c => !isClassPlaced(c.id)).sort((a,b) => b.duration - a.duration);
    
    toPlace.forEach(cls => {
        // Lecturer Finder
        const validLecs = lecturers.filter(l => {
            const h = getLecturerWeeklyHours(l.id);
            if (h + cls.duration > l.maxWeeklyHours) return false;
            const teachesThis = classes.some(c => c.lecturerId === l.id && c.module === cls.module);
            return teachesThis || getLecturerUniqueModules(l.id) < l.maxModules;
        }).sort((a,b) => getLecturerWeeklyHours(a.id) - getLecturerWeeklyHours(b.id));

        if (validLecs.length > 0) cls.lecturerId = validLecs[0].id;

        // Slot & Room Finder
        let placed = false, tries = 0;
        while (!placed && tries < 150) {
            tries++;
            const d = days[Math.floor(Math.random()*5)], sIdx = Math.floor(Math.random()*4), s = slots[sIdx];
            if (cls.duration === 3 && sIdx === 3) continue; // No 3pm starts for 3h
            
            if (isLecturerFree(d, s, cls.lecturerId)) {
                if (cls.duration === 3 && !isLecturerFree(d, slots[sIdx+1], cls.lecturerId)) continue;

                const freeRooms = classrooms.filter(r => {
                    const f = isClassroomFree(d, s, r.id);
                    return cls.duration === 3 ? (f && isClassroomFree(d, slots[sIdx+1], r.id)) : f;
                });

                if (freeRooms.length > 0) {
                    cls.classroomId = freeRooms[0].id;
                    timetable[d][s].push(cls.id);
                    if (cls.duration === 3) timetable[d][slots[sIdx+1]].push(cls.id);
                    placed = true;
                }
            }
        }
    });
    saveData(); renderTimetable(); updateLists();
}

function renderTimetable() {
    const tbody = document.querySelector('#timetableTable tbody');
    tbody.innerHTML = '';
    days.forEach(day => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><b>${day}</b></td>`;
        slots.forEach(slot => {
            const td = document.createElement('td');
            td.className = 'editable';
            td.onclick = (e) => { if(e.target === td) openEditModal(day, slot); };
            td.innerHTML = timetable[day][slot].map(cid => {
                const cls = classes.find(c => c.id === cid);
                const lec = lecturers.find(l => l.id === cls?.lecturerId);
                const room = classrooms.find(r => r.id === cls?.classroomId);
                if(!cls) return '';
                return `<div class="class-block">
                    <span class="code">${cls.module} (${cls.group})</span>
                    <span class="lect">${lec ? lec.name : 'No Lec'}</span>
                    <span class="room">${room ? room.name : 'No Room'}</span>
                    <button class="remove-btn" onclick="event.stopPropagation(); removeClassFromSlot('${day}','${slot}',${cid})">×</button>
                </div>`;
            }).join('') || '—';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// --- MODALS ---
function openClassEditModal(id) {
    editingClassId = id; 
    const cls = classes.find(c => c.id === id);
    document.getElementById('editModuleCode').value = cls.module;
    document.getElementById('editSchoolName').value = cls.school;
    document.getElementById('editClassGroup').value = cls.group;
    document.getElementById('editClassDuration').value = cls.duration;
    document.getElementById('editClassLecturer').innerHTML = '<option value="">None</option>' + lecturers.map(l => `<option value="${l.id}" ${cls.lecturerId == l.id ? 'selected' : ''}>${l.name}</option>`).join('');
    document.getElementById('editClassClassroom').innerHTML = '<option value="">None</option>' + classrooms.map(r => `<option value="${r.id}" ${cls.classroomId == r.id ? 'selected' : ''}>${r.name}</option>`).join('');
    document.getElementById('classEditModal').style.display = 'block';
}
function closeClassEditModal() { document.getElementById('classEditModal').style.display = 'none'; }

function saveClassEdit() {
    const cls = classes.find(c => c.id === editingClassId);
    cls.module = document.getElementById('editModuleCode').value;
    cls.school = document.getElementById('editSchoolName').value;
    cls.group = document.getElementById('editClassGroup').value;
    cls.name = `${cls.module} (${cls.group})`;
    cls.duration = parseInt(document.getElementById('editClassDuration').value);
    cls.lecturerId = parseInt(document.getElementById('editClassLecturer').value) || null;
    cls.classroomId = parseInt(document.getElementById('editClassClassroom').value) || null;
    saveData(); updateLists(); renderTimetable(); closeClassEditModal();
}

function openEditModal(day, slot) {
    editingDay = day; editingSlot = slot;
    document.getElementById('slotDisplay').textContent = `${day} at ${slot}`;
    const unplaced = classes.filter(c => !isClassPlaced(c.id));
    const sel = document.getElementById('editClass');
    sel.innerHTML = unplaced.length ? unplaced.map(c => `<option value="${c.id}">${c.name}</option>`).join('') : '<option value="">No unplaced classes</option>';
    document.getElementById('editModal').style.display = 'block';
}
function closeModal() { document.getElementById('editModal').style.display = 'none'; }

function saveSlotEdit() {
    const cid = parseInt(document.getElementById('editClass').value);
    if (!cid) return closeModal();
    const cls = classes.find(c => c.id === cid);
    const sIdx = slots.indexOf(editingSlot);
    if (cls.duration === 3 && sIdx === 3) return alert("3h class can't start at 3pm");
    
    timetable[editingDay][editingSlot].push(cid);
    if (cls.duration === 3) timetable[editingDay][slots[sIdx+1]].push(cid);
    saveData(); renderTimetable(); updateLists(); closeModal();
}

function removeClassFromSlot(day, slot, cid) {
    const cls = classes.find(c => c.id === cid);
    timetable[day][slot] = timetable[day][slot].filter(id => id !== cid);
    // Remove from linked slot for 3h classes
    if (cls?.duration === 3) {
        const sIdx = slots.indexOf(slot);
        if (sIdx < 3 && timetable[day][slots[sIdx+1]].includes(cid)) 
            timetable[day][slots[sIdx+1]] = timetable[day][slots[sIdx+1]].filter(id => id !== cid);
        else if (sIdx > 0 && timetable[day][slots[sIdx-1]].includes(cid)) 
            timetable[day][slots[sIdx-1]] = timetable[day][slots[sIdx-1]].filter(id => id !== cid);
    }
    saveData(); renderTimetable(); updateLists();
}

function exportToExcel() {
    const rows = [['Day', 'Time', 'Module', 'School', 'Group', 'Lecturer', 'Room']];
    days.forEach(day => {
        slots.forEach(slot => {
            timetable[day][slot].forEach(cid => {
                const c = classes.find(x => x.id === cid);
                const l = lecturers.find(x => x.id === c.lecturerId);
                const r = classrooms.find(x => x.id === c.classroomId);
                if(c) rows.push([day, slot, c.module, c.school, c.group, l?l.name:'-', r?r.name:'-']);
            });
        });
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timetable");
    XLSX.writeFile(wb, "timetable.xlsx");
}

window.onload = () => { 
    switchIntakeTab('Jan'); 
    renderTimetable(); 
};
