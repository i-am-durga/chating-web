const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Database setup
const db = new sqlite3.Database(':memory:'); // Use file-based DB for persistence if needed: './chat.db'

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, gender TEXT, profile_pic TEXT)");
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.post('/register', (req, res) => {
    const { username, password, gender, profilePic } = req.body;
    if (!username || !password || !gender) return res.status(400).json({ error: 'All fields are required' });

    // Use a default avatar if no profilePic provided, or validate it's a string
    const finalProfilePic = profilePic || `https://ui-avatars.com/api/?name=${username}&background=random`;

    // Limit profile pic size if it's a base64 string (simple check)
    if (finalProfilePic.length > 5000000) return res.status(400).json({ error: 'Profile picture too large' });

    const stmt = db.prepare("INSERT INTO users (username, password, gender, profile_pic) VALUES (?, ?, ?, ?)");
    stmt.run(username, password, gender, finalProfilePic, function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Username already taken' });
            }
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ id: this.lastID, username, gender, profilePic: finalProfilePic });
    });
    stmt.finalize();
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(401).json({ error: 'Invalid credentials' });
        res.json({ id: row.id, username: row.username, gender: row.gender, profilePic: row.profile_pic });
    });
});

// Socket.io Logic
const onlineUsers = new Map(); // socketId -> username

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('user:join', (userData) => {
        // userData: { username, gender, profilePic }
        onlineUsers.set(socket.id, userData); // Store full object

        // Send list of users
        const users = Array.from(onlineUsers, ([id, data]) => ({
            id,
            username: data.username,
            gender: data.gender,
            profilePic: data.profilePic
        }));
        io.emit('user:list', users);
        socket.broadcast.emit('message', { user: 'System', text: `${userData.username} has joined.` });
    });

    socket.on('message:send', (data) => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            io.emit('message', {
                user: user.username,
                profilePic: user.profilePic,
                text: data.text,
                image: data.image
            });
        }
    });

    // WebRTC Signaling - Direct 1-on-1
    socket.on('call:offer', (data) => {
        // data: { offer, target }
        if (data.target) {
            const caller = onlineUsers.get(socket.id);
            io.to(data.target).emit('call:offer', {
                offer: data.offer,
                from: socket.id,
                username: caller.username,
                profilePic: caller.profilePic
            });
        }
    });

    socket.on('call:answer', (data) => {
        // data: { answer, target }
        if (data.target) {
            io.to(data.target).emit('call:answer', {
                answer: data.answer,
                from: socket.id
            });
        }
    });

    socket.on('call:candidate', (data) => {
        // data: { candidate, target }
        if (data.target) {
            io.to(data.target).emit('call:candidate', {
                candidate: data.candidate,
                from: socket.id
            });
        }
    });

    socket.on('disconnect', () => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            onlineUsers.delete(socket.id);
            const users = Array.from(onlineUsers, ([id, data]) => ({
                id,
                username: data.username,
                gender: data.gender,
                profilePic: data.profilePic
            }));
            io.emit('user:list', users);
            socket.broadcast.emit('message', { user: 'System', text: `${user.username} has left.` });
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
