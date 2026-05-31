// ==========================================
// ملف التحكم الخاص بمدير الجلسة (Host)
// ==========================================

let database;
let roomCode = "";
let currentRound = 1;
let maxRounds = 5;

// دالة تشغيل لوحة المدير عند الضغط على "إنشاء غرفة"
function initHost() {
    const hostName = document.getElementById('host-name').value.trim();
    maxRounds = parseInt(document.getElementById('total-rounds').value) || 5;

    if (!hostName) {
        alert("الرجاء كتابة اسمك أولاً يا مدير!");
        return;
    }

    // تشغيل الفايربيس بناءً على الإعدادات في config.js
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        database = firebase.database();
    } else {
        alert("خطأ: لم يتم تحميل مكتبة الفايربيس بشكل صحيح.");
        return;
    }

    // توليد رمز غرفة عشوائي من 4 أرقام
    roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    document.getElementById('display-room-code').innerText = `رمز الروم: ${roomCode}`;
    document.getElementById('host-max-rounds').innerText = maxRounds;

    // إنشاء بيانات الروم في السيرفر المباشر
    database.ref('rooms/' + roomCode).set({
        hostName: hostName,
        maxRounds: maxRounds,
        currentRound: currentRound,
        secretWord: "",
        gameStatus: "lobby", // الحالات: lobby, playing, voting
        winnerWordPlayer: "" // من جاب الكلمة الصح
    });

    // الانتقال لشاشة المدير وإخفاء شاشة الدخول
    document.getElementById('auth-screen').classList.add('d-none');
    document.getElementById('host-screen').classList.remove('d-none');

    // الاستماع للاعبين المتصلين بالروم وتحديث القائمة والتحديات لايف
    listenToPlayers();
    listenToChallengeAnswers();
}

// دالة لتثبيت الكلمة السرية
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

// الاستماع للاعبين المتصلين لعرضهم في لوحة المدير
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
            
            // إنشاء كرت لكل لاعب ومعه خانة لإرسال تلميح مخصص له
            const playerRow = document.createElement('div');
            playerRow.className = "card";
            playerRow.style.padding = "10px";
            playerRow.style.marginBottom = "10px";
            playerRow.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong>🎮 ${player.name}</strong>
                    <span class="badge" style="border-color: #ff007c; color: #ff007c;">محاولاته: ${player.attempts}</span>
                </div>
                <div class="form-group inline-group" style="margin-bottom: 0;">
                    <input type="text" id="hint-input-${playerId}" placeholder="اكتب تلميحاً سرياً له...">
                    <button onclick="sendPrivateHint('${playerId}')" class="btn btn-host" style="width:auto; padding: 5px 10px; font-size:0.9rem;">إرسال تلميح</button>
                </div>
            `;
            playersListDiv.appendChild(playerRow);
        }
    });
}

// دالة يضغطها المدير لإرسال تلميح خاص للاعب معين في صندوقه
function sendPrivateHint(playerId) {
    const hintInput = document.getElementById(`hint-input-${playerId}`);
    const hintText = hintInput.value.trim();
    
    if (!hintText) {
        alert("اكتب تلميحاً أولاً لتوريثه للاعب!");
        return;
    }

    // دفع التلميح في صندوق اللاعب السري بالخادم
    const hintRef = database.ref('rooms/' + roomCode + '/players/' + playerId + '/hints').push();
    hintRef.set(hintText);
    
    hintInput.value = ""; // تنظيف الخانة
    alert("تم إرسال التلميح سرياً لجوال اللاعب!");
}

// الاستماع لإجابات التحديات اللي يرسلها الشباب سرياً للمدير
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

// دالة الانتقال للجولة التالية وتصفير إجابات التحديات القديمة
function nextRound() {
    if (currentRound >= maxRounds) {
        alert("وصلت للحد الأقصى من الجولات! أعلن نهاية القيم أو انتظر تخمين الكلمة.");
        return;
    }
    currentRound++;
    document.getElementById('host-current-round').innerText = currentRound;

    // تحديث الجولة في السيرفر وتصفير إجابات التحدي لاستقبال تحدي جديد
    database.ref('rooms/' + roomCode).update({ currentRound: currentRound });
    
    // تصفير خانات التحدي عند كل اللاعبين في السيرفر
    database.ref('rooms/' + roomCode + '/players').once('value', (snapshot) => {
        const players = snapshot.val();
        for (let playerId in players) {
            database.ref('rooms/' + roomCode + '/players/' + playerId).update({
                challengeAnswer: ""
            });
        }
    });
}