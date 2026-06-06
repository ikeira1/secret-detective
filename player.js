let pDatabase;
let pRoomCode = "";
let playerName = "";
let pAttempts = 3;
let hasFiredConfetti = false;
let lastKnownStatus = "lobby";

function getOrCreateUID() {
    let uid = localStorage.getItem('sd_my_uid');
    if (!uid) {
        uid = "u_" + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('sd_my_uid', uid);
    }
    return uid;
}

function handleKickedOrLoggedOut() {
    localStorage.removeItem('sd_role');
    localStorage.removeItem('sd_roomCode');
    localStorage.removeItem('sd_playerName');
    window.location.reload();
}

function leaveRoomButton() {
    if (confirm("هل تريد الخروج من الروم الحالي والعودة للشاشة الرئيسية؟")) {
        try {
            const savedRoom = localStorage.getItem('sd_roomCode');
            const currentUID = localStorage.getItem('sd_my_uid');
            if (savedRoom && currentUID && typeof firebase !== 'undefined' && firebase.apps.length) {
                firebase.database().ref('rooms/' + savedRoom + '/players/' + currentUID).remove();
            }
        } catch(e) { console.log("مغادرة: ", e); }
        handleKickedOrLoggedOut();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    getOrCreateUID();
    
    // حل مشكلة الروابط تمنع فتح صفحة اللعبة مكررة
    if (typeof mySocialLinks !== 'undefined') {
        const setLink = (id, url) => {
            const el = document.getElementById(id);
            if (el) {
                el.href = url;
                el.target = "_blank";
                el.onclick = (e) => { e.stopPropagation(); }; 
            }
        };
        setLink('nav-donate', mySocialLinks.donation);
        setLink('nav-tiktok', mySocialLinks.tiktok);
        setLink('nav-youtube', mySocialLinks.youtube);
        setLink('nav-twitch', mySocialLinks.twitch);
    }
    
    if (typeof firebaseConfig === 'undefined') return;
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

    const savedRole = localStorage.getItem('sd_role');
    const savedRoom = localStorage.getItem('sd_roomCode');
    
    if (savedRole && savedRoom) {
        const checkDb = firebase.database();
        checkDb.ref('rooms/' + savedRoom).once('value', (snap) => {
            if (snap.exists()) {
                pRoomCode = savedRoom;
                playerName = localStorage.getItem('sd_playerName') || "";
                
                if (savedRole === 'host') {
                    if (typeof database !== 'undefined') database = checkDb;
                    if (typeof roomCode !== 'undefined') roomCode = savedRoom;
                    if (typeof hostName !== 'undefined') hostName = playerName;
                    
                    document.getElementById('auth-screen').classList.add('d-none');
                    document.getElementById('host-screen').classList.remove('d-none');
                    document.getElementById('display-room-code').innerText = `رمز الروم: ${savedRoom}`;
                    document.getElementById('host-max-rounds').innerText = snap.val().maxRounds || 5;
                    
                    if (document.getElementById('host-name')) document.getElementById('host-name').value = playerName;

                    if (typeof listenToPlayers === "function") listenToPlayers();
                    if (typeof listenToChallengeAnswers === "function") listenToChallengeAnswers();
                    if (typeof listenToChatForHost === "function") listenToChatForHost();
                    if (typeof setupHostPresence === "function") setupHostPresence();
                } else {
                    pDatabase = checkDb;
                    pDatabase.ref('rooms/' + pRoomCode + '/players/' + localStorage.getItem('sd_my_uid')).once('value', (pSnap) => {
                        if (pSnap.exists()) {
                            pAttempts = pSnap.val().attempts !== undefined ? pSnap.val().attempts : 3;
                            document.getElementById('remaining-attempts').innerText = pAttempts;
                            document.getElementById('auth-screen').classList.add('d-none');
                            document.getElementById('player-screen').classList.remove('d-none');
                            document.getElementById('player-display-room-code').innerText = `رمز الروم الحالي: ${pRoomCode}`;
                            startPlayerListeners();
                        } else {
                            handleKickedOrLoggedOut();
                        }
                    });
                }
            } else {
                handleKickedOrLoggedOut();
            }
        });
    }
});

