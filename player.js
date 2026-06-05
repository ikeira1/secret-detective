// ==========================================
// ملف التحكم الخاص باللاعبين المطور (Player)
// ==========================================

let pDatabase;
let pRoomCode = "";
let playerId = "";
let playerName = "";
let pAttempts = 3;
let hasFiredConfetti = false; // لمنع تكرار الألعاب النارية في نفس اللحظة

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
                        listenToGameStatusForHost();
                    } else {
                        playerId = localStorage.getItem('sd_playerId');
                        pDatabase = checkDb;
                        pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).once('value', (pSnap) => {
                            if (pSnap.exists()) {
                                pAttempts = pSnap.val().attempts !== undefined ? pSnap.val().attempts : 3;
                                document.getElementById('remaining-attempts').innerText = pAttempts;
                                document.getElementById('auth-screen').classList.add('d-none');
                                document.getElementById('player-screen').classList.remove('d-none');
                                document.getElementById('player-display-room-code').innerText = `رمز الروم الحالي: ${pRoomCode}`;
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
            attempts: 3,
            challengeAnswer: "",
            votedFor: "",
            manualHintCount: 0
        }).then(() => {
            document.getElementById('auth-screen').classList.add('d-none');
            document.getElementById('player-screen').classList.remove('d-none');
            document.getElementById('player-display-room-code').innerText = `رمز الروم الحالي: ${pRoomCode}`;
            startPlayerListeners();
        });
    });
}

function startPlayerListeners() {
    // 1. مراقبة قائمة كل المشاركين بالروم وطباعتها عند كل اللاعبين مع وسم المدير
    pDatabase.ref('rooms/' + pRoomCode).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const membersDiv = document.getElementById('player-all-members-list');
        if (membersDiv) {
            membersDiv.innerHTML = "";
            // إضافة المدير أولاً بالتاج المميز
            const hostRow = document.createElement('div');
            hostRow.style.padding = "6px 10px";
            hostRow.style.background = "rgba(99, 102, 241, 0.2)";
            hostRow.style.borderRadius = "4px";
            hostRow.style.borderRight = "3px solid #6366f1";
            hostRow.innerHTML = `👑 <strong>${data.hostName}</strong> <span style="font-size:0.75rem; color:#a5b4fc;">(المدير)</span>`;
            membersDiv.appendChild(hostRow);

            // طباعة باقي اللاعبين
            if (data.players) {
                for (let pId in data.players) {
                    const pItem = data.players[pId];
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

        // تحديث لايف للمحاولات المتبقية إذا عدلها المدير يدوياً من عنده
        if (data.players && data.players[playerId]) {
            pAttempts = data.players[playerId].attempts !== undefined ? data.players[playerId].attempts : 3;
            document.getElementById('remaining-attempts').innerText = pAttempts;
            if (pAttempts > 0 && data.gameStatus === "playing") {
                document.getElementById('guess-input').disabled = false;
            }
        }

        // تحويل آمن للمدير الجديد بدون تعليق
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

        // تفعيل شاشة التصويت الفردية العادلة وإطلاق الالعاب النارية
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
            hasFiredConfetti = false; // تصفير العداد للراند القادم
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
        alert("انتهت محاولاتك الحالية!");
        return;
    }

    pDatabase.ref('rooms/' + pRoomCode).once('value', (snapshot) => {
        const data = snapshot.val();
        if (playerGuess === data.secretWord) {
            // بدلاً من فتح التصويت فوراً، نغير الحالة للانتظار ونعلم المدير بالاسم سراً
            pDatabase.ref('rooms/' + pRoomCode).update({
                gameStatus: "word_guessed_waiting",
                winnerWordPlayer: playerName
            });
            alert("🎯 كفوووو جبت الكلمة صح! الحين انتظر المدير يطلق مرحلة التصويت لاحقاً طقطق عليهم بالشات 😉");
        } else {
            pAttempts--;
            document.getElementById('remaining-attempts').innerText = pAttempts;
            pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).update({ attempts: pAttempts });

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
    var duration = 4 * 1000;
    var end = Date.now() + duration;

    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.8 } });
      confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.8 } });
      if (Date.now() < end) { requestAnimationFrame(frame); }
    }());
}

// شاشة التصويت العادلة الفورية مع نافذة التأكيد (موافق أو إلغاء)
function openVoteScreen(roomData) {
    document.getElementById('player-screen').classList.add('d-none');
    document.getElementById('vote-screen').classList.remove('d-none');

    const voteGrid = document.getElementById('vote-players-list');
    voteGrid.innerHTML = "";
    const players = roomData.players || {};

    let hasOptions = false;

    for (let pId in players) {
        // فلترة: لا يظهر اسم المدير، ولا يظهر اسم اللاعب نفسه اللي جالس يصوت
        if (pId === playerId) continue; 
        
        hasOptions = true;
        const btn = document.createElement('button');
        btn.className = "btn btn-player";
        btn.style.margin = "5px 0";
        btn.style.width = "100%";
        btn.style.padding = "12px";
        btn.style.fontSize = "1.05rem";
        btn.innerText = players[pId].name;
        
        btn.onclick = function() {
            // إضافة زر التأكيد لغلق باب الأعذار تماماً
            const confirmChoice = confirm(`هل أنت متأكد وتبغى تصوت وتخمن إن [ ${players[pId].name} ] هو اللي جاب الكلمة؟`);
            if (!confirmChoice) return; // إذا تراجع اللاعب يمديه يختار اسم ثاني

            // إذا وافق، نرفع التصويت ونقفل الشاشة فوراً ونرجعه للوبي
            pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).update({ votedFor: players[pId].name }).then(() => {
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
    if (!answerText) return;

    pDatabase.ref('rooms/' + pRoomCode).once('value', (rSnap) => {
        const rData = rSnap.val() || {};
        const currentR = rData.currentRound || 1;

        pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).update({ 
            challengeAnswer: answerText,
            challengeRound: currentR,
            challengeTimestamp: firebase.database.ServerValue.TIMESTAMP
        });
        answerInput.value = "";
        alert("تم إرسال جوابك وتثبيت ترتيبك سرياً للمدير!");
    });
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

function leaveRoomButton() {
    if(confirm("هل تريد تسجيل الخروج ومسح بيانات الجلسة بالكامل لإنشاء/دخول روم جديد؟")) {
        localStorage.clear();
        window.location.reload();
    }
}