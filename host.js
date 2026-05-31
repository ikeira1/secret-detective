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
    }).catch((error) => {
        alert("خطأ في الاتصال بقاعدة البيانات: " + error.message);
    });
}

function saveSecretWord() {
    const word = document.getElementById('secret-word').value.trim();
    if (!word) {
        alert("اكتب كلمة سرية أولاً!");
        return;
    }
    database.ref('rooms/' + roomCode).update({
        secretWord: word,
        gameStatus: "playing"
    });
    alert("تم تثبيت الكلمة السرية وبدأ الجيم لايف عند الشباب!");
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
            // قراءة العداد اليدوي للتلميحات من السيرفر
            const manualHintCount = player.manualHintCount || 0;

            const playerRow = document.createElement('div');
            playerRow.className = "card player-card-hover"; // كلاس للتأثير بالماوس
            playerRow.style.padding = "10px";
            playerRow.style.marginBottom = "10px";
            playerRow.style.position = "relative";
            
            playerRow.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <strong>🎮 ${player.name}</strong>
                        <span style="color: #00ffcc; font-weight: bold; font-size: 0.95rem;">[💡 ${manualHintCount}]</span>
                        
                        <div class="hint-controls">
                            <button type="button" onclick="changeHintCount('${playerId}', 1)" style="background: #10b981; color: white; border: none; border-radius: 4px; padding: 0px 6px; font-size: 0.8rem; cursor: pointer; font-weight: bold;">+</button>
                            <button type="button" onclick="changeHintCount('${playerId}', -1)" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 0px 7px; font-size: 0.8rem; cursor: pointer; font-weight: bold;">-</button>
                        </div>
                    </div>
                    
                    <div>
                        <span class="badge" style="border-color: #ff007c; color: #ff007c; margin-left: 5px;">محاولاته: ${player.attempts}</span>
                        <button type="button" onclick="transferHost('${playerId}', '${player.name}')" class="btn" style="width:auto; padding: 2px 6px; font-size:0.75rem; background-color:#6366f1; color:white; border:none; border-radius:4px; cursor:pointer;">تعيين كمدير 👑</button>
                    </div>
                </div>
                <div class="form-group inline-group" style="margin-bottom: 0;">
                    <input type="text" id="hint-input-${playerId}" placeholder="اكتب تلميحاً سرياً له...">
                    <button type="button" onclick="sendPrivateHint('${playerId}')" class="btn btn-host" style="width:auto; padding: 5px 10px; font-size:0.9rem;">إرسال تلميح</button>
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

function sendPrivateHint(playerId) {
    const hintInput = document.getElementById(`hint-input-${playerId}`);
    const hintText = hintInput.value.trim();
    
    if (!hintText) {
        alert("اكتب تلميحاً أولاً!");
        return;
    }

    database.ref('rooms/' + roomCode + '/players/' + playerId + '/hints').push(hintText);
    hintInput.value = "";
    alert("تم إرسال التلميح سرياً للاعب!");
}

function listenToChallengeAnswers() {
    database.ref('rooms/' + roomCode + '/players').on('value', (snapshot) => {
        const box = document.getElementById('host-challenges-box');
        box.innerHTML = "";
        const players = snapshot.val();
        let hasAnswers = false;

        for (let playerId in players) {
            const player = players[playerId];
            if (player.challengeAnswer) {
                hasAnswers = true;
                const msg = document.createElement('div');
                msg.className = "msg msg-host";
                msg.innerHTML = `<strong>${player.name}:</strong> ${player.challengeAnswer}`;
                box.appendChild(msg);
            }
        }

        if (!hasAnswers) {
            box.innerHTML = '<span class="empty-state">لم يرسل أي لاعب حل التحدي بعد...</span>';
        }
    });
}

function nextRound() {
    if (currentRound >= maxRounds) {
        alert("وصلت للحد الأقصى من الجولات! يمكنك إعادة تعيين الجيم بالكامل.");
        return;
    }
    currentRound++;
    document.getElementById('host-current-round').innerText = currentRound;
    database.ref('rooms/' + roomCode).update({ currentRound: currentRound });
    
    database.ref('rooms/' + roomCode + '/players').once('value', (snapshot) => {
        const players = snapshot.val();
        for (let playerId in players) {
            database.ref('rooms/' + roomCode + '/players/' + playerId).update({
                challengeAnswer: ""
            });
        }
    });
}

function transferHost(targetPlayerId, targetPlayerName) {
    if (!confirm(`هل أنت متأكد من نقل صلاحية المدير إلى ${targetPlayerName}؟ ستتحول أنت إلى لاعب.`)) return;

    const currentHostName = document.getElementById('host-name').value.trim();
    const myNewPlayerId = "_" + Math.random().toString(36).substr(2, 9);
    
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
    if (!confirm("هل تريد إعادة تشغيل الجيم بالكامل وتصفير النقاط والمحاولات؟")) return;

    currentRound = 1;
    document.getElementById('host-current-round').innerText = currentRound;
    
    database.ref('rooms/' + roomCode).update({
        currentRound: 1,
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
        alert("تم تصفير الجيم بالكامل وبدأ اللوبي من جديد بنفس الروم!");
    });
}