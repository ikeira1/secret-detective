// ==========================================
// ملف التحكم الخاص باللاعبين المطور (Player) - نسخة خالية من التعارض
// ==========================================

let pDatabase;
let pRoomCode = "";
myUID = ""; // ✅ تم حذف let من هنا عشان يتشارك المتغير مع الملف الأساسي بدون كراش
let playerName = "";
let pAttempts = 3;
let hasFiredConfetti = false;

function getOrCreateUID() {
    let uid = localStorage.getItem('sd_my_uid');
    if (!uid) {
        uid = "u_" + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('sd_my_uid', uid);
    }
    return uid;
}

// دالة تفريغ الكاش بالكامل وفك أي تعليق على الأزرار فوراً
function handleKickedOrLoggedOut() {
    localStorage.removeItem('sd_role');
    localStorage.removeItem('sd_roomCode');
    localStorage.removeItem('sd_playerName');
    window.location.reload();
}

// دالة الخروج وصناعة روم جديد (المستدعاة من أي زر خروج باللعبة)
function leaveRoomButton() {
    if (confirm("هل تريد الخروج من الروم الحالي والعودة للشاشة الرئيسية لصنع روم جديد؟")) {
        try {
            const savedRoom = localStorage.getItem('sd_roomCode');
            const currentUID = localStorage.getItem('sd_my_uid');
            if (savedRoom && currentUID && firebase.apps.length) {
                const db = firebase.database();
                // مسح اللاعب من قائمة اللاعبين قبل مغادرته
                db.ref('rooms/' + savedRoom + '/players/' + currentUID).remove();
            }
        } catch(e) { console.log("خطأ مغادرة طبيعي: ", e); }
        handleKickedOrLoggedOut();
    }
}

// المنطق الآمن لفحص حالة الجلسات بدون تجميد الأزرار الرئيسية عند التحميل
document.addEventListener("DOMContentLoaded", () => {
    myUID = getOrCreateUID();
    
    // التأكد من تهيئة فايربيس أولاً وقبل أي استدعاء خارجي
    if (typeof firebaseConfig !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
    } else {
        console.error("ملف config.js غير معرف أو مفقود!");
        return;
    }

    const savedRole = localStorage.getItem('sd_role');
    const savedRoom = localStorage.getItem('sd_roomCode');
    
    if (savedRole && savedRoom) {
        const checkDb = firebase.database();
        checkDb.ref('rooms/' + savedRoom).once('value', (snap) => {
            if (snap.exists()) {
                pRoomCode = savedRoom;
                playerName = localStorage.getItem('sd_playerName') || "";
                
                if (savedRole === 'host') {
                    // تحويل لربط لوحة تحكم المدير
                    if (typeof database !== 'undefined') database = checkDb;
                    if (typeof roomCode !== 'undefined') roomCode = savedRoom;
                    
                    document.getElementById('auth-screen').classList.add('d-none');
                    document.getElementById('host-screen').classList.remove('d-none');
                    document.getElementById('display-room-code').innerText = `رمز الروم: ${savedRoom}`;
                    document.getElementById('host-max-rounds').innerText = snap.val().maxRounds || 5;
                    
                    const hostInputField = document.getElementById('host-name');
                    if (hostInputField) hostInputField.value = playerName;

                    if (typeof listenToPlayers === "function") listenToPlayers();
                    if (typeof listenToChallengeAnswers === "function") listenToChallengeAnswers();
                    if (typeof listenToChatForHost === "function") listenToChatForHost();
                    if (typeof listenToGameStatusForHost === "function") listenToGameStatusForHost();
                    if (typeof setupHostPresence === "function") setupHostPresence();
                } else {
                    // ربط واجهة اللاعب
                    pDatabase = checkDb;
                    pDatabase.ref('rooms/' + pRoomCode + '/players/' + myUID).once('value', (pSnap) => {
                        if (pSnap.exists()) {
                            pAttempts = pSnap.val().attempts !== undefined ? pSnap.val().attempts : 3;
                            document.getElementById('remaining-attempts').innerText = pAttempts;
                            document.getElementById('auth-screen').classList.add('d-none');
                            document.getElementById('player-screen').classList.remove('d-none');
                            document.getElementById('player-display-room-code').innerText = `رمز الروم الحالي: ${pRoomCode}`;
                            startPlayerListeners();
                        } else {
                            // اللاعب غير مقيد بالغرفة، نظف الكاش لفك التعليق عن أزرار واجهة الدخول
                            localStorage.removeItem('sd_role');
                            localStorage.removeItem('sd_roomCode');
                        }
                    });
                }
            } else {
                // الغرفة حُذفت تماماً، مسح آمن للكاش
                localStorage.removeItem('sd_role');
                localStorage.removeItem('sd_roomCode');
            }
        }).catch(err => {
            console.log("خطأ فحص الجلسة: ", err);
        });
    }
});

