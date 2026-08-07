// Vercel serverless entry — serves Express under /api/*
const app = require("../apts-backend/dist/app");

module.exports = app.default || app;
