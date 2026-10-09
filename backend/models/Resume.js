const mongoose = require("mongoose");

const ResumeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    jobDescription: {
        type: String,
        default: ""
    },
    fileName: {
        type: String,
        default: "Resume"
    },
    versionNumber: {
        type: Number,
        required: true,
        default: 1
    },
    analysisResult: {
        type: Object,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Resume", ResumeSchema);
