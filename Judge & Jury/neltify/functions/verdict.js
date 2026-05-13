const https = require("https");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { topic, argA, argB } = body;

  if (!argA || !argB) {
    return { statusCode: 400, body: "Missing arguments" };
  }

  const ctx = topic ? `Context: ${topic}\n\n` : "";

  const prompt = `You are a rigorous, impartial arbiter with one core obligation: reach the CORRECT verdict based on the substance of each argument, not how well it is written.

CRITICAL RULES:
1. IGNORE writing quality entirely. Judge the substance, facts, and logic — not the packaging.
2. CORRECT for articulation bias. If one side is less articulate, extract their core claim and evaluate it on its merits.
3. IDENTIFY the actual crux. Strip away emotion and rhetoric. Find the core disagreement and rule on that.
4. CALL OUT weak reasoning on BOTH sides equally.
5. DECLARE a TIE only when genuinely warranted.
6. EXPLAIN your verdict clearly enough that the losing side understands exactly why they lost.

${ctx}SIDE A: "${argA}"

SIDE B: "${argB}"

Respond ONLY with a valid JSON object. No preamble, no markdown fences. Required keys:
- "winner": "A", "B", or "TIE"
- "winner_reason": punchy 8-12 word headline saying who won and why
- "summary": 2-3 sentence executive summary of the verdict
- "score_a": integer 0-100 for substantive strength of Side A
- "score_b": integer 0-100 for substantive strength of Side B
- "analysis_a": 3-5 sentences on Side A — core claim, what supports it, what undermines it, any logical fallacies
- "analysis_b": 3-5 sentences on Side B — core claim, what supports it, what undermines it, any logical fallacies
- "full_analysis": 4 paragraphs. P1: what the dispute is actually about. P2: evaluation of Side A. P3: evaluation of Side B. P4: why the verdict lands where it does and what the loser needed to say to win. Plain text, newline between paragraphs.`;

  const apiKey = process.env.GROQ_API_KEY;

  const requestBody = JSON.stringify({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1500,
    messages: [
      {
        role: "system",
        content: "You are an impartial arbiter. Always respond with valid JSON only — no markdown, no preamble."
      },
      {
        role: "user",
        content: prompt
      }
    ],
  });

  return new Promise((resolve) => {
    const options = {
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(requestBody),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices[0].message.content;
          const clean = text.replace(/```json|```/g, "").trim();
          JSON.parse(clean);
          resolve({
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: clean,
          });
        } catch (err) {
          resolve({
            statusCode: 500,
            body: JSON.stringify({ error: "Parse error", raw: data }),
          });
        }
      });
    });

    req.on("error", (err) => {
      resolve({
        statusCode: 500,
        body: JSON.stringify({ error: err.message }),
      });
    });

    req.write(requestBody);
    req.end();
  });
};
