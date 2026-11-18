# 🚗 Daiho Auto Parts Supply — POS & Inventory System

Isang full-stack **Point of Sale (POS) at Inventory Management System** na ginawa para sa **Daiho Auto Parts Supply**. Dinisenyo ito para sa mabilis na pag-checkout gamit ang barcode scanner, real-time stock monitoring, supplier variant tracking, at financial reporting.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+), Lucide Icons, Chart.js, JsBarcode, Html5-QRCode
* **Backend:** Node.js, Express.js, Compression Middleware, JWT Authentication
* **Database:** PostgreSQL
* **Cloud Storage & Hosting:** Cloudinary (Image CDN), Render (Static Site, Web Service, & Managed PostgreSQL)

---

## 📂 Project Structure

```text
auto-parts-pos/
├── .gitignore
├── README.md
├── frontend/
│   ├── index.html          # Main SPA interface at modals
│   ├── css/
│   │   └── style.css       # Custom styling at responsive layout
│   └── js/
│       ├── config.js       # Backend API base URL configuration
│       ├── api.js          # HTTP fetch wrapper at auth token handler
│       └── app.js          # Core frontend logic, POS checkout, at reports
└── backend/
    ├── .env                # Environment variables (huwag i-commit sa Git)
    ├── package.json        # Node.js dependencies
    ├── server.js           # Express server entry point
    ├── config/
    │   └── db.js           # PostgreSQL connection pool
    ├── db/
    │   └── schema.sql      # Database table definitions
    ├── middleware/
    │   ├── authMiddleware.js
    │   └── errorHandler.js
    ├── routes/
    │   ├── auth.routes.js
    │   ├── master.routes.js
    │   ├── variant.routes.js
    │   ├── sale.routes.js
    │   ├── report.routes.js
    │   ├── supplier.routes.js
    │   └── user.routes.js
    └── controllers/
        ├── auth.controller.js
        ├── master.controller.js
        ├── variant.controller.js
        ├── sale.controller.js
        ├── report.controller.js
        ├── supplier.controller.js
        └── user.controller.js
```

---

## ✨ Key Features

* **Role-Based Access Control (RBAC):** Magkakaibang access levels para sa **Admin**, **Manager**, at **Cashier**.
* **Fast POS Checkout:** Suportado ang USB barcode scanner, live camera QR/Barcode scanner, at instant search.
* **Master Item & Variant Coding:** Naka-grupo ang mga piyesa ayon sa *Part Name* at may hiwalay na supplier pricing, cost tracking, at CODE128 thermal barcode sticker printing.
* **Cloud Image Optimization:** Awtomatikong kino-compress ang mga larawan bago i-upload sa Cloudinary CDN para mapanatiling magaan at mabilis ang PostgreSQL database.
* **Sales & Financial Reports:** Real-time Daily Sales Log at drill-down Yearly, Monthly, at Daily profit reports.

---

## 🚀 Local Setup & Installation

### 1. I-clone ang Repository
```bash
git clone https://github.com
cd auto-parts-pos
```

### 2. I-setup ang Backend
```bash
cd backend
npm install
```

Gumawa ng `.env` file sa loob ng `backend/` folder at ilagay ang iyong credentials:
```env
PORT=5000
DATABASE_URL=postgresql://user:password@host:5432/database_name
JWT_SECRET=your_super_secret_jwt_key
NODE_ENV=development
```

I-run ang SQL schema mula sa `backend/db/schema.sql` sa iyong PostgreSQL database, pagkatapos ay simulan ang server:
```bash
npm start
```

### 3. I-setup ang Frontend
1. Buksan ang `frontend/js/config.js` at siguraduhing nakaturo ang `API_BASE_URL` sa iyong backend server (hal. `http://localhost:5000/api` o sa iyong Render Web Service URL).
2. Buksan ang `frontend/index.html` gamit ang **Live Server** sa VS Code.

---

## 🔗 Main API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | User authentication at pagkuha ng JWT token |
| `GET` / `POST` | `/api/masters` | Kunin o magrehistro ng Master Items |
| `GET` | `/api/masters/:id/images` | Kunin ang buong gallery images ng isang item |
| `GET` / `POST` | `/api/variants` | Kunin o gumawa ng supplier variant coding |
| `PATCH` | `/api/variants/:code/restock` | Magdagdag ng stock sa existing variant |
| `GET` / `POST` | `/api/sales` | Magtala ng benta at kunin ang sales logs |
| `GET` / `POST` | `/api/suppliers` | Pamahalaan ang listahan ng suppliers |
| `GET` / `POST` | `/api/users` | Pamahalaan ang system user accounts |
