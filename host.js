// ==========================================
// ملف التحكم الخاص بمدير الجلسة المطور (Host)
// ==========================================

let database;
let roomCode = "";
let currentRound = 1;
let maxRounds = 5;

function initHost() {
    const hostName = document.getElementById('host-name').value.trim();
    maxRounds = parseInt(document.getElementById('total-rounds').value) || 5;

    if (!hostName) {
        alert("الرجاء كتابة اسمك أولاً يا مدير!");
        return;
    }

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        database = firebase.database();
    } catch (error) {
        alert("خطأ في تحميل سيرفر فايربيس: " + error.message);
        return;
    }

    roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    document.getElementById('display-room-code').innerText = `رمز الروم: ${roomCode}`;
    document.getElementById('host-max-rounds').innerText = maxRounds;

    localStorage.setItem('sd_role', 'host');
    localStorage.setItem('sd_roomCode', roomCode);
    localStorage.setItem('sd_playerName', hostName);

    database.ref('rooms/' + roomCode).set({
        hostName: hostName,
        maxRounds: maxRounds,
        currentRound: currentRound,
        secretWord: "",
        gameStatus: "lobby",
        winnerWordPlayer: "",
        chat: { "system": { sender: "النظام", text: "تم إنشاء الغرفة بنجاح!" } }
    }).then(() => {
        document.getElementById('auth-screen').classList.add('d-none');
        document.getElementById('host-screen').classList.remove('d-none');
        listenToPlayers();
        listenToChallengeAnswers();
        listenForHostTransfer(); 
        listenToChatForHost();
        listenToGameStatusForHost(); // مراقبة حالة الجيم لرصد من يكتشف الكلمة
    }).catch((error) => {
        alert("خطأ في الاتصال بقاعدة البيانات: " + error.message);
    });
}

function saveSecretWord() {
    const wordInput = document.getElementById('secret-word');
    const wordBtn = document.getElementById('save-word-btn');
    const word = wordInput.value.trim();
    
    if (!word) {
        alert("اكتب كلمة سرية أولاً!");
        return;
    }

    wordInput.disabled = true;
    wordBtn.disabled = true;
    wordBtn.innerText = "🔒 تم التثبيت";
    wordInput.style.backgroundColor = "#1e293b";

    database.ref('rooms/' + roomCode).update({
        secretWord: word,
        gameStatus: "playing"
    });

    database.ref('rooms/' + roomCode + '/chat').push({
        sender: "🚨 النظام",
        text: "المدير حدد الكلمة السرية الحين! بدأت الجولة رسميًا.. ورونا شطارتكم بالتخمين! 🤔🔥"
    });
}

// دالة مراقبة حالة الروم والكلمة السرية عند المدير لكشف الفائز له أولاً ومنع قفل الصفحة التلقائي
function listenToGameStatusForHost() {
    database.ref('rooms/' + roomCode).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // إذا تم اكتشاف الكلمة ولكننا لم نطلق مرحلة التصويت بعد
        if (data.gameStatus === "word_guessed_waiting" && data.winnerWordPlayer) {
            document.getElementById('host-winner-name').innerText = data.winnerWordPlayer;
            document.getElementById('host-winner-alert-box').classList.remove('d-none');
        } else {
            document.getElementById('host-winner-alert-box').classList.add('d-none');
        }
    });
}

// الزر المطور لتفعيل مرحلة التصويت للاعبين يدويًا بعد ما يخلص المدير طقطقة وسوالف
function activateVotingStage() {
    database.ref('rooms/' + roomCode).update({
        gameStatus: "voting"
    });
    // إرسال تنبيه في الشات
    database.ref('rooms/' + roomCode + '/chat').push({
        sender: "🚨 النظام",
        text: "انطلقت مرحلة التصويت الحين لايف بشاشاتكم! خمنوا من البطل اللي قفط الكلمة؟ 👀💥"
    });
}

