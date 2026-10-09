const express = require("express");
const cors = require("cors");
const supabase = require("./config/supabase");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (req, res) => {
    try {
        await supabase.checkConnection();
        res.json({ status: "ok", database: "supabase" });
    } catch (error) {
        res.status(503).json({ status: "error", message: "Database unavailable" });
    }
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/roadmap", require("./routes/roadmap"));
app.use("/api/resume", require("./routes/resume"));

app.use((error, req, res, next) => {
    console.error("Request error:", error.message);
    res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        error: error.message || "Invalid request"
    });
});

async function startServer() {
    try {
        await supabase.checkConnection();

        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            console.log(`Server running on port ${port} with Supabase`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app;

