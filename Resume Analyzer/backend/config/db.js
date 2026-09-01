const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const connString = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/skillscan";
        await mongoose.connect(connString);

        console.log("MongoDB Connected");
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
};

module.exports = connectDB;

