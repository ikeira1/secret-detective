let database;
let roomCode = "";
let myUID = ""; 
let hostName = "";
let currentRound = 1;
let maxRounds = 5;

function getOrCreateHostUID() {
    let uid = localStorage.getItem('sd_my_uid');
    if (!uid) {
        uid = "u_" + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('sd_my_uid', uid);
    }
    return uid;
}

function initHost() {
    hostName = document.getElementById('host-name').value.trim();
    maxRounds = parseInt(document.getElementById('total-rounds').value) || 5;
    myUID = getOrCreateHostUID();

    if (!hostName) {
        alert("الرجاء كتابة اسمك أولاً يا مدير!");
        return;
    }

    roomCode = Math.floor(1000 + Math.random() * 9000).toString();

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    database = firebase.database();

    localStorage.setItem('sd_role', 'host');
    localStorage.setItem('sd_roomCode', roomCode);
    localStorage.setItem('sd_playerName', hostName);

    database.ref('rooms/' + roomCode).set({
        hostUID: myUID,
        hostName: hostName,
        maxRounds: maxRounds,
        currentRound: 1,
        gameStatus: "lobby",
        secretWord: "",
        winnerWordPlayer: ""
    }).then(() => {
        setupHostPresence();
        document.getElementById('auth-screen').classList.add('d-none');
        document.getElementById('host-screen').classList.remove('d-none');
        document.getElementById('display-room-code').innerText = `رمز الروم: ${roomCode}`;
        document.getElementById('host-max-rounds').innerText = maxRounds;

        listenToPlayers();
        listenToChallengeAnswers();
        listenToChatForHost();
        listenToGameStatusForHost();
    }).catch(err => { alert("خطأ: " + err.message); });
}

function setupHostPresence() {
    if (!database || !roomCode) return;
    database.ref('rooms/' + roomCode + '/hostUID').onDisconnect().remove();
}

function listenToPlayers() {
    database.ref('rooms/' + roomCode + '/players').on('value', (snapshot) => {
        const playersListDiv = document.getElementById('host-players-list');
        if(!playersListDiv) return;
        playersListDiv.innerHTML = "";
        const players = snapshot.val();

        if (!players) {
            playersListDiv.innerHTML = '<span class="empty-state">بانتظار دخول اللاعبين... 🕒</span>';
            return;
        }

        for (let idKey in players) {
            const player = players[idKey];
            const pRow = document.createElement('div');
            pRow.style.display = "flex"; pRow.style.justifyContent = "space-between"; pRow.style.alignItems = "center";
            pRow.style.padding = "10px"; pRow.style.background = "#1e293b"; pRow.style.borderRadius = "8px"; pRow.style.marginBottom = "6px";

            const currentAttempts = player.attempts !== undefined ? player.attempts : 3;
            const hintCount = player.manualHintCount !== undefined ? player.manualHintCount : 0;

            pRow.innerHTML = `
                <div>
                    <span style="font-weight:bold; color:#fff;">🎮 ${player.name}</span>
                    <div style="font-size:0.8rem; color:#94a3b8;">المحاولات: <strong style="color:#ef4444">${currentAttempts}</strong> | تلميحات: <strong>${hintCount}</strong></div>
                </div>
                <div>
                    <button onclick="giveManualHint('${idKey}', '${player.name}')" class="btn btn-sm btn-info text-dark">💡 تلميح</button>
                    <button onclick="modifyPlayerAttempts('${idKey}', ${currentAttempts})" class="btn btn-sm btn-warning">⚙️ محاولات</button>
                    <button onclick="kickPlayer('${idKey}', '${player.name}')" class="btn btn-sm btn-danger">❌ طرد</button>
                </div>
            `;
            playersListDiv.appendChild(pRow);
        }
    });
}

function listenToChallengeAnswers() {
    // مستمع عام لتحديث الأجوبة بلوحة التحكم
}

function listenToChatForHost() {
    database.ref('rooms/' + roomCode + '/chat').on('value', (snapshot) => {
        const chatLog = document.getElementById('host-chat-log');
        if (!chatLog) return;
        chatLog.innerHTML = "";
        const messages = snapshot.val();
        if (!messages) return;

        for (let mKey in messages) {
            const msg = messages[mKey];
            const div = document.createElement('div');
            div.className = msg.sender.includes("👑") ? "msg msg-host text-end ms-auto mb-1" : "msg msg-player text-end me-auto mb-1";
            div.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;
            chatLog.appendChild(div);
        }
        chatLog.scrollTop = chatLog.scrollHeight;
    });
}

