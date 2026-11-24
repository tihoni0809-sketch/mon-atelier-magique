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
