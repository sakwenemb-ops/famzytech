import "server-only";

type Email = { to: string; subject: string; text: string; html?: string };

/** Sends with Resend when RESEND_API_KEY is set; otherwise logs (development). */
export async function sendEmail(msg: Email) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email:dev] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "LinguaBridge <no-reply@example.com>",
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    }),
  });
  if (!res.ok) throw new Error(`Email send failed: ${res.status}`);
}
