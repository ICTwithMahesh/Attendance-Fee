// ============================================================
// Class Attendance & Fee Manager (Sinhala UI)
// Firebase v9 modular SDK, loaded straight from Google's CDN
// ============================================================

import firebaseConfig from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  deleteDoc, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------- State ----------------
let students = [];      // {id, name, className, contact, monthlyFee, createdAt}
let unsubStudents = null;
let selectedFeeStudentId = null;

// ---------------- Helpers ----------------
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStr = () => new Date().toISOString().slice(0, 7);

function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  $("#toast-root").appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function currency(n) {
  return "රු. " + Number(n || 0).toLocaleString();
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function classKey(className) {
  return (className || "default").toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "default";
}

// month range helper: inclusive list of "YYYY-MM" from start to end
function monthsRange(startStr, endStr) {
  if (!startStr) return [endStr];
  const [sy, sm] = startStr.split("-").map(Number);
  const [ey, em] = endStr.split("-").map(Number);
  let d = new Date(sy, sm - 1, 1);
  const end = new Date(ey, em - 1, 1);
  if (d > end) return [endStr];
  const out = [];
  while (d <= end) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

function monthLabel(m) {
  const [y, mo] = m.split("-").map(Number);
  const names = ["ජනවාරි","පෙබරවාරි","මාර්තු","අප්‍රේල්","මැයි","ජූනි","ජූලි","අගෝස්තු","සැප්තැම්බර්","ඔක්තෝබර්","නොවැම්බර්","දෙසැම්බර්"];
  return `${names[mo - 1]} ${y}`;
}

// ---------------- Auth ----------------
$("#login-btn").addEventListener("click", async () => {
  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;
  $("#login-error").textContent = "";
  if (!email || !password) {
    $("#login-error").textContent = "විද්‍යුත් තැපෑල සහ මුරපදය දෙකම ඇතුළත් කරන්න.";
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    $("#login-error").textContent = friendlyAuthError(err.code);
  }
});

function friendlyAuthError(code) {
  const map = {
    "auth/invalid-email": "විද්‍යුත් තැපෑල වැරදියි.",
    "auth/user-not-found": "මෙම විද්‍යුත් තැපෑලෙන් ගිණුමක් නැත. Firebase Console > Authentication හි user කෙනෙක් සාදන්න.",
    "auth/wrong-password": "මුරපදය වැරදියි.",
    "auth/invalid-credential": "විද්‍යුත් තැපෑල හෝ මුරපදය වැරදියි.",
    "auth/too-many-requests": "උත්සාහ කිරීම් වැඩියි. පසුව උත්සාහ කරන්න.",
  };
  return map[code] || "පිවිසීමට නොහැකි විය. Firebase සැකසුම බලන්න.";
}

$("#logout-btn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    $("#login-screen").classList.add("hidden");
    $("#app").classList.remove("hidden");
    $("#current-user-email").textContent = user.email;
    startListeners();
  } else {
    $("#app").classList.add("hidden");
    $("#login-screen").classList.remove("hidden");
    if (unsubStudents) unsubStudents();
  }
});

// ---------------- Navigation ----------------
$all(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    $all(".nav-item").forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
    const page = item.dataset.page;
    $all(".page").forEach((p) => p.classList.remove("active"));
    $(`#page-${page}`).classList.add("active");
    if (page === "attendance") renderAttendance();
    if (page === "fees") renderFeesPage();
    if (page === "dashboard") renderDashboard();
  });
});

// ---------------- Live data ----------------
function startListeners() {
  unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
    students = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    refreshClassFilters();
    renderStudents();
    renderDashboard();
    if ($("#page-attendance").classList.contains("active")) renderAttendance();
    if ($("#page-fees").classList.contains("active")) renderFeesPage();
  });

  if (!$("#attendance-month").value) $("#attendance-month").value = monthStr();
  renderDashboard();
}

function refreshClassFilters() {
  const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
  ["#student-class-filter", "#attendance-class-select"].forEach((sel) => {
    const el = $(sel);
    const current = el.value;
    const placeholder = sel === "#attendance-class-select"
      ? '<option value="">ශ්‍රේණියක් තෝරන්න</option>'
      : '<option value="">සියලුම ශ්‍රේණි</option>';
    el.innerHTML = placeholder +
      classes.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    el.value = current;
  });
}

