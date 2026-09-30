# trademove — treyding community sayti + admin panel

Tashqi kutubxonasiz (faqat Node >= 18).

```bash
ADMIN_PASSWORD='kuchli-parol' npm start     # http://localhost:3000  ·  admin: /admin
```

## Nima bor
- `/` — landing (tariflar, darslar, sozlamalar serverdan olinadi; ariza formasi; tashrif/klik hisobi)
- `/admin` — admin panel: umumiy ko‘rinish (KPI, grafik), arizalar (holat, izoh, qidiruv, CSV), tariflar, darslar, sozlamalar, parol
- `server.js` — API va statik fayllar. Ma’lumotlar `DATA_DIR/db.json` da saqlanadi

## Muhit o‘zgaruvchilari
| Nom | Vazifasi |
|---|---|
| `ADMIN_PASSWORD` | boshlang‘ich admin paroli (bo‘lmasa `admin123` — o‘zgartiring!). Panelda parol o‘zgartirilgach, saqlangan parol ustun turadi |
| `DATA_DIR` | ma’lumotlar papkasi (default `./data`) |
| `PORT` | port (default 3000) |

## Railway'ga joylash
1. Repo'ni Railway'ga ulang (start: `npm start`).
2. **Volume** yarating va `DATA_DIR=/data` deb `/data` ga ulang, aks holda har deployda arizalar yo‘qoladi.
3. `ADMIN_PASSWORD` ni o‘rnating.

## Xavfsizlik
Parol scrypt bilan xeshlanadi, sessiya HttpOnly + SameSite=Strict imzolangan cookie, login va ariza uchun rate-limit, admin ma’lumotlari escape qilinadi.
