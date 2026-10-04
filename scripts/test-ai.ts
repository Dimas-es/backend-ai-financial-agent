import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });

  try {
    const result = await model.generateContent('Halo, tes koneksi 123.');
    console.log('Response:', result.response.text());
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
