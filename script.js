/* ========= Utilities ========= */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const toKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`;
};

function loadEvents(){
  try { return JSON.parse(localStorage.getItem("events_v2") || "[]"); }
  catch { return []; }
}
function saveEvents(list){ localStorage.setItem("events_v2", JSON.stringify(list)); }

function byDateAsc(a,b){
  const A = `${a.date} ${a.time || "00:00"}`;
  const B = `${b.date} ${b.time || "00:00"}`;
  return A.localeCompare(B);
}

function formatDateTime(date, time){
  return time && time.trim()
    ? `${date} \u2022 ${time.trim()}`
    : date;
}

function iconSVG(name){
  if(name === "edit"){
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M16.862 4.487l2.651 2.651m-2.651-2.651L6.75 14.6l-.875 3.525 3.525-.875 10.112-10.113-2.65-2.65z"/>
      </svg>`;
  }
  if(name === "trash"){
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M19 7H5m5 4v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>
      </svg>`;
  }
  return "";
}
function iconBtn(type, onClick){
  const btn = document.createElement("button");
  btn.className = `btn-icon ${type === "edit" ? "btn-edit" : "btn-delete"}`;
  btn.innerHTML = iconSVG(type === "edit" ? "edit" : "trash");
  btn.addEventListener("click", onClick);
  return btn;
}

/* ========= State ========= */
let current = new Date();
let selectedDate = new Date();
let events = loadEvents();

/* ========= DOM ========= */
const monthYear = $("#monthYear");
const calendarBody = $("#calendarBody");
const selectedDateLabel = $("#selectedDateLabel");
const eventList = $("#eventList");
const upcomingList = $("#upcomingEvents");

const prevBtn = $("#prevMonth");
const nextBtn = $("#nextMonth");
const addBtn  = $("#addEventBtn");

const modal = $("#eventModal");
const closeModalBtn = $("#closeModal");
const form = $("#eventForm");
const titleInput = $("#eventTitle");
const dateInput  = $("#eventDate");
const timeInput  = $("#eventTime");
const editingIdInput = $("#editingId");
const modalTitle = $("#modalTitle");

const filterSelect = $("#eventFilter");

/* ========= Init ========= */
function init(){
  if (window.flatpickr){
    flatpickr(timeInput, { enableTime:true, noCalendar:true, dateFormat:"H:i" });
  }

  selectedDateLabel.textContent = toKey(selectedDate).split("-").reverse().join("/");

  renderCalendar();
  renderDayEvents();
  renderUpcoming();

  prevBtn.addEventListener("click", ()=>{ current.setMonth(current.getMonth()-1); renderCalendar(); renderUpcoming(); });
  nextBtn.addEventListener("click", ()=>{ current.setMonth(current.getMonth()+1); renderCalendar(); renderUpcoming(); });

  addBtn.addEventListener("click", openModalForCreate);
  closeModalBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e)=>{ if(e.target === modal) closeModal(); });

  form.addEventListener("submit", handleSave);
  filterSelect.addEventListener("change", renderUpcoming);
}
document.addEventListener("DOMContentLoaded", init);

/* ========= Calendar ========= */
function renderCalendar(){
  const y = current.getFullYear();
  const m = current.getMonth();
  monthYear.textContent = `${monthNames[m]} ${y}`;
  calendarBody.innerHTML = "";

  const first = new Date(y, m, 1);
  const firstWeekday = first.getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();

  let row = document.createElement("tr");
  const today = new Date(); today.setHours(0,0,0,0);

  for(let i=0;i<firstWeekday;i++){
    const td = document.createElement("td");
    td.className = "empty";
    row.appendChild(td);
  }

  for(let d=1; d<=daysInMonth; d++){
    if(row.children.length === 7){ calendarBody.appendChild(row); row = document.createElement("tr"); }

    const td = document.createElement("td");
    td.textContent = d;

    const dayDate = new Date(y, m, d);
    dayDate.setHours(0,0,0,0);
    const key = toKey(dayDate);

    // disable past
    if(dayDate < today){
      td.classList.add("disabled");
    } else {
      td.addEventListener("click", ()=> {
        selectedDate = dayDate;
        selectedDateLabel.textContent = key.split("-").reverse().join("/");
        renderDayEvents();
        [...$$(".calendar-table td")].forEach(c=>c.classList.remove("focused"));
        td.classList.add("focused");
      });
    }

    const todayKey = toKey(new Date());
    if (key === todayKey) td.classList.add("today");

    const hasEvent = events.some(ev => ev.date === key);
    if (hasEvent) td.classList.add("event-day");

    row.appendChild(td);
  }

  while(row.children.length < 7){
    const td = document.createElement("td");
    td.className = "empty";
    row.appendChild(td);
  }
  calendarBody.appendChild(row);
}

/* ========= Day Events ========= */
function renderDayEvents(){
  const key = toKey(selectedDate);
  const dayEvents = events.filter(e => e.date === key).sort(byDateAsc);

  eventList.innerHTML = "";
  if (dayEvents.length === 0){
    const li = document.createElement("li");
    li.className = "no-events";
    li.textContent = "No events planned";
    eventList.appendChild(li);
    return;
  }

  dayEvents.forEach(ev => {
    const li = document.createElement("li");
    const left = document.createElement("div");
    left.innerHTML = `<strong>${ev.title}</strong><br/><small>${formatDateTime(ev.date, ev.time)}</small>`;
    const actions = document.createElement("div");
    actions.className = "event-actions";
    actions.append(
      iconBtn("edit", ()=> openModalForEdit(ev.id)),
      iconBtn("delete", ()=> deleteEvent(ev.id))
    );
    li.append(left, actions);
    eventList.appendChild(li);
  });
}

/* ========= Upcoming ========= */
function renderUpcoming(){
  const mode = filterSelect.value;
  const curYear = current.getFullYear();
  const curMonth = current.getMonth();

  let list = [...events];

  if (mode === "today"){
    const key = toKey(new Date());
    list = list.filter(e => e.date === key);
  } else if (mode === "current-month"){
    const start = `${curYear}-${pad(curMonth+1)}-01`;
    const end   = `${curYear}-${pad(curMonth+1)}-31`;
    list = list.filter(e => e.date >= start && e.date <= end);
  } else if (mode === "next-month"){
    const nm = new Date(curYear, curMonth+1, 1);
    const start = `${nm.getFullYear()}-${pad(nm.getMonth()+1)}-01`;
    const end   = `${nm.getFullYear()}-${pad(nm.getMonth()+1)}-31`;
    list = list.filter(e => e.date >= start && e.date <= end);
  }

  list.sort(byDateAsc);

  upcomingList.innerHTML = "";
  if (list.length === 0){
    const li = document.createElement("li");
    li.className = "no-events";
    li.textContent = "No upcoming events";
    upcomingList.appendChild(li);
    return;
  }

  list.forEach(ev => {
    const li = document.createElement("li");
    const left = document.createElement("div");
    left.innerHTML = `<strong>${ev.title}</strong><br/><small>${formatDateTime(ev.date, ev.time)}</small>`;
    const actions = document.createElement("div");
    actions.className = "event-actions";
    actions.append(
      iconBtn("edit", ()=> openModalForEdit(ev.id)),
      iconBtn("delete", ()=> deleteEvent(ev.id))
    );
    li.append(left, actions);
    upcomingList.appendChild(li);
  });
}

/* ========= Modal / CRUD ========= */
function openModalForCreate(){
  modalTitle.textContent = "Add Event";
  form.reset();
  dateInput.value = toKey(selectedDate);
  dateInput.min = toKey(new Date());  // ⬅️ block past
  editingIdInput.value = "";
  modal.style.display = "block";
  modal.setAttribute("aria-hidden","false");
}
function openModalForEdit(id){
  const ev = events.find(e => e.id === id);
  if(!ev) return;
  modalTitle.textContent = "Edit Event";
  titleInput.value = ev.title;
  dateInput.value  = ev.date;
  dateInput.min    = toKey(new Date()); // ⬅️ block past
  timeInput.value  = ev.time || "";
  editingIdInput.value = ev.id;
  modal.style.display = "block";
  modal.setAttribute("aria-hidden","false");
}
function closeModal(){
  modal.style.display = "none";
  modal.setAttribute("aria-hidden","true");
}
function handleSave(e){
  e.preventDefault();
  const title = titleInput.value.trim();
  const date  = dateInput.value;
  const time  = timeInput.value.trim();
  if(!title || !date) return;

  const editingId = editingIdInput.value;
  if(editingId){
    events = events.map(ev => ev.id === editingId ? { ...ev, title, date, time } : ev);
  }else{
    const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()));
    events.push({ id, title, date, time });
  }
  saveEvents(events);
  closeModal();
  renderCalendar(); renderDayEvents(); renderUpcoming();
}
function deleteEvent(id){
  events = events.filter(e => e.id !== id);
  saveEvents(events);
  renderCalendar(); renderDayEvents(); renderUpcoming();
}