// ============================================================
// STUDENTS
// ============================================================
function renderStudents() {
  const search = ($("#student-search").value || "").toLowerCase();
  const classFilter = $("#student-class-filter").value;

  const rows = students
    .filter((s) => s.name.toLowerCase().includes(search))
    .filter((s) => !classFilter || s.className === classFilter)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (rows.length === 0) {
    $("#students-table").innerHTML = '<div class="empty-state">තවම සිසුන් නැත. "+ සිසුවෙකු එකතු කරන්න" ක්ලික් කරන්න.</div>';
    return;
  }

  $("#students-table").innerHTML = `
    <div class="card-grid">
      ${rows.map((s) => `
        <div class="data-card">
          <div>
            <div class="card-title">${escapeHtml(s.name)}</div>
            <div class="card-sub">${escapeHtml(s.className || "ශ්‍රේණිය නැත")}</div>
          </div>
          <div class="card-row"><span class="k">දුරකථන අංකය</span><span class="v">${escapeHtml(s.contact || "-")}</span></div>
          <div class="card-row"><span class="k">මාසික ගාස්තුව</span><span class="v">${currency(s.monthlyFee)}</span></div>
          <div class="card-actions">
            <button class="btn-secondary" onclick="window.__editStudent('${s.id}')">සංස්කරණය</button>
            <button class="btn-danger" onclick="window.__deleteStudent('${s.id}')">මකන්න</button>
          </div>
        </div>`).join("")}
    </div>`;
}

$("#student-search").addEventListener("input", renderStudents);
$("#student-class-filter").addEventListener("change", renderStudents);

$("#add-student-btn").addEventListener("click", () => openStudentModal());

window.__editStudent = (id) => openStudentModal(students.find((s) => s.id === id));

window.__deleteStudent = async (id) => {
  if (!confirm("මෙම සිසුවා මකන්නද? මෙය පසුව අවලංගු කළ නොහැක.")) return;
  await deleteDoc(doc(db, "students", id));
  showToast("සිසුවා මකා දමන ලදී");
};

