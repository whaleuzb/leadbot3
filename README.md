# Mamurjon | MT — treyding community sayti + admin panel

Tashqi kutubxonasiz (faqat Node >= 18).

```bash
ADMIN_PASSWORD='kuchli-parol' npm start     # http://localhost:3000  ·  admin: /admin
```

## Nima bor
- `/` — landing: Online / Offlayn tariflar (narx, chegirma, Whales muddati), ariza + to‘lov (USDT BEP20 yoki karta), promo kod
- `/admin` — admin panel: umumiy ko‘rinish (KPI, tushum), arizalar va to‘lovlar (chekni ko‘rish, to‘lovni tasdiqlash, USDT o‘tkazmani biriktirish, CSV), tariflar (narx, format, sotuvda/yo‘q), promo kodlar, darslar, “Kimga mos”, natijalar, sozlamalar (to‘lov: hamyon, karta, kurs), Telegram bot, parol
- `server.js` — API va statik fayllar. Ma’lumotlar `DATA_DIR/db.json` da, karta cheklari `DATA_DIR/receipts/` da (faqat admin ko‘radi)
- `pay.js` — USDT (BEP20) hamyon skaneri: BSC'dan hamyonga kelgan USDT o‘tkazmalarini o‘qiydi (faqat ochiq manzil, maxfiy kalit yo‘q)

## To‘lov qanday ishlaydi
- **USDT (BEP20)**: har buyurtmaga noyob summa beriladi (masalan 899.37 USDT). Server har 20 soniyada hamyonni tekshiradi va summasi mos o‘tkazmani avtomatik tasdiqlaydi. Mijoz TxID yuborsa — darhol tekshiriladi. Mos kelmagan o‘tkazma admin panelda chiqadi va qo‘lda biriktiriladi.
- **Karta**: summa so‘mda (narx × kurs, mingga yaxlitlanadi). Mijoz chek skrinshotini yuklaydi → Telegramga keladi → admin panelda “To‘lovni tasdiqlash”.
- To‘lov tasdiqlanganda Telegramga xabar keladi — mijozni Whales guruhi va darslarga qo‘shasiz.
- Promo kod “ishlatilgan” soni faqat to‘lov tasdiqlanganda oshadi.

## Muhit o‘zgaruvchilari
| Nom | Vazifasi |
|---|---|
| `ADMIN_PASSWORD` | boshlang‘ich admin paroli (bo‘lmasa `admin123` — o‘zgartiring!). Panelda parol o‘zgartirilgach, saqlangan parol ustun turadi |
| `DATA_DIR` | ma’lumotlar papkasi (default `./data`) |
| `PORT` | port (default 3000) |
| `TELEGRAM_BOT_TOKEN` | @BotFather bergan bot tokeni — arizalar shu bot orqali yuboriladi |
| `TELEGRAM_CHAT_ID` | arizalar keladigan chat/guruh ID si (admin → Sozlamalar → “Chat ID topish”) |
| `USDT_WALLET` | (ixtiyoriy) USDT BEP20 hamyonning ochiq manzili — admin paneldagidan ustun turadi |
| `BSC_RPC_URL` | (ixtiyoriy) BNB Smart Chain RPC, default `https://bsc-rpc.publicnode.com` |
| `USD_RATE` | (ixtiyoriy) dollar kursi, so‘m — admin panelda kurs qo‘yilsa, o‘sha ustun turadi |
| `BSC_CONFIRMATIONS` | (ixtiyoriy) tasdiqlar soni, default 15 |

## Railway'ga joylash
1. Repo'ni Railway'ga ulang (start: `npm start`).
2. **Volume** yarating va `DATA_DIR=/data` deb `/data` ga ulang, aks holda har deployda arizalar yo‘qoladi.
3. `ADMIN_PASSWORD` ni o‘rnating.

## Xavfsizlik
Parol scrypt bilan xeshlanadi, sessiya HttpOnly + SameSite=Strict imzolangan cookie, login va ariza uchun rate-limit, admin ma’lumotlari escape qilinadi.
