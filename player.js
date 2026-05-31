// ==========================================
// ملف التحكم الخاص باللاعبين الحديث (Player)
// ==========================================

let pDatabase;
let pRoomCode = "";
let playerId = "";
let playerName = "";
let pAttempts = 3;

function initPlayer() {
    playerName = document.getElementById('player-name').value.trim();
    pRoomCode = document.getElementById('room-code').value.trim();

    if (!playerName || !pRoomCode) {
        alert("الرجاء كتابة اسمك ورمز الغرفة!");
        return;
    }

    // الربط الصحيح المتوافق مع مكاتب Compat
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        pDatabase = firebase.database();
    } catch (error) {
        alert("خطأ في تحميل سيرفر فايربيس: " + error.message);
        return;
    }

    pDatabase.ref('rooms/' + pRoomCode).once('value', (snapshot) => {
        if (!snapshot.exists()) {
            alert("رقم الغرفة غير صحيح أو غير موجود!");
            return;
        }

        playerId = "_" + Math.random().toString(36).substr(2, 9);

        pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).set({
            name: playerName,
            attempts: pAttempts,
            challengeAnswer: "",
            votedFor: ""
        }).then(() => {
            document.getElementById('auth-screen').classList.add('d-none');
            document.getElementById('player-screen').classList.remove('d-none');
            startPlayerListeners();
        });
    });
}

function startPlayerListeners() {
    pDatabase.ref('rooms/' + pRoomCode).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        document.getElementById('player-current-round').innerText = data.currentRound;

        if (data.gameStatus === "voting") {
            openVoteScreen();
        }
    });

    pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId + '/hints').on('value', (snapshot) => {
        const hintsBox = document.getElementById('player-hints-box');
        hintsBox.innerHTML = "";
        const hints = snapshot.val();

        if (!hints) {
            hintsBox.innerHTML = '<span class="empty-state">لم تصلك أي تلميحات بعد...</span>';
            return;
        }

        for (let hintId in hints) {
            const hintText = hints[hintId];
            const hintItem = document.createElement('div');
            hintItem.className = "msg";
            hintItem.style.backgroundColor = "#1e293b";
            hintItem.style.borderRight = "3px solid #00ffcc";
            hintItem.innerHTML = `💡 ${hintText}`;
            hintsBox.appendChild(hintItem);
        }
    });

    pDatabase.ref('rooms/' + pRoomCode + '/chat').on('value', (snapshot) => {
        const chatBox = document.getElementById('game-chat-box');
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

function submitGuess() {
    const guessInput = document.getElementById('guess-input');
    const playerGuess = guessInput.value.trim();

    if (!playerGuess) return;

    if (pAttempts <= 0) {
        alert("انتهت محاولاتك الـ 3!");
        return;
    }

    pDatabase.ref('rooms/' + pRoomCode).once('value', (snapshot) => {
        const data = snapshot.val();
        
        if (playerGuess === data.secretWord) {
            pDatabase.ref('rooms/' + pRoomCode).update({
                gameStatus: "voting",
                winnerWordPlayer: playerName
            });
        } else {
            pAttempts--;
            document.getElementById('remaining-attempts').innerText = pAttempts;
            
            pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).update({
                attempts: pAttempts
            });

            if (pAttempts <= 0) {
                alert("للأسف انتهت محاولاتك!");
                guessInput.disabled = true;
            } else {
                alert(`خطأ! باقي لك ${pAttempts} محاولات.`);
            }
        }
        guessInput.value = "";
    });
}

function submitChallengeAnswer() {
    const answerInput = document.getElementById('challenge-answer-input');
    const answerText = answerInput.value.trim();

    if (!answerText) return;

    pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).update({
        challengeAnswer: answerText
    });

    answerInput.value = "";
    alert("تم إرسال جوابك سرياً للمدير!");
}

function sendChatMessage() {
    const chatInput = document.getElementById('chat-message-input');
    const msgText = chatInput.value.trim();

    if (!msgText) return;

    pDatabase.ref('rooms/' + pRoomCode + '/chat').push({
        sender: playerName,
        text: msgText
    });

    chatInput.value = "";
}

function openVoteScreen() {
    document.getElementById('player-screen').classList.add('d-none');
    document.getElementById('host-screen').classList.add('d-none');
    document.getElementById('vote-screen').classList.remove('d-none');

    pDatabase.ref('rooms/' + pRoomCode + '/players').once('value', (snapshot) => {
        const voteGrid = document.getElementById('vote-players-list');
        voteGrid.innerHTML = "";
        const players = snapshot.val();

        for (let pId in players) {
            if (pId === playerId) continue;

            const btn = document.createElement('button');
            btn.className = "vote-btn";
            btn.innerText = players[pId].name;
            btn.onclick = function() {
                pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).update({
                    votedFor: players[pId].name
                });
                voteGrid.innerHTML = "<h3>تم تسجيل تصويتك بنجاح سرياً! 🔒</h3>";
            };
            voteGrid.appendChild(btn);
        }
    });
}