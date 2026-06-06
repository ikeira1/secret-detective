// ==========================================
// ملف التحكم الخاص بالمدير (Host) - نسخة الجدول الزمني الاحترافي
// ==========================================

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
            pRow.style.justifyContent = "space-between";
            pRow.style.alignItems = "center";
            pRow.style.padding = "10px";
            pRow.style.background = "#1e293b";
            pRow.style.borderRadius = "8px";
            pRow.style.marginBottom = "6px";

            const currentAttempts = player.attempts !== undefined ? player.attempts : 3;
            const hintCount = player.manualHintCount !== undefined ? player.manualHintCount : 0;
            const displayName = player.name ? player.name : "لاعب متصل";

            pRow.innerHTML = `
                <div>
                    <span style="font-weight:bold; color:#fff;">🎮 ${displayName}</span>
                    <div style="font-size:0.8rem; color:#94a3b8; margin-top:2px;">
                        <span>المحاولات: <strong style="color:#ef4444">${currentAttempts}</strong></span> | 
                        <span>التلميحات: <strong style="color:#00ffcc">${hintCount}</strong></span>
                    </div>
                </div>
                <div class="action-btn-group" style="display:flex; gap:5px;">
                    <button type="button" onclick="giveManualHint('${idKey}', '${displayName}')" class="btn btn-sm" style="background:#0284c7; color:white;">💡 تلميح</button>
                    <button type="button" onclick="modifyPlayerAttempts('${idKey}', ${currentAttempts})" class="btn btn-sm" style="background:#f59e0b; color:white;">⚙️ محاولات</button>
                    <button type="button" onclick="kickPlayer('${idKey}', '${displayName}')" class="btn btn-sm" style="background:#ef4444; color:white;">❌ طرد</button>
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

        let allAnswers = [];
        for (let idKey in players) {
            const p = players[idKey];
            if (p.challengeHistory) {
                for (let rNum in p.challengeHistory) {
                    allAnswers.push({
                        name: p.name || "مجهول",
                        round: parseInt(rNum),
                        answer: p.challengeHistory[rNum].answer,
                        timestamp: p.challengeHistory[rNum].timestamp || 0
                    });
                }
            }
        }

        if (allAnswers.length === 0) {
            box.innerHTML = '<span class="empty-state">لم يرسل أي لاعب حل التحدي بعد.</span>';
            return;
        }

        allAnswers.sort((a, b) => {
            if (a.round !== b.round) return b.round - a.round;
            return a.timestamp - b.timestamp;
        });

        let lastRenderedRound = null;
        let rankInRound = 1;

        allAnswers.forEach(item => {
            if (item.round !== lastRenderedRound) {
                lastRenderedRound = item.round;
                rankInRound = 1;
                
                const divider = document.createElement('div');
                divider.className = "round-divider";
                divider.innerHTML = `<span>🎯 تحديات وإجابات الجولة [ ${item.round} ]</span>`;
                box.appendChild(divider);
            }

            let timeString = "بدون توقيت";
            if (item.timestamp) {
                const date = new Date(item.timestamp);
                const hrs = String(date.getHours()).padStart(2, '0');
                const mins = String(date.getMinutes()).padStart(2, '0');
                const secs = String(date.getSeconds()).padStart(2, '0');
                const ms = String(date.getMilliseconds()).padStart(3, '0');
                timeString = `${hrs}:${mins}:${secs}.${ms}`;
            }

            const isFirst = rankInRound === 1;
            const badgeText = isFirst ? "🥇 الأسرع" : `#${rankInRound}`;
            const badgeBg = isFirst ? "#f59e0b" : "#475569";

            const row = document.createElement('div');
            row.style.background = isFirst ? "rgba(245, 158, 11, 0.15)" : "#1e293b";
            row.style.borderRight = isFirst ? "4px solid #f59e0b" : "3px solid #38bdf8";
            row.style.padding = "8px 12px";
            row.style.borderRadius = "6px";
            row.style.marginBottom = "5px";
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";

            row.innerHTML = `
                <div>
                    <span class="badge" style="background:${badgeBg}; margin-left:8px;">${badgeText}</span>
                    <strong>${item.name}</strong>: <span style="color:#38bdf8; font-weight:bold;">${item.answer}</span>
                </div>
                <small style="color:#64748b; font-family:monospace; font-size:0.75rem;">⏱️ ${timeString}</small>
            `;

            box.appendChild(row);
            rankInRound++;
        });
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
        database.ref('rooms/' + roomCode + '/chat').push({
            sender: "📢 [النظام]",
            text: "المدير قفل وثبّت الكلمة السرية المحورية الحين! خانة التخمين مفتوحة للاعبين.. ورونا ذكائكم! 🔥"
        });
        alert("🔒 تم تثبيت وقفل الكلمة السرية المحورية بنجاح طول القيم الحين!");
    });
}

