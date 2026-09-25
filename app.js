// ============================================================
// Class Attendance & Fee Manager
// Firebase v9 modular SDK (loaded straight from Google's CDN)
// ============================================================

import firebaseConfig from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDocs, setDoc, addDoc, updateDoc,
  deleteDoc, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------- State ----------------
let students = [];   // {id, name, className, contact, monthlyFee}
let attendanceCache = {}; // key `${date}_${studentId}` -> {present}
let feesCache = {};       // key `${studentId}_${month}` -> {amountDue, amountPaid, status}
let unsubStudents = null;

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
  return "Rs. " + Number(n || 0).toLocaleString();
}

// ---------------- Auth ----------------
$("#login-btn").addEventListener("click", async () => {
  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;
  $("#login-error").textContent = "";
  if (!email || !password) {
    $("#login-error").textContent = "Enter both email and password.";
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
    "auth/invalid-email": "That email address looks invalid.",
    "auth/user-not-found": "No account with that email. Create the user in Firebase Console > Authentication.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
  };
  return map[code] || "Could not sign in. Check your Firebase setup.";
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
    if (page === "fees") renderFees();
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
    if ($("#page-fees").classList.contains("active")) renderFees();
  });

  if (!$("#attendance-date").value) $("#attendance-date").value = todayStr();
  if (!$("#fees-month").value) $("#fees-month").value = monthStr();

  renderDashboard();
}

