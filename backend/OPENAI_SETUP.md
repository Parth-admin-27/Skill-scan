# OpenAI Integration Setup

## How to Enable AI-Powered Roadmaps

The roadmap feature now supports OpenAI integration for generating dynamic, personalized career roadmaps.

### Setup Instructions:

1. **Get an OpenAI API Key:**
   - Go to https://platform.openai.com/api-keys
   - Sign up or log in to your OpenAI account
   - Create a new API key
   - Copy the API key

2. **Add API Key to Environment Variables:**
   - Open `backend/.env` file
   - Replace `your_openai_api_key_here` with your actual OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

3. **Restart the Backend Server:**
   ```bash
   cd "Resume Analyzer/backend"
   node server.js
   ```

### How It Works:

- **With OpenAI API Key:** The system uses GPT-3.5-turbo to generate customized, detailed roadmaps for ANY career path entered by users.
- **Without OpenAI API Key:** The system falls back to predefined roadmaps (for popular careers) or generic roadmaps (for other careers).

### Features:

✅ AI-generated roadmaps tailored to specific careers
✅ 6-8 progressive steps from beginner to expert
✅ Practical, actionable guidance
✅ Automatic fallback to generic roadmaps if API fails
✅ Supports unlimited career paths

### Predefined Roadmaps (No API Key Needed):

- Software Developer
- Data Scientist
- UI/UX Designer
- DevOps Engineer
- Product Manager
- Machine Learning Engineer

### Cost Considerations:

- OpenAI API usage is pay-per-use
- GPT-3.5-turbo is cost-effective (~$0.002 per request)
- Consider implementing caching for frequently requested careers
- Monitor your API usage at https://platform.openai.com/usage

### Security Note:

⚠️ Never commit your `.env` file with real API keys to GitHub!
The `.env` file is already in `.gitignore` to prevent accidental commits.