function listenToGameStatusForHost() {
    database.ref('rooms/' + roomCode).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const adminStatusBadge = document.getElementById('admin-game-status-badge');
        if (data.gameStatus === "lobby") {
            adminStatusBadge.innerText = "انتظار قفل الكلمة السرية 🔑";
            document.getElementById('btn-lock-word').disabled = false;
            document.getElementById('btn-reset-lobby').classList.add('d-none');
        } else if (data.gameStatus === "playing") {
            adminStatusBadge.innerText = "الجولة شغالة.. التخمين مفتوح! 🏃‍♂️🔥";
            document.getElementById('btn-lock-word').disabled = true;
            document.getElementById('btn-reset-lobby').classList.remove('d-none');
        } else if (data.gameStatus === "voting") {
            adminStatusBadge.innerText = "🗳️ مرحلة التصويت الإجباري نشطة!";
            document.getElementById('btn-reset-lobby').classList.remove('d-none');
            showLiveVotesToAdmin(data.players, data.winnerWordPlayer);
        }
    });
}

function showLiveVotesToAdmin(players, luckyPlayer) {
    const answersDiv = document.getElementById('host-challenges-log');
    if (!answersDiv) return;
    answersDiv.innerHTML = `<div style="background: rgba(139, 92, 246, 0.1); padding: 10px; border-radius: 6px; border: 1px dashed #8b5cf6;">
        🎉 <strong>المحقق الفائز بالكلمة:</strong> <span style="color:#a78bfa; font-weight:bold;">${luckyPlayer || "غير معروف"}</span>
    </div><h5 class="text-purple mt-3 mb-2">📥 أصوات اللاعبين الحالية:</h5>`;

    let hasVotes = false;
    if (players) {
        for (let idKey in players) {
            const p = players[idKey];
            if (p.votedFor) {
                hasVotes = true;
                const vBlock = document.createElement('div');
                vBlock.style.background = "#0f172a"; vBlock.style.padding = "8px 12px"; vBlock.style.borderRadius = "6px"; vBlock.style.marginBottom = "5px";
                vBlock.innerHTML = `🗳️ اللاعب <strong>${p.name}</strong> يصوت ضد 👈 <span class="text-danger" style="font-weight:bold;">${p.votedFor}</span>`;
                answersDiv.appendChild(vBlock);
            }
        }
    }
    if(!hasVotes) answersDiv.innerHTML += `<span class="empty-state">بانتظار تصويت المحققين... 🗳️</span>`;
}

function lockSecretWord() {
    const wordInput = document.getElementById('secret-word-input');
    const word = wordInput.value.trim();
    if (!word) return;

    database.ref('rooms/' + roomCode).update({ secretWord: word, gameStatus: "playing" }).then(() => {
        wordInput.value = "";
        database.ref('rooms/' + roomCode + '/chat').push({ sender: "👑 المدير", text: "🔒 تم قفل الكلمة وبدأت الجولة الحين!" });
    });
}

function resetRoomToLobby() {
    if (!confirm("هل أنت متأكد من إنهاء الجولة والعودة للوبي لبدء قيم جديد؟")) return;
    database.ref('rooms/' + roomCode + '/players').once('value', (snap) => {
        const players = snap.val();
        if (players) {
            for (let idKey in players) {
                database.ref('rooms/' + roomCode + '/players/' + idKey).update({ attempts: 3, challengeAnswer: "", votedFor: "", hints: null, manualHintCount: 0 });
            }
        }
        database.ref('rooms/' + roomCode).update({ gameStatus: "lobby", secretWord: "", winnerWordPlayer: "" }).then(() => {
            database.ref('rooms/' + roomCode + '/chat').remove();
            alert("🔄 تم العودة للوبي بنجاح!");
        });
    });
}

function kickPlayer(playerUID, pName) {
    if (confirm(`طرد [ ${pName} ] نهائياً؟`)) {
        database.ref('rooms/' + roomCode + '/blacklist/' + playerUID).set(true).then(() => {
            database.ref('rooms/' + roomCode + '/players/' + playerUID).remove();
        });
    }
}

function giveManualHint(playerUID, pName) {
    const hintText = prompt(`تلميح سري لـ [ ${pName} ] (محد بيشوفه غيره):`);
    if (!hintText || !hintText.trim()) return;
    const pRef = database.ref('rooms/' + roomCode + '/players/' + playerUID);
    pRef.child('hints').push(hintText.trim());
    pRef.child('manualHintCount').transaction((c) => { return (c || 0) + 1; });
}

function modifyPlayerAttempts(playerUID, currentAtt) {
    const newAttStr = prompt(`اكتب المحاولات الجديدة:`, currentAtt);
    if (newAttStr === null) return;
    const newAtt = parseInt(newAttStr);
    if (!isNaN(newAtt) && newAtt >= 0) database.ref('rooms/' + roomCode + '/players/' + playerUID).update({ attempts: newAtt });
}