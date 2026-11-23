# Production Deployment Guide — HINAYA MARIYAM ERP

This guide details the steps required to deploy HINAYA MARIYAM ERP into a production Linux server (Ubuntu 22.04 / 24.04 LTS or Debian 12) with Node.js 22, MongoDB Replica Set (required for transactions), Nginx reverse proxy with SSL, PM2 process management, and automated daily database backups.

---

## 1. System Requirements

- **Server:** Minimum 2 vCPU, 4GB RAM, 40GB SSD
- **OS:** Ubuntu 22.04 LTS or Debian 12
- **Runtime:** Node.js 22.x LTS, npm 10.x
- **Database:** MongoDB Community Server 7.0+ (configured as a 1-node replica set `rs0` or MongoDB Atlas M10+)
- **Reverse Proxy:** Nginx with Let's Encrypt SSL (Certbot)
- **Process Manager:** PM2

---

## 2. Server Provisioning & Dependencies

```bash
# Update and install base utilities
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw fail2ban certbot python3-certbot-nginx

# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# Verify
node -v  # v22.x
pm2 -v
```

---

## 3. MongoDB Installation & Replica Set Configuration

MongoDB transactions require a replica set. On a single production VPS, configure a single-member replica set `rs0`:

```bash
# Import MongoDB GPG key and repo
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org
```

Edit `/etc/mongod.conf` to enable the replica set:

```yaml
replication:
  replSetName: "rs0"
```

Restart and initiate the replica set:

```bash
sudo systemctl enable --now mongod
mongosh --eval 'rs.initiate()'
```

---

## 4. Application Setup & Build

```bash
# Clone the repository
cd /var/www
git clone <repo-url> hinaya-mariyam
cd /var/www/hinaya-mariyam

# Install dependencies for both client and server
npm install

# Build client PWA and server TypeScript
npm run build
```

---

## 5. Production Environment Variables

Create `/var/www/hinaya-mariyam/server/.env`:

```ini
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/hinaya_mariyam_erp?replicaSet=rs0
CORS_ORIGIN=https://erp.hinayamariyam.com

# 64-char crypto secure string
SESSION_SECRET=GENERATE_STRONG_RANDOM_SECRET_KEY_HERE
SESSION_TTL_HOURS=8
TZ=Asia/Kolkata

INVOICE_PREFIX=HM
INVOICE_FORMAT=HM/YYYY/######

# Automated 9:00 PM IST daily business report
REPORT_CRON=0 21 * * *
REPORT_TIMEZONE=Asia/Kolkata
REPORT_OUTPUT_DIR=/var/www/hinaya-mariyam/server/reports

# Admin contact credentials
ADMIN_MOBILE=9698603288
ADMIN_EMAIL=sivaprakashs127@gmail.com

# Backup configuration
BACKUP_DIR=/var/backups/hinaya_mariyam
BACKUP_RETENTION_DAYS=30

# Optional integrations
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=sivaprakashs127@gmail.com
SMTP_PASS=app_password_here
SMTP_FROM="HINAYA MARIYAM" <sivaprakashs127@gmail.com>

WHATSAPP_CLOUD_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

---

## 6. PM2 Process Management

Start and daemonize the backend with PM2:

```bash
cd /var/www/hinaya-mariyam/server
pm2 start dist/index.js --name "hinaya-erp-backend" -i max --time
pm2 save
pm2 startup
```

---

## 7. Nginx & SSL Configuration

Configure Nginx to serve the Vite PWA frontend build and reverse proxy `/api` requests to Express on port 3001:

Create `/etc/nginx/sites-available/hinayamariyam`:

```nginx
server {
    listen 80;
    server_name erp.hinayamariyam.com;

    # Frontend Static PWA Build
    root /var/www/hinaya-mariyam/client/dist;
    index index.html;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # PWA SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and acquire SSL certificate:

```bash
sudo ln -s /etc/nginx/sites-available/hinayamariyam /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue Let's Encrypt Certificate
sudo certbot --nginx -d erp.hinayamariyam.com
```

---

## 8. Automated Daily Database Backup (Cron)

Schedule the built-in backup script to run every night at 2:00 AM IST:

```bash
# Edit crontab
crontab -e
```

Add the following entry:

```cron
0 2 * * * cd /var/www/hinaya-mariyam && npm run backup >> /var/log/hinaya_backup.log 2>&1
```

---

## 9. Verification & Health Check

1. Health Endpoint: `curl https://erp.hinayamariyam.com/api/health` → `{"status":"ok","db":"connected"}`
2. PM2 status: `pm2 status`
3. Backups: `npm run backup` → archives verified in `backups/`
