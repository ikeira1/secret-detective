// ==========================================
// ملف إعدادات الخادم والربط المباشر (Config)
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyDldMqab0GJ_AkzdhJ31oJrVjOKW6wyXPs",
    authDomain: "secretdetective-a2acf.firebaseapp.com",
    databaseURL: "https://secretdetective-a2acf-default-rtdb.firebaseio.com/", 
    projectId: "secretdetective-a2acf",
    storageBucket: "secretdetective-a2acf.firebasestorage.app",
    messagingSenderId: "663254171790",
    appId: "1:663254171790:web:464aec6dc57e30e05289df"
};

// روابط حساباتك الحقيقية (K e i r a) تظهر تلقائياً أسفل الموقع
const mySocialLinks = {
    donation: "https://creators.sa/keira",
    tiktok: "https://www.tiktok.com/@ikeira12?is_from_webapp=1&sender_device=pc", 
    youtube: "https://www.youtube.com/@ikeira1", 
    twitch: "https://www.twitch.tv/ikeira1" 
};

// دالة لتحديث الروابط في الموقع تلقائياً عند التحميل
document.addEventListener("DOMContentLoaded", () => {
    if(document.getElementById('donation-link')) document.getElementById('donation-link').href = mySocialLinks.donation;
    if(document.getElementById('tiktok-link')) document.getElementById('tiktok-link').href = mySocialLinks.tiktok;
    if(document.getElementById('youtube-link')) document.getElementById('youtube-link').href = mySocialLinks.youtube;
    if(document.getElementById('twitch-link')) document.getElementById('twitch-link').href = mySocialLinks.twitch;
});// ==========================================
// ملف إعدادات الخادم والربط المباشر (Config)
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyDldMqab0GJ_AkzdhJ31oJrVjOKW6wyXPs",
    authDomain: "secretdetective-a2acf.firebaseapp.com",
    databaseURL: "https://secretdetective-a2acf-default-rtdb.firebaseio.com/", 
    projectId: "secretdetective-a2acf",
    storageBucket: "secretdetective-a2acf.firebasestorage.app",
    messagingSenderId: "663254171790",
    appId: "1:663254171790:web:464aec6dc57e30e05289df"
};

// روابط حساباتك الحقيقية (K e i r a) تظهر تلقائياً أسفل الموقع
const mySocialLinks = {
    donation: "https://creators.sa/keira",
    tiktok: "https://www.tiktok.com/@ikeira12?is_from_webapp=1&sender_device=pc", 
    youtube: "https://www.youtube.com/@ikeira1", 
    twitch: "https://www.twitch.tv/ikeira1" 
};

// دالة لتحديث الروابط في الموقع تلقائياً عند التحميل
document.addEventListener("DOMContentLoaded", () => {
    if(document.getElementById('donation-link')) document.getElementById('donation-link').href = mySocialLinks.donation;
    if(document.getElementById('tiktok-link')) document.getElementById('tiktok-link').href = mySocialLinks.tiktok;
    if(document.getElementById('youtube-link')) document.getElementById('youtube-link').href = mySocialLinks.youtube;
    if(document.getElementById('twitch-link')) document.getElementById('twitch-link').href = mySocialLinks.twitch;
});