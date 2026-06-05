// ==========================================
// ملف التحكم الخاص بالمدير (Host) - نسخة خالية من التعارض
// ==========================================

let database;
let roomCode = "";
let myUID = ""; // 👑 تم تعريفها هنا كمتغير أساسي للمشروع
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
    }).catch(err => {
        alert("خطأ في إنشاء الغرفة: " + err.message);
    });
}

function setupHostPresence() {
    if (!database || !roomCode) return;
    database.ref('rooms/' + roomCode + '/hostUID').onDisconnect().remove();
}

function listenToPlayers() {
    database.ref('rooms/' + roomCode + '/players').on('value', (snapshot) => {
        const playersListDiv = document.getElementById('host-players-list');
        playersListDiv.innerHTML = "";
        const players = snapshot.val();

        if (!players) {
            playersListDiv.innerHTML = '<span class="empty-state">بانتظار دخول اللاعبين... 🕒</span>';
            return;
        }

        for (let idKey in players) {
            const player = players[idKey];
            const pRow = document.createElement('div');
            pRow.className = "player-row-admin";
            pRow.style.display = "flex";
            pRow.style.justify = "space-between";
            pRow.style.alignItems = "center";
            pRow.style.padding = "8px 12px";
            pRow.style.background = "#1e293b";
            pRow.style.borderRadius = "6px";
            pRow.style.marginBottom = "6px";

            // تحضير العدادات التفاعلية للمحاولات والتلميحات
            const currentAttempts = player.attempts !== undefined ? player.attempts : 3;
            const hintCount = player.manualHintCount !== undefined ? player.manualHintCount : 0;

            pRow.innerHTML = `
                <div>
                    <span style="font-weight:bold; color:#fff;">🎮 ${player.name}</span>
                    <div style="font-size:0.8rem; color:#94a3b8; margin-top:2px;">
                        <span class="attempt-controls">المحاولات: <strong style="color:#ef4444">${currentAttempts}</strong></span> | 
                        <span class="hint-controls">التلميحات: <strong style="color:#00ffcc">${hintCount}</strong></span>
                    </div>
                </div>
                <div class="action-btn-group" style="display:flex; gap:5px;">
                    <button type="button" onclick="giveManualHint('${idKey}', '${player.name}')" class="btn" style="background:#0284c7; color:white; padding:4px 8px; font-size:0.75rem; width:auto; margin:0;">💡 تلميح</button>
                    <button type="button" onclick="modifyPlayerAttempts('${idKey}', ${currentAttempts})" class="btn" style="background:#f59e0b; color:white; padding:4px 8px; font-size:0.75rem; width:auto; margin:0;">⚙️ المحاولات</button>
                    <button type="button" onclick="kickPlayer('${idKey}', '${player.name}')" class="btn" style="background:#ef4444; color:white; padding:4px 8px; font-size:0.75rem; width:auto; margin:0;">❌ طرد</button>
                </div>
            `;
            playersListDiv.appendChild(pRow);
        }
    });
}

function listenToChallengeAnswers() {
    database.ref('rooms/' + roomCode + '/players').on('value', (snapshot) => {
        const box = document.getElementById('host-challenges-box');
        box.innerHTML = "";
        const players = snapshot.val();
        if (!players) {
            box.innerHTML = '<span class="empty-state">لا يوجد إجابات تحديات حالياً...</span>';
            return;
        }

        let answersArray = [];
        for (let idKey in players) {
            const p = players[idKey];
            if (p.challengeAnswer) {
                answersArray.push({
                    name: p.name,
                    answer: p.challengeAnswer,
                    round: p.challengeRound || currentRound
                });
            }
        }

        if (answersArray.length === 0) {
            box.innerHTML = '<span class="empty-state">لم يرسل أي لاعب حل التحدي بعد في هذه الجولة.</span>';
            return;
        }

        answersArray.forEach(item => {
            const row = document.createElement('div');
            row.className = "msg";
            row.style.background = "#1e293b";
            row.style.borderRight = "3px solid #38bdf8";
            row.innerHTML = `<strong>${item.name}</strong> (جولة ${item.round}): <span style="color:#38bdf8;">${item.answer}</span>`;
            box.appendChild(row);
        });
        box.scrollTop = box.scrollHeight;
    });
}

