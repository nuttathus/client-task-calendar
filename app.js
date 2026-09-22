/**
 * app.js: ระบบจัดการข้อมูลและตารางปฏิทินงานลูกค้า
 */

// ชื่อคีย์สำหรับบันทึกลง LocalStorage
const STORAGE_KEY = 'client_task_calendar_data_v1';
const THEME_KEY = 'client_task_calendar_theme';

// รายชื่อเดือนภาษาไทย
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

// สถานะการแสดงผลปัจจุบัน
let state = {
  currentDate: new Date(), // วันที่ปัจจุบัน
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(), // 0 - 11
  tasks: [],
  searchQuery: '',
  filterStatus: 'all',
  selectedDateForDayModal: null,
  currentTheme: 'light' // 'light' หรือ 'dark'
};

// ข้อมูลตัวอย่างเริ่มต้น (กรณีที่ยังไม่มีข้อมูลในเครื่อง)
const INITIAL_SAMPLE_TASKS = [
  {
    id: 'sample-1',
    title: 'ทำใบเสนอราคาโครงการ 1',
    client: 'ลูกค้าโครงการ 1',
    createdDate: formatDateToISO(new Date()),
    dueDate: '2026-09-30',
    details: '1. รวบรวมเอกสาร BOQ\n2. คำนวณต้นทุนและราคาขาย\n3. จัดทำเอกสารส่งตรวจ',
    status: 'pending',
    priority: 'high'
  },
  {
    id: 'sample-2',
    title: 'ส่งมอบแบบร่างงวดที่ 1',
    client: 'บริษัท เอเชีย คอนสตรัคชั่น จำกัด',
    createdDate: '2026-09-15',
    dueDate: '2026-09-25',
    details: 'ส่งไฟล์ CAD และ PDF ให้ฝ่ายวิศวกรตรวจแบบ',
    status: 'in_progress',
    priority: 'urgent'
  },
  {
    id: 'sample-3',
    title: 'วางบิลค่าบริการประจำเดือน',
    client: 'คุณสมศักดิ์ การค้า',
    createdDate: '2026-09-10',
    dueDate: '2026-09-20',
    details: 'ส่งใบแจ้งหนี้พร้อมใบเสร็จรับเงินทางอีเมล',
    status: 'completed',
    priority: 'normal'
  }
];

// --- Helpers แปลงวันที่ ---
function formatDateToISO(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISODate(dateStr) {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatThaiDateDisplay(dateStr, showYear = true) {
  if (!dateStr) return '-';
  const d = parseISODate(dateStr);
  const day = d.getDate();
  const month = THAI_MONTHS_SHORT[d.getMonth()];
  const yearBe = d.getFullYear() + 543;
  return showYear ? `${day} ${month} ${yearBe}` : `${day} ${month}`;
}

// ตรวจสอบว่างานเกินกำหนดหรือยัง
function isTaskOverdue(task) {
  if (task.status === 'completed') return false;
  const todayStr = formatDateToISO(new Date());
  return task.dueDate < todayStr;
}

// --- การจัดการ LocalStorage ---
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state.tasks = JSON.parse(raw);
    } else {
      state.tasks = [...INITIAL_SAMPLE_TASKS];
      saveTasks();
    }
  } catch (e) {
    console.error('ไม่สามารถโหลดข้อมูลจาก LocalStorage ได้:', e);
    state.tasks = [...INITIAL_SAMPLE_TASKS];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  } catch (e) {
    console.error('ไม่สามารถบันทึกข้อมูลลง LocalStorage ได้:', e);
  }
  render();
}

// --- DOM Elements ---
const calendarGrid = document.getElementById('calendar-grid');
const calendarMonthYear = document.getElementById('calendar-month-year');
const urgentTasksList = document.getElementById('urgent-tasks-list');
const urgentBadgeCount = document.getElementById('urgent-badge-count');

// Stats Elements
const statTotal = document.getElementById('stat-total');
const statPending = document.getElementById('stat-pending');
const statOverdue = document.getElementById('stat-overdue');
const statCompleted = document.getElementById('stat-completed');