function refreshClassFilters() {
  const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
  [ "#student-class-filter", "#attendance-class-filter", "#fees-class-filter" ].forEach((sel) => {
    const el = $(sel);
    const current = el.value;
    el.innerHTML = '<option value="">All Classes</option>' +
      classes.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    el.value = current;
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
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
    $("#students-table").innerHTML = '<div class="empty-state">No students yet. Click "+ Add Student" to begin.</div>';
    return;
  }

  $("#students-table").innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>Class</th><th>Contact</th><th>Monthly Fee</th><th></th></tr></thead>
      <tbody>
        ${rows.map((s) => `
          <tr>
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.className || "-")}</td>
            <td>${escapeHtml(s.contact || "-")}</td>
            <td>${currency(s.monthlyFee)}</td>
            <td class="row-actions">
              <button class="btn-secondary" onclick="window.__editStudent('${s.id}')">Edit</button>
              <button class="btn-danger" onclick="window.__deleteStudent('${s.id}')">Delete</button>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

$("#student-search").addEventListener("input", renderStudents);
$("#student-class-filter").addEventListener("change", renderStudents);

$("#add-student-btn").addEventListener("click", () => openStudentModal());

window.__editStudent = (id) => openStudentModal(students.find((s) => s.id === id));

window.__deleteStudent = async (id) => {
  if (!confirm("Delete this student? This cannot be undone.")) return;
  await deleteDoc(doc(db, "students", id));
  showToast("Student deleted");
};

function openStudentModal(student) {
  const isEdit = !!student;
  $("#modal-root").innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <h3>${isEdit ? "Edit" : "Add"} Student</h3>
        <label>Full Name</label>
        <input id="m-name" value="${escapeHtml(student?.name || "")}" />
        <label>Class / Grade</label>
        <input id="m-class" value="${escapeHtml(student?.className || "")}" placeholder="e.g. Grade 10 A" />
        <label>Contact (phone/parent)</label>
        <input id="m-contact" value="${escapeHtml(student?.contact || "")}" />
        <label>Monthly Fee (Rs.)</label>
        <input id="m-fee" type="number" value="${student?.monthlyFee ?? ""}" />
        <div class="modal-actions">
          <button class="btn-secondary" id="m-cancel">Cancel</button>
          <button class="btn-primary" id="m-save">Save</button>
        </div>
      </div>
    </div>`;

  $("#m-cancel").addEventListener("click", closeModal);
  $("#m-save").addEventListener("click", async () => {
    const name = $("#m-name").value.trim();
    if (!name) { showToast("Name is required"); return; }
    const data = {
      name,
      className: $("#m-class").value.trim(),
      contact: $("#m-contact").value.trim(),
      monthlyFee: Number($("#m-fee").value) || 0,
    };
    if (isEdit) {
      await updateDoc(doc(db, "students", student.id), data);
      showToast("Student updated");
    } else {
      await addDoc(collection(db, "students"), data);
      showToast("Student added");
    }
    closeModal();
  });
}

function closeModal() { $("#modal-root").innerHTML = ""; }

// ============================================================
// ATTENDANCE
// ============================================================
$("#attendance-date").addEventListener("change", renderAttendance);
$("#attendance-class-filter").addEventListener("change", renderAttendance);

async function renderAttendance() {
  const date = $("#attendance-date").value || todayStr();
  const classFilter = $("#attendance-class-filter").value;

  const q = query(collection(db, "attendance"), where("date", "==", date));
  const snap = await getDocs(q);
  const records = {};
  snap.forEach((d) => { records[d.data().studentId] = { docId: d.id, ...d.data() }; });

  const list = students
    .filter((s) => !classFilter || s.className === classFilter)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (list.length === 0) {
    $("#attendance-list").innerHTML = '<div class="empty-state">No students to show. Add students first.</div>';
    return;
  }

  $("#attendance-list").innerHTML = list.map((s) => {
    const rec = records[s.id];
    const present = rec ? rec.present : null;
    return `
      <div class="attendance-row">
        <div class="name">${escapeHtml(s.name)} <span style="color:var(--muted);font-size:12px;">${escapeHtml(s.className || "")}</span></div>
        <div class="toggle-group">
          <button class="toggle-btn ${present === true ? "present-on" : ""}" onclick="window.__setAttendance('${s.id}','${date}',true)">Present</button>
          <button class="toggle-btn ${present === false ? "absent-on" : ""}" onclick="window.__setAttendance('${s.id}','${date}',false)">Absent</button>
        </div>
      </div>`;
  }).join("");
}

window.__setAttendance = async (studentId, date, present) => {
  const docId = `${date}_${studentId}`;
  const student = students.find((s) => s.id === studentId);
  await setDoc(doc(db, "attendance", docId), {
    studentId, date, present, className: student?.className || ""
  });
  renderAttendance();
  renderDashboard();
};

$("#mark-all-present").addEventListener("click", async () => {
  const date = $("#attendance-date").value || todayStr();
  const classFilter = $("#attendance-class-filter").value;
  const list = students.filter((s) => !classFilter || s.className === classFilter);
  for (const s of list) {
    await setDoc(doc(db, "attendance", `${date}_${s.id}`), {
      studentId: s.id, date, present: true, className: s.className || ""
    });
  }
  showToast("Marked all present");
  renderAttendance();
  renderDashboard();
});

// ============================================================
// FEES
// ============================================================
$("#fees-month").addEventListener("change", renderFees);
$("#fees-class-filter").addEventListener("change", renderFees);

async function renderFees() {
  const month = $("#fees-month").value || monthStr();
  const classFilter = $("#fees-class-filter").value;

  const q = query(collection(db, "fees"), where("month", "==", month));
  const snap = await getDocs(q);
  const records = {};
  snap.forEach((d) => { records[d.data().studentId] = { docId: d.id, ...d.data() }; });

  const list = students
    .filter((s) => !classFilter || s.className === classFilter)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (list.length === 0) {
    $("#fees-table").innerHTML = '<div class="empty-state">No students to show.</div>';
    return;
  }

  $("#fees-table").innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>Class</th><th>Due</th><th>Paid</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${list.map((s) => {
          const rec = records[s.id];
          const due = s.monthlyFee || 0;
          const paid = rec?.amountPaid || 0;
          let status = "due";
          if (paid >= due && due > 0) status = "paid";
          else if (paid > 0) status = "partial";
          return `
            <tr>
              <td>${escapeHtml(s.name)}</td>
              <td>${escapeHtml(s.className || "-")}</td>
              <td>${currency(due)}</td>
              <td>${currency(paid)}</td>
              <td><span class="badge ${status}">${status}</span></td>
              <td class="row-actions">
                <button class="btn-secondary" onclick="window.__recordPayment('${s.id}','${month}')">Record Payment</button>
              </td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

window.__recordPayment = async (studentId, month) => {
  const student = students.find((s) => s.id === studentId);
  const docId = `${studentId}_${month}`;
  const existing = await getDocs(query(collection(db, "fees"), where("studentId", "==", studentId), where("month", "==", month)));
  const currentPaid = existing.empty ? 0 : existing.docs[0].data().amountPaid || 0;

  $("#modal-root").innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <h3>Record Payment — ${escapeHtml(student.name)}</h3>
        <label>Month</label>
        <input value="${month}" disabled />
        <label>Amount Due</label>
        <input value="${currency(student.monthlyFee)}" disabled />
        <label>Total Paid So Far (edit to update)</label>
        <input id="m-paid" type="number" value="${currentPaid}" />
        <div class="modal-actions">
          <button class="btn-secondary" id="m-cancel">Cancel</button>
          <button class="btn-primary" id="m-save">Save</button>
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
    showToast("Payment recorded");
    closeModal();
    renderFees();
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
  const paidByStudent = {};
  feesSnap.forEach((d) => {
    collected += d.data().amountPaid || 0;
    paidByStudent[d.data().studentId] = d.data().amountPaid || 0;
  });
  const totalDue = students.reduce((sum, s) => sum + (s.monthlyFee || 0), 0);
  const outstanding = Math.max(totalDue - collected, 0);

  $("#stat-fees-collected").textContent = currency(collected);
  $("#stat-fees-due").textContent = currency(outstanding);

  const recent = feesSnap.docs
    .map((d) => d.data())
    .sort((a, b) => (b.lastPaymentDate || "").localeCompare(a.lastPaymentDate || ""))
    .slice(0, 8);

  if (recent.length === 0) {
    $("#recent-fees-table").innerHTML = '<div class="empty-state">No fee payments recorded yet this month.</div>';
    return;
  }

  $("#recent-fees-table").innerHTML = `
    <table>
      <thead><tr><th>Student</th><th>Amount Paid</th><th>Date</th></tr></thead>
      <tbody>
        ${recent.map((r) => {
          const s = students.find((st) => st.id === r.studentId);
          return `<tr><td>${escapeHtml(s?.name || "Unknown")}</td><td>${currency(r.amountPaid)}</td><td>${escapeHtml(r.lastPaymentDate || "-")}</td></tr>`;
        }).join("")}
      </tbody>
    </table>`;
}
