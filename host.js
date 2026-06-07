let database;
let roomCode = "";
let myUID = ""; 
let hostName = "";
let currentRound = 1;
let maxRounds = 5;
let activePrivateChatPlayerUID = ""; // لتحديد اللاعب النشط حالياً في الشات الخاص للمدير

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
                <div class="d-flex gap-1">
                    <button onclick="openHostPrivateChat('${idKey}', '${player.name}')" class="btn btn-sm btn-light py-1">💬 خاص</button>
                    <button onclick="giveManualHint('${idKey}', '${player.name}')" class="btn btn-sm btn-info text-dark py-1">💡 تلميح</button>
                    <button onclick="modifyPlayerAttempts('${idKey}', ${currentAttempts})" class="btn btn-sm btn-warning py-1">⚙️</button>
                    <button onclick="kickPlayer('${idKey}', '${player.name}')" class="btn btn-sm btn-danger py-1">❌</button>
                </div>
            `;
            playersListDiv.appendChild(pRow);
        }
    });
}

// فتح شات خاص مع لاعب محدد للمدير
function openHostPrivateChat(playerUID, pName) {
    activePrivateChatPlayerUID = playerUID;
    document.getElementById('host-target-player-name').innerText = pName;
    document.getElementById('host-private-chat-section').classList.remove('d-none');

    // قطع الاتصال بالمستمع القديم إن وجد والمزامنة مع الشات الجديد
    database.ref('rooms/' + roomCode + '/private_chats/' + playerUID).off();
    database.ref('rooms/' + roomCode + '/private_chats/' + playerUID).on('value', (snapshot) => {
        const pChatLog = document.getElementById('host-private-chat-log');
        if (!pChatLog) return;
        pChatLog.innerHTML = "";
        const messages = snapshot.val();
        if (!messages) {
            pChatLog.innerHTML = `<span class="empty-state">محادثة سرية نظيفة، أرسل أول رسالة...</span>`;
            return;
        }
        for (let mKey in messages) {
            const msg = messages[mKey];
            const div = document.createElement('div');
            div.className = msg.sender === "👑 المدير" ? "msg msg-host text-end ms-auto mb-1" : "msg msg-player text-end me-auto mb-1";
            div.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;
            pChatLog.appendChild(div);
        }
        pChatLog.scrollTop = pChatLog.scrollHeight;
    });
}

function closeHostPrivateChat() {
    document.getElementById('host-private-chat-section').classList.add('d-none');
    if (activePrivateChatPlayerUID) {
        database.ref('rooms/' + roomCode + '/private_chats/' + activePrivateChatPlayerUID).off();
    }
}

function sendHostPrivateChatMessage() {
    const chatInput = document.getElementById('host-private-chat-message');
    const msgText = chatInput.value.trim();
    if (!msgText || !activePrivateChatPlayerUID) return;

    database.ref('rooms/' + roomCode + '/private_chats/' + activePrivateChatPlayerUID).push({
        sender: "👑 المدير",
        text: msgText
    });
    chatInput.value = "";
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

        currentRound = data.currentRound || 1;
        document.getElementById('host-current-round-text').innerText = currentRound;

        // تحديث الكلمة السرية المقفلة داخل الصندوق للمدير بشكل ثابت ومستمر
        const wordDisplay = document.getElementById('host-current-word-display');
        if (data.secretWord) {
            wordDisplay.innerText = `🔑 [ ${data.secretWord} ]`;
            wordDisplay.className = "fs-4 text-center text-success font-weight-bold animated-pulse";
        } else {
            wordDisplay.innerText = "🔒 لم تُحدد بعد";
            wordDisplay.className = "fs-4 text-center text-warning font-weight-bold";
        }

        const adminStatusBadge = document.getElementById('admin-game-status-badge');
        if (data.gameStatus === "lobby") {
            adminStatusBadge.innerText = "انتظار قفل الكلمة السرية 🔑";
            document.getElementById('btn-lock-word').disabled = false;
        } else if (data.gameStatus === "playing") {
            adminStatusBadge.innerText = "الجولة شغالة.. التخمين مفتوح! 🏃‍♂️🔥";
            document.getElementById('btn-lock-word').disabled = true;
        } else if (data.gameStatus === "voting") {
            adminStatusBadge.innerText = "🗳️ مرحلة التصويت الإجباري نشطة!";
            document.getElementById('btn-lock-word').disabled = true;
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

// ⏭️ الانتقال للجولة التالية بشكل سليم وصيانة البيانات
function nextRound() {
    if (currentRound >= maxRounds) {
        alert("⚠️ لقد وصلت للحد الأقصى من الجولات المحددة للمشروع!");
        return;
    }
    if (!confirm("هل تريد الانتقال للجولة التالية؟ سيتم تصفير الكلمة والمحاولات ورفع رقم الجولة.")) return;

    database.ref('rooms/' + roomCode + '/players').once('value', (snap) => {
        const players = snap.val();
        if (players) {
            for (let idKey in players) {
                database.ref('rooms/' + roomCode + '/players/' + idKey).update({ 
                    attempts: 3, 
                    challengeAnswer: "", 
                    votedFor: "", 
                    hints: null, 
                    manualHintCount: 0 
                });
            }
        }
        database.ref('rooms/' + roomCode).update({ 
            currentRound: currentRound + 1, 
            gameStatus: "lobby", 
            secretWord: "", 
            winnerWordPlayer: "" 
        }).then(() => {
            database.ref('rooms/' + roomCode + '/chat').remove();
            const logDiv = document.getElementById('host-challenges-log');
            if (logDiv) logDiv.innerHTML = "";
            alert(`✅ تم الانتقال بنجاح للجولة رقم ${currentRound + 1}!`);
        });
    });
}

// 🔄 إعادة تعيين نفس الجولة الحالية بدون رفع الرقم
function resetCurrentRound() {
    if (!confirm("هل أنت متأكد من إعادة تعيين نفس الجولة الحالية وتصفير المحاولات والكلمة؟")) return;

    database.ref('rooms/' + roomCode + '/players').once('value', (snap) => {
        const players = snap.val();
        if (players) {
            for (let idKey in players) {
                database.ref('rooms/' + roomCode + '/players/' + idKey).update({ 
                    attempts: 3, 
                    challengeAnswer: "", 
                    votedFor: "", 
                    hints: null, 
                    manualHintCount: 0 
                });
            }
        }
        database.ref('rooms/' + roomCode).update({ 
            gameStatus: "lobby", 
            secretWord: "", 
            winnerWordPlayer: "" 
        }).then(() => {
            database.ref('rooms/' + roomCode + '/chat').remove();
            const logDiv = document.getElementById('host-challenges-log');
            if (logDiv) logDiv.innerHTML = "";
            alert("🔄 تم إعادة الجولة الحالية وتصفير البيانات للوبي الجولة!");
        });
    });
}

function resetRoomToLobby() {
    if (!confirm("هل أنت متأكد من إنهاء اللعبة بالكامل؟ سيتم تصفير الغرفة والعودة للجولة الأولى.")) return;
    database.ref('rooms/' + roomCode + '/players').once('value', (snap) => {
        const players = snap.val();
        if (players) {
            for (let idKey in players) {
                database.ref('rooms/' + roomCode + '/players/' + idKey).update({ 
                    attempts: 3, 
                    challengeAnswer: "", 
                    votedFor: "", 
                    hints: null, 
                    manualHintCount: 0 
                });
            }
        }
        database.ref('rooms/' + roomCode).update({ 
            currentRound: 1, 
            gameStatus: "lobby", 
            secretWord: "", 
            winnerWordPlayer: "" 
        }).then(() => {
            database.ref('rooms/' + roomCode + '/chat').remove();
            database.ref('rooms/' + roomCode + '/private_chats').remove();
            alert("🔄 تم إنهاء الجلسة والعودة للوبي الأول بنجاح!");
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