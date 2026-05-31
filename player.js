// ==========================================
// ملف التحكم الخاص باللاعبين (Player)
// ==========================================

let pDatabase;
let pRoomCode = "";
let playerId = "";
let playerName = "";
let pAttempts = 3;

// دالة انضمام اللاعب للروم
function initPlayer() {
    playerName = document.getElementById('player-name').value.trim();
    pRoomCode = document.getElementById('room-code').value.trim();

    if (!playerName || !pRoomCode) {
        alert("الرجاء كتابة اسمك ورمز الغرفة لتتمكن من الدخول!");
        return;
    }

    // تشغيل الفايربيس
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        pDatabase = firebase.database();
    } else {
        alert("خطأ: لم يتم تحميل مكتبة الفايربيس.");
        return;
    }

    // التحقق من وجود الغرفة في السيرفر أولاً
    pDatabase.ref('rooms/' + pRoomCode).once('value', (snapshot) => {
        if (!snapshot.exists()) {
            alert("رقم الغرفة غير صحيح أو غير موجود! تأكد من المدير.");
            return;
        }

        // إنشاء معرف فريد للاعب داخل الروم
        playerId = "_" + Math.random().toString(36).substr(2, 9);

        // تسجيل بيانات اللاعب المبدئية في السيرفر
        pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).set({
            name: playerName,
            attempts: pAttempts,
            challengeAnswer: "",
            votedFor: ""
        });

        // الانتقال لواجهة اللعب وإخفاء شاشة الدخول
        document.getElementById('auth-screen').classList.add('d-none');
        document.getElementById('player-screen').classList.remove('d-none');

        // بدء الاستماع للتحديثات المباشرة (الجولة، التلميحات، الشات، حالة الفوز)
        startPlayerListeners();
    });
}

// تشغيل المستمعين لتحديث شاشة اللاعب لايف
function startPlayerListeners() {
    // 1. الاستماع لتغير الجولات وحالة اللعبة
    pDatabase.ref('rooms/' + pRoomCode).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        document.getElementById('player-current-round').innerText = data.currentRound;

        // إذا تحولت حالة اللعبة إلى تصويت (يعني فيه أحد جاب الكلمة)
        if (data.gameStatus === "voting") {
            openVoteScreen();
        }
    });

    // 2. الاستماع لصندوق التلميحات السري الخاص بهذا اللاعب فقط
    pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId + '/hints').on('value', (snapshot) => {
        const hintsBox = document.getElementById('player-hints-box');
        hintsBox.innerHTML = "";
        const hints = snapshot.val();

        if (!hints) {
            hintsBox.innerHTML = '<span class="empty-state">لم تصلك أي تلميحات بعد... فز بالتحدي لتكسب تلميحاً!</span>';
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

    // 3. الاستماع لشات اللعبة العام المباشر
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
        chatBox.scrollTop = chatBox.scrollHeight; // نزول تلقائي لآخر رسالة
    });
}

// دالة إرسال التخمين (مع نظام الـ 3 محاولات)
function submitGuess() {
    const guessInput = document.getElementById('guess-input');
    const playerGuess = guessInput.value.trim();

    if (!playerGuess) {
        alert("اكتب كلمتك أولاً قبل الضغط على تخمين!");
        return;
    }

    if (pAttempts <= 0) {
        alert("انتهت محاولاتك الـ 3! لا يمكنك التخمين مجدداً، انتظر نهاية الجيم.");
        return;
    }

    // جلب الكلمة السرية الحقيقية من السيرفر للتحقق
    pDatabase.ref('rooms/' + pRoomCode).once('value', (snapshot) => {
        const data = snapshot.val();
        
        if (playerGuess === data.secretWord) {
            // كفووو جابها صح! نحول اللعبة فوراً لحالة التصويت النهائي
            pDatabase.ref('rooms/' + pRoomCode).update({
                gameStatus: "voting",
                winnerWordPlayer: playerName
            });
        } else {
            // خطأ، نقص محاولة
            pAttempts--;
            document.getElementById('remaining-attempts').innerText = pAttempts;
            
            // تحديث عدد المحاولات في السيرفر ليراها المدير
            pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).update({
                attempts: pAttempts
            });

            if (pAttempts <= 0) {
                alert("للأسف! كانت هذه محاولتك الأخيرة وقفل عليك صندوق التخمين.");
                guessInput.disabled = true;
            } else {
                alert(`خطأ! حاول مجدداً، باقي لك ${pAttempts} محاولات.`);
            }
        }
        guessInput.value = ""; // تنظيف الخانة
    });
}

// دالة إرسال جواب التحدي سرياً للمدير
function submitChallengeAnswer() {
    const answerInput = document.getElementById('challenge-answer-input');
    const answerText = answerInput.value.trim();

    if (!answerText) {
        alert("اكتب جواب التحدي أولاً!");
        return;
    }

    pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).update({
        challengeAnswer: answerText
    });

    answerInput.value = "";
    alert("تم إرسال جوابك سرياً للمدير بنجاح! انتظر التلميح إذا فزت.");
}

// دالة إرسال رسالة في شات اللعبة المباشر للتمويه
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

// فتح شاشة التصويت النهائي وجلب أسماء اللاعبين للتصويت
function openVoteScreen() {
    document.getElementById('player-screen').classList.add('d-none');
    document.getElementById('host-screen').classList.add('d-none');
    document.getElementById('vote-screen').classList.remove('d-none');

    pDatabase.ref('rooms/' + pRoomCode + '/players').once('value', (snapshot) => {
        const voteGrid = document.getElementById('vote-players-list');
        voteGrid.innerHTML = "";
        const players = snapshot.val();

        for (let pId in players) {
            // لا تظهر اسم اللاعب نفسه في قائمة التصويت (ما يصوت لنفسه)
            if (pId === playerId) continue;

            const btn = document.createElement('button');
            btn.className = "vote-btn";
            btn.innerText = players[pId].name;
            btn.onclick = function() {
                // تسجيل صوت اللاعب في السيرفر سرياً
                pDatabase.ref('rooms/' + pRoomCode + '/players/' + playerId).update({
                    votedFor: players[pId].name
                });
                // قفل الأزرار بعد التصويت
                voteGrid.innerHTML = "<h3>تم تسجيل تصويتك بنجاح سرياً! 🔒</h3>";
            };
            voteGrid.appendChild(btn);
        }
    });
}