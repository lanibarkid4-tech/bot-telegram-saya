// ======================================================
//  🤖 BOT TELEGRAM UNTUK PEMULA
// ======================================================
//  File ini adalah kode utama bot Anda.
//  Setiap baris sudah diberi penjelasan agar mudah dipahami.
// ======================================================

// 1️⃣  LOAD DOTENV - Untuk membaca file .env (isi token)
require('dotenv').config();

// 2️⃣  IMPORT LIBRARY TELEGRAM - Untuk komunikasi dengan Telegram
const TelegramBot = require('node-telegram-bot-api');

// 3️⃣  AMBIL TOKEN DARI FILE .env
//     Token ini seperti "password" bot Anda. Jangan share ke orang lain!
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// 4️⃣  CEK APAKAH TOKEN SUDAH DIISI
if (!TOKEN) {
  // Kalau token belum diisi, tampilkan pesan error dan hentikan program
  console.log('========================================');
  console.log('❌ TOKEN BELUM DIISI!');
  console.log('========================================');
  console.log('Cara memperbaiki:');
  console.log('1. Buka file .env di folder ini');
  console.log('2. Isi TELEGRAM_BOT_TOKEN dengan token dari BotFather');
  console.log('3. Jalankan ulang: npm start');
  console.log('========================================');
  process.exit(1); // hentikan program
}

// 5️⃣  BUAT BOT BARU dengan metode POLLING
//     Polling = bot cek Telegram secara berkala apakah ada pesan baru
const bot = new TelegramBot(TOKEN, { polling: true });

// 6️⃣  TAMPILKAN PESAN DI CONSOLE bahwa bot sudah jalan
console.log('========================================');
console.log('✅ BOT BERHASIL DIJALANKAN!');
console.log('🤖 Bot siap menerima pesan...');
console.log('⏰ Waktu: ' + new Date().toLocaleString());
console.log('========================================');
console.log('💡 Tekan CTRL + C untuk mematikan bot');

// ======================================================
//  PERINTAH /start
// ======================================================
//  Ini artinya: ketika user ketik /start, bot akan balas pesan ini
bot.onText(/\/start/, (pesan) => {
  // Ambil ID chat user (semacam "alamat" user di Telegram)
  const chatId = pesan.chat.id;

  // Ambil nama depan user, kalau gak ada default "Sahabat"
  const nama = pesan.from.first_name || 'Sahabat';

  // Pesan yang akan dikirim ke user
  const teksBalasan = `
Halo ${nama}! 👋

Selamat datang di Bot Telegram saya!

Saya bot yang siap membantu Anda 24 jam.

📌 PERINTAH YANG TERSEDIA:
/start - Tampilkan pesan ini
/help  - Bantuan
/halo  - Sapa bot
/info  - Info tentang Anda
/jam   - Lihat jam sekarang
/quote - Quote motivasi

Silakan coba salah satu perintah di atas! 😊
  `;

  // Kirim pesan ke user
  bot.sendMessage(chatId, teksBalasan);

  // Catat di console bahwa ada user baru
  console.log(`📩 User baru: ${nama} (ID: ${chatId})`);
});

// ======================================================
//  PERINTAH /help
// ======================================================
bot.onText(/\/help/, (pesan) => {
  const chatId = pesan.chat.id;

  const teksBantuan = `
📚 BANTUAN

Berikut perintah yang bisa Anda gunakan:

/start  - Pesan pembuka
/help   - Tampilkan bantuan ini
/halo   - Sapa bot
/info   - Lihat info akun Telegram Anda
/jam    - Lihat waktu sekarang
/quote  - Dapatkan kata-kata motivasi

💡 Tips: Cukup kirim pesan biasa (contoh: "halo", "apa kabar"),
maka bot akan membalas Anda!
  `;

  bot.sendMessage(chatId, teksBantuan);
});

// ======================================================
//  PERINTAH /halo
// ======================================================
bot.onText(/\/halo/, (pesan) => {
  const chatId = pesan.chat.id;
  const nama = pesan.from.first_name || 'Sahabat';

  bot.sendMessage(chatId, `Halo juga ${nama}! 🌟 Senang berjumpa dengan Anda!`);
});

// ======================================================
//  PERINTAH /info
// ======================================================
bot.onText(/\/info/, (pesan) => {
  const chatId = pesan.chat.id;
  const user = pesan.from;

  // Ambil info user
  const id = user.id;
  const namaDepan = user.first_name || '(tidak ada)';
  const namaBelakang = user.last_name || '(tidak ada)';
  const username = user.username ? '@' + user.username : '(tidak ada)';

  const teksInfo = `
👤 INFO AKUN ANDA

🆔 ID        : ${id}
📛 Nama Depan: ${namaDepan}
📛 Nama Blkg : ${namaBelakang}
👤 Username  : ${username}
🌐 Bahasa    : ${user.language_code || '(tidak diketahui)'}
  `;

  bot.sendMessage(chatId, teksInfo);
});