function openStudentModal(student) {
  const isEdit = !!student;
  $("#modal-root").innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <h3>${isEdit ? "සිසුවා සංස්කරණය" : "සිසුවෙකු එකතු කරන්න"}</h3>
        <label>සම්පූර්ණ නම</label>
        <input id="m-name" value="${escapeHtml(student?.name || "")}" />
        <label>ශ්‍රේණිය</label>
        <input id="m-class" value="${escapeHtml(student?.className || "")}" placeholder="උදා: 10 ශ්‍රේණිය A" />
        <label>දුරකථන අංකය (දෙමාපිය/සිසු)</label>
        <input id="m-contact" value="${escapeHtml(student?.contact || "")}" />
        <label>මාසික ගාස්තුව (රු.)</label>
        <input id="m-fee" type="number" value="${student?.monthlyFee ?? ""}" />
        <div class="modal-actions">
          <button class="btn-secondary" id="m-cancel">අවලංගු කරන්න</button>
          <button class="btn-primary" id="m-save">සුරකින්න</button>
        </div>
      </div>
    </div>`;

  $("#m-cancel").addEventListener("click", closeModal);
  $("#m-save").addEventListener("click", async () => {
    const name = $("#m-name").value.trim();
    if (!name) { showToast("නම අවශ්‍යයි"); return; }
    const data = {
      name,
      className: $("#m-class").value.trim(),
      contact: $("#m-contact").value.trim(),
      monthlyFee: Number($("#m-fee").value) || 0,
    };
    if (isEdit) {
      await updateDoc(doc(db, "students", student.id), data);
      showToast("සිසුවාගේ තොරතුරු යාවත්කාලීන කරන ලදී");
    } else {
      data.createdAt = monthStr(); // enrollment month, used for fee pending calculation
      await addDoc(collection(db, "students"), data);
      showToast("සිසුවා එකතු කරන ලදී");
    }
    closeModal();
  });
}

function closeModal() { $("#modal-root").innerHTML = ""; }

// ============================================================
// ATTENDANCE  (up to 5 class-days per month, each with its own date)
// ============================================================
const SESSIONS_PER_MONTH = 5;
let currentSessionDates = ["", "", "", "", ""];
let currentAttendanceMap = {}; // `${studentId}_${session}` -> {present, date}

$("#attendance-class-select").addEventListener("change", renderAttendance);
$("#attendance-month").addEventListener("change", renderAttendance);

async function renderAttendance() {
  const className = $("#attendance-class-select").value;
  const month = $("#attendance-month").value || monthStr();

  if (!className) {
    $("#attendance-sessions-panel").innerHTML = '<div class="empty-state">කරුණාකර ශ්‍රේණියක් තෝරන්න.</div>';
    $("#attendance-table").innerHTML = "";
    return;
  }

  const sessionsId = `${classKey(className)}_${month}`;
  const sessionsSnap = await getDoc(doc(db, "classSessions", sessionsId));
  currentSessionDates = sessionsSnap.exists() && sessionsSnap.data().dates
    ? sessionsSnap.data().dates
    : ["", "", "", "", ""];

  $("#attendance-sessions-panel").innerHTML = `
    <h3>මෙම මාසයේ පන්ති දින (${escapeHtml(className)} — ${monthLabel(month)})</h3>
    <div class="toolbar">
      ${currentSessionDates.map((d, i) => `
        <div>
          <label style="margin:0 0 4px;">${i + 1} වන පන්තිය</label>
          <input type="date" class="session-date-input" data-session="${i}" value="${d || ""}" />
        </div>`).join("")}
    </div>`;

  $all(".session-date-input").forEach((inp) => {
    inp.addEventListener("change", async (e) => {
      const idx = Number(e.target.dataset.session);
      currentSessionDates[idx] = e.target.value;
      await setDoc(doc(db, "classSessions", sessionsId), {
        className, month, dates: currentSessionDates
      }, { merge: true });
      showToast(`${idx + 1} වන පන්තියේ දිනය සුරකින ලදී`);
      renderAttendanceTable(className, month);
    });
  });

  await renderAttendanceTable(className, month);
}

async function renderAttendanceTable(className, month) {
  const q = query(collection(db, "attendance"), where("className", "==", className), where("month", "==", month));
  const snap = await getDocs(q);
  currentAttendanceMap = {};
  snap.forEach((d) => {
    const data = d.data();
    currentAttendanceMap[`${data.studentId}_${data.session}`] = data;
  });

  const list = students
    .filter((s) => s.className === className)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (list.length === 0) {
    $("#attendance-table").innerHTML = '<div class="empty-state">මෙම ශ්‍රේණියේ සිසුන් නැත.</div>';
    return;
  }

  $("#attendance-table").innerHTML = `
    <div class="card-grid">
      ${list.map((s) => `
        <div class="data-card">
          <div class="card-title">${escapeHtml(s.name)}</div>
          <div class="session-chips">
            ${currentSessionDates.map((d, i) => {
              const rec = currentAttendanceMap[`${s.id}_${i + 1}`];
              const present = rec ? rec.present : null;
              if (!d) {
                return `<div class="session-chip disabled">
                  <span class="session-num">${i + 1} වන පන්තිය</span>
                  <span class="session-date">දිනය සකසන්න</span>
                </div>`;
              }
              return `<div class="session-chip">
                <span class="session-num">${i + 1} වන පන්තිය <span class="session-date">${d}</span></span>
                <div class="toggle-group">
                  <button class="toggle-btn ${present === true ? "present-on" : ""}" onclick="window.__setAttendance('${s.id}','${className}','${month}',${i + 1},'${d}',true)">✓</button>
                  <button class="toggle-btn ${present === false ? "absent-on" : ""}" onclick="window.__setAttendance('${s.id}','${className}','${month}',${i + 1},'${d}',false)">✗</button>
                </div>
              </div>`;
            }).join("")}
          </div>
        </div>`).join("")}
    </div>`;
}

window.__setAttendance = async (studentId, className, month, session, date, present) => {
  const docId = `${studentId}_${month}_${session}`;
  await setDoc(doc(db, "attendance", docId), {
    studentId, className, month, session, date, present
  });
  renderAttendanceTable(className, month);
  renderDashboard();
};

// ============================================================
// FEES  (search a student, see pending months, record payments)
// ============================================================
$("#fees-search").addEventListener("input", () => {
  const term = $("#fees-search").value.trim().toLowerCase();
  if (!term) { $("#fees-search-results").innerHTML = ""; return; }
  const matches = students.filter((s) => s.name.toLowerCase().includes(term)).slice(0, 8);
  if (matches.length === 0) {
    $("#fees-search-results").innerHTML = '<div class="empty-state">සිසුවෙක් හමු නොවීය.</div>';
    return;
  }
  $("#fees-search-results").innerHTML = `
    <div class="card-grid" style="margin-bottom:20px;">
      ${matches.map((s) => `
        <div class="data-card" style="cursor:pointer;" onclick="window.__selectFeeStudent('${s.id}')">
          <div class="card-title">${escapeHtml(s.name)}</div>
          <div class="card-sub">${escapeHtml(s.className || "ශ්‍රේණිය නැත")}</div>
          <div class="card-row"><span class="k">මාසිකව</span><span class="v">${currency(s.monthlyFee)}</span></div>
        </div>`).join("")}
    </div>`;
});

window.__selectFeeStudent = (id) => {
  selectedFeeStudentId = id;
  $("#fees-search-results").innerHTML = "";
  $("#fees-search").value = students.find((s) => s.id === id)?.name || "";
  renderFeeDetail(id);
};

function renderFeesPage() {
  if (selectedFeeStudentId) renderFeeDetail(selectedFeeStudentId);
}

async function renderFeeDetail(studentId) {
  const student = students.find((s) => s.id === studentId);
  if (!student) { $("#fees-detail").innerHTML = ""; return; }

  const feesSnap = await getDocs(query(collection(db, "fees"), where("studentId", "==", studentId)));
  const feeMap = {};
  feesSnap.forEach((d) => { feeMap[d.data().month] = d.data(); });

  const months = monthsRange(student.createdAt, monthStr()).reverse(); // most recent first
  const due = student.monthlyFee || 0;

  let pendingMonths = 0;
  let pendingTotal = 0;
  const rows = months.map((m) => {
    const rec = feeMap[m];
    const paid = rec?.amountPaid || 0;
    let status = "due";
    if (due === 0) status = "paid";
    else if (paid >= due) status = "paid";
    else if (paid > 0) status = "partial";
    if (status !== "paid") { pendingMonths++; pendingTotal += Math.max(due - paid, 0); }
    return { month: m, due, paid, status };
  });

  $("#fees-detail").innerHTML = `
    <div class="panel">
      <h3>${escapeHtml(student.name)} <span style="color:var(--muted);font-weight:400;font-size:13px;">(${escapeHtml(student.className || "-")})</span></h3>
      <div class="stat-grid" style="margin-top:14px;">
        <div class="stat-card">
          <div class="label">පොරොත්තු මාස ගණන</div>
          <div class="value ${pendingMonths > 0 ? "danger" : "green"}">${pendingMonths}</div>
        </div>
        <div class="stat-card">
          <div class="label">මුළු පොරොත්තු ගාස්තුව</div>
          <div class="value ${pendingTotal > 0 ? "danger" : "green"}">${currency(pendingTotal)}</div>
        </div>
        <div class="stat-card">
          <div class="label">මාසික ගාස්තුව</div>
          <div class="value">${currency(due)}</div>
        </div>
      </div>
    </div>
    <div class="panel">
      <h3>මාස අනුව ගාස්තු</h3>
      <div class="card-grid">
        ${rows.map((r) => `
          <div class="data-card">
            <div class="card-title">${monthLabel(r.month)}</div>
            <div class="card-row"><span class="k">ගෙවිය යුතු</span><span class="v">${currency(r.due)}</span></div>
            <div class="card-row"><span class="k">ගෙවා ඇත</span><span class="v">${currency(r.paid)}</span></div>
            <div><span class="badge ${r.status}">${r.status === "paid" ? "ගෙවා ඇත" : r.status === "partial" ? "අර්ධ වශයෙන්" : "පොරොත්තු"}</span></div>
            <div class="card-actions">
              <button class="btn-secondary" onclick="window.__recordPayment('${studentId}','${r.month}')">ගෙවීම වාර්තා කරන්න</button>
            </div>
          </div>`).join("")}
      </div>
    </div>`;
}

window.__recordPayment = async (studentId, month) => {
  const student = students.find((s) => s.id === studentId);
  const docId = `${studentId}_${month}`;
  const existing = await getDoc(doc(db, "fees", docId));
  const currentPaid = existing.exists() ? existing.data().amountPaid || 0 : 0;

  $("#modal-root").innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <h3>ගෙවීම වාර්තා කරන්න — ${escapeHtml(student.name)}</h3>
        <label>මාසය</label>
        <input value="${monthLabel(month)}" disabled />
        <label>ගෙවිය යුතු මුදල</label>
        <input value="${currency(student.monthlyFee)}" disabled />
        <label>මුළු ගෙවූ මුදල (යාවත්කාලීන කිරීමට වෙනස් කරන්න)</label>
        <input id="m-paid" type="number" value="${currentPaid}" />
        <div class="modal-actions">
          <button class="btn-secondary" id="m-cancel">අවලංගු කරන්න</button>
          <button class="btn-primary" id="m-save">සුරකින්න</button>
        </div>
      </div>
    </div>`;

  $("#m-cancel").addEventListener("click", closeModal);
  $("#m-save").addEventListener("click", async () => {
    const amountPaid = Number($("#m-paid").value) || 0;
    await setDoc(doc(db, "fees", docId), {
      studentId, month, amountPaid,
      amountDue: student.monthlyFee || 0,
      lastPaymentDate: todayStr(),
    });
    showToast("ගෙවීම වාර්තා කරන ලදී");
    closeModal();
    renderFeeDetail(studentId);
    renderDashboard();
  });
};

