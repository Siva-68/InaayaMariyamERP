# Email Notification & Daily PDF Setup Guide — HINAYA MARIYAM ERP

HINAYA MARIYAM ERP sends automated invoice receipts and daily 9:00 PM IST 3-page executive business PDF reports to the store owner and accountant.

---

## Supported Email Providers

The ERP uses standard Nodemailer SMTP and works with:
- **Gmail / Google Workspace** (Recommended)
- **Zoho Mail**
- **Amazon SES**
- **SendGrid / Postmark / Mailgun**

---

## Gmail / Google Workspace Setup (with App Password)

Google requires an **App Password** when 2-Factor Authentication (2FA) is enabled on your Gmail account.

### Step 1: Generate an App Password
1. Sign in to your Google Account: [myaccount.google.com](https://myaccount.google.com).
2. Go to **Security** → Under "How you sign in to Google", ensure **2-Step Verification** is turned ON.
3. Search for **App passwords** (or go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
4. Enter an app name: `Hinaya Mariyam ERP`.
5. Click **Create** and copy the 16-character generated password (e.g. `abcd efgh ijkl mnop`).

### Step 2: Configure `server/.env`
Add these variables to `server/.env`:

```ini
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=sivaprakashs127@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM="HINAYA MARIYAM ERP" <sivaprakashs127@gmail.com>

ADMIN_EMAIL=9698603288@gmail.com
REPORT_EMAIL_RECIPIENTS=sivaprakashs127@gmail.com,9698603288@gmail.com
```

### Step 3: Test Email Dispatch
Generate and email today's report manually via API or dashboard:
```bash
curl -X POST http://localhost:3001/api/reports/daily/generate -b cookies.txt
```
Or test upon creating a new bill with customer email attached!
