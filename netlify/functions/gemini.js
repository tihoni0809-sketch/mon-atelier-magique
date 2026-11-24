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

try {
const body = JSON.parse(event.body || "{}");
const contents = body.contents;
const systemInstruction = body.systemInstruction;
const generationConfig = body.generationConfig;

if (!contents) {
return {
statusCode: 400,
headers,
body: JSON.stringify({ error: "Paramètre 'contents' manquant" }),
};
}

const payload = { contents };
if (systemInstruction) payload.systemInstruction = systemInstruction;
if (generationConfig) payload.generationConfig = generationConfig;

const model = body.model || "gemini-3.0-flash";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

const response = await fetch(url, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});

const data = await response.json();

return {
statusCode: response.status,
headers,
body: JSON.stringify(data),
};
} catch (err) {
return {
statusCode: 500,
headers,
body: JSON.stringify({ error: err.message || "Erreur serveur interne" }),
};
}
};
