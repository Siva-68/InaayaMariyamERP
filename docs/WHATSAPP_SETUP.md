# WhatsApp Integration Setup Guide — HINAYA MARIYAM ERP

HINAYA MARIYAM ERP supports two levels of WhatsApp integration:
1. **Direct Web & Mobile Click-to-Chat (Zero-configuration Fallback):** Pre-encodes full receipt details into official WhatsApp URLs (`https://wa.me/919698603288?text=...`) for one-tap sharing by the billing cashier or admin. Works immediately without any API keys or fees.
2. **Meta WhatsApp Business Cloud API (Automated Background Dispatch):** Direct automated API transmission to the customer and admin when a bill is completed.

---

## Direct Web / App Link Workflow (Active by Default)

Whenever an invoice is completed:
- The cashier gets two dedicated action buttons:
  - **Send to Admin WhatsApp (+91 9698603288)**
  - **Send to Customer WhatsApp (+91 [Customer Mobile])**
- Tapping either opens WhatsApp directly with the complete itemized bill and greeting already formatted.

---

## Meta WhatsApp Business Cloud API Setup (Optional)

To enable automated background message delivery directly from the server:

### 1. Register Meta Developer Account
1. Go to [developers.facebook.com](https://developers.facebook.com) and sign in.
2. Create an App → Select **Business** type.
3. Under "Add products to your app", locate **WhatsApp** and click **Set up**.

### 2. Configure Phone Number & Business Account
1. Navigate to **WhatsApp > API Setup** in the Meta App Dashboard.
2. Obtain:
   - **Temporary or Permanent Access Token**
   - **Phone Number ID** (e.g. `104928472910482`)
   - **WhatsApp Business Account ID**

### 3. Configure Environment Variables
Add the credentials into `server/.env`:

```ini
WHATSAPP_CLOUD_API_TOKEN=EAA...YourPermanentAccessTokenHere
WHATSAPP_PHONE_NUMBER_ID=104928472910482
ADMIN_MOBILE=9698603288
```

Restart the server:
```bash
npm run dev:server
```

When configured, the backend automatically dispatches text notifications in real-time on invoice generation!