// Modal Elements (Add/Edit)
const taskModal = document.getElementById('task-modal');
const modalTitle = document.getElementById('modal-title');
const taskForm = document.getElementById('task-form');
const taskIdInput = document.getElementById('task-id');
const taskTitleInput = document.getElementById('task-title');
const taskClientInput = document.getElementById('task-client');
const taskCreatedDateInput = document.getElementById('task-created-date');
const taskDueDateInput = document.getElementById('task-due-date');
const taskDetailsInput = document.getElementById('task-details');
const taskStatusInput = document.getElementById('task-status');
const taskPriorityInput = document.getElementById('task-priority');
const btnDeleteTask = document.getElementById('btn-delete-task');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const btnOpenAddModal = document.getElementById('btn-open-add-modal');

// Day Detail Modal
const dayDetailModal = document.getElementById('day-detail-modal');
const dayDetailDate = document.getElementById('day-detail-date');
const dayDetailSub = document.getElementById('day-detail-sub');
const dayTasksContainer = document.getElementById('day-tasks-container');
const btnCloseDayModal = document.getElementById('btn-close-day-modal');
const btnAddTaskOnDay = document.getElementById('btn-add-task-on-day');

// Quick Add Bar
const quickInputTitle = document.getElementById('quick-input-title');
const quickInputClient = document.getElementById('quick-input-client');
const quickInputDueDate = document.getElementById('quick-input-duedate');
const btnQuickSubmit = document.getElementById('btn-quick-submit');

// Filters & Search
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');

// Other Buttons
const btnPrevMonth = document.getElementById('btn-prev-month');
const btnNextMonth = document.getElementById('btn-next-month');
const btnToday = document.getElementById('btn-today');
const btnExportData = document.getElementById('btn-export-data');
const btnImportData = document.getElementById('btn-import-data');
const importFileInput = document.getElementById('import-file-input');
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const themeIcon = document.getElementById('theme-icon');

// --- การจัดการ Theme (Dark / Light Mode) ---
function applyTheme(theme) {
  state.currentTheme = theme;
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    if (themeIcon) {
      themeIcon.setAttribute('data-lucide', 'sun');
    }
    if (btnThemeToggle) {
      btnThemeToggle.setAttribute('title', 'เปลี่ยนเป็นโหมดสว่าง (Light Mode)');
    }
  } else {
    document.documentElement.classList.remove('dark');
    if (themeIcon) {
      themeIcon.setAttribute('data-lucide', 'moon');
    }
    if (btnThemeToggle) {
      btnThemeToggle.setAttribute('title', 'เปลี่ยนเป็นโหมดมืด (Dark Mode)');
    }
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    console.error('ไม่สามารถบันทึก Theme ลง LocalStorage ได้:', e);
  }
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function initTheme() {
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem(THEME_KEY);
  } catch (e) {}

  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
}

function toggleTheme() {
  const nextTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
}

// --- Render Logic ---

function getFilteredTasks() {
  return state.tasks.filter(task => {
    // Filter status
    if (state.filterStatus !== 'all') {
      if (state.filterStatus === 'completed' && task.status !== 'completed') return false;
      if (state.filterStatus === 'pending' && task.status !== 'pending') return false;
      if (state.filterStatus === 'in_progress' && task.status !== 'in_progress') return false;
      if (state.filterStatus === 'waiting' && task.status !== 'waiting') return false;
    }
    // Search query
    if (state.searchQuery.trim() !== '') {
      const q = state.searchQuery.toLowerCase();
      const matchTitle = (task.title || '').toLowerCase().includes(q);
      const matchClient = (task.client || '').toLowerCase().includes(q);
      const matchDetails = (task.details || '').toLowerCase().includes(q);
      if (!matchTitle && !matchClient && !matchDetails) return false;
    }
    return true;
  });
}

