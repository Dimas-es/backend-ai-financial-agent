import OpenAI from 'openai';
import { getSystemPrompt } from './systemPrompt';
import { db } from '../db';
import { users, categories } from '../db/schema';
import { eq } from 'drizzle-orm';
import { financialTools } from './tools';
import { executeTool } from './toolExecutor';
import 'dotenv/config';

// ──────────────────────────────────────────────
// Inisialisasi OpenRouter (menggunakan OpenAI SDK)
// ──────────────────────────────────────────────
const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.warn('OPENROUTER_API_KEY is not defined in .env. Please set it before using the bot.');
}

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: apiKey || 'dummy-key',
});

// Batas maksimum iterasi Function Call loop
const MAX_TOOL_ITERATIONS = 5;

export async function processMessage(userId: string, userMessage: string): Promise<string> {
  console.log(`\n[AIController] ━━━ Memproses pesan untuk user: ${userId} ━━━`);
  console.log(`[AIController] Pesan: "${userMessage}"`);

  if (!apiKey) {
    return '⚙️ OPENROUTER_API_KEY belum dikonfigurasi di file .env. Mohon isi terlebih dahulu.';
  }

  try {
    const userRecord = await db.query.users.findFirst({ where: eq(users.id, userId) });
    let basePrompt = getSystemPrompt();

    // Ambil daftar kategori milik user agar AI tidak ngarang
    const userCategories = await db.query.categories.findMany({
      where: eq(categories.userId, userId),
    });

    if (userCategories && userCategories.length > 0) {
      const categoryNames = userCategories.map((c: any) => c.name).join(', ');
      basePrompt += `\n\n[DAFTAR KATEGORI MILIK USER]:\nUser sudah memiliki kategori berikut di databasenya: ${categoryNames}.\nJika transaksi yang disebutkan user cocok, WAJIB gunakan salah satu dari kategori di atas secara sama persis (huruf besar/kecilnya). Jika transaksi tidak cocok dengan kategori manapun, JANGAN membuat kategori baru, melainkan gunakan nama kategori "Lainnya" (atau biarkan kosong).`;
    }

    if (userRecord?.aiPersona) {
      basePrompt += `\n\n[INSTRUKSI KHUSUS DARI PENGGUNA]:\n${userRecord.aiPersona}`;
    }

    // Persiapkan riwayat pesan awal
    const messages: any[] = [
      { role: 'system', content: basePrompt },
      { role: 'user', content: userMessage },
    ];

    let iterationCount = 0;
    
    // Daftar model gratis sebagai fallback (seperti cara kerja 9Router)
    const FREE_MODELS = [
      'google/gemini-1.5-pro:free',
      'google/gemini-1.5-flash:free',
      'meta-llama/llama-3.2-3b-instruct:free',
      'qwen/qwen-2.5-7b-instruct:free',
      'microsoft/phi-3-mini-128k-instruct:free',
      'mistralai/mistral-7b-instruct:free',
      'apodex/apodex-1.1-mini:free',
      'inclusionai/ling-3.0-flash-sante:free'
    ];

    // ──────────────────────────────────────────────
    // Function Call Loop (Multi-Turn)
    // ──────────────────────────────────────────────
    while (iterationCount < MAX_TOOL_ITERATIONS) {
      let response: any = null;
      let usedModel = '';

      // Auto-fallback system
      for (const modelId of FREE_MODELS) {
        try {
          usedModel = modelId;
          response = await openai.chat.completions.create({
            model: modelId,
            messages: messages,
            tools: financialTools as any,
            tool_choice: 'auto',
          });
          // Jika sukses, hentikan loop pencarian model
          break;
        } catch (err: any) {
          if (err?.status === 429 || err?.status === 503 || err?.status === 502 || err?.status === 404 || err?.status === 400) {
            console.warn(`[AIController] Model ${modelId} sedang sibuk/limit/tidak tersedia (Status: ${err?.status}). Mencoba model berikutnya...`);
            continue; // Coba model selanjutnya
          }
          throw err; // Jika error lain (misal API key salah), lempar error
        }
      }

      if (!response) {
        return '⏳ Maaf, semua server AI gratis saat ini sedang sibuk (Full Limit). Mohon coba lagi beberapa menit kemudian ya! 🙏';
      }

      const message = response.choices[0].message;
      messages.push(message);

      // Jika AI membalas teks (tidak memanggil tool lagi)
      if (!message.tool_calls || message.tool_calls.length === 0) {
        const finalReply = message.content || 'Hmm, aku tidak bisa memproses pesanmu. Coba ulangi ya! 🙏';
        console.log(`[AIController] Balasan AI: "${finalReply.substring(0, 100)}..."`);
        return finalReply;
      }

      iterationCount++;
      console.log(`[AIController] Iterasi Function Call #${iterationCount}: ${message.tool_calls.length} tool(s) dipanggil`);

      // Eksekusi semua tool yang dipanggil
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        console.log(`[AIController] → Memanggil tool: ${toolName}`);

        const toolResult = await executeTool(userId, toolName, toolArgs);

        console.log(`[AIController] ← Hasil tool ${toolName}:`, JSON.stringify(toolResult).substring(0, 200));

        // Tambahkan hasil eksekusi tool ke riwayat pesan
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(toolResult),
        });
      }
    }

    console.warn(`[AIController] ⚠️ Mencapai batas iterasi Function Call (${MAX_TOOL_ITERATIONS})`);
    return 'Maaf, prosesnya memakan waktu terlalu lama. Coba ubah pertanyaanmu.';

  } catch (error: any) {
    console.error('[AIController] ❌ Error saat memproses pesan via OpenRouter:', error);
    
    if (error?.status === 429) {
      return '⏳ Maaf, aku sedang sibuk (rate limit OpenRouter). Coba lagi nanti ya!';
    }
    if (error?.status === 402) {
      return '💳 Maaf, saldo (kredit) OpenRouter kamu sepertinya habis. Mohon isi ulang.';
    }

    return 'Maaf, ada gangguan jaringan sementara ke AI. Coba lagi nanti ya! 🙏';
  }
}
