// app.js
const slots = ['8-10am', '10-12pm', '1-3pm', '3-5pm'];
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

let classes = JSON.parse(localStorage.getItem('classes')) || [];
let lecturers = JSON.parse(localStorage.getItem('lecturers')) || [];
let classrooms = JSON.parse(localStorage.getItem('classrooms')) || [];
let lockedIntakes = JSON.parse(localStorage.getItem('lockedIntakes')) || { Jan: false, Apr: false };
let timetable = JSON.parse(localStorage.getItem('timetable')) || {};

// Ensure timetable structure exists
days.forEach(day => {
    if (!timetable[day]) timetable[day] = {};
    slots.forEach(slot => {
        if (!Array.isArray(timetable[day][slot])) timetable[day][slot] = [];
    });
});

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

// --- HELPERS ---
function isClassPlaced(id) {
    return Object.values(timetable).some(dayObj => 
        Object.values(dayObj).some(arr => arr.includes(id))
    );
}

function getLecturerWeeklyHours(lectId) {
    const seenClasses = new Set();
    Object.values(timetable).forEach(dayObj => {
        Object.values(dayObj).forEach(slotArr => {
            slotArr.forEach(cid => {
                const cls = classes.find(c => c.id === cid);
                if (cls && cls.lecturerId === lectId) seenClasses.add(cid);
            });
        });
    });
    return Array.from(seenClasses).reduce((sum, cid) => {
        const cls = classes.find(c => c.id === cid);
        return sum + (cls ? cls.duration : 0);
    }, 0);
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

// --- UI UPDATES ---
function updateLists() {
    ['Jan', 'Apr'].forEach(intake => {
        const listEl = document.getElementById(`classList${intake}`);
        const intakeClasses = classes.filter(c => c.intake === intake);
        
        listEl.innerHTML = intakeClasses.map(c => {
            const placed = isClassPlaced(c.id) ? '<b style="color:green">✓</b> ' : '';
            return `<li>${placed}${c.name} (${c.duration}h) 
                <button class="edit-btn" onclick="openClassEditModal(${c.id})">Edit</button>
                <button class="delete-btn" onclick="deleteClass(${c.id})">Del</button></li>`;
        }).join('');
        
        listEl.classList.toggle('locked', lockedIntakes[intake]);
        const btn = document.getElementById(`lock${intake}Btn`);
        btn.textContent = lockedIntakes[intake] ? `Unlock ${intake}` : `Lock ${intake}`;
        btn.classList.toggle('locked-active', lockedIntakes[intake]);
    });

    document.getElementById('lecturerList').innerHTML = lecturers.map(l => {
        const h = getLecturerWeeklyHours(l.id);
        return `<li>${l.name} <span class="${h > l.maxWeeklyHours ? 'over-limit' : ''}">${h}/${l.maxWeeklyHours}h</span> 
                <button class="delete-btn" onclick="deleteLecturer(${l.id})">Del</button></li>`;
    }).join('');

    document.getElementById('classroomList').innerHTML = classrooms.map(r => 
        `<li>${r.name} <button class="delete-btn" onclick="deleteClassroom(${r.id})">Del</button></li>`).join('');
}

// --- CRUD ---
function addClass() {
    const intake = document.getElementById('classIntake').value;
    if (lockedIntakes[intake]) return alert("This intake is locked!");
    
    const name = document.getElementById('className').value.trim();
    if (!name) return alert("Enter name");
    
    classes.push({
        id: Date.now(), // Unique ID
        name,
        duration: parseInt(document.getElementById('classDuration').value),
        intake,
        lecturerId: null,
        classroomId: null
    });
    saveData(); updateLists();
    document.getElementById('className').value = '';
}

function deleteClass(id) {
    classes = classes.filter(c => c.id !== id);
    days.forEach(d => slots.forEach(s => {
        timetable[d][s] = timetable[d][s].filter(cid => cid !== id);
    }));
    saveData(); updateLists(); renderTimetable();
}

function addLecturer() {
    const name = document.getElementById('lecturerName').value.trim();
    if (!name) return;
    lecturers.push({
        id: Date.now(),
        name,
        maxDifferentClasses: parseInt(document.getElementById('maxDifferent').value),
        maxWeeklyHours: parseInt(document.getElementById('maxWeeklyHours').value),
        assignedClasses: []
    });
    saveData(); updateLists();
    document.getElementById('lecturerName').value = '';
}

function addClassroom() {
    const name = document.getElementById('classroomName').value.trim();
    if (!name) return;
    classrooms.push({ id: Date.now(), name });
    saveData(); updateLists();
    document.getElementById('classroomName').value = '';
}

// --- MODALS ---
function openClassEditModal(id) {
    editingClassId = id;
    const cls = classes.find(c => c.id === id);
    document.getElementById('editClassName').value = cls.name;
    document.getElementById('editClassDuration').value = cls.duration;
    
    document.getElementById('editClassLecturer').innerHTML = '<option value="">None</option>' + 
        lecturers.map(l => `<option value="${l.id}" ${cls.lecturerId == l.id ? 'selected' : ''}>${l.name}</option>`).join('');
    
    document.getElementById('editClassClassroom').innerHTML = '<option value="">None</option>' + 
        classrooms.map(r => `<option value="${r.id}" ${cls.classroomId == r.id ? 'selected' : ''}>${r.name}</option>`).join('');
    
    document.getElementById('classEditModal').style.display = 'block';
}

function closeClassEditModal() { document.getElementById('classEditModal').style.display = 'none'; }

function saveClassEdit() {
    const cls = classes.find(c => c.id === editingClassId);
    cls.name = document.getElementById('editClassName').value;
    cls.duration = parseInt(document.getElementById('editClassDuration').value);
    cls.lecturerId = parseInt(document.getElementById('editClassLecturer').value) || null;
    cls.classroomId = parseInt(document.getElementById('editClassClassroom').value) || null;
    saveData(); updateLists(); renderTimetable(); closeClassEditModal();
}

function openEditModal(day, slot) {
    editingDay = day; editingSlot = slot;
    const unplaced = classes.filter(c => !isClassPlaced(c.id));
    const sel = document.getElementById('editClass');
    sel.innerHTML = unplaced.length ? unplaced.map(c => `<option value="${c.id}">${c.name}</option>`).join('') : '<option>No unassigned classes</option>';
    document.getElementById('editModal').style.display = 'block';
}

function closeModal() { document.getElementById('editModal').style.display = 'none'; }

function saveSlotEdit() {
    const cid = parseInt(document.getElementById('editClass').value);
    if (!cid) return;
    timetable[editingDay][editingSlot].push(cid);
    saveData(); renderTimetable(); updateLists(); closeModal();
}

// --- SCHEDULING ---
function generateTimetable() {
    // Reset
    days.forEach(d => slots.forEach(s => timetable[d][s] = []));
    
    // Sort classes by duration (descending) for better packing
    const sortedClasses = [...classes].sort((a,b) => b.duration - a.duration);
    
    sortedClasses.forEach(cls => {
        // Find lecturer
        const availableLecturer = lecturers.find(l => 
            getLecturerWeeklyHours(l.id) + cls.duration <= l.maxWeeklyHours
        );
        if (!availableLecturer) return;
        cls.lecturerId = availableLecturer.id;

        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 50) {
            attempts++;
            const d = days[Math.floor(Math.random() * days.length)];
            const sIdx = Math.floor(Math.random() * slots.length);
            const s = slots[sIdx];
            
            if (cls.duration === 3 && sIdx === 3) continue; // No 3h classes in last slot

            if (isLecturerFree(d, s, cls.lecturerId) && isClassroomFree(d, s, cls.classroomId)) {
                timetable[d][s].push(cls.id);
                if (cls.duration === 3) timetable[d][slots[sIdx + 1]].push(cls.id);
                placed = true;
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
            td.onclick = () => openEditModal(day, slot);
            
            const content = timetable[day][slot].map(cid => {
                const cls = classes.find(c => c.id === cid);
                if (!cls) return '';
                const lec = lecturers.find(l => l.id === cls.lecturerId);
                const room = classrooms.find(r => r.id === cls.classroomId);
                return `<div class="class-block">
                    <span class="code">${cls.name}</span>
                    <span class="lect">${lec ? lec.name : 'No Lec'}</span>
                    <span class="room">${room ? room.name : 'No Room'}</span>
                    <button class="remove-btn" onclick="event.stopPropagation(); removeClassFromSlot('${day}','${slot}',${cid})">×</button>
                </div>`;
            }).join('');
            td.innerHTML = content || '—';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function removeClassFromSlot(day, slot, cid) {
    timetable[day][slot] = timetable[day][slot].filter(id => id !== cid);
    saveData(); renderTimetable(); updateLists();
}

function toggleLock(intake) {
    lockedIntakes[intake] = !lockedIntakes[intake];
    saveData(); updateLists();
}

function deleteUnlockedIntake(intake) {
    if (lockedIntakes[intake]) return alert("Locked!");
    classes = classes.filter(c => c.intake !== intake);
    saveData(); updateLists(); renderTimetable();
}

// Init
updateLists(); renderTimetable();
