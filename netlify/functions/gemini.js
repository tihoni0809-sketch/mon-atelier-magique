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
const body = event.body ? JSON.parse(event.body) : {};


let contents = body.contents;
if (!contents) {
const parts = [];
const textInput =
body.prompt || body.text || body.lessonText || body.message || "";
const rawImage = body.imageBase64 || body.image || body.base64 || "";
const mimeType = body.mimeType || body.imageMimeType || "image/jpeg";

if (rawImage) {
const cleanBase64 = String(rawImage).replace(/^data:[^;]+;base64,/, "");
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

const model =
!body.model || body.model === "gemini-2.5-flash"
? "gemini-3.0-flash"
: body.model;

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
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