// ======================================================
//  PERINTAH /jam
// ======================================================
bot.onText(/\/jam/, (pesan) => {
  const chatId = pesan.chat.id;

  // Ambil waktu sekarang
  const sekarang = new Date();
  const jam = sekarang.toLocaleString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Jakarta'
  });

  bot.sendMessage(chatId, `🕐 WAKTU SAAT INI (WIB):\n\n${jam}`);
});

// ======================================================
//  PERINTAH /quote
// ======================================================
const daftarQuote = [
  "Jangan pernah menyerah, karena kegagalan adalah awal dari kesuksesan. 💪",
  "Hidup adalah petualangan yang berani atau tidak sama sekali. 🌟",
  "Sukses dimulai dengan langkah pertama. 🚀",
  "Bermimpilah besar, karena Anda bisa mewujudkannya. ⭐",
  "Jangan takut gagal, takutlah untuk tidak mencoba. 🔥",
  "Hari ini adalah hadiah, maka itu disebut 'hadiah' (present). 🎁",
  "Kegagalan adalah kesempatan untuk memulai lagi dengan lebih cerdas. 🎯",
  "Kerja keras mengalahkan bakat ketika bakat tidak bekerja keras. 🏆"
];

bot.onText(/\/quote/, (pesan) => {
  const chatId = pesan.chat.id;

  // Pilih quote secara acak
  const indexAcak = Math.floor(Math.random() * daftarQuote.length);
  const quoteTerpilih = daftarQuote[indexAcak];

  bot.sendMessage(chatId, `💭 QUOTE HARI INI:\n\n"${quoteTerpilih}"`);
});

// ======================================================
//  AUTO-REPLY UNTUK PESAN BIASA
// ======================================================
//  Ini menangkap SEMUA pesan yang bukan command (diawali /)
bot.on('message', (pesan) => {
  // Kalau pesan adalah command (diawali /), abaikan
  // karena sudah ditangani oleh handler di atas
  if (pesan.text && pesan.text.startsWith('/')) return;

  const chatId = pesan.chat.id;
  const nama = pesan.from.first_name || 'Sahabat';
  const teks = (pesan.text || '').toLowerCase(); // ubah ke huruf kecil

  // Cek kata kunci dan beri balasan sesuai
  if (teks.includes('halo') || teks.includes('hai') || teks.includes('hello')) {
    bot.sendMessage(chatId, `Halo juga ${nama}! 👋 Ada yang bisa saya bantu?`);
  }
  else if (teks.includes('apa kabar') || teks.includes('kabar')) {
    bot.sendMessage(chatId, 'Alhamdulillah baik! 😊 Bagaimana dengan Anda?');
  }
  else if (teks.includes('terima kasih') || teks.includes('thanks') || teks.includes('makasih')) {
    bot.sendMessage(chatId, 'Sama-sama! Senang bisa membantu 😊');
  }
  else if (teks.includes('siapa kamu') || teks.includes('kamu siapa')) {
    bot.sendMessage(chatId, 'Saya adalah bot Telegram yang dibuat dengan Node.js! 🤖');
  }
  else if (teks.includes('selamat pagi')) {
    bot.sendMessage(chatId, 'Selamat pagi! ☀️ Semoga harimu menyenangkan!');
  }
  else if (teks.includes('selamat siang')) {
    bot.sendMessage(chatId, 'Selamat siang! 🌤️ Jangan lupa makan siang ya!');
  }
  else if (teks.includes('selamat malam')) {
    bot.sendMessage(chatId, 'Selamat malam! 🌙 Istirahat yang cukup ya!');
  }
  else if (teks.includes('bot') && teks.includes('?')) {
    bot.sendMessage(chatId, 'Ya, saya bot! 🤖 Ketik /help untuk lihat perintah.');
  }
  else {
    // Balasan default untuk pesan yang tidak dikenali
    bot.sendMessage(chatId, `Saya menerima pesan Anda: "${pesan.text}"\n\nKetik /help untuk melihat daftar perintah.`);
  }
});

// ======================================================
//  ERROR HANDLING
// ======================================================
bot.on('polling_error', (error) => {
  console.log('❌ Polling error:', error.message);
});

process.on('unhandledRejection', (error) => {
  console.log('❌ Error tidak tertangani:', error.message);
});

// ======================================================
//  TANGANI KETIKA BOT DIMATIKAN
// ======================================================
process.on('SIGINT', () => {
  console.log('\n👋 Bot dimatikan. Sampai jumpa!');
  bot.stopPolling();
  process.exit(0);
});
