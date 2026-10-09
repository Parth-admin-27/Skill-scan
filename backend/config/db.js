const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let memoryServer;

const connectDB = async () => {
    try {
        const connString = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/skillscan";
        // Fail fast (3s) instead of the ~100s default so the in-memory fallback kicks in quickly
        // when no local/remote MongoDB is reachable (this was causing "failed to connect to
        // server" to hang for a long time before falling back).
        await mongoose.connect(connString, process.env.MONGO_URI ? {} : { serverSelectionTimeoutMS: 3000 });

        console.log("MongoDB Connected");
    } catch (error) {
        if (!process.env.MONGO_URI) {
            console.log("MongoDB local server not found. Starting in-memory MongoDB...");
            try {
                memoryServer = await MongoMemoryServer.create();
                const uri = memoryServer.getUri();
                await mongoose.connect(uri);
                console.log("In-memory MongoDB connected");
                return;
            } catch (memoryError) {
                console.error("Unable to start in-memory MongoDB:", memoryError);
            }
        }

        console.log(error);
        process.exit(1);
    }
};

module.exports = connectDB;