function initPlayer() {
    playerName = document.getElementById('player-name').value.trim();
    pRoomCode = document.getElementById('room-code').value.trim();
    myUID = getOrCreateUID();

    if (!playerName || !pRoomCode) {
        alert("الرجاء كتابة اسمك ورمز الغرفة أولاً!");
        return;
    }

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    pDatabase = firebase.database();

    pDatabase.ref('rooms/' + pRoomCode).once('value', (snapshot) => {
        if (!snapshot.exists()) {
            alert("رقم الغرفة غير صحيح أو قام المدير بإغلاقها!");
            return;
        }

        const roomData = snapshot.val();
        if (roomData.blacklist && roomData.blacklist[myUID]) {
            alert("❌ عذراً، أنت مطرود من هذا الروم ومسجل في القائمة السوداء!");
            return;
        }

        localStorage.setItem('sd_role', 'player');
        localStorage.setItem('sd_roomCode', pRoomCode);
        localStorage.setItem('sd_playerName', playerName);

        pDatabase.ref('rooms/' + pRoomCode + '/players/' + myUID).set({
            name: playerName,
            attempts: 3,
            challengeAnswer: "",
            votedFor: "",
            manualHintCount: 0
        }).then(() => {
            pDatabase.ref('rooms/' + pRoomCode + '/players/' + myUID).onDisconnect().remove();
            document.getElementById('auth-screen').classList.add('d-none');
            document.getElementById('player-screen').classList.remove('d-none');
            document.getElementById('player-display-room-code').innerText = `رمز الروم الحالي: ${pRoomCode}`;
            startPlayerListeners();
        });
    }).catch(err => {
        alert("خطأ في الاتصال بالسيرفر: " + err.message);
    });
}

function startPlayerListeners() {
    if (!pDatabase || !pRoomCode) return;

    pDatabase.ref('rooms/' + pRoomCode).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            handleKickedOrLoggedOut();
            return;
        }

        if (data.blacklist && data.blacklist[myUID]) {
            pDatabase.ref('rooms/' + pRoomCode).off();
            alert("❌ تم طردك من الغرفة من قِبل المدير!");
            handleKickedOrLoggedOut();
            return;
        }

        if (data.players && !data.players[myUID] && data.hostUID !== myUID && data.gameStatus !== "voting") {
            pDatabase.ref('rooms/' + pRoomCode).off();
            handleKickedOrLoggedOut();
            return;
        }

        if (data.hostUID === myUID) {
            pDatabase.ref('rooms/' + pRoomCode).off();
            alert("👑 تم تعيينك كمدير جديد للروم الحين!");
            localStorage.removeItem('sd_role');
            localStorage.setItem('sd_role', 'host');
            window.location.reload();
            return;
        }

        const membersDiv = document.getElementById('player-all-members-list');
        if (membersDiv) {
            membersDiv.innerHTML = "";
            const hostRow = document.createElement('div');
            hostRow.style.padding = "6px 10px";
            hostRow.style.background = "rgba(99, 102, 241, 0.2)";
            hostRow.style.borderRadius = "4px";
            hostRow.style.borderRight = "3px solid #6366f1";
            hostRow.innerHTML = `👑 <strong>${data.hostName}</strong> <span style="font-size:0.75rem; color:#a5b4fc;">(المدير)</span>`;
            membersDiv.appendChild(hostRow);

            if (data.players) {
                for (let idKey in data.players) {
                    const pItem = data.players[idKey];
                    const pRow = document.createElement('div');
                    pRow.style.padding = "6px 10px";
                    pRow.style.background = "#1e293b";
                    pRow.style.borderRadius = "4px";
                    pRow.innerHTML = `🎮 ${pItem.name}`;
                    membersDiv.appendChild(pRow);
                }
            }
        }

        document.getElementById('player-current-round').innerText = data.currentRound;

        if (data.players && data.players[myUID]) {
            pAttempts = data.players[myUID].attempts !== undefined ? data.players[myUID].attempts : 3;
            document.getElementById('remaining-attempts').innerText = pAttempts;
            if (pAttempts > 0 && data.gameStatus === "playing") {
                document.getElementById('guess-input').disabled = false;
            }
        }

        if (data.gameStatus === "voting") {
            if (!hasFiredConfetti) {
                triggerFireworksEffect();
                hasFiredConfetti = true;
            }
            openVoteScreen(data);
        }
        
        if (data.gameStatus === "lobby" || data.gameStatus === "playing") {
            document.getElementById('vote-screen').classList.add('d-none');
            document.getElementById('player-screen').classList.remove('d-none');
            hasFiredConfetti = false; 
        }
    });

    pDatabase.ref('rooms/' + pRoomCode + '/players/' + myUID + '/hints').on('value', (snapshot) => {
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
        if (!chatBox) return;
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
    if (!playerGuess || !pDatabase) return;

    if (pAttempts <= 0) {
        alert("انتهت محاولاتك الحالية!");
        return;
    }

    pDatabase.ref('rooms/' + pRoomCode).once('value', (snapshot) => {
        const data = snapshot.val();
        if (playerGuess === data.secretWord) {
            pDatabase.ref('rooms/' + pRoomCode).update({
                gameStatus: "word_guessed_waiting",
                winnerWordPlayer: playerName
            });
            alert("🎯 كفوووو جبت الكلمة صح! الحين انتظر المدير يطلق مرحلة التصويت لاحقاً طقطق عليهم بالشات 😉");
        } else {
            pAttempts--;
            document.getElementById('remaining-attempts').innerText = pAttempts;
            pDatabase.ref('rooms/' + pRoomCode + '/players/' + myUID).update({ attempts: pAttempts });

            if (pAttempts <= 0) {
                alert("انتهت محاولاتك الـ 3!");
                guessInput.disabled = true;
            } else {
                alert(`خطأ! متبقي لك: ${pAttempts} محاولات`);
            }
        }
        guessInput.value = "";
    });
}

function triggerFireworksEffect() {
    if (typeof confetti !== "function") return;
    var duration = 4 * 1000;
    var end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.8 } });
      confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.8 } });
      if (Date.now() < end) { requestAnimationFrame(frame); }
    }());
}