// ============================================================
// DASHBOARD
// ============================================================
async function renderDashboard() {
  $("#stat-total-students").textContent = students.length;

  const date = todayStr();
  const attSnap = await getDocs(query(collection(db, "attendance"), where("date", "==", date)));
  let present = 0, absent = 0;
  attSnap.forEach((d) => d.data().present ? present++ : absent++);
  $("#stat-present-today").textContent = present;
  $("#stat-absent-today").textContent = absent;

  const month = monthStr();
  const feesSnap = await getDocs(query(collection(db, "fees"), where("month", "==", month)));
  let collected = 0;
  feesSnap.forEach((d) => { collected += d.data().amountPaid || 0; });
  $("#stat-fees-collected").textContent = currency(collected);

  // Total pending across ALL students, ALL months since enrollment
  const allFeesSnap = await getDocs(collection(db, "fees"));
  const feeMap = {};
  allFeesSnap.forEach((d) => {
    const f = d.data();
    feeMap[`${f.studentId}_${f.month}`] = f.amountPaid || 0;
  });

  let totalPending = 0;
  let pendingStudentCount = 0;
  students.forEach((s) => {
    const due = s.monthlyFee || 0;
    if (due <= 0) return;
    const months = monthsRange(s.createdAt, month);
    let studentPending = 0;
    months.forEach((m) => {
      const paid = feeMap[`${s.id}_${m}`] || 0;
      if (paid < due) studentPending += (due - paid);
    });
    if (studentPending > 0) { totalPending += studentPending; pendingStudentCount++; }
  });

  $("#stat-fees-due").textContent = currency(totalPending);
  $("#stat-pending-students").textContent = pendingStudentCount;

  const recent = feesSnap.docs
    .map((d) => d.data())
    .sort((a, b) => (b.lastPaymentDate || "").localeCompare(a.lastPaymentDate || ""))
    .slice(0, 8);

  if (recent.length === 0) {
    $("#recent-fees-table").innerHTML = '<div class="empty-state">මෙම මාසයේ තවම ගාස්තු ගෙවීම් වාර්තා වී නැත.</div>';
    return;
  }

  $("#recent-fees-table").innerHTML = `
    <div class="card-grid">
      ${recent.map((r) => {
        const s = students.find((st) => st.id === r.studentId);
        return `
          <div class="data-card">
            <div class="card-title">${escapeHtml(s?.name || "නොදන්නා")}</div>
            <div class="card-row"><span class="k">ගෙවූ මුදල</span><span class="v">${currency(r.amountPaid)}</span></div>
            <div class="card-row"><span class="k">දිනය</span><span class="v">${escapeHtml(r.lastPaymentDate || "-")}</span></div>
          </div>`;
      }).join("")}
    </div>`;
}
