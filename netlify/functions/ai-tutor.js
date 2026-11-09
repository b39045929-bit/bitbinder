
const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const MODEL = "openrouter/free";

const SYSTEM_PROMPT = `
Kamu adalah BitBinder AI Research Tutor.

IDENTITAS:
Kamu adalah asisten AI untuk belajar pemrograman, teknologi,
sains, riset, dan pengetahuan umum. Kamu membantu pengguna
dari tingkat pemula sampai tingkat lanjut.

BAHASA DAN GAYA:
- Gunakan Bahasa Indonesia secara natural.
- Jawab langsung, jelas, dan tidak bertele-tele.
- Sesuaikan kedalaman penjelasan dengan pertanyaan.
- Jangan mengarang fakta, sumber, atau hasil pengujian.

KEMAMPUAN:
- Menjawab pertanyaan umum dan teknis.
- Menjelaskan HTML, CSS, JavaScript, Python, dan bahasa lain.
- Membantu debugging dan analisis kode.
- Membuat contoh program.
- Menjelaskan cybersecurity defensif, CTF, dan pengujian lab.
- Melakukan riset menggunakan web search jika dibutuhkan.
- Membandingkan informasi dari berbagai sumber.

WEB SEARCH:
- Kamu memiliki akses ke alat web search.
- Gunakan pencarian untuk informasi terbaru, berita,
  dokumentasi, referensi, dan pertanyaan yang membutuhkan
  data dari internet.
- Jangan mengaku telah mencari jika tidak melakukan pencarian.
- Cantumkan sumber yang benar-benar digunakan.
- Bedakan informasi terbaru dengan pengetahuan umum.

FORMAT JAWABAN:
- Gunakan Markdown yang valid.
- Gunakan heading jika diperlukan.
- Gunakan blok kode dengan bahasa yang sesuai.
- Jangan membungkus code block dengan tanda kutip.
- Tampilkan output program secara akurat.
- Jelaskan kesalahan dan solusi secara terstruktur.
- Jangan memotong jawaban di tengah kalimat.

KEAMANAN:
- Bahas topik teknis secara terbuka dan objektif.
- Jangan menolak hanya karena topiknya kompleks atau sensitif.
- Jangan membantu pencurian kredensial, malware, atau
  serangan terhadap sistem tanpa izin.
- Untuk pengujian keamanan, arahkan bantuan pada sistem
  yang dimiliki pengguna atau yang memiliki izin pengujian.

PENTING:
Jangan mengarang hasil pencarian.
Jangan mengarang output program.
Jika tidak mengetahui sesuatu, katakan dengan jujur.
`;

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: HEADERS,
    body: JSON.stringify(data),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      error: "Gunakan metode POST.",
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return jsonResponse(503, {
      error: "OPENROUTER_API_KEY belum diatur di Netlify.",
    });
  }

  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, {
      error: "Format JSON tidak valid.",
    });
  }

  const question = String(body.question || "").trim();
  const code = String(body.code || "");

  if (!question) {
    return jsonResponse(400, {
      error: "Pertanyaan tidak boleh kosong.",
    });
  }

  if (question.length > 6000 || code.length > 15000) {
    return jsonResponse(413, {
      error: "Pertanyaan atau kode terlalu panjang.",
    });
  }

  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content:
        "PERTANYAAN PENGGUNA:\n" +
        question +
        "\n\nKODE PENGGUNA:\n" +
        (code || "(Tidak ada kode yang dilampirkan)"),
    },
  ];

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://bitbinder.netlify.app",
        "X-Title": "BitBinder AI Research Tutor",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,

        // Web search tersedia untuk AI pada setiap pertanyaan.
        // AI menentukan sendiri kapan pencarian diperlukan.
        tools: [
          {
            type: "openrouter:web_search",
          },
        ],

        max_tokens: 2500,
        temperature: 0.7,
      }),
    });

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }

    if (!response.ok) {
      const apiMessage =
        data?.error?.message ||
        `OpenRouter HTTP ${response.status}`;

      let friendlyMessage = apiMessage;

      if (response.status === 401) {
        friendlyMessage =
          "API key OpenRouter tidak valid. Periksa environment variable.";
      } else if (response.status === 402) {
        friendlyMessage =
          "Saldo atau kredit OpenRouter tidak mencukupi.";
      } else if (response.status === 429) {
        friendlyMessage =
          "Batas permintaan tercapai. Coba beberapa saat lagi.";
      } else if (response.status >= 500) {
        friendlyMessage =
          "Layanan AI sedang mengalami gangguan. Coba lagi nanti.";
      }

      return jsonResponse(502, {
        error: friendlyMessage,
        provider_status: response.status,
      });
    }

    const message = data?.choices?.[0]?.message;

    let answer = message?.content || "";

    if (Array.isArray(answer)) {
      answer = answer
        .filter((part) => part.type === "text")
        .map((part) => part.text || "")
        .join("\n");
    }

    if (typeof answer !== "string" || !answer.trim()) {
      return jsonResponse(502, {
        error: "AI tidak mengembalikan jawaban teks.",
      });
    }

    // Ambil sumber web jika disediakan oleh OpenRouter.
    const sources = (message?.annotations || [])
      .filter((item) => item.type === "url_citation")
      .map((item) => ({
        title: item.url_citation?.title || "Sumber",
        url: item.url_citation?.url || "",
      }))
      .filter((item) => item.url);

    return jsonResponse(200, {
      answer: answer.trim(),
      sources,
      model: data?.model || MODEL,
    });

  } catch (error) {
    return jsonResponse(502, {
      error:
        "Tidak dapat menghubungi OpenRouter. Periksa koneksi dan coba lagi.",
    });
  }
};
