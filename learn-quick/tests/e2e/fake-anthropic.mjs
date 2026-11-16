/**
 * A stand-in for the Anthropic API during browser tests, so the app's real AI-grading
 * code runs end to end without cost. It answers POST .../v1/messages with a grade:
 * - an answer equal to a reference translation → perfect, no mistakes
 * - an answer containing FAIL_GRADER → HTTP 500 (to test the fallback)
 * - anything else → one mistake on the first two words
 */
import http from "node:http";

const port = Number(process.env.FAKE_ANTHROPIC_PORT ?? 3199);
const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").replace(/[.!?\s]+$/, "").trim();

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (req.method !== "POST" || !req.url.includes("/v1/messages")) {
        res.writeHead(404).end();
        return;
      }
      const body = JSON.parse(raw || "{}");
      const text = String(body.messages?.[0]?.content ?? "");
      const answer = (text.match(/<student_translation>\n([\s\S]*?)\n<\/student_translation>/) ?? [])[1] ?? "";
      const refs = [...text.matchAll(/<reference>([\s\S]*?)<\/reference>/g)].map((m) => m[1]);
      const level = (text.match(/Exercise level: (\w\d)/) ?? [])[1] ?? "B1";
      if (answer.includes("FAIL_GRADER")) {
        res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ type: "error", error: { type: "api_error", message: "fake failure" } }));
        return;
      }
      const perfect = refs.some((r) => norm(r) === norm(answer));
      const grade = perfect
        ? { accuracy: 100, grammar: 100, vocabulary: 100, style: 100, errors: [], correctedText: answer, feedback: "Parfait !", estimatedLevel: level }
        : {
            accuracy: 70, grammar: 50, vocabulary: 80, style: 60,
            errors: [{ excerpt: answer.split(" ").slice(0, 2).join(" "), type: "grammar", explanation: "Explication de test.", suggestion: refs[0]?.split(" ").slice(0, 2).join(" ") ?? "" }],
            correctedText: refs[0] ?? "", feedback: "Bon effort, continuez.", estimatedLevel: level,
          };
      res.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          id: `msg_fake_${Date.now()}`, type: "message", role: "assistant", model: body.model,
          content: [{ type: "text", text: JSON.stringify(grade) }],
          stop_reason: "end_turn", stop_sequence: null, stop_details: null,
          usage: { input_tokens: 100, output_tokens: 80 },
        }),
      );
    });
  })
  .listen(port, () => console.log(`fake Anthropic API on ${port}`));
