# 🚀 CARA DEPLOY KE RAILWAY (GRATIS 24 JAM)

Ikuti langkah-langkah ini dengan TELITI ya!

---

## LANGKAH 1: Buat Akun GitHub

GitHub = tempat menyimpan kode online.

1. Buka https://github.com
2. Klik **Sign Up** (Daftar)
3. Isi email, password, username
4. Verifikasi email Anda
5. Sudah punya akun? Langsung **Sign In** (Masuk)

---

## LANGKAH 2: Buat Repository Baru

1. Setelah login, klik tombol **+** di pojok kanan atas
2. Pilih **New repository**
3. Isi nama repository, contoh: `bot-telegram-saya`
4. Pilih **Public** (supaya bisa gratis)
5. **JANGAN** centang "Add a README file"
6. Klik **Create repository**

---

## LANGKAH 3: Upload File Bot

1. Di halaman repository baru, klik tombol **uploading an existing file**
   (link berwarna biru di tengah halaman)
2. **Drag & drop** semua file dari folder `telegram-bot-pemula` ke browser, KECUALI:
   - ❌ `node_modules` (folder ini, kalau ada)
   - ❌ `.env` (file ini JANGAN diupload, isinya rahasia!)
3. Atau klik **choose your files** dan pilih semua file manual
4. Scroll ke bawah, klik **Commit changes**

File yang harus diupload:
- ✅ `bot.js`
- ✅ `package.json`
- ✅ `Procfile` (opsional, untuk Railway)
- ✅ `README.md`

---

## LANGKAH 4: Daftar Railway

1. Buka https://railway.app
2. Klik **Login** atau **Start a New Project**
3. Pilih **Login with GitHub**
4. Setujui izin yang diminta

---

## LANGKAH 5: Deploy Bot

1. Di dashboard Railway, klik **New Project**
2. Pilih **Deploy from GitHub repo**
3. Pilih repository `bot-telegram-saya` Anda
4. Railway akan mulai membaca kode Anda
5. Tunggu sampai proses selesai (1-2 menit)

---

## LANGKAH 6: Tambahkan Environment Variable

Ini yang PALING PENTING! Token bot Anda harus disimpan di Railway.

1. Klik nama project Anda di Railway
2. Klik nama service (biasanya nama repo Anda)
3. Klik tab **Variables**
4. Klik **+ New Variable**
5. Isi:
   - **Name**: `TELEGRAM_BOT_TOKEN`
   - **Value**: (paste token BotFather Anda di sini)
6. Klik **Add**

Railway akan otomatis restart bot dengan token baru.

---

## LANGKAH 7: Cek Bot Berjalan

1. Di Railway, klik tab **Deployments**
2. Lihat log - harusnya muncul tulisan "✅ BOT BERHASIL DIJALANKAN!"
3. Buka Telegram, chat dengan bot Anda
4. Coba ketik `/start`

**SELESAI! 🎉** Bot Anda sekarang hidup 24/7 GRATIS!

---

## 💡 Tips Penting

| Tips | Penjelasan |
|------|------------|
| 🔒 Jangan share token | Token = password bot. Jangan upload ke GitHub! |
| 💰 Gratis selamanya? | Railway kasih $5/bulan gratis. Untuk bot kecil, cukup! |
| 📊 Cek log | Di Railway tab "Deployments" untuk lihat aktivitas bot |
| 🔄 Update bot? | Edit file di GitHub, Railway otomatis deploy ulang |

## ❓ Kalau Ada Masalah

**Bot gak respon?**
- Cek Variables di Railway, pastikan token benar
- Cek log di tab Deployments, lihat error-nya apa

**Deployment gagal?**
- Pastikan `package.json` ada di repository
- Pastikan `bot.js` ada di repository

**Mau tanya?** Hubungi saya lagi aja ya! 😊
