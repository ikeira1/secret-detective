// ==========================================
// ملف التحكم الخاص بمدير الجلسة المطور (Host)
// ==========================================

let database;
let roomCode = "";
let currentRound = 1;
let maxRounds = 5;
let myUID = "";

// دالة توليد المعرف الثابت الفريد للجهاز لمنع التكرار نهائياً
function getOrCreateUID() {
    let uid = localStorage.getItem('sd_my_uid');
    if (!uid) {
        uid = "u_" + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('sd_my_uid', uid);
    }
    return uid;
}

function initHost() {
    const hostName = document.getElementById('host-name').value.trim();
    maxRounds = parseInt(document.getElementById('total-rounds').value) || 5;
    myUID = getOrCreateUID();

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
        hostUID: myUID,
        hostName: hostName,
        maxRounds: maxRounds,
        currentRound: currentRound,
        secretWord: "",
        gameStatus: "lobby",
        winnerWordPlayer: "",
        chat: { "system": { sender: "النظام", text: "تم إنشاء الغرفة بنجاح!" } }
    }).then(() => {
        // إدارة الحضور وغياب المدير (إذا طلع المدير يتم استبداله عشوائياً فوراً)
        setupHostPresence();

        document.getElementById('auth-screen').classList.add('d-none');
        document.getElementById('host-screen').classList.remove('d-none');
        
        listenToPlayers();
        listenToChallengeAnswers();
        listenToChatForHost();
        listenToGameStatusForHost();
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

function listenToGameStatusForHost() {
    database.ref('rooms/' + roomCode).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (data.gameStatus === "word_guessed_waiting" && data.winnerWordPlayer) {
            document.getElementById('host-winner-name').innerText = data.winnerWordPlayer;
            document.getElementById('host-winner-alert-box').classList.remove('d-none');
        } else {
            document.getElementById('host-winner-alert-box').classList.add('d-none');
        }
    });
}