function initPlayer() {
    playerName = document.getElementById('player-name').value.trim();
    pRoomCode = document.getElementById('room-code').value.trim();
    let currentUID = getOrCreateUID();

    if (!playerName || !pRoomCode) {
        alert("الرجاء كتابة اسمك ورمز الغرفة أولاً!");
        return;
    }

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    pDatabase = firebase.database();

    pDatabase.ref('rooms/' + pRoomCode).once('value', (snapshot) => {
        if (!snapshot.exists()) {
            alert("رقم الغرفة غير صحيح أو غير متوفر حالياً!");
            return;
        }

        const roomData = snapshot.val();
        if (roomData.blacklist && roomData.blacklist[currentUID]) {
            alert("❌ عذراً، أنت مطرود من هذا الروم!");
            return;
        }

        localStorage.setItem('sd_role', 'player');
        localStorage.setItem('sd_roomCode', pRoomCode);
        localStorage.setItem('sd_playerName', playerName);

        pDatabase.ref('rooms/' + pRoomCode + '/players/' + currentUID).set({
            name: playerName,
            attempts: 3,
            challengeAnswer: "",
            votedFor: "",
            manualHintCount: 0
        }).then(() => {
            pDatabase.ref('rooms/' + pRoomCode + '/players/' + currentUID).onDisconnect().remove();
            document.getElementById('auth-screen').classList.add('d-none');
            document.getElementById('player-screen').classList.remove('d-none');
            document.getElementById('player-display-room-code').innerText = `رمز الروم الحالي: ${pRoomCode}`;
            startPlayerListeners();
        });
    }).catch(err => { alert("خطأ اتصال: " + err.message); });
}

function startPlayerListeners() {
    if (!pDatabase || !pRoomCode) return;
    let currentUID = getOrCreateUID();

    pDatabase.ref('rooms/' + pRoomCode).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            handleKickedOrLoggedOut();
            return;
        }

        if (data.blacklist && data.blacklist[currentUID]) {
            pDatabase.ref('rooms/' + pRoomCode).off();
            alert("❌ تم طردك من الغرفة!");
            handleKickedOrLoggedOut();
            return;
        }

        const statusBadge = document.getElementById('game-status-badge');
        const alertStatusBox = document.getElementById('player-status-alert');
        
        if (data.gameStatus === "lobby") {
            if (statusBadge) { statusBadge.innerText = "بانتظار المدير يقفل الكلمة السرية... ⏳"; statusBadge.className = "text-warning"; }
            if (alertStatusBox) alertStatusBox.classList.add('d-none');
            document.getElementById('guess-input').disabled = true;
            document.getElementById('guess-btn').disabled = true;
        } else if (data.gameStatus === "playing") {
            if (statusBadge) { statusBadge.innerText = "الجيم شغال.. الكلمة مقفلة! 🔥"; statusBadge.className = "text-success"; }
            if (lastKnownStatus === "lobby" && alertStatusBox) {
                alertStatusBox.innerText = "🚨 بدأت الجولة! المدير قفل الكلمة السرية.. ابدأوا التخمين الحين! 🔥";
                alertStatusBox.classList.remove('d-none');
            }
            if (pAttempts > 0) {
                document.getElementById('guess-input').disabled = false;
                document.getElementById('guess-btn').disabled = false;
            }
        }

        lastKnownStatus = data.gameStatus;

        // تحديث حي فوري لقائمة المشتركين
        const membersDiv = document.getElementById('player-all-members-list');
        if (membersDiv) {
            membersDiv.innerHTML = "";
            const hostRow = document.createElement('div');
            hostRow.style.padding = "6px 10px"; hostRow.style.background = "rgba(99, 102, 241, 0.2)";
            hostRow.style.borderRadius = "4px"; hostRow.style.borderRight = "3px solid #6366f1";
            hostRow.innerHTML = `👑 <strong>${data.hostName}</strong> <span style="font-size:0.75rem; color:#a5b4fc;">(المدير)</span>`;
            membersDiv.appendChild(hostRow);

            if (data.players) {
                for (let idKey in data.players) {
                    const pItem = data.players[idKey];
                    const pRow = document.createElement('div');
                    pRow.style.padding = "6px 10px"; pRow.style.background = "#1e293b"; pRow.style.borderRadius = "4px";
                    pRow.innerHTML = `🎮 ${pItem.name || "لاعب متصل"}`;
                    membersDiv.appendChild(pRow);
                }
            }
        }

        if (document.getElementById('player-current-round')) document.getElementById('player-current-round').innerText = data.currentRound;

        if (data.players && data.players[currentUID]) {
            pAttempts = data.players[currentUID].attempts !== undefined ? data.players[currentUID].attempts : 3;
            document.getElementById('remaining-attempts').innerText = pAttempts;
            
            // تحديث التلميحات
            const hintsDiv = document.getElementById('player-hints-box');
            if (hintsDiv) {
                hintsDiv.innerHTML = "";
                if (data.players[currentUID].hints) {
                    for (let hKey in data.players[currentUID].hints) {
                        const hText = data.players[currentUID].hints[hKey];
                        const hBubble = document.createElement('div');
                        hBubble.style.padding = "6px 10px"; hBubble.style.background = "rgba(0, 255, 204, 0.1)";
                        hBubble.style.borderRight = "3px solid #00ffcc"; hBubble.style.borderRadius = "4px"; hBubble.style.marginBottom = "4px";
                        hBubble.innerHTML = `💡 ${hText}`;
                        hintsDiv.appendChild(hBubble);
                    }
                } else {
                    hintsDiv.innerHTML = `<span class="empty-state">ما جاك أي تلميح خاص للحين.</span>`;
                }
            }
        }

        if (data.gameStatus === "voting") {
            if (!hasFiredConfetti) { triggerFireworksEffect(); hasFiredConfetti = true; }
            openVoteScreen(data);
        }

        if (data.gameStatus === "lobby" || data.gameStatus === "playing") {
            document.getElementById('vote-screen').classList.add('d-none');
            document.getElementById('player-screen').classList.remove('d-none');
            hasFiredConfetti = false;
        }
    });

    pDatabase.ref('rooms/' + pRoomCode + '/chat').on('value', (snapshot) => {
        const chatLog = document.getElementById('player-chat-log');
        if (!chatLog) return;
        chatLog.innerHTML = "";
        const messages = snapshot.val();
        if (!messages) return;

        for (let mKey in messages) {
            const msg = messages[mKey];
            const div = document.createElement('div');
            div.className = msg.sender.includes("👑") ? "msg msg-host text-end align-self-start ms-auto mb-1" : "msg msg-player text-end align-self-start me-auto mb-1";
            div.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;
            chatLog.appendChild(div);
        }
        chatLog.scrollTop = chatLog.scrollHeight;
    });
}