function render() {
  renderStats();
  renderCalendar();
  renderUrgentList();
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// 1. สรุปสถิติต่างๆ
function renderStats() {
  const total = state.tasks.length;
  const completed = state.tasks.filter(t => t.status === 'completed').length;
  const overdue = state.tasks.filter(t => isTaskOverdue(t)).length;
  const pending = total - completed;

  statTotal.textContent = total;
  statPending.textContent = pending;
  statOverdue.textContent = overdue;
  statCompleted.textContent = completed;
}

// 2. เรนเดอร์ปฏิทินรายเดือน
function renderCalendar() {
  const year = state.viewYear;
  const month = state.viewMonth;
  const thaiYear = year + 543;

  calendarMonthYear.textContent = `${THAI_MONTHS[month]} ${thaiYear} (${year})`;

  calendarGrid.innerHTML = '';

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = อาทิตย์
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const todayStr = formatDateToISO(new Date());
  const filteredTasks = getFilteredTasks();

  // จัดกลุ่มงานตามวันที่กำหนดส่ง (dueDate) และวันที่สั่งงาน (createdDate)
  const tasksByDueDate = {};
  const tasksByCreatedDate = {};

  filteredTasks.forEach(task => {
    if (task.dueDate) {
      tasksByDueDate[task.dueDate] = tasksByDueDate[task.dueDate] || [];
      tasksByDueDate[task.dueDate].push(task);
    }
    if (task.createdDate && task.createdDate !== task.dueDate) {
      tasksByCreatedDate[task.createdDate] = tasksByCreatedDate[task.createdDate] || [];
      tasksByCreatedDate[task.createdDate].push(task);
    }
  });

  // วันของเดือนก่อนหน้า (Padding days)
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevMonthDate = new Date(year, month - 1, dayNum);
    const dateStr = formatDateToISO(prevMonthDate);
    const cell = createCalendarCell(dayNum, dateStr, true, tasksByDueDate[dateStr] || [], tasksByCreatedDate[dateStr] || []);
    calendarGrid.appendChild(cell);
  }

  // วันในเดือนปัจจุบัน
  for (let d = 1; d <= daysInMonth; d++) {
    const currentMonthDate = new Date(year, month, d);
    const dateStr = formatDateToISO(currentMonthDate);
    const isToday = dateStr === todayStr;
    const cell = createCalendarCell(d, dateStr, false, tasksByDueDate[dateStr] || [], tasksByCreatedDate[dateStr] || [], isToday);
    calendarGrid.appendChild(cell);
  }

  // วันของเดือนถัดไป (Padding days ให้ครบตาราง 35 หรือ 42 ช่อง)
  const totalCells = firstDayIndex + daysInMonth;
  const nextMonthPadding = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let d = 1; d <= nextMonthPadding; d++) {
    const nextMonthDate = new Date(year, month + 1, d);
    const dateStr = formatDateToISO(nextMonthDate);
    const cell = createCalendarCell(d, dateStr, true, tasksByDueDate[dateStr] || [], tasksByCreatedDate[dateStr] || []);
    calendarGrid.appendChild(cell);
  }
}

function createCalendarCell(dayNum, dateStr, isOtherMonth, dueTasks, createdTasks, isToday = false) {
  const cell = document.createElement('div');
  cell.className = `calendar-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''}`;
  cell.dataset.date = dateStr;

  const header = document.createElement('div');
  header.className = 'day-header';

  const numSpan = document.createElement('span');
  numSpan.className = 'day-number';
  numSpan.textContent = dayNum;
  header.appendChild(numSpan);

  const totalTasksToday = dueTasks.length + createdTasks.length;
  if (totalTasksToday > 0) {
    const countBadge = document.createElement('span');
    countBadge.className = 'text-[10px] text-slate-400 font-medium';
    countBadge.textContent = `${totalTasksToday} งาน`;
    header.appendChild(countBadge);
  }

  cell.appendChild(header);

  // ส่วนแสดง Task Pills ในช่องวันที่
  const tasksContainer = document.createElement('div');
  tasksContainer.className = 'flex flex-col gap-1 overflow-hidden';

  // แสดงงานที่มีกำหนดส่งในวันนี้ (เด่นชัด)
  dueTasks.slice(0, 3).forEach(task => {
    const pill = document.createElement('div');
    const overdue = isTaskOverdue(task);
    const isCompleted = task.status === 'completed';

    let pillStyle = 'task-pill-due-pending';
    if (isCompleted) {
      pillStyle = 'task-pill-due-completed';
    } else if (overdue) {
      pillStyle = 'task-pill-due-overdue';
    }

    pill.className = `task-pill ${pillStyle}`;
    pill.title = `กำหนดส่ง: ${task.title} (${task.client})`;

    const icon = document.createElement('span');
    icon.innerHTML = isCompleted ? '✓' : (overdue ? '⚠️' : '🕒');
    pill.appendChild(icon);

    const titleText = document.createElement('span');
    titleText.className = 'truncate';
    titleText.textContent = `${task.title} - ${task.client}`;
    pill.appendChild(titleText);

    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(task.id);
    });

    tasksContainer.appendChild(pill);
  });

  // ถ้างวดมีงานมากกว่า 3 งาน ให้แสดงปุ่มดูเพิ่ม
  if (dueTasks.length > 3) {
    const morePill = document.createElement('div');
    morePill.className = 'text-[9px] text-slate-500 font-semibold px-1';
    morePill.textContent = `+ อีก ${dueTasks.length - 3} รายการ...`;
    tasksContainer.appendChild(morePill);
  }

  // แสดงงานที่เริ่ม/สั่งวันนี้ (สีจาง)
  if (dueTasks.length < 2 && createdTasks.length > 0) {
    createdTasks.slice(0, 1).forEach(task => {
      const pill = document.createElement('div');
      pill.className = 'task-pill task-pill-created';
      pill.title = `เริ่ม/สั่งงาน: ${task.title} (${task.client})`;
      pill.innerHTML = `<span class="text-[9px] text-indigo-500 font-semibold">เริ่ม:</span> <span class="truncate">${task.title}</span>`;
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(task.id);
      });
      tasksContainer.appendChild(pill);
    });
  }

  cell.appendChild(tasksContainer);

  // เมื่อคลิกที่ช่องวันที่ ให้เปิดหน้าต่างดูรายละเอียดของวันนั้น
  cell.addEventListener('click', () => {
    openDayDetailModal(dateStr, dueTasks, createdTasks);
  });

  return cell;
}

