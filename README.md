# Class Attendance & Fee Manager

A simple admin tool for one teacher/school to:
- Log in with an email + password
- Manage a student list (name, class, contact, monthly fee)
- Mark daily attendance per class
- Record fee payments per month and see who's paid/due
- See a quick dashboard of today's attendance and this month's fees

Runs entirely in the browser (no backend server) using **Firebase**
(Authentication + Firestore database) and is meant to be hosted for
free on **GitHub Pages**.

---

## 1. Create your Firebase project

1. Go to https://console.firebase.google.com and click **Add project**.
   Give it any name (e.g. `my-class-manager`) and finish the wizard.
2. In the left sidebar, click **Build > Authentication** → **Get started**.
   Under the **Sign-in method** tab, enable **Email/Password**.
3. Still in Authentication, go to the **Users** tab → **Add user**.
   Create yourself an admin login (this is the email/password you'll
   use to sign in to the app). You can add more teacher accounts later
   the same way.
4. In the left sidebar, click **Build > Firestore Database** → **Create database**.
   Choose a region close to Sri Lanka (e.g. `asia-south1`) and start in
   **production mode**.
5. Go to the **Rules** tab of Firestore and replace the contents with
   what's in `firestore.rules` in this folder, then click **Publish**.
   (This restricts all reads/writes to logged-in users only.)

## 2. Connect the app to your project

1. In the Firebase Console, click the gear icon → **Project settings**.
2. Scroll to **Your apps**, click the `</>` (web) icon, and register a
   nickname (e.g. "Class Manager Web"). You don't need Firebase Hosting.
3. Copy the `firebaseConfig` object it shows you.
4. Open `firebase-config.js` in this folder and paste your values in,
   replacing the placeholders (`YOUR_API_KEY`, etc).

## 3. Put it on GitHub

1. Create a new repository on GitHub (e.g. `class-manager`).
2. Upload all the files in this folder (`index.html`, `style.css`,
   `app.js`, `firebase-config.js`) to that repository — either by
   dragging them into the GitHub web UI, or with git:
   ```bash
   git init
   git add .
   git commit -m "Initial class manager app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/class-manager.git
   git push -u origin main
   ```

## 4. Turn on GitHub Pages (free hosting)

1. In your GitHub repo, go to **Settings > Pages**.
2. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   branch `main`, folder `/ (root)`. Save.
3. After a minute, GitHub gives you a URL like
   `https://YOUR_USERNAME.github.io/class-manager/` — that's your live app.

## 5. Authorize the domain in Firebase

1. Back in Firebase Console → **Authentication > Settings > Authorized domains**,
   click **Add domain** and add your GitHub Pages domain
   (`YOUR_USERNAME.github.io`).
2. Without this step, login will fail with an `auth/unauthorized-domain` error.

---

## Using the app

- **Students** — add each student with their class/grade and monthly fee.
- **Attendance** — pick a date, tap Present/Absent for each student.
  "Mark All Present" is a shortcut for a normal day.
- **Fees** — pick a month, click "Record Payment" on a student to log
  what they've paid; the badge shows Paid / Partial / Due automatically
  based on their monthly fee.
- **Dashboard** — today's attendance counts and this month's fee totals
  at a glance.

## Notes & possible next steps

- Data updates live — if you and another teacher are both logged in,
  you'll both see changes instantly (Firestore real-time sync).
- The Firestore rules in this project allow **any logged-in user** to
  read/write everything, which is fine for one admin. If you add more
  staff accounts later and want to restrict what they can see/edit,
  the rules file is the place to tighten that (e.g. lock it to a
  specific email, or add role fields).
- Everything is plain HTML/CSS/JS with no build step, so you can open
  and edit any file directly and just refresh the page (or re-push to
  GitHub) to see changes.
- If you'd like this translated into Sinhala, or want a printable
  attendance/fee report (PDF), that's a straightforward addition — just ask.
