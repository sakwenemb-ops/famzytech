import "server-only";

/** Sends with Africa's Talking when AT_API_KEY is set; otherwise logs (development). */
export async function sendSms(to: string, text: string) {
  const key = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;
  if (!key || !username) {
    console.info(`[sms:dev] to=${to}\n${text}`);
    return;
  }
  const host = username === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
  const body = new URLSearchParams({ username, to, message: text });
  if (process.env.AT_SENDER_ID) body.set("from", process.env.AT_SENDER_ID);
  const res = await fetch(`https://${host}/version1/messaging`, {
    method: "POST",
    headers: { apiKey: key, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`SMS send failed: ${res.status}`);
}
