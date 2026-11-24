export default async (req) => {
if (req.method !== "POST") {
return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
status: 405,
headers: { "Content-Type": "application/json" },
});
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
return new Response(
JSON.stringify({ error: "Variable GEMINI_API_KEY manquante sur Netlify" }),
{
status: 500,
headers: { "Content-Type": "application/json" },
}
);
}

try {
const body = await req.json();
const { prompt, imageBase64, mimeType, model = "gemini-2.5-flash" } = body || {};

if (!prompt && !imageBase64) {
return new Response(
JSON.stringify({ error: "Veuillez fournir un texte ou une image." }),
{
status: 400,
headers: { "Content-Type": "application/json" },
}
);
}

const parts = [];
if (prompt) {
parts.push({ text: prompt });
}
if (imageBase64) {
const cleanBase64 = imageBase64.includes(",")
? imageBase64.split(",")[1]
: imageBase64;
parts.push({
inlineData: {
mimeType: mimeType || "image/jpeg",
data: cleanBase64,
},
});
}

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

const geminiResponse = await fetch(url, {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
contents: [{ parts }],
}),
});

const data = await geminiResponse.json();

if (!geminiResponse.ok) {
return new Response(
JSON.stringify({
error: data?.error?.message || "Erreur renvoyée par l'API Gemini",
details: data,
}),
{
status: geminiResponse.status,
headers: { "Content-Type": "application/json" },
}
);
}

const text =
data?.candidates?.[0]?.content?.parts
?.map((p) => p.text || "")
.join("")
.trim() || "";

return new Response(JSON.stringify({ text, raw: data }), {
status: 200,
headers: { "Content-Type": "application/json" },
});
} catch (err) {
return new Response(
JSON.stringify({ error: err?.message || "Erreur interne de la fonction" }),
{
status: 500,
headers: { "Content-Type": "application/json" },
}
);
}
};