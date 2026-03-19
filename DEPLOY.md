# מדריך העלאה לאוויר — FinTrack

## אפשרות א׳ — Railway (הכי פשוט, מומלץ למתחילים)

Railway מריץ Docker Compose אוטומטית ונותן לך PostgreSQL מנוהל.
**עלות: $5/חודש** (כולל DB + שרת)

### שלבים:

1. **פתח חשבון Railway**
   → https://railway.app (התחבר עם GitHub)

2. **העלה את הקוד ל-GitHub**
   ```bash
   git init
   git add .
   git commit -m "initial"
   git remote add origin https://github.com/YOUR_USERNAME/fintrack.git
   git push -u origin main
   ```

3. **Railway: New Project → Deploy from GitHub**
   - בחר את ה-repo שלך
   - Railway יזהה את docker-compose.yml אוטומטית

4. **הוסף משתני סביבה ב-Railway:**
   ```
   DB_USER=fintrack
   DB_PASS=strong_password_here
   DB_NAME=fintrack
   SECRET_KEY=run: python -c "import secrets; print(secrets.token_hex(32))"
   ALLOWED_ORIGINS=https://your-railway-domain.up.railway.app
   ```

5. **קבל דומיין:**
   - Railway נותן domain חינמי: `yourapp.up.railway.app`
   - אפשר לחבר דומיין פרטי בהמשך

---

## אפשרות ב׳ — VPS (Hetzner / DigitalOcean)

יותר שליטה, **עלות: ~$5-8/חודש**

### שלבים:

1. **קנה שרת** ב-https://hetzner.com (CX21, Ubuntu 22.04)

2. **התחבר ל-SSH:**
   ```bash
   ssh root@YOUR_SERVER_IP
   ```

3. **התקן Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   apt install docker-compose-plugin -y
   ```

4. **העלה קוד:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/fintrack.git
   cd fintrack
   cp .env.example .env
   nano .env   # מלא את כל הערכים
   ```

5. **הפעל:**
   ```bash
   docker compose up -d
   ```

6. **בדוק שעובד:**
   ```bash
   docker compose ps
   curl http://localhost:8000/health
   ```

---

## הוספת דומיין + SSL (HTTPS)

1. **קנה דומיין** (Namecheap, Google Domains, ~$10/שנה)

2. **הגדר DNS:** A record → IP של השרת שלך

3. **קבל SSL חינמי עם Let's Encrypt:**
   ```bash
   docker compose run --rm certbot certonly \
     --webroot -w /var/www/certbot \
     -d fintrack.yourdomain.com \
     --email your@email.com --agree-tos
   ```

4. **עדכן nginx/default.conf** — בטל את ה-# על בלוק ה-HTTPS

5. **Reload nginx:**
   ```bash
   docker compose exec nginx nginx -s reload
   ```

---

## גיבוי ה-Database

```bash
# גיבוי
docker compose exec db pg_dump -U fintrack fintrack > backup_$(date +%Y%m%d).sql

# שחזור
cat backup_20260316.sql | docker compose exec -T db psql -U fintrack fintrack
```

### גיבוי אוטומטי (cron — כל יום ב-3:00 לפנות בוקר):
```bash
crontab -e
# הוסף שורה:
0 3 * * * cd /root/fintrack && docker compose exec -T db pg_dump -U fintrack fintrack > /root/backups/backup_$(date +\%Y\%m\%d).sql
```

---

## ניטור ולוגים

```bash
# לוגים live
docker compose logs -f api

# שימוש ב-CPU/זיכרון
docker stats

# ריסטארט אחרי שינויים
docker compose restart api
```

---

## מבנה הקבצים

```
fintrack/
├── backend/
│   ├── main.py          ← FastAPI app
│   ├── auth.py          ← JWT + bcrypt
│   ├── database.py      ← DB connection
│   ├── models.py        ← SQLAlchemy tables
│   ├── schemas.py       ← Pydantic validation
│   ├── routers/
│   │   ├── auth.py      ← /auth/login, /auth/register
│   │   └── users.py     ← /users/me, /users/admin/all
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── index.html       ← דף כניסה/הרשמה
│   └── dashboard.html   ← הדשבורד הקיים
├── nginx/
│   └── default.conf
├── docker-compose.yml
├── .env.example
└── DEPLOY.md            ← המסמך הזה
```

---

## API Endpoints

| Method | URL | תיאור |
|--------|-----|-------|
| POST | /auth/register | רישום משתמש חדש |
| POST | /auth/login | כניסה, מחזיר JWT token |
| GET | /users/me | פרופיל המשתמש הנוכחי |
| PUT | /users/me | עדכון פרופיל |
| GET | /users/me/state | טעינת מצב הדשבורד (overrides, projects...) |
| PUT | /users/me/state | שמירת מצב הדשבורד |
| GET | /users/admin/all | רשימת כל המשתמשים (מנהל בלבד) |
| PUT | /users/admin/{id}/toggle-active | השהיית/שחרור משתמש |

תיעוד API אוטומטי זמין בכתובת: **http://localhost:8000/docs**
