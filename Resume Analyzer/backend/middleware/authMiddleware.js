const jwt = require("jsonwebtoken");
require("dotenv").config();

module.exports = function (req, res, next) {
    const authHeader = req.header("Authorization");

    if (!authHeader) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    try {
        const token = authHeader.split(" ")[1]; // Bearer <token>
        if (!token) {
            return res.status(401).json({ message: "Access denied. Token format invalid." });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret_key_123");
        req.user = decoded; // { id: userId, ... }
        next();
    } catch (error) {
        res.status(400).json({ message: "Invalid token." });
    }
};