function activateVotingStage() {
    database.ref('rooms/' + roomCode).update({ gameStatus: "voting" }).then(() => {
        alert("🚀 تم إطلاق شاشة التصويت الإجباري لجميع اللاعبين بنجاح!");
    });
}

function nextRound() {
    currentRound++;
    database.ref('rooms/' + roomCode).update({
        currentRound: currentRound,
        gameStatus: "playing",
        winnerWordPlayer: ""
    });

    database.ref('rooms/' + roomCode + '/players').once('value', (snapshot) => {
        const players = snapshot.val();
        if (players) {
            for (let idKey in players) {
                database.ref('rooms/' + roomCode + '/players/' + idKey).update({ challengeAnswer: "" });
            }
        }
    });

    database.ref('rooms/' + roomCode + '/chat').push({
        sender: "📢 [النظام]",
        text: `انتقلنا للتحدي رقم [ ${currentRound} ]! ركزوا مع المدير بالبث لمعرفة السؤال الجديد وعطوه الحل الأسرع! 🚀`
    });

    document.getElementById('host-current-round').innerText = currentRound;
    alert(`➡️ انتقلت للجولة والتحدي رقم [ ${currentRound} ] بنجاح، والكلمة السرية ثابتة ومحفوظة!`);
}

function clearCurrentRoundAnswers() {
    if (!confirm("هل أنت متأكد وتبغى تمسح أجوبة التحدي حقت الجولة الحالية بس عشان يعيدون كتابتها؟")) return;
    database.ref('rooms/' + roomCode + '/players').once('value', (snapshot) => {
        const players = snapshot.val();
        if (players) {
            for (let idKey in players) {
                database.ref('rooms/' + roomCode + '/players/' + idKey + '/challengeHistory/' + currentRound).remove();
                database.ref('rooms/' + roomCode + '/players/' + idKey).update({ challengeAnswer: "" });
            }
        }
    });
    alert("🗑️ تم تنظيف كشف التحدي للجولة الحالية بنجاح.");
}

function resetFullGame() {
    if (!confirm("هل أنت متأكد من إعادة تصفير الجيم والكلمة بالكامل للجولة 1 وفتح المحاولات؟")) return;
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
                database.ref('rooms/' + roomCode + '/players/' + idKey + '/challengeHistory').remove();
            }
        }
    });

    document.getElementById('secret-word').value = "";
    document.getElementById('host-current-round').innerText = 1;
    alert("🔄 تم نسف وإعادة تصفير الجلسة بالكامل للبداية!");
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

function listenToChatForHost() {
    database.ref('rooms/' + roomCode + '/chat').on('value', (snapshot) => {
        const chatBox = document.getElementById('host-chat-box');
        if (!chatBox) return;
        chatBox.innerHTML = "";
        const messages = snapshot.val();
        if (!messages) return;

        for (let msgId in messages) {
            const msgData = messages[msgId];
            const msgItem = document.createElement('div');
            msgItem.className = "msg";
            msgItem.style.padding = "4px 8px";
            msgItem.innerHTML = `<strong>${msgData.sender}:</strong> ${msgData.text}`;
            chatBox.appendChild(msgItem);
        }
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

function listenToGameStatusForHost() {
    // مستمع إضافي للمدير لمتابعة التحديثات الهيكلية إن لزم الأمر
}

function giveManualHint(playerUID, pName) {
    const hintText = prompt(`اكتب التلميح الخاص السري للاعب [ ${pName} ] (محد بيشوفه غيره):`);
    if (!hintText || !hintText.trim()) return;

    const pRef = database.ref('rooms/' + roomCode + '/players/' + playerUID);
    pRef.child('hints').push(hintText.trim());
    pRef.child('manualHintCount').transaction((currentCount) => { return (currentCount || 0) + 1; });
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