// 3. เรนเดอร์รายการงานค้างส่ง / ใกล้กำหนดส่ง (Sidebar)
function renderUrgentList() {
  const activeTasks = state.tasks.filter(t => t.status !== 'completed');
  
  // เรียงลำดับ: งานที่เกินกำหนดส่งขึ้นก่อน ตามด้วยงานที่ใกล้ถึงกำหนดส่งที่สุด
  activeTasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  urgentBadgeCount.textContent = activeTasks.length;
  urgentTasksList.innerHTML = '';

  if (activeTasks.length === 0) {
    urgentTasksList.innerHTML = `
      <div class="text-center py-8 text-slate-400 text-xs">
        ไม่มีงานค้างส่งในขณะนี้ 🎉<br>
        <span class="text-[11px] text-slate-300 mt-1 block">กดปุ่ม "+ จดงานใหม่" เพื่อบันทึกงาน</span>
      </div>
    `;
    return;
  }

  activeTasks.forEach(task => {
    const overdue = isTaskOverdue(task);
    const item = document.createElement('div');
    item.className = `p-3 rounded-xl border transition cursor-pointer ${
      overdue 
        ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 hover:border-rose-300 dark:hover:border-rose-800' 
        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-sm'
    }`;

    item.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-1.5">
            ${overdue ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-900/80 text-rose-700 dark:text-rose-200">เกินกำหนด</span>' : ''}
            <span class="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate block">${escapeHtml(task.title)}</span>
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">ลูกค้า: ${escapeHtml(task.client)}</p>
        </div>
        <button class="btn-check-done p-1 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition" title="ทำเครื่องหมายว่าส่งแล้ว">
          <i data-lucide="check-circle" class="w-4 h-4"></i>
        </button>
      </div>

      <div class="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100/80 dark:border-slate-700/80">
        <span class="flex items-center space-x-1 ${overdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}">
          <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
          <span>ส่ง: ${formatThaiDateDisplay(task.dueDate)}</span>
        </span>
        <span class="px-2 py-0.5 rounded text-[10px] font-medium ${getStatusBadgeClass(task.status)}">
          ${getStatusText(task.status)}
        </span>
      </div>
    `;

    // คลิกเพื่อแก้ไข
    item.addEventListener('click', () => {
      openEditModal(task.id);
    });

    // ปุ่มติ๊กส่งเรียบร้อย
    const btnDone = item.querySelector('.btn-check-done');
    btnDone.addEventListener('click', (e) => {
      e.stopPropagation();
      task.status = 'completed';
      saveTasks();
    });

    urgentTasksList.appendChild(item);
  });
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'completed': return 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300';
    case 'in_progress': return 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300';
    case 'waiting': return 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300';
    case 'pending':
    default: return 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300';
  }
}

function getStatusText(status) {
  switch (status) {
    case 'completed': return 'ส่งมอบเรียบร้อย';
    case 'in_progress': return 'กำลังทำ';
    case 'waiting': return 'รอส่งมอบ/รอลูกค้า';
    case 'pending':
    default: return 'รอดำเนินการ';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- Modals Logic ---

// เปิด Modal เพิ่มงานใหม่
function openAddModal(defaultDate = null) {
  modalTitle.innerHTML = `
    <i data-lucide="file-plus" class="w-5 h-5 text-indigo-600"></i>
    <span>จดงาน / กำหนดการใหม่</span>
  `;
  taskForm.reset();
  taskIdInput.value = '';
  
  const todayStr = formatDateToISO(new Date());
  taskCreatedDateInput.value = todayStr;
  taskDueDateInput.value = defaultDate || todayStr;
  taskStatusInput.value = 'pending';
  taskPriorityInput.value = 'normal';
  
  btnDeleteTask.classList.add('hidden');
  taskModal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
  taskTitleInput.focus();
}

// เปิด Modal แก้ไขงาน
function openEditModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  modalTitle.innerHTML = `
    <i data-lucide="file-edit" class="w-5 h-5 text-indigo-600"></i>
    <span>แก้ไขงาน / กำหนดการ</span>
  `;
  taskIdInput.value = task.id;
  taskTitleInput.value = task.title || '';
  taskClientInput.value = task.client || '';
  taskCreatedDateInput.value = task.createdDate || formatDateToISO(new Date());
  taskDueDateInput.value = task.dueDate || '';
  taskDetailsInput.value = task.details || '';
  taskStatusInput.value = task.status || 'pending';
  taskPriorityInput.value = task.priority || 'normal';

  btnDeleteTask.classList.remove('hidden');
  taskModal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeModal() {
  taskModal.classList.add('hidden');
}

// เปิด Modal รายการงานประจำวัน (เมื่อกดที่ช่องปฏิทิน)
function openDayDetailModal(dateStr, dueTasks, createdTasks) {
  state.selectedDateForDayModal = dateStr;
  const thaiDate = formatThaiDateDisplay(dateStr);
  dayDetailDate.textContent = `รายการงานวันที่ ${thaiDate}`;
  
  dayTasksContainer.innerHTML = '';
  const allTasks = [...dueTasks, ...createdTasks];

  if (allTasks.length === 0) {
    dayTasksContainer.innerHTML = `
      <div class="text-center py-6 text-slate-400 text-xs">
        ไม่มีงานที่กำหนดส่งหรือเริ่มในวันนี้
      </div>
    `;
  } else {
    // แสดงรายการงานในวันนั้น
    allTasks.forEach(task => {
      const isDueToday = task.dueDate === dateStr;
      const isCreatedToday = task.createdDate === dateStr;
      const overdue = isTaskOverdue(task);

      const card = document.createElement('div');
      card.className = 'p-3 bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-white dark:hover:bg-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 transition cursor-pointer';
      
      card.innerHTML = `
        <div class="flex items-start justify-between">
          <div class="min-w-0 flex-1">
            <div class="flex items-center space-x-1.5">
              ${isDueToday ? '<span class="text-[10px] bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 font-bold px-1.5 py-0.5 rounded">กำหนดส่ง</span>' : ''}
              ${isCreatedToday && !isDueToday ? '<span class="text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium px-1.5 py-0.5 rounded">เริ่มงาน</span>' : ''}
              <span class="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(task.title)}</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">ลูกค้า: <strong class="text-slate-700 dark:text-slate-200">${escapeHtml(task.client)}</strong></p>
            ${task.details ? `<p class="text-[11px] text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line bg-white/70 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-100 dark:border-slate-700">${escapeHtml(task.details)}</p>` : ''}
          </div>
        </div>

        <div class="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
          <span>สถานะ: <strong class="${task.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}">${getStatusText(task.status)}</strong></span>
          <button class="text-indigo-600 dark:text-indigo-400 font-medium hover:underline text-xs">แก้ไข / ดูรายละเอียด →</button>
        </div>
      `;

      card.addEventListener('click', () => {
        closeDayModal();
        openEditModal(task.id);
      });

      dayTasksContainer.appendChild(card);
    });
  }

  dayDetailModal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeDayModal() {
  dayDetailModal.classList.add('hidden');
}

// --- Event Listeners ---

// 1. ส่งฟอร์ม (บันทึก / แก้ไข)
taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const id = taskIdInput.value;
  const taskData = {
    title: taskTitleInput.value.trim(),
    client: taskClientInput.value.trim(),
    createdDate: taskCreatedDateInput.value,
    dueDate: taskDueDateInput.value,
    details: taskDetailsInput.value.trim(),
    status: taskStatusInput.value,
    priority: taskPriorityInput.value
  };

  if (id) {
    // แก้ไขงานเดิม
    const index = state.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      state.tasks[index] = { ...state.tasks[index], ...taskData };
    }
  } else {
    // สร้างงานใหม่
    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      ...taskData
    };
    state.tasks.push(newTask);
  }

  saveTasks();
  closeModal();
});

// 2. ลบงาน
btnDeleteTask.addEventListener('click', () => {
  const id = taskIdInput.value;
  if (!id) return;
  if (confirm('คุณต้องการลบรายการงานนี้ใช่หรือไม่?')) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveTasks();
    closeModal();
  }
});

// 3. Quick Add Bar ด้านบนปฏิทิน
btnQuickSubmit.addEventListener('click', () => {
  const title = quickInputTitle.value.trim();
  const client = quickInputClient.value.trim();
  const dueDate = quickInputDueDate.value;

  if (!title) {
    alert('กรุณากรอกชื่องาน');
    quickInputTitle.focus();
    return;
  }

  const newTask = {
    id: 'task_' + Date.now(),
    title: title,
    client: client || 'ลูกค้าทั่วไป',
    createdDate: formatDateToISO(new Date()),
    dueDate: dueDate || formatDateToISO(new Date()),
    details: '',
    status: 'pending',
    priority: 'normal'
  };

  state.tasks.push(newTask);
  saveTasks();

  quickInputTitle.value = '';
  quickInputClient.value = '';
  quickInputDueDate.value = '';
});

// 4. ปุ่มเปิด Modal ต่างๆ
btnOpenAddModal.addEventListener('click', () => openAddModal());
btnCloseModal.addEventListener('click', closeModal);
btnCancelModal.addEventListener('click', closeModal);

btnCloseDayModal.addEventListener('click', closeDayModal);
btnAddTaskOnDay.addEventListener('click', () => {
  const targetDate = state.selectedDateForDayModal;
  closeDayModal();
  openAddModal(targetDate);
});

// 5. นำทางปฏิทิน (ก่อนหน้า, ถัดไป, วันนี้)
btnPrevMonth.addEventListener('click', () => {
  state.viewMonth--;
  if (state.viewMonth < 0) {
    state.viewMonth = 11;
    state.viewYear--;
  }
  renderCalendar();
});

btnNextMonth.addEventListener('click', () => {
  state.viewMonth++;
  if (state.viewMonth > 11) {
    state.viewMonth = 0;
    state.viewYear++;
  }
  renderCalendar();
});

btnToday.addEventListener('click', () => {
  const now = new Date();
  state.viewYear = now.getFullYear();
  state.viewMonth = now.getMonth();
  renderCalendar();
});

// 6. การค้นหาและตัวกรอง
searchInput.addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  renderCalendar();
  renderUrgentList();
});

filterStatus.addEventListener('change', (e) => {
  state.filterStatus = e.target.value;
  renderCalendar();
  renderUrgentList();
});

// 7. สำรองข้อมูลเป็นไฟล์ JSON (Export)
btnExportData.addEventListener('click', () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.tasks, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `client_tasks_backup_${formatDateToISO(new Date())}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
});

// 8. นำเข้าข้อมูลจากไฟล์ JSON (Import)
if (btnImportData && importFileInput) {
  btnImportData.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedTasks = JSON.parse(event.target.result);
        if (Array.isArray(importedTasks)) {
          if (confirm(`พบข้อมูลจำนวน ${importedTasks.length} รายการ คุณต้องการนำเข้าข้อมูลชุดนี้ใช่หรือไม่?`)) {
            state.tasks = importedTasks;
            saveTasks();
            alert('นำเข้าข้อมูลสำเร็จเรียบร้อยแล้ว!');
          }
        } else {
          alert('รูปแบบไฟล์ไม่ถูกต้อง กรุณาใช้ไฟล์สำรอง .json ที่ดาวน์โหลดจากระบบ');
        }
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์: ' + err.message);
      }
      importFileInput.value = '';
    };
    reader.readAsText(file);
  });
}

// 9. ปุ่มสลับ Dark / Light Theme
if (btnThemeToggle) {
  btnThemeToggle.addEventListener('click', toggleTheme);
}

// ปิด Modal เมื่อคลิกนอกกล่อง
window.addEventListener('click', (e) => {
  if (e.target === taskModal) closeModal();
  if (e.target === dayDetailModal) closeDayModal();
});

// --- เริ่มต้นการทำงาน (Init) ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadTasks();
  
  // ตั้งค่าวันที่เริ่มต้นสำหรับ Quick Add Bar เป็นวันปัจจุบัน
  quickInputDueDate.value = formatDateToISO(new Date());

  render();
});