function listenToChatForHost() {
    database.ref('rooms/' + roomCode + '/chat').on('value', (snapshot) => {
        const chatBox = document.getElementById('host-chat-box');
        chatBox.innerHTML = "";
        const messages = snapshot.val();
        if (!messages) return;

        for (let msgId in messages) {
            const msgData = messages[msgId];
            const msgItem = document.createElement('div');
            msgItem.className = "msg msg-host";
            msgItem.innerHTML = `<strong>${msgData.sender}:</strong> ${msgData.text}`;
            chatBox.appendChild(msgItem);
        }
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

function listenToGameStatusForHost() {
    database.ref('rooms/' + roomCode).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        currentRound = data.currentRound || 1;
        document.getElementById('host-current-round').innerText = currentRound;

        const alertBox = document.getElementById('host-winner-alert-box');
        if (data.gameStatus === "word_guessed_waiting") {
            document.getElementById('host-winner-name').innerText = data.winnerWordPlayer || "مجهول";
            alertBox.classList.remove('d-none');
        } else {
            alertBox.classList.add('d-none');
        }
    });
}

function saveSecretWord() {
    const wordInput = document.getElementById('secret-word');
    const wordText = wordInput.value.trim();
    if (!wordText) {
        alert("اكتب كلمة أولاً لتثبيتها للشباب!");
        return;
    }

    database.ref('rooms/' + roomCode).update({
        secretWord: wordText,
        gameStatus: "playing",
        winnerWordPlayer: ""
    }).then(() => {
        alert("🔒 تم قفل الكلمة بنجاح، اللعب مفتوح للاعبين الحين بالتخمين!");
    });
}

function activateVotingStage() {
    database.ref('rooms/' + roomCode).update({
        gameStatus: "voting"
    }).then(() => {
        alert("🚀 تم إطلاق شاشة التصويت الإجباري لجميع اللاعبين بنجاح!");
    });
}

function nextRound() {
    if (currentRound >= maxRounds) {
        alert("وصلت للجولة الأخيرة للروم الحالي يا مدير!");
        return;
    }
    currentRound++;
    
    // تصفير البيانات المؤقتة والتحضير لجولة نظيفة جديدة
    database.ref('rooms/' + roomCode).update({
        currentRound: currentRound,
        gameStatus: "lobby",
        secretWord: "",
        winnerWordPlayer: ""
    });

    database.ref('rooms/' + roomCode + '/players').once('value', (snapshot) => {
        const players = snapshot.val();
        if (players) {
            for (let idKey in players) {
                database.ref('rooms/' + roomCode + '/players/' + idKey).update({
                    challengeAnswer: "",
                    votedFor: "",
                    attempts: 3
                });
            }
        }
    });

    document.getElementById('secret-word').value = "";
    alert(`➡️ انتقلت للجولة [ ${currentRound} ] بنجاح وتصفرت أوراق اللاعبين!`);
}

function resetFullGame() {
    if (!confirm("هل أنت متأكد من إعادة تصفير الجيم بالكامل للجولة 1 وفتح المحاولات؟")) return;
    currentRound = 1;

    database.ref('rooms/' + roomCode).update({
        currentRound: 1,
        gameStatus: "lobby",
        secretWord: "",
        winnerWordPlayer: ""
    });

    database.ref('rooms/' + roomCode + '/players').once('value', (snapshot) => {
        const players = snapshot.val();
        if (players) {
            for (let idKey in players) {
                database.ref('rooms/' + roomCode + '/players/' + idKey).update({
                    challengeAnswer: "",
                    votedFor: "",
                    attempts: 3,
                    manualHintCount: 0
                });
                database.ref('rooms/' + roomCode + '/players/' + idKey + '/hints').remove();
            }
        }
    });

    document.getElementById('secret-word').value = "";
    alert("🔄 تم تصفير وإعادة تشغيل الجلسة بالكامل من جديد!");
}

function sendHostChatMessage() {
    const chatInput = document.getElementById('host-chat-input');
    const msgText = chatInput.value.trim();
    if (!msgText || !database) return;

    database.ref('rooms/' + roomCode + '/chat').push({
        sender: `👑 المدير (${hostName})`,
        text: msgText
    });
    chatInput.value = "";
}

function giveManualHint(playerUID, pName) {
    const hintText = prompt(`اكتب التلميح الخاص السري للاعب [ ${pName} ] (محد بيشوفه غيره):`);
    if (!hintText || !hintText.trim()) return;

    const pRef = database.ref('rooms/' + roomCode + '/players/' + playerUID);
    pRef.child('hints').push(hintText.trim());

    pRef.child('manualHintCount').transaction((currentCount) => {
        return (currentCount || 0) + 1;
    });
    alert(`💡 تم إرسال التلميح السري إلى ${pName} بنجاح!`);
}

function modifyPlayerAttempts(playerUID, currentAtt) {
    const newAttStr = prompt(`تعديل عدد المحاولات الحالي للاعب. اكتب الرقم الجديد:`, currentAtt);
    if (newAttStr === null) return;
    const newAtt = parseInt(newAttStr);
    if (isNaN(newAtt) || newAtt < 0) {
        alert("الرجاء كتابة رقم صحيح ومقبول!");
        return;
    }
    database.ref('rooms/' + roomCode + '/players/' + playerUID).update({ attempts: newAtt });
    alert("⚙️ تم تحديث عدد محاولات اللاعب فوراً في السيرفر!");
}

function kickPlayer(playerUID, pName) {
    if (!confirm(`هل أنت متأكد من طرد اللاعب [ ${pName} ] وحظر دخوله للروم مجدداً؟`)) return;
    database.ref('rooms/' + roomCode + '/blacklist/' + playerUID).set(true).then(() => {
        database.ref('rooms/' + roomCode + '/players/' + playerUID).remove();
        alert(`❌ تم طرد ${pName} ووضعه في القائمة السوداء للروم.`);
    });
}