// Global Client State
let socket = null;
let currentUser = null;
let selectedImageBase64 = null;

// WebRTC State
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let currentCallTarget = null;
let pendingOffer = null;

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Check for existing session
window.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('cyberchat_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      initializeChat();
    } catch (e) {
      localStorage.removeItem('cyberchat_user');
    }
  }
});

function switchAuthTab(tab) {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('login-form');
  const formRegister = document.getElementById('register-form');

  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
  }
  document.getElementById('login-error').textContent = '';
  document.getElementById('register-error').textContent = '';
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errDiv = document.getElementById('login-error');
  errDiv.textContent = '';

  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errDiv.textContent = data.error || 'Invalid credentials';
      return;
    }
    currentUser = data;
    localStorage.setItem('cyberchat_user', JSON.stringify(currentUser));
    initializeChat();
  } catch (err) {
    errDiv.textContent = 'Server connection failed';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const gender = document.getElementById('reg-gender').value;
  const profilePic = document.getElementById('reg-avatar').value.trim() || undefined;
  const errDiv = document.getElementById('register-error');
  errDiv.textContent = '';

  try {
    const res = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, gender, profilePic })
    });
    const data = await res.json();
    if (!res.ok) {
      errDiv.textContent = data.error || 'Registration failed';
      return;
    }
    currentUser = data;
    localStorage.setItem('cyberchat_user', JSON.stringify(currentUser));
    initializeChat();
  } catch (err) {
    errDiv.textContent = 'Server connection failed';
  }
}

function handleLogout() {
  localStorage.removeItem('cyberchat_user');
  if (socket) socket.disconnect();
  location.reload();
}

function initializeChat() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');

  document.getElementById('current-user-avatar').src = currentUser.profilePic;
  document.getElementById('current-user-name').textContent = currentUser.username;

  // Initialize Socket.io
  socket = io();

  socket.on('connect', () => {
    socket.emit('user:join', {
      username: currentUser.username,
      gender: currentUser.gender,
      profilePic: currentUser.profilePic
    });
  });

  socket.on('user:list', (users) => {
    renderUserList(users);
  });

  socket.on('message', (msg) => {
    appendMessage(msg);
  });

  // WebRTC Signaling
  socket.on('call:offer', async (data) => {
    pendingOffer = data;
    document.getElementById('caller-avatar').src = data.profilePic || `https://ui-avatars.com/api/?name=${data.username}`;
    document.getElementById('caller-name').textContent = `${data.username} is calling...`;
    document.getElementById('incoming-call-modal').classList.remove('hidden');
  });

  socket.on('call:answer', async (data) => {
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });

  socket.on('call:candidate', async (data) => {
    if (peerConnection && data.candidate) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.error('Error adding ICE candidate', e);
      }
    }
  });
}

function renderUserList(users) {
  const listEl = document.getElementById('user-list');
  const countEl = document.getElementById('online-count');
  listEl.innerHTML = '';
  countEl.textContent = users.length;

  users.forEach((u) => {
    const isMe = u.username === currentUser.username;
    const li = document.createElement('li');
    li.className = 'user-item';

    li.innerHTML = `
      <div class="user-info">
        <img src="${u.profilePic}" alt="${u.username}" class="avatar-sm">
        <div>
          <div class="font-bold">${u.username} ${isMe ? '<small style="color:var(--text-muted)">(You)</small>' : ''}</div>
          <small style="color:var(--text-muted); text-transform:capitalize;">${u.gender}</small>
        </div>
      </div>
      ${!isMe ? `<button class="btn-call-user" onclick="startCall('${u.id}', '${u.username}')">📹 Call</button>` : ''}
    `;
    listEl.appendChild(li);
  });
}

function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert('Please choose an image under 2MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    selectedImageBase64 = event.target.result;
    document.getElementById('image-preview').src = selectedImageBase64;
    document.getElementById('image-preview-container').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearSelectedImage() {
  selectedImageBase64 = null;
  document.getElementById('image-upload').value = '';
  document.getElementById('image-preview-container').classList.add('hidden');
}

function handleSendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('message-input');
  const text = input.value.trim();

  if (!text && !selectedImageBase64) return;

  socket.emit('message:send', {
    text: text || '',
    image: selectedImageBase64 || null
  });

  input.value = '';
  clearSelectedImage();
}

function appendMessage(msg) {
  const container = document.getElementById('messages-container');
  const isMine = msg.user === currentUser.username;
  const isSystem = msg.user === 'System';

  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${isSystem ? 'system' : (isMine ? 'mine' : 'theirs')}`;

  if (isSystem) {
    bubble.innerHTML = `<div class="message-content">${escapeHtml(msg.text)}</div>`;
  } else {
    bubble.innerHTML = `
      <img src="${msg.profilePic || 'https://ui-avatars.com/api/?name=' + msg.user}" alt="${msg.user}" class="avatar-sm">
      <div class="message-body">
        <span class="message-author">${escapeHtml(msg.user)}</span>
        <div class="message-content">
          ${msg.text ? `<p>${escapeHtml(msg.text)}</p>` : ''}
          ${msg.image ? `<img src="${msg.image}" alt="attachment" class="message-img" onclick="window.open('${msg.image}')">` : ''}
        </div>
      </div>
    `;
  }

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// WebRTC Calling
async function setupLocalMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById('local-video').srcObject = localStream;
}

async function startCall(targetSocketId, targetUsername) {
  currentCallTarget = targetSocketId;
  document.getElementById('remote-user-label').textContent = targetUsername;
  document.getElementById('video-call-screen').classList.remove('hidden');

  await setupLocalMedia();
  createPeerConnection();

  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit('call:offer', { offer, target: targetSocketId });
}

async function acceptIncomingCall() {
  document.getElementById('incoming-call-modal').classList.add('hidden');
  document.getElementById('video-call-screen').classList.remove('hidden');

  currentCallTarget = pendingOffer.from;
  document.getElementById('remote-user-label').textContent = pendingOffer.username;

  await setupLocalMedia();
  createPeerConnection();

  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  await peerConnection.setRemoteDescription(new RTCSessionDescription(pendingOffer.offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('call:answer', { answer, target: currentCallTarget });
  pendingOffer = null;
}

function declineIncomingCall() {
  document.getElementById('incoming-call-modal').classList.add('hidden');
  pendingOffer = null;
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(rtcConfig);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate && currentCallTarget) {
      socket.emit('call:candidate', { candidate: event.candidate, target: currentCallTarget });
    }
  };

  peerConnection.ontrack = (event) => {
    remoteStream = event.streams[0];
    document.getElementById('remote-video').srcObject = remoteStream;
  };
}

function toggleMic() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      document.getElementById('btn-toggle-mic').textContent = audioTrack.enabled ? '🎤 Mute' : '🔇 Unmute';
    }
  }
}

function toggleCam() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      document.getElementById('btn-toggle-cam').textContent = videoTrack.enabled ? '📹 Camera' : '🚫 No Cam';
    }
  }
}

function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
  document.getElementById('video-call-screen').classList.add('hidden');
  currentCallTarget = null;
}