/**
 * Before a first paid lesson, contact details are hidden in messages so lessons and payments
 * stay on the platform (protecting both the student and the teacher).
 */
const PATTERNS: RegExp[] = [
  // email addresses, also written "name at gmail dot com"
  /[\w.+-]+\s*(?:@|\(at\)|\[at\]|\sat\s)\s*[\w-]+\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*[a-z]{2,}/gi,
  // links and web addresses
  /\b(?:https?:\/\/|www\.)\S+/gi,
  /\b[\w-]+\.(?:com|net|org|cm|fr|me|io|co|ly|gl|link)(?:\/\S*)?\b/gi,
  // phone numbers: 8 or more digits, with spaces, dots, dashes or a + in between
  /\+?\d(?:[\s.\-()]*\d){7,}/g,
];
const APPS = /\b(?:whats\s?app|wa\.me|telegram|t\.me|skype|zoom\.us|viber|snapchat|instagram|facebook|messenger)\b/gi;

export const REDACTED = "•••";

export function redactContacts(text: string): { text: string; redacted: boolean } {
  let out = text;
  for (const p of PATTERNS) out = out.replace(p, REDACTED);
  out = out.replace(APPS, REDACTED);
  return { text: out, redacted: out !== text };
}
