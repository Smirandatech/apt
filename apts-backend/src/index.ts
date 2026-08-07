import app from "./app";

const PORT = Number(process.env.PORT) || 5000;

// Local / Railway: run as a long-lived server.
// Vercel imports `app` via /api and does not use this file.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});
