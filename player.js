// ==========================================
// ملف التحكم الخاص باللاعبين المطور (Player)
// ==========================================

let pDatabase;
let pRoomCode = "";
let playerId = "";
let playerName = "";
let pAttempts = 3;

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        const savedRole = localStorage.getItem('sd_role');
        const savedRoom = localStorage.getItem('sd_roomCode');
        
        if (savedRole && savedRoom) {
            if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
            const checkDb = firebase.database();
            
            checkDb.ref('rooms/' + savedRoom).once('value', (snap) => {
                if (snap.exists()) {
                    pRoomCode = savedRoom;
                    playerName = localStorage.getItem('sd_playerName');
                    
                    if (savedRole === 'host') {
                        roomCode = savedRoom;
                        database = checkDb;
                        document.getElementById('auth-screen').classList.add('d-none');
                        document.getElementById('host-screen').classList.remove('d-none');
                        document.getElementById('display-room-code').innerText = `رمز الروم: ${roomCode}`;
                        document.getElementById('host-max-rounds').innerText = snap.val().maxRounds;
                        document.getElementById('host-name').value = playerName;
                        listenToPlayers();
                        listenToChallengeAnswers();
                        listenForHostTransfer();
                        listenToChatForHost();
                    } else {
                        playerId = localStorage.getItem('sd_playerId');
                        pDatabase = checkDb;
                        pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).once('value', (pSnap) => {
                            if (pSnap.exists()) {
                                pAttempts = pSnap.val().attempts;
                                document.getElementById('remaining-attempts').innerText = pAttempts;
                                document.getElementById('auth-screen').classList.add('d-none');
                                document.getElementById('player-screen').classList.remove('d-none');
                                startPlayerListeners();
                            } else {
                                localStorage.clear();
                            }
                        });
                    }
                } else {
                    localStorage.clear();
                }
            });
        }
    }, 1000); 
});

function initPlayer() {
    playerName = document.getElementById('player-name').value.trim();
    pRoomCode = document.getElementById('room-code').value.trim();

    if (!playerName || !pRoomCode) {
        alert("الرجاء كتابة اسمك ورمز الغرفة!");
        return;
    }

    try {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        pDatabase = firebase.database();
    } catch (error) {
        alert("خطأ في السيرفر: " + error.message);
        return;
    }

    pDatabase.ref('rooms/' + pRoomCode).once('value', (snapshot) => {
        if (!snapshot.exists()) {
            alert("رقم الغرفة غير صحيح!");
            return;
        }

        playerId = "p_" + Math.random().toString(36).substr(2, 9);
        
        localStorage.setItem('sd_role', 'player');
        localStorage.setItem('sd_roomCode', pRoomCode);
        localStorage.setItem('sd_playerId', playerId);
        localStorage.setItem('sd_playerName', playerName);

        pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).set({
            name: playerName,
            attempts: pAttempts,
            challengeAnswer: "",
            votedFor: "",
            manualHintCount: 0
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

        // دالة تحويل اللاعب الفورية لمدير آمنة ونظيفة 100% بدون أي تعليق
        if (data.gameStatus === "host_transferred" && data.newHostId === playerId) {
            pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).remove().then(() => {
                alert("👑 مبروك! أصبحت مدير الروم الحالي الآن!");
                
                localStorage.removeItem('sd_role');
                localStorage.removeItem('sd_playerId');
                localStorage.setItem('sd_role', 'host');
                
                window.location.reload(); 
            });
            return;
        }

        if (data.gameStatus === "voting") {
            openVoteScreen();
        }
        
        if (data.gameStatus === "lobby") {
            document.getElementById('vote-screen').classList.add('d-none');
            document.getElementById('player-screen').classList.remove('d-none');
            pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).once('value', (pSnap) => {
               if(pSnap.exists()) {
                   pAttempts = pSnap.val().attempts;
                   document.getElementById('remaining-attempts').innerText = pAttempts;
                   if(pAttempts > 0) document.getElementById('guess-input').disabled = false;
               }
            });
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
        alert("انتهت محاولاتك!");
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
            pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).update({ attempts: pAttempts });

            if (pAttempts <= 0) {
                alert("انتهت محاولاتك الـ 3!");
                guessInput.disabled = true;
            } else {
                alert(`خطأ! متبقي: ${pAttempts}`);
            }
        }
        guessInput.value = "";
    });
}

function submitChallengeAnswer() {
    const answerInput = document.getElementById('challenge-answer-input');
    const answerText = answerInput.value.trim();
    if (!answerText) return;

    pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).update({ challengeAnswer: answerText });
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
                pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).update({ votedFor: players[pId].name });
                voteGrid.innerHTML = "<h3>تم تسجيل تصويتك بنجاح سرياً! 🔒</h3>";
            };
            voteGrid.appendChild(btn);
        }
    });
}

function leaveRoomButton() {
    if(confirm("هل تريد تسجيل الخروج ومسح بيانات الجلسة بالكامل لإنشاء/دخول روم جديد؟")) {
        localStorage.clear();
        window.location.reload();
    }
}