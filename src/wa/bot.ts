import { makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import fs from 'fs';
import { getOrCreateUser } from '../services/userService';
import { processMessage } from '../ai/aiController';
import { createServer } from '../api/server';

const AUTH_FOLDER = 'auth_info_baileys';

/**
 * Inisialisasi dan jalankan WhatsApp Bot Gateway (Baileys)
 */
export async function startWhatsAppBot() {
  console.log('----------------------------------------------------');
  console.log('🤖 Menyiapkan WhatsApp Bot Gateway...');
  console.log('----------------------------------------------------');

  // 1. Simpan sesi otentikasi di folder 'auth_info_baileys'
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  // 2. Buat socket koneksi Baileys dengan konfigurasi stabil
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }), // Mengabaikan log internal Baileys
    printQRInTerminal: false, // QR ditangani lewat event connection.update
    browser: Browsers.windows('Desktop'),
    syncFullHistory: false, // JANGAN download seluruh riwayat chat lama agar sesi tidak revoked (401)
    generateHighQualityLinkPreview: false,
  });

  // 3. Simpan perubahan kredensial/token secara otomatis
  sock.ev.on('creds.update', saveCreds);

  // 4. Pantau status koneksi (QR Code, Terhubung, atau Terputus)
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📲 SILAKAN SCAN QR CODE DI BAWAH INI DENGAN WHATSAPP:');
      qrcode.generate(qr, { small: true });
      console.log('Buka WhatsApp > Perangkat Tertaut (Linked Devices) > Tautkan Perangkat.\n');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

      console.log(`⚠️ Koneksi terputus. Status code: ${statusCode}. Logged out: ${isLoggedOut}`);

      if (isLoggedOut) {
        console.log('\n⚠️ Sesi WhatsApp sebelumnya telah kedaluwarsa / logout (Error 401).');
        console.log('🧹 Membersihkan folder sesi dan menyiapkan QR Code baru secara otomatis...\n');
        
        try {
          fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        } catch (e) {
          console.error('Gagal menghapus folder auth:', e);
        }

        setTimeout(() => {
          startWhatsAppBot();
        }, 2000);
      } else {
        console.log('🔄 Mencoba menghubungkan kembali dalam 3 detik...');
        setTimeout(() => {
          startWhatsAppBot();
        }, 3000);
      }
    } else if (connection === 'open') {
      console.log('\n✅ BERHASIL TERHUBUNG KE WHATSAPP!');
      console.log('Bot aktif dan siap menerima pesan.\n');
    }
  });

  // Set untuk melacak ID pesan yang dikirim bot (mencegah loop di chat ke diri sendiri)
  const sentMessageIds = new Set<string>();
  const markSentMessage = (id?: string | null) => {
    if (!id) return;
    sentMessageIds.add(id);
    setTimeout(() => sentMessageIds.delete(id), 60000);
  };

  // 5. Listener untuk pesan masuk
  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (m.type !== 'notify') return;

      // Nomor bot sendiri
      const botNumber = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] : '';

      for (const msg of m.messages) {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid.includes('@broadcast') || remoteJid.includes('@newsletter')) continue;

        // Cek pengirim
        const rawNumber = remoteJid.replace(/@s\.whatsapp\.net|@g\.us|@lid/, '').split(':')[0];
        
        // Resolve LID ke nomor HP asli jika memungkinkan
        let whatsappNumber = rawNumber;
        if (remoteJid.endsWith('@lid')) {
          try {
            const lidFile = `${AUTH_FOLDER}/lid-mapping-${rawNumber}_reverse.json`;
            if (fs.existsSync(lidFile)) {
              whatsappNumber = JSON.parse(fs.readFileSync(lidFile, 'utf-8'));
            }
          } catch {}
        }

        // Cek apakah pesan berasal dari fitur "Message yourself" (chat ke nomor sendiri)
        const isSelfChat = !!botNumber && (whatsappNumber === botNumber || rawNumber === botNumber || remoteJid.startsWith(botNumber));

        // Batasi HANYA merespon chat ke diri sendiri (Self Chat)
        if (!isSelfChat) {
          continue;
        }

        // Abaikan jika pesan ini adalah balasan yang baru saja dikirim oleh bot sendiri
        if (msg.key.id && sentMessageIds.has(msg.key.id)) {
          sentMessageIds.delete(msg.key.id);
          continue;
        }

        // Abaikan riwayat pesan lama (> 2 menit lalu) saat baru connect
        const msgTime = Number(msg.messageTimestamp);
        const now = Math.floor(Date.now() / 1000);
        if (msgTime && now - msgTime > 120) continue;

        // Ambil isi teks pesan
        const messageText =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          '';

        const cleanText = messageText.trim();
        if (!cleanText) continue;

        const senderName = isSelfChat ? (sock.user?.name || msg.pushName || 'Saya') : (msg.pushName || 'Pengguna');

        // Task 2.4: Daftarkan nomor ke database jika belum ada
        let user;
        try {
          user = await getOrCreateUser(whatsappNumber, senderName);
        } catch (dbErr) {
          console.error('[DB Error] Gagal mendaftarkan user:', dbErr);
          continue; // Skip pesan ini jika DB error
        }

        console.log(`📩 [Pesan Masuk${isSelfChat ? ' - Self Chat' : ''}] ${senderName} (${whatsappNumber}): "${cleanText}"`);

        // ──────────────────────────────────────────────
        // FASE 4: Proses pesan melalui AI Controller (Gemini)
        // ──────────────────────────────────────────────
        try {
          const aiReply = await processMessage(user.id, cleanText);

          if (aiReply) {
            const sent = await sock.sendMessage(remoteJid, { text: aiReply });
            markSentMessage(sent?.key?.id);
            console.log(`📤 [AI Reply] Balasan terkirim ke ${whatsappNumber} (${aiReply.length} karakter)`);
          }
        } catch (aiErr) {
          console.error('[AI Error] Gagal memproses pesan melalui AI:', aiErr);

          // Fallback: jika AI down, kirim pesan error ramah
          try {
            const sent = await sock.sendMessage(remoteJid, {
              text: 'Maaf, ada gangguan sementara di sistem. Coba kirim pesanmu lagi ya! 🙏',
            });
            markSentMessage(sent?.key?.id);
          } catch (sendErr) {
            console.error('[Send Error] Gagal mengirim pesan fallback:', sendErr);
          }
        }
      }
    } catch (err) {
      console.error('[Bot Error] Terjadi kesalahan saat memproses pesan masuk:', err);
    }
  });
}

// Jalankan API Server dan WhatsApp Bot
async function bootstrap() {
  try {
    const app = createServer();
    const port = process.env.PORT || 4000;
    
    app.listen(port, () => {
      console.log(`🌐 Backend API Server berjalan di http://localhost:${port}`);
    });

    await startWhatsAppBot();
  } catch (err) {
    console.error('Fatal error starting application:', err);
  }
}

bootstrap();
