# BitBinder — From Indonesian Community

Interactive software developer roadmap with an editable JavaScript playground and optional AI tutor.

## Included
- Cyberpunk BitBinder roadmap UI and progress checklist.
- Editable JavaScript textarea editor.
- Run JavaScript in a sandboxed browser iframe (not a server-side compiler).
- Console output and starter snippets.
- AI tutor Netlify Function using Gemini API.
- API key stays server-side in Netlify environment variables.

## Deploy on Netlify

### Option A — GitHub (recommended)
1. Create a GitHub repository and upload the contents of this folder (keep `index.html`, `netlify.toml`, and `netlify/` at the repository root).
2. In Netlify choose **Add new project → Import an existing project** and select that repository.
3. Build settings:
   - Build command: leave empty
   - Publish directory: `.`
   - Functions directory: `netlify/functions` (normally detected from `netlify.toml`)
4. Deploy the site.

### Enable AI Tutor
1. Create an API key from Google AI Studio: https://aistudio.google.com/app/apikey
2. In Netlify open **Project configuration → Environment variables**.
3. Add `GEMINI_API_KEY` with your secret API key as its value.
4. Trigger a new deploy.
5. Open the deployed site and test the AI Tutor.

Do not put the API key in `index.html`, GitHub, or any public JavaScript file.

## Local development (optional)
Install Node.js and Netlify CLI, then run:
```bash
npm install
npx netlify dev
```
Set `GEMINI_API_KEY` in your local environment before testing the AI function.

## Notes and safety
- JavaScript runs in a sandboxed iframe in the visitor's browser. It is not a general-purpose secure server-side code execution service.
- The AI endpoint sends the user's question and current editor contents to the configured AI provider.
- Add authentication, usage limits, and abuse protection before opening AI access widely; serverless functions can incur provider costs.
- Roadmap completion is saved in each visitor's browser using localStorage, not synced between devices.
