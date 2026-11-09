
const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed." }),
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: "OPENROUTER_API_KEY belum diatur di Netlify.",
      }),
    };
  }

  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "JSON tidak valid." }),
    };
  }

  const question = String(body.question || "").trim();
  const code = String(body.code || "");

  if (!question) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Pertanyaan tidak boleh kosong." }),
    };
  }

  if (question.length > 3000 || code.length > 12000) {
    return {
      statusCode: 413,
      headers,
      body: JSON.stringify({ error: "Input terlalu panjang." }),
    };
  }

  // Web search hanya aktif jika pertanyaan meminta pencarian/info terbaru.
  const wantsSearch =
    /\b(cari|search|telusuri|sumber|referensi|berita|terbaru|terkini|hari ini|sekarang|update|harga saat ini)\b/i
      .test(question);

  const messages = [
    {
      role: "system",
      content:
        "Kamu adalah BitBinder AI Tutor, asisten pemrograman ramah untuk pemula Indonesia. Jawab dalam Bahasa Indonesia yang jelas. Jelaskan bertahap, berikan contoh kode jika relevan, dan jangan mengarang fakta atau hasil eksekusi kode. Jika tersedia hasil pencarian web, gunakan dan cantumkan sumbernya.",
    },
    {
      role: "user",
      content:
        question +
        "\n\nKode JavaScript pengguna:\n" +
        (code || "(tidak ada kode)"),
    },
  ];

  try {
    const requestBody = {
      model: "openrouter/free",
      messages,
      max_tokens: 1200,
    };

    if (wantsSearch) {
      requestBody.tools = [
        { type: "openrouter:web_search" },
      ];
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://bitbinder.netlify.app",
          "X-Title": "BitBinder AI Tutor",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const raw = await response.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }

    if (!response.ok) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error:
            data?.error?.message ||
            `OpenRouter gagal dengan HTTP ${response.status}.`,
        }),
      };
    }

    const message = data?.choices?.[0]?.message;
    let answer = message?.content || "";

    if (Array.isArray(answer)) {
      answer = answer
        .filter((part) => part.type === "text")
        .map((part) => part.text || "")
        .join("\n");
    }

    if (!answer.trim()) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "Model tidak mengembalikan jawaban teks.",
        }),
      };
    }

    const sources = (message?.annotations || [])
      .filter((item) => item.type === "url_citation")
      .map((item) => ({
        title: item.url_citation?.title || "Sumber",
        url: item.url_citation?.url || "",
      }))
      .filter((item) => item.url);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ answer, sources }),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error: error.message || "Tidak dapat menghubungi OpenRouter.",

      }),
    };
  }
};