function listenToPlayers() {
    database.ref('rooms/' + roomCode + '/players').on('value', (snapshot) => {
        const playersListDiv = document.getElementById('host-players-list');
        playersListDiv.innerHTML = "";
        const players = snapshot.val();

        if (!players) {
            playersListDiv.innerHTML = '<span class="empty-state">في انتظار دخول اللاعبين...</span>';
            return;
        }

        for (let playerId in players) {
            const player = players[playerId];
            const manualHintCount = player.manualHintCount || 0;
            const currentAttempts = player.attempts !== undefined ? player.attempts : 3;

            const playerRow = document.createElement('div');
            playerRow.className = "card player-card-hover"; 
            playerRow.style.padding = "12px";
            playerRow.style.marginBottom = "10px";
            playerRow.style.position = "relative";
            
            playerRow.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <strong>🎮 ${player.name}</strong>
                        <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
                            <span style="font-size: 0.85rem; color: #00ffcc;">💡 تلميحاته: <strong>${manualHintCount}</strong></span>
                            <div class="hint-controls">
                                <button type="button" onclick="changeHintCount('${playerId}', 1)" style="background: #10b981; color: white; border: none; border-radius: 4px; padding: 0px 6px; font-size: 0.75rem; cursor: pointer; font-weight: bold;">+</button>
                                <button type="button" onclick="changeHintCount('${playerId}', -1)" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 0px 7px; font-size: 0.75rem; cursor: pointer; font-weight: bold;">-</button>
                            </div>
                        </div>
                    </div>
                    <div style="text-align: left;">
                        <div style="display: flex; align-items: center; gap: 6px; justify-content: flex-end; margin-bottom: 5px;">
                            <span class="badge" style="border-color: #ff007c; color: #ff007c; font-size: 0.8rem; padding: 2px 6px;">محاولاته: ${currentAttempts}</span>
                            <div class="attempt-controls">
                                <button type="button" onclick="changePlayerAttempts('${playerId}', 1)" style="background: #6366f1; color: white; border: none; border-radius: 4px; padding: 0px 5px; font-size: 0.75rem; cursor: pointer; font-weight: bold;">+</button>
                                <button type="button" onclick="changePlayerAttempts('${playerId}', -1)" style="background: #f59e0b; color: white; border: none; border-radius: 4px; padding: 0px 6px; font-size: 0.75rem; cursor: pointer; font-weight: bold;">-</button>
                            </div>
                        </div>
                        <button type="button" onclick="transferHost('${playerId}', '${player.name}')" class="btn" style="width:auto; padding: 2px 8px; font-size:0.75rem; background-color:#4f46e5; color:white; border:none; border-radius:4px; cursor:pointer; font-weight: bold;">تعيين كمدير 👑</button>
                    </div>
                </div>
                <div class="form-group inline-group" style="margin-bottom: 0;">
                    <input type="text" id="hint-input-${playerId}" placeholder="اكتب تلميحاً سرياً له...">
                    <button type="button" onclick="sendPrivateHint('${playerId}')" class="btn btn-host" style="width:auto; padding: 5px 10px; font-size:0.9rem;">إرسال</button>
                </div>
            `;
            playersListDiv.appendChild(playerRow);
        }
    });
}

function changeHintCount(playerId, value) {
    const playerRef = database.ref('rooms/' + roomCode + '/players/' + playerId);
    playerRef.once('value', (snapshot) => {
        const player = snapshot.val();
        if (!player) return;
        let currentCount = player.manualHintCount || 0;
        let newCount = currentCount + value;
        if (newCount < 0) newCount = 0;
        playerRef.update({ manualHintCount: newCount });
    });
}

// دالة التحكم اليدوي بعدد المحاولات للالاعبين زيادة أو نقصان
function changePlayerAttempts(playerId, value) {
    const playerRef = database.ref('rooms/' + roomCode + '/players/' + playerId);
    playerRef.once('value', (snapshot) => {
        const player = snapshot.val();
        if (!player) return;
        let currentAttempts = player.attempts !== undefined ? player.attempts : 3;
        let newAttempts = currentAttempts + value;
        if (newAttempts < 0) newAttempts = 0;
        playerRef.update({ attempts: newAttempts });
    });
}

function sendPrivateHint(playerId) {
    const hintInput = document.getElementById(`hint-input-${playerId}`);
    const hintText = hintInput.value.trim();
    if (!hintText) {
        alert("اكتب تلميحاً أولاً!");
        return;
    }
    database.ref('rooms/' + roomCode + '/players/' + playerId + '/hints').push(hintText);
    hintInput.value = "";
}

// ترتيب صندوق الإجابات بالفواصل والترتيب العددي التصاعدي للأسرع بكل جولة
function listenToChallengeAnswers() {
    database.ref('rooms/' + roomCode).on('value', (roomSnapshot) => {
        const roomData = roomSnapshot.val();
        const box = document.getElementById('host-challenges-box');
        box.innerHTML = "";
        
        if (!roomData || !roomData.players) {
            box.innerHTML = '<span class="empty-state">لم يرسل أي لاعب حل التحدي بعد...</span>';
            return;
        }

        const players = roomData.players;
        
        let roundsAnswers = {};
        for (let i = 1; i <= (roomData.currentRound || 1); i++) {
            roundsAnswers[i] = [];
        }

        for (let playerId in players) {
            const player = players[playerId];
            if (player.challengeAnswer) {
                const rNum = player.challengeRound || roomData.currentRound || 1;
                if (!roundsAnswers[rNum]) roundsAnswers[rNum] = [];
                
                roundsAnswers[rNum].push({
                    name: player.name,
                    answer: player.challengeAnswer,
                    timestamp: player.challengeTimestamp || 0
                });
            }
        }

        let hasAnyData = false;

        for (let r = 1; r <= (roomData.currentRound || 1); r++) {
            const list = roundsAnswers[r] || [];
            if (list.length > 0) {
                hasAnyData = true;
                
                list.sort((a, b) => a.timestamp - b.timestamp);

                const divider = document.createElement('div');
                divider.className = "round-divider";
                divider.innerText = `⏳ إجابات الجولة رقم [ ${r} ]`;
                box.appendChild(divider);

                list.forEach((item, index) => {
                    const msg = document.createElement('div');
                    msg.className = "msg msg-host";
                    msg.style.borderLeft = "3px solid #38bdf8";
                    msg.innerHTML = `<strong>[ ${index + 1} ] ${item.name}:</strong> ${item.answer}`;
                    box.appendChild(msg);
                });
            }
        }

        if (!hasAnyData) {
            box.innerHTML = '<span class="empty-state">لم يرسل أي لاعب حل التحدي بعد...</span>';
        }
    });
}

function listenToChatForHost() {
    database.ref('rooms/' + roomCode + '/chat').on('value', (snapshot) => {
        const chatBox = document.getElementById('host-chat-box');
        if(!chatBox) return;
        chatBox.innerHTML = "";
        const messages = snapshot.val();
        if (!messages) return;

        for (let msgId in messages) {
            const msgData = messages[msgId];
            const msgItem = document.createElement('div');
            msgItem.className = "msg msg-player";
            msgItem.innerHTML = `<strong>${msgData.sender}:</strong> ${msgData.text}`;
            chatBox.appendChild(msgItem);
        }
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

function sendHostChatMessage() {
    const chatInput = document.getElementById('host-chat-input');
    const msgText = chatInput.value.trim();
    const myName = localStorage.getItem('sd_playerName') || "المدير";
    if (!msgText) return;

    database.ref('rooms/' + roomCode + '/chat').push({
        sender: myName + " 👑",
        text: msgText
    });
    chatInput.value = "";
}

function nextRound() {
    if (currentRound >= maxRounds) {
        alert("وصلت للحد الأقصى من الجولات!");
        return;
    }
    currentRound++;
    document.getElementById('host-current-round').innerText = currentRound;
    
    const wordInput = document.getElementById('secret-word');
    const wordBtn = document.getElementById('save-word-btn');
    wordInput.value = "";
    wordInput.disabled = false;
    wordInput.style.backgroundColor = "";
    wordBtn.disabled = false;
    wordBtn.innerText = "تثبيت الكلمة";

    database.ref('rooms/' + roomCode).update({ 
        currentRound: currentRound,
        secretWord: "",
        gameStatus: "lobby",
        winnerWordPlayer: ""
    });
    
    database.ref('rooms/' + roomCode + '/players').once('value', (snapshot) => {
        const players = snapshot.val();
        for (let playerId in players) {
            database.ref('rooms/' + roomCode + '/players/' + playerId).update({ 
                challengeAnswer: "",
                votedFor: "" 
            });
        }
    });
}

// دالة النقل الاحترافية والمعدلة لمنع قليتش الوميض والتعليق اللانهائي
function transferHost(targetPlayerId, targetPlayerName) {
    if (!confirm(`هل أنت متأكد من نقل صلاحية المدير إلى ${targetPlayerName}؟ ستتحول أنت تلقائيًا إلى لاعب عادي بنفس اسمك الحقيقي.`)) return;

    const currentHostName = localStorage.getItem('sd_playerName') || "مدير سابق";
    const myNewPlayerId = "p_" + Math.random().toString(36).substr(2, 9);
    
    localStorage.removeItem('sd_role');
    localStorage.removeItem('sd_playerId');
    
    localStorage.setItem('sd_role', 'player');
    localStorage.setItem('sd_playerId', myNewPlayerId);

    database.ref('rooms/' + roomCode + '/players/' + myNewPlayerId).set({
        name: currentHostName,
        attempts: 3,
        challengeAnswer: "",
        votedFor: "",
        manualHintCount: 0
    }).then(() => {
        database.ref('rooms/' + roomCode).update({
            hostName: targetPlayerName,
            newHostId: targetPlayerId, 
            gameStatus: "host_transferred"
        });
    });
}

function listenForHostTransfer() {
    database.ref('rooms/' + roomCode + '/gameStatus').on('value', (snapshot) => {
        if (snapshot.val() === "host_transferred") {
            window.location.reload(); 
        }
    });
}

function resetFullGame() {
    let newRounds = prompt("كم تريد أن يكون عدد الجولات للجيم الجديد؟", maxRounds);
    if (newRounds === null) return; 
    newRounds = parseInt(newRounds) || 5;

    let stayHost = confirm("هل تريد الاستمرار كونك المدير?\n(موافق/OK = استمرار، إلغاء/Cancel = نقل المدير لشخص آخر من القائمة)");

    currentRound = 1;
    maxRounds = newRounds;
    document.getElementById('host-current-round').innerText = 1;
    document.getElementById('host-max-rounds').innerText = newRounds;

    const wordInput = document.getElementById('secret-word');
    const wordBtn = document.getElementById('save-word-btn');
    wordInput.value = "";
    wordInput.disabled = false;
    wordInput.style.backgroundColor = "";
    wordBtn.disabled = false;
    wordBtn.innerText = "تثبيت الكلمة";

    database.ref('rooms/' + roomCode).update({
        currentRound: 1,
        maxRounds: maxRounds,
        secretWord: "",
        gameStatus: "lobby",
        winnerWordPlayer: ""
    });

    database.ref('rooms/' + roomCode + '/players').once('value', (snapshot) => {
        const players = snapshot.val();
        if (!players) return;
        for (let pId in players) {
            database.ref('rooms/' + roomCode + '/players/' + pId).set({
                name: players[pId].name,
                attempts: 3,
                challengeAnswer: "",
                votedFor: "",
                manualHintCount: 0
            });
        }
        
        database.ref('rooms/' + roomCode + '/chat').push({
            sender: "🚨 النظام",
            text: `تمت إعادة تشغيل الجيم بالكامل لعدد (${maxRounds}) جولات جديدة! بانتظار المدير يثبت الكلمة 👀✨`
        });

        if (!stayHost) {
            alert("تم تصفير الروم، اضغط الآن على زر 'تعيين كمدير 👑' بجانب اسم اللاعب اللي تبيه يتولى الروم!");
        } else {
            alert("تم تصفير الروم وبدء قيم جديد بنجاح وأنت المدير الحين!");
        }
    });
}