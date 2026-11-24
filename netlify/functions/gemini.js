exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Méthode non autorisée" }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Clé GEMINI_API_KEY manquante sur Netlify" }),
    };
  }

  async function callGenerateContent(modelName, payload, apiVersion = "v1beta") {
    const cleanModel = String(modelName).replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${cleanModel}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: rawText };
    }

    return { status: response.status, data };
  }

  async function findAvailableGeminiModel() {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
      apiKey
    )}`;
    const res = await fetch(listUrl);
    if (!res.ok) return null;

    const json = await res.json();
    const models = Array.isArray(json.models) ? json.models : [];

    const supported = models.filter(
      (m) =>
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes("generateContent")
    );

    // Prioriser un modèle flash récent si disponible
    const preferred =
      supported.find((m) => /gemini.*flash/i.test(m.name)) || supported[0];

    return preferred ? preferred.name.replace(/^models\//, "") : null;
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};

    let contents = body.contents;
    if (!contents) {
      const parts = [];
      const textInput =
        body.prompt || body.text || body.lessonText || body.message || "";
      const rawImage = body.imageBase64 || body.image || body.base64 || "";
      const mimeType = body.mimeType || body.imageMimeType || "image/jpeg";

      if (rawImage) {
        const cleanBase64 = String(rawImage).replace(
          /^data:[^;]+;base64,/,
          ""
        );
        parts.push({
          inlineData: {
            mimeType,
            data: cleanBase64,
          },
        });
      }

      if (textInput) {
        parts.push({ text: String(textInput) });
      }

      if (parts.length > 0) {
        contents = [{ role: "user", parts }];
      }
    }

    if (!contents) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Paramètre 'contents' manquant",
          receivedKeys: Object.keys(body),
        }),
      };
    }

    const payload = { contents };
    if (body.systemInstruction) payload.systemInstruction = body.systemInstruction;
    if (body.generationConfig) payload.generationConfig = body.generationConfig;

    const candidates = [
      body.model,
      "gemini-3-flash",
      "gemini-3.0-flash",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash",
    ].filter(Boolean);

    let lastResult = null;

    for (const candidate of candidates) {
      const result = await callGenerateContent(candidate, payload, "v1beta");
      lastResult = result;
      if (result.status !== 404) {
        return {
          statusCode: result.status,
          headers,
          body: JSON.stringify(result.data),
        };
      }
    }

    // Si tous les candidats retournent 404, interroger ListModels pour trouver un modèle valide
    const discoveredModel = await findAvailableGeminiModel();
    if (discoveredModel) {
      const fallbackResult = await callGenerateContent(
        discoveredModel,
        payload,
        "v1beta"
      );
      return {
        statusCode: fallbackResult.status,
        headers,
        body: JSON.stringify({
          ...fallbackResult.data,
          _usedModel: discoveredModel,
        }),
      };
    }

    return {
      statusCode: lastResult ? lastResult.status : 404,
      headers,
      body: JSON.stringify(lastResult ? lastResult.data : { error: "Modèle introuvable" }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Erreur serveur interne" }),
    };
  }
};
