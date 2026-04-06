# Expense Splitter 🤝
live link- https://expense-app-3h78.onrender.com/

A full-stack group expense splitting application with real-time chat and AI-powered features. Built with the MERN stack (MongoDB, Express, React, Node.js) plus Socket.io for real-time communication and Groq AI for intelligent features.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-22.x-green)
![React](https://img.shields.io/badge/React-19.x-61DAFB)

## ✨ Features

- **Group Management** - Create groups, invite members via unique links
- **Expense Tracking** - Add, split, and track expenses among group members
- **Real-time Chat** - Socket.io powered instant messaging within groups
- **AI-Powered** - Natural language expense input and balance queries
- **Settlement** - Track and settle debts between members
- **Payment Integration** - Razorpay integration for payments (optional)

## 🏗️ Architecture

```
expense-app/
├── backend/           # Express.js API server
│   └── src/
│       ├── modules/   # Feature modules (auth, expense, group, chat, AI, payment)
│       ├── config/    # Database, Redis, environment config
│       ├── socket/    # Real-time Socket.io handlers
│       └── app.js     # Express app setup
│
└── frontend/          # React + Vite frontend
    └── src/
        ├── pages/     # Dashboard, Chat, Invite pages
        ├── components/ # Reusable UI components
        └── services/  # API and Socket clients
```

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 22.x
- **Framework**: Express.js 5.x
- **Database**: MongoDB (Mongoose ODM)
- **Real-time**: Socket.io 4.x
- **Auth**: JWT + bcrypt
- **AI**: Groq SDK
- **Cache**: Redis (optional)
- **Payments**: Razorpay

### Frontend
- **Framework**: React 19.x
- **Build Tool**: Vite 7.x
- **Styling**: Tailwind CSS 4.x
- **HTTP Client**: Axios
- **Routing**: React Router DOM 7.x

## 🚀 Getting Started

### Prerequisites
- Node.js 22.x+
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Avi-47/expense-app.git
cd expense-app
```

2. **Setup Backend**
```bash
cd backend
npm install
# Create .env file (see .env.example)
npm run dev    # Development
npm start      # Production
```

3. **Setup Frontend**
```bash
cd frontend
npm install
npm run dev    # Development
npm run build  # Production
```

### Environment Variables

Create `backend/.env`:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_api_key
REDIS_URL=optional_redis_url
RAZORPAY_KEY_ID=optional_razorpay_key
RAZORPAY_KEY_SECRET=optional_razorpay_secret
```

## 📡 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/auth` | Authentication (register, login) |
| `/api/groups` | Group CRUD operations |
| `/api/expenses` | Expense management |
| `/api/chat` | Real-time messaging |
| `/api/settlement` | Debt settlement |
| `/api/ai` | AI-powered features |
| `/api/payments` | Payment integration |
| `/api/users` | User search & profile |

## 🌐 Live Demo

The app is deployed on [Render](https://expense-app-3h78.onrender.com) (free tier may have cold start delays).

## 📄 License

MIT License - feel free to use this project for learning or personal projects.

---

Built with ❤️ by [Avi-47](https://github.com/Avi-47)
