# Khyxx Digitals backend setup

1. Install Node.js 18 or newer on the hosting server.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set a long `ADMIN_KEY`.
4. Configure the SMTP variables if you want new bank transfer and GCash orders emailed to you.
5. Start with `npm start`.
6. Open `/admin.html` and enter `ADMIN_KEY` to view recorded orders and their payment methods.

Orders are stored in `data/orders.json`. Configure the SMTP variables to email each paid order to `ORDER_NOTIFICATION_EMAIL`. For public production use, deploy behind HTTPS and use persistent storage; the included JSON store is intended for a small shop or initial deployment.
