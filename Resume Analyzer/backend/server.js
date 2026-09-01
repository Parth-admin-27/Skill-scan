const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/roadmap", require("./routes/roadmap"));
app.use("/api/resume", require("./routes/resume"));

app.listen(3000, () => {
    console.log("Server running on port 3000");
});