function submitPlayerGuess() {
    const inputEl = document.getElementById('guess-input');
    const guessText = inputEl.value.trim();
    let currentUID = getOrCreateUID();

    if (!guessText) return;
    if (pAttempts <= 0) return;

    inputEl.value = "";

    pDatabase.ref('rooms/' + pRoomCode).once('value', (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData) return;

        const correctWord = roomData.secretWord ? roomData.secretWord.trim() : "";
        let newAttempts = pAttempts - 1;

        if (guessText === correctWord) {
            pDatabase.ref('rooms/' + pRoomCode).update({
                gameStatus: "voting",
                winnerWordPlayer: playerName
            }).then(() => {
                pDatabase.ref('rooms/' + pRoomCode + '/chat').push({
                    sender: "🚨 نظام اللعبة",
                    text: `🎉 المحقق [ ${playerName} ] قفط الكلمة السرية الصحيحة! وانتقلنا للتصويت!`
                });
            });
        } else {
            pDatabase.ref('rooms/' + pRoomCode + '/players/' + currentUID).update({ attempts: newAttempts }).then(() => {
                pAttempts = newAttempts;
                document.getElementById('remaining-attempts').innerText = pAttempts;
                if (newAttempts <= 0) {
                    document.getElementById('guess-input').disabled = true;
                    document.getElementById('guess-btn').disabled = true;
                    alert("⚠️ انتهت محاولاتك!");
                } else {
                    alert(`❌ غلط! باقي ${newAttempts} محاولات.`);
                }
            });
        }
    });
}

function openVoteScreen(roomData) {
    document.getElementById('player-screen').classList.add('d-none');
    document.getElementById('vote-screen').classList.remove('d-none');

    const voteGrid = document.getElementById('vote-players-list');
    if (!voteGrid) return;
    voteGrid.innerHTML = "";

    const players = roomData.players || {};
    let currentUID = getOrCreateUID();
    let hasOptions = false;

    for (let idKey in players) {
        if (idKey === currentUID) continue; 
        hasOptions = true;
        const btn = document.createElement('button');
        btn.className = "btn btn-outline-light text-start w-100 p-3 my-1";
        btn.innerText = `🎮 اللاعب: ${players[idKey].name}`;
        
        btn.onclick = function() {
            if (!confirm(`صوت ضد [ ${players[idKey].name} ]؟`)) return;
            pDatabase.ref('rooms/' + pRoomCode + '/players/' + currentUID).update({ votedFor: players[idKey].name }).then(() => {
                alert("🔒 تم تسجيل تصويتك!");
                document.getElementById('vote-screen').classList.add('d-none');
                document.getElementById('player-screen').classList.remove('d-none');
            });
        };
        voteGrid.appendChild(btn);
    }
    if (!hasOptions) voteGrid.innerHTML = "<h3>لا يوجد لاعبين آخرين بالروم للتصويت لهم!</h3>";
}

function sendChatMessage() {
    const chatInput = document.getElementById('chat-message');
    const msgText = chatInput.value.trim();
    if (!msgText || !pDatabase) return;

    pDatabase.ref('rooms/' + pRoomCode + '/chat').push({ sender: playerName, text: msgText });
    chatInput.value = "";
}

function triggerFireworksEffect() {
    var duration = 4 * 1000; var end = Date.now() + duration;
    (function frame() {
        confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.85 } });
        confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.85 } });
        if (Date.now() < end) { requestAnimationFrame(frame); }
    }());
}