function activateVotingStage() {
    database.ref('rooms/' + roomCode).update({ gameStatus: "voting" });
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

        for (let pUID in players) {
            const player = players[pUID];
            const manualHintCount = player.manualHintCount || 0;
            const currentAttempts = player.attempts !== undefined ? player.attempts : 3;

            const playerRow = document.createElement('div');
            playerRow.className = "card player-card-hover"; 
            playerRow.style.padding = "12px";
            playerRow.style.marginBottom = "10px";
            
            playerRow.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <strong>🎮 ${player.name}</strong>
                        <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
                            <span style="font-size: 0.85rem; color: #00ffcc;">💡 تلميحاته: <strong>${manualHintCount}</strong></span>
                            <div class="hint-controls">
                                <button type="button" onclick="changeHintCount('${pUID}', 1)" style="background: #10b981; color: white; border: none; border-radius: 4px; padding: 0px 6px; font-size: 0.75rem; cursor: pointer; font-weight: bold;">+</button>
                                <button type="button" onclick="changeHintCount('${pUID}', -1)" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 0px 7px; font-size: 0.75rem; cursor: pointer; font-weight: bold;">-</button>
                            </div>
                        </div>
                    </div>
                    <div style="text-align: left; display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span class="badge" style="border-color: #ff007c; color: #ff007c; font-size: 0.8rem; padding: 2px 6px;">محاولاته: ${currentAttempts}</span>
                            <div class="attempt-controls">
                                <button type="button" onclick="changePlayerAttempts('${pUID}', 1)" style="background: #6366f1; color: white; border: none; border-radius: 4px; padding: 0px 5px; font-size: 0.75rem; cursor: pointer; font-weight: bold;">+</button>
                                <button type="button" onclick="changePlayerAttempts('${pUID}', -1)" style="background: #f59e0b; color: white; border: none; border-radius: 4px; padding: 0px 6px; font-size: 0.75rem; cursor: pointer; font-weight: bold;">-</button>
                            </div>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button type="button" onclick="transferHost('${pUID}', '${player.name}')" class="btn" style="width:auto; padding: 2px 6px; font-size:0.75rem; background-color:#4f46e5; color:white; border:none; border-radius:4px; cursor:pointer; font-weight: bold;">مدير 👑</button>
                            <button type="button" onclick="kickPlayer('${pUID}', '${player.name}')" class="btn" style="width:auto; padding: 2px 6px; font-size:0.75rem; background-color:#ef4444; color:white; border:none; border-radius:4px; cursor:pointer; font-weight: bold;">طرد ❌</button>
                        </div>
                    </div>
                </div>
                <div class="form-group inline-group" style="margin-bottom: 0;">
                    <input type="text" id="hint-input-${pUID}" placeholder="اكتب تلميحاً سرياً له...">
                    <button type="button" onclick="sendPrivateHint('${pUID}')" class="btn btn-host" style="width:auto; padding: 5px 10px; font-size:0.9rem;">إرسال</button>
                </div>
            `;
            playersListDiv.appendChild(playerRow);
        }
    });
}

function changeHintCount(pUID, value) {
    const playerRef = database.ref('rooms/' + roomCode + '/players/' + pUID);
    playerRef.once('value', (snapshot) => {
        const player = snapshot.val();
        if (!player) return;
        let currentCount = player.manualHintCount || 0;
        let newCount = currentCount + value;
        if (newCount < 0) newCount = 0;
        playerRef.update({ manualHintCount: newCount });
    });
}

function changePlayerAttempts(pUID, value) {
    const playerRef = database.ref('rooms/' + roomCode + '/players/' + pUID);
    playerRef.once('value', (snapshot) => {
        const player = snapshot.val();
        if (!player) return;
        let currentAttempts = player.attempts !== undefined ? player.attempts : 3;
        let newAttempts = currentAttempts + value;
        if (newAttempts < 0) newAttempts = 0;
        playerRef.update({ attempts: newAttempts });
    });
}

function sendPrivateHint(pUID) {
    const hintInput = document.getElementById(`hint-input-${pUID}`);
    const hintText = hintInput.value.trim();
    if (!hintText) return;
    database.ref('rooms/' + roomCode + '/players/' + pUID + '/hints').push(hintText);
    hintInput.value = "";
}

// دالة طرد اللاعب ووضعه في القائمة السوداء (Blacklist) للروم الحالي ولأجهزة المدير القديمة
function kickPlayer(pUID, pName) {
    if (!confirm(`هل أنت متأكد من طرد اللاعب [ ${pName} ]؟ لن يتمكن من العودة نهائياً.`)) return;
    
    // تسجيل الطرد في البلاك ليست بالسيرفر
    database.ref('rooms/' + roomCode + '/blacklist/' + pUID).set(true);
    // إخراجه فوراً
    database.ref('rooms/' + roomCode + '/players/' + pUID).remove();
    
    database.ref('rooms/' + roomCode + '/chat').push({
        sender: "🚨 النظام",
        text: `تم طرد اللاعب [ ${pName} ] وإدراجه في القائمة السوداء بنجاح! 🧼`
    });
}

// صندوق التحديات التاريخي: الإبقاء على الرسائل القديمة ورسم خط فاصل ذكي في النص لكل جولة جديدة
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
        let maxSeenRound = roomData.currentRound || 1;
        
        let roundsAnswers = {};
        for (let i = 1; i <= maxSeenRound; i++) {
            roundsAnswers[i] = [];
        }

        // قراءة كل الإجابات المرفوعة عبر كل اللاعبين وتصنيفها حسب الجولة المرفوعة بها
        for (let pUID in players) {
            const player = players[pUID];
            if (player.challengeHistory) {
                for (let rKey in player.challengeHistory) {
                    const ansObj = player.challengeHistory[rKey];
                    const rNum = parseInt(rKey);
                    if (!roundsAnswers[rNum]) roundsAnswers[rNum] = [];
                    roundsAnswers[rNum].push({
                        name: player.name,
                        answer: ansObj.answer,
                        timestamp: ansObj.timestamp || 0
                    });
                }
            }
        }

        let hasAnyData = false;

        // طباعة كافة الجولات تصاعدياً من الجولة 1 لإظهار الهيستوري كامل ومرتب
        for (let r = 1; r <= maxSeenRound; r++) {
            const list = roundsAnswers[r] || [];
            if (list.length > 0) {
                hasAnyData = true;
                list.sort((a, b) => a.timestamp - b.timestamp);

                const lineDivider = document.createElement('div');
                lineDivider.className = "round-line-divider";
                lineDivider.innerText = `--- الإجابات الواردة في الجولة رقم [ ${r} ] ---`;
                box.appendChild(lineDivider);

                list.forEach((item, index) => {
                    const msg = document.createElement('div');
                    msg.className = "msg msg-host";
                    msg.style.borderLeft = "3px solid #ff007c";
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

// تعديل الجولة التالية: الكلمة السرية الحين تظل ثابتة ومستمرة طول الجولات ولا تختفي
function nextRound() {
    if (currentRound >= maxRounds) {
        alert("وصلت للحد الأقصى من الجولات في هذا القيم!");
        return;
    }
    currentRound++;
    document.getElementById('host-current-round').innerText = currentRound;

    // نقوم بتحديث رقم الجولة وتصفير الفائز بالتصويت، مع إبقاء الـ secretWord كما هي بالسيرفر وثابتة
    database.ref('rooms/' + roomCode).update({ 
        currentRound: currentRound,
        gameStatus: "playing", // تستمر الجولة في حالة اللعب مباشرة بالكلمة القديمة
        winnerWordPlayer: ""
    });
    
    // تصفير حقول التصويت فقط للاعبين، وإبقاء إجابات التحديات القديمة
    database.ref('rooms/' + roomCode + '/players').once('value', (snapshot) => {
        const players = snapshot.val();
        for (let pUID in players) {
            database.ref('rooms/' + roomCode + '/players/' + pUID).update({ 
                votedFor: "" 
            });
        }
    });
}

// دالة النقل الذكية المستهدفة لمنع الوميض وتكرار الشاشة نهائياً
function transferHost(targetUID, targetPlayerName) {
    if (!confirm(`هل أنت متأكد من نقل صلاحية المدير إلى ${targetPlayerName}؟ ستتحول أنت تلقائيًا إلى لاعب عادي.`)) return;

    const currentHostName = localStorage.getItem('sd_playerName') || "مدير سابق";
    myUID = getOrCreateUID();

    // إلغاء تفعيل حضورك أولاً كمدير لمنع التعويض التلقائي
    if(window.myPresenceRef) window.myPresenceRef.removeAttributeOnDisconnect();

    localStorage.removeItem('sd_role');
    localStorage.setItem('sd_role', 'player');

    // إعداد حسابك كلاعب بالسيرفر أولاً
    database.ref('rooms/' + roomCode + '/players/' + myUID).set({
        name: currentHostName,
        attempts: 3,
        challengeAnswer: "",
        votedFor: "",
        manualHintCount: 0
    }).then(() => {
        // تحديث السيرفر لإرسال إشارة النقل الموجهة للـ UID المستهدف
        database.ref('rooms/' + roomCode).update({
            hostUID: targetUID,
            hostName: targetPlayerName,
            gameStatus: "lobby",
            winnerWordPlayer: ""
        }).then(() => {
            // نقوم بعمل off لكل المستمعين قبل الريفرش لإنهاء كاش الـ Listeners القديم قاطعاً
            database.ref('rooms/' + roomCode).off();
            window.location.reload();
        });
    });
}

// نظام غياب الحضور والتعويض العشوائي الذكي للمدير
function setupHostPresence() {
    const presenceRef = database.ref('.info/connected');
    window.myPresenceRef = database.ref('rooms/' + roomCode + '/hostConnected');
    
    presenceRef.on('value', (snap) => {
        if (snap.val() === true) {
            window.myPresenceRef.onDisconnect().set(false);
            window.myPresenceRef.set(true);
        }
    });

    // مراقبة الحضور: لو طلع المدير، نختار لاعب عشوائي فوراً ليتولى الروم
    database.ref('rooms/' + roomCode + '/hostConnected').on('value', (snapshot) => {
        if (snapshot.val() === false) {
            // المدير طلع! نقوم باختيار لاعب عشوائي
            database.ref('rooms/' + roomCode + '/players').once('value', (pSnap) => {
                const players = pSnap.val();
                if (players) {
                    const keys = Object.keys(players);
                    const randomUID = keys[Math.floor(Math.random() * keys.length)];
                    const randomPlayer = players[randomUID];

                    database.ref('rooms/' + roomCode).update({
                        hostUID: randomUID,
                        hostName: randomPlayer.name,
                        hostConnected: true // تفعيل الحضور للمدير الجديد
                    }).then(() => {
                        // إزالة خانته من قائمة اللاعبين كونه ترقى لمدير
                        database.ref('rooms/' + roomCode + '/players/' + randomUID).remove();
                    });
                }
            });
        }
    });
}

function resetFullGame() {
    let newRounds = prompt("كم تريد أن يكون عدد الجولات للجيم الجديد؟", maxRounds);
    if (newRounds === null) return; 
    newRounds = parseInt(newRounds) || 5;

    let stayHost = confirm("هل تريد الاستمرار كونك المدير؟\n(موافق/OK = استمرار، إلغاء/Cancel = اختيار لاعب آخر)");

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
        if (players) {
            for (let pUID in players) {
                database.ref('rooms/' + roomCode + '/players/' + pUID).set({
                    name: players[pUID].name,
                    attempts: 3,
                    challengeAnswer: "",
                    votedFor: "",
                    manualHintCount: 0
                });
            }
        }
        
        database.ref('rooms/' + roomCode + '/chat').push({
            sender: "🚨 النظام",
            text: `تمت إعادة تشغيل الجيم بالكامل لعدد (${maxRounds}) جولات جديدة! بانتظار تزويد الكلمة السرية 👀✨`
        });

        if (!stayHost) {
            alert("تم تصفير الروم، اضغط الآن على زر 'مدير 👑' بجانب اسم اللاعب اللي تبيه يتولى الروم!");
        } else {
            alert("تم تصفير الروم وبدء قيم جديد بنجاح وأنت المدير الحين!");
        }
    });
}