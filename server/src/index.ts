import 'dotenv/config';
import { app } from './app.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`[Prasaranam] Server listening on http://localhost:${PORT}`);
  console.log(`[Prasaranam] AI API Key configured: ${Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)}`);
});

