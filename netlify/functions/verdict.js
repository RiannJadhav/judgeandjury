exports.handler = async function (event) {
  // Only allow POST
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

CRITICAL RULES you must follow before analysing anything:

1. IGNORE writing quality entirely. Do not reward eloquence, length, vocabulary, or structure. A short, blunt argument can be completely correct. A long, articulate argument can be entirely wrong. Judge the substance — the facts, reasoning, and logic — not the packaging.

2. CORRECT for articulation bias. If one side is clearly less articulate, actively ask yourself: "What are they actually saying beneath the surface?" Extract their core claim and evaluate it on its merits. A poorly worded argument that is fundamentally right must beat a beautifully written argument that is fundamentally wrong.

3. IDENTIFY the actual crux. What is this dispute really about? Strip away emotion, framing, and rhetoric from both sides. Find the core factual or moral disagreement and rule on that.

4. CALL OUT weak reasoning on BOTH sides equally. If Side A makes a logical fallacy, name it. If Side B makes one, name it too. Do not go easier on the winning side.

5. DECLARE a TIE only when genuinely warranted — when both sides have equal merit on the core issue after honest evaluation. Do not use TIE to avoid making a hard call.

6. EXPLAIN your verdict clearly enough that the losing side understands exactly why they lost and what would have changed the outcome.

${ctx}SIDE A: "${argA}"

SIDE B: "${argB}"

Respond ONLY with a valid JSON object. No preamble, no markdown fences. Required keys:
- "winner": "A", "B", or "TIE"
- "winner_reason": punchy 8-12 word headline saying who won and why
- "summary": 2-3 sentence executive summary of the verdict — lead with the core reason, not a description of the arguments
- "score_a": integer 0-100 reflecting the substantive strength of Side A's position (not their writing)
- "score_b": integer 0-100 reflecting the substantive strength of Side B's position (not their writing)
- "analysis_a": 3-5 sentences on Side A — what their core claim actually is, what supports it, what undermines it, any logical fallacies
- "analysis_b": 3-5 sentences on Side B — what their core claim actually is, what supports it, what undermines it, any logical fallacies
- "full_analysis": 3-4 paragraphs of thorough deliberation. Paragraph 1: what the dispute is actually about at its core. Paragraph 2: evaluation of Side A's substantive position. Paragraph 3: evaluation of Side B's substantive position. Paragraph 4: why the verdict lands where it does, and what the losing side would have needed to say to win. Plain text, newline between paragraphs.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic error:", data);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "AI request failed", detail: data }),
      };
    }

    const text = (data.content || []).map((b) => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();

    // Validate it's parseable JSON before sending back
    JSON.parse(clean);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: clean,
    };
  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
