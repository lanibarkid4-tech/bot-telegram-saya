# 🤖 Cara Buat Bot Telegram - Panduan Pemula

Selamat datang! Panduan ini untuk Anda yang **belum pernah coding** atau **baru mulai belajar**.

Ikuti langkah-langkah dengan TELITI ya! 😊

---

## 📖 DAFTAR ISI

1. [Install Node.js](#1-install-nodejs)
2. [Buat Bot di BotFather](#2-buat-bot-di-botfather)
3. [Setup Project](#3-setup-project)
4. [Jalankan Bot](#4-jalankan-bot)
5. [Deploy 24 Jam (Gratis)](#5-deploy-24-jam-gratis)

---

## 1. Install Node.js

Node.js adalah program yang dibutuhkan untuk menjalankan bot.

### Langkah:
1. Buka browser, pergi ke: **https://nodejs.org**
2. Klik tombol besar **"Download Node.js (LTS)"** (versi hijau)
3. Buka file yang didownload (`.msi`)
4. Klik **Next** terus sampai **Install**
5. Klik **Finish**
6. **TUTUP** semua jendela Command Prompt / PowerShell
7. Buka PowerShell baru, ketik: `node --version`
8. Kalau muncul versi (contoh `v20.11.0`), berarti BERHASIL! ✅

---

## 2. Buat Bot di BotFather

BotFather adalah "pabrik" bot resmi dari Telegram.

### Langkah:
1. Buka aplikasi **Telegram** (HP atau PC)
2. Klik kaca pembesar (search), ketik: `@BotFather`
3. Pilih yang **ada centang birunya** (bot resmi)
4. Klik **Start** atau ketik `/start`
5. Ketik: `/newbot`
6. Akan ditanya nama bot, contoh: `Bot Keren Saya`
7. Akan ditanya username, contoh: `bot_keren_saya_bot` (HARUS diakhiri `bot`)
8. **PENTING**: BotFather akan kirim **TOKEN**
   - Bentuknya: `123456789:ABCdefGHIjkl...`
   - **COPY** token ini!

### Cek username bot Anda
- Tutup chat BotFather
- Search username yang Anda buat (contoh `@bot_keren_saya_bot`)
- Klik **Start** untuk memulai chat

---

## 3. Setup Project

### Cara Otomatis (Recommended):

1. Buka folder `telegram-bot-pemula` di File Explorer
2. **Double-click** file `install.bat`
3. Tunggu sampai selesai
4. Akan muncul notepad, **paste TOKEN** Anda di situ
5. Save dan tutup notepad
6. Selesai!

### Cara Manual:

1. Buka **PowerShell** di folder project
   - Cara: Klik kanan di folder → "Open in Terminal" / "Buka di Terminal"
2. Ketik:
   ```bash
   npm install
   ```
3. Buat file `.env` (file kosong, tapi namanya `.env`)
   - Klik kanan → New → Text Document
   - Rename jadi `.env` (ada titik di depan, hapus `.txt`)
4. Buka file `.env` dengan Notepad
5. Isi dengan:
   ```
   TELEGRAM_BOT_TOKEN=paste_token_anda_disini
   ```
6. Save & tutup

---

## 4. Jalankan Bot

### Cara Otomatis:
- Double-click `install.bat` lagi
- Bot akan langsung jalan!

### Cara Manual:
- Di PowerShell, ketik:
  ```bash
  npm start
  ```

### Coba Bot:
1. Buka Telegram
2. Cari bot Anda (contoh `@bot_keren_saya_bot`)
3. Klik **Start**
4. Coba ketik `/halo` atau `/quote`
5. Kalau bot bales = BERHASIL! 🎉

### Matikan Bot:
- Di PowerShell, tekan **Ctrl + C**

⚠️ **PENTING**: Kalau bot dijalankan di PC/laptop, dia **mati saat PC dimatikan**.
Untuk jalan 24 jam, lihat langkah 5!

---

## 5. Deploy 24 Jam (Gratis)

Bot yang kita buat akan **mati** kalau PC/laptop dimatikan.
Supaya bot hidup 24 jam, kita harus **upload ke server gratis**.

Baca panduan lengkap di file: **`deploy-railway.md`**

Ringkasnya:
1. Buat akun GitHub (gratis)
2. Upload file bot ke GitHub (JANGAN upload file `.env`!)
3. Buat akun Railway.app (gratis, login pakai GitHub)
4. Deploy dari GitHub
5. Tambah Environment Variable `TELEGRAM_BOT_TOKEN` di Railway
6. SELESAI! Bot hidup 24/7! 🎉

---

## ❓ FAQ (Pertanyaan Umum)

### Q: Berapa biayanya?
**A: GRATIS 100%!** Railway kasih $5/bulan gratis, cukup untuk bot kecil.

### Q: Aman gak upload kode ke GitHub?
**A: Aman**, TAPI jangan upload file `.env` karena isinya token rahasia!

### Q: Bisa tambah fitur gak?
**A: Bisa banget!** Edit file `bot.js`, tambah perintah baru.
Misalnya:
```javascript
bot.onText(/\/test/, (pesan) => {
  bot.sendMessage(pesan.chat.id, 'Bot masih hidup!');
});
```

### Q: Bot saya gak respon?
**A: Cek hal ini:**
1. Token di `.env` benar?
2. Bot sudah di-start di Telegram?
3. Ada error di console? (lihat pesan merah)

### Q: Gimana cara hentikan bot di Railway?
**A: Buka Railway dashboard → klik service → Settings → Delete Service**

---

## 🆘 Butuh Bantuan?

Kalau ada yang bingung, tanyakan ke saya lagi ya! Saya bantu sampai bisa 😊

---

## 📁 Struktur File

```
telegram-bot-pemula/
├── bot.js              ← Kode utama bot (JANGAN diubah kalau belum paham)
├── package.json        ← Daftar library yang dipakai
├── install.bat         ← Script install otomatis
├── env_template.txt    ← Panduan bikin file .env
├── README.md           ← File ini (panduan)
└── deploy-railway.md   ← Panduan deploy 24 jam
```

---

Selamat mencoba! Semoga berhasil! 🚀
