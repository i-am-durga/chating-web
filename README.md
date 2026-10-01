# 💬 CyberChat - Real-Time Chat & WebRTC Video Calling

A high-performance, full-stack real-time communication platform built with **Node.js, Express, Socket.io, SQLite, and WebRTC**.

---

## ✨ Features

- ⚡ **Real-Time Messaging**: Instant global room messaging powered by Socket.io with zero lag.
- 📹 **1-on-1 WebRTC Video Calls**: Direct peer-to-peer audio & video streaming with interactive call controls (Mute Mic, Toggle Camera, Hang Up).
- 🖼️ **Image Attachments**: Send photos and screenshots directly in chat.
- 👥 **Live Active Users**: Real-time presence indicator showing all connected peers.
- 🔐 **Account Authentication**: Secure user registration and login with profile avatars and gender selection.
- 🎨 **Glassmorphism Cyber Theme**: Responsive, sleek dark-mode UI with Google Fonts (Outfit & Space Grotesk).

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- npm or yarn

### 2. Installation
```bash
git clone https://github.com/i-am-durga/chating-web.git
cd chating-web
npm install
```

### 3. Run the Server
```bash
npm start
# or
node server.js
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🛠️ Architecture

```
chating-web/
├── server.js          # Express server, Socket.io signaling, SQLite database
├── package.json       # Dependencies & scripts
└── public/
    ├── index.html     # Semantic single-page application structure
    ├── style.css      # Glassmorphism dark-theme styling
    └── app.js         # Client Socket.io & WebRTC peer connection logic
```

---

## 📜 License
MIT License. Created by [Durga Prasad Sah](https://github.com/i-am-durga).