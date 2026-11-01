# 🏥 RMCH Student Hub

**The ultimate digital companion for RMCH medical students.**

Welcome to the **RMCH Student Hub**, a comprehensive progressive web application (PWA) designed to streamline your academic life and campus experience. Built with a stunning "Liquid Glass" aesthetic, this app brings everything a medical student needs into one fluid, beautiful interface.

---

## ✨ Key Features

### 📊 Smart Attendance Manager
Never worry about falling below 75% again.
* **Theory vs. Practical:** Track attendance separately for every subject.
* **Smart Calculator:** Instantly see how many classes you can safely "bunk" or how many you need to attend to reach the safe zone.
* **Visual Indicators:** Color-coded stats (Green for Safe, Red for Danger) with real-time sync status.

### 🤝 Peer-to-Peer Book Renting
A convenient campus sharing platform for medical textbooks.
* **Easy Listing:** List physical books for rent with daily/weekly/monthly/flat rates and UPI ID.
* **Request Board:** Manage borrow requests, negotiate prices, and approve handovers.
* **Student Verified:** Internal profiles ensure trust within the campus.

### ❄️ The Chill Zone
The campus social pulse.
* **Anonymous Confessions:** Share your thoughts freely without revealing your identity.
* **Identity Toggle:** Choose to post as "Anonymous" or display your username and avatar.
* **Interactive Community:** Like posts, reply to threads, and engage with your peers.
* **Safety First:** Built-in reporting system and moderation tools.

### 📚 Digital Library
A pocket-sized repository of knowledge.
* **Quick Search:** Find books by title, author, or subject instantly.
* **Subject Filters:** Narrow down resources by MBBS year or specialty.
* **Personal Bookmarks:** Save textbooks and notes to your profile for offline reference.

### 🎨 Stunning UI/UX & PWA
* **Liquid Glass Theme:** Modern frosted-glass interface that adapts cleanly to any device.
* **Dark & Light Modes:** Switch seamlessly between "Deep Ocean" (Dark) and "Clear Water" (Light) modes.
* **Installable PWA:** Full native app experience on Android Chrome and iOS Safari with offline fallback caching and safe-area inset support.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on Node 22)
- npm 9+

### Installation
```bash
git clone https://github.com/rimtmch/studenthub.git
cd studenthub
npm install
```

### Environment Variables
Copy the template file:
```bash
cp .env.example .env
```
Populate `.env` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-publishable-key
```
*(If left unset during local development, safe publishable fallbacks are used automatically).*

### Local Development
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### Code Quality & Verification
```bash
npm run lint    # ESLint check (0 errors, 0 warnings enforced)
npm run build   # TypeScript compilation + Vite production bundle
npm run preview # Preview the production build locally
```

---

## 🌐 GitHub Pages Deployment

The repository is configured for relative base deployment (`./`) and uses `HashRouter` (`/#/`), allowing it to run smoothly on GitHub Pages without requiring server-side fallback rules.

1. Ensure the `homepage` in `package.json` matches your target URL:
   ```json
   "homepage": "https://rimtmch.github.io/studenthub"
   ```
2. Build and publish directly to the `gh-pages` branch:
   ```bash
   npm run deploy
   ```
3. In your GitHub repository settings under **Pages**, ensure the Source is set to **Deploy from a branch** and select the `gh-pages` branch.

---

## 📱 PWA Installation Guide

- **Android (Chrome / Edge / Samsung Internet):**
  1. Open the website in Chrome.
  2. Tap the banner or the top-right menu (⋮) -> **"Install app"** or **"Add to Home screen"**.
  3. The app will launch in full-screen standalone mode with native taskbar integration.

- **iPhone & iPad (Safari):**
  1. Open the website in Safari.
  2. Tap the **Share** button (box with upward arrow).
  3. Scroll down and tap **"Add to Home Screen"**.
  4. Tap **Add** in the top-right corner. The app will launch without browser chrome, honoring notched and dynamic island safe areas.

---

## 🔒 Privacy & Security
* **Supabase Authentication:** Secure email/password login and OTP recovery.
* **Username Cooldown:** Enforces a 7-day cooldown on username changes to prevent identity fraud and spoofing in the social feed.
* **Safe Session Management:** Persisted sessions with automatic token refresh and clean sign-out.

---

## ❤️ Made by
**RMCH Tech Committee**  
*Designed and developed by students, for students.*