function openVoteScreen(roomData) {
    document.getElementById('player-screen').classList.add('d-none');
    document.getElementById('vote-screen').classList.remove('d-none');

    const voteGrid = document.getElementById('vote-players-list');
    voteGrid.innerHTML = "";
    const players = roomData.players || {};

    let hasOptions = false;

    for (let idKey in players) {
        if (idKey === myUID) continue; 
        
        hasOptions = true;
        const btn = document.createElement('button');
        btn.className = "btn btn-player";
        btn.style.margin = "5px 0";
        btn.style.width = "100%";
        btn.style.padding = "12px";
        btn.style.fontSize = "1.05rem";
        btn.innerText = players[idKey].name;
        
        btn.onclick = function() {
            const confirmChoice = confirm(`هل أنت متأكد وتبغى تصوت وتخمن إن [ ${players[idKey].name} ] هو اللي جاب الكلمة؟`);
            if (!confirmChoice) return;

            pDatabase.ref('rooms/' + pRoomCode + '/players/' + myUID).update({ votedFor: players[idKey].name }).then(() => {
                alert("🔒 تم تسجيل تصويتك بنجاح وسرياً! تم إرجاعك للروم العام.");
                document.getElementById('vote-screen').classList.add('d-none');
                document.getElementById('player-screen').classList.remove('d-none');
            });
        };
        voteGrid.appendChild(btn);
    }

    if (!hasOptions) {
        voteGrid.innerHTML = "<h3>لا يوجد لاعبين آخرين للتصويت لهم بالروم! 🔍</h3>";
    }
}

function submitChallengeAnswer() {
    const answerInput = document.getElementById('challenge-answer-input');
    const answerText = answerInput.value.trim();
    if (!answerText || !pDatabase) return;

    pDatabase.ref('rooms/' + pRoomCode).once('value', (rSnap) => {
        const rData = rSnap.val() || {};
        const currentR = rData.currentRound || 1;

        pDatabase.ref('rooms/' + pRoomCode + '/players/' + myUID + '/challengeHistory/' + currentR).set({
            answer: answerText,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        pDatabase.ref('rooms/' + pRoomCode + '/players/' + myUID).update({
            challengeAnswer: answerText,
            challengeRound: currentR
        });

        answerInput.value = "";
        alert("تم إرسال جوابك وتثبيت ترتيبك سرياً للمدير!");
    });
}

function sendChatMessage() {
    const chatInput = document.getElementById('chat-message-input');
    const msgText = chatInput.value.trim();
    if (!msgText || !pDatabase) return;

    pDatabase.ref('rooms/' + pRoomCode + '/chat').push({
        sender: playerName,
        text: msgText
    });
    chatInput.value = "";
}