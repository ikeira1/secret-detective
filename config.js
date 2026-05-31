// ==========================================
// ملف إعدادات الخادم والربط المباشر (Config)
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyDldMqab0GJ_AkzdhJ31oJrVjOKW6wyXPs",
    authDomain: "secretdetective-a2acf.firebaseapp.com",
    // ⚠️ أنا أضفت لك هذا السطر بناءً على اسم مشروعك عشان يربط الشات والتخمينات لايف
    databaseURL: "https://secretdetective-a2acf-default-rtdb.firebaseio.com/", 
    projectId: "secretdetective-a2acf",
    storageBucket: "secretdetective-a2acf.firebasestorage.app",
    messagingSenderId: "663254171790",
    appId: "1:663254171790:web:464aec6dc57e30e05289df"
};

// هنا تقدر تحط روابطك الحقيقية للدعم والسوشل ميديا مستقبلاً
const mySocialLinks = {
    donation: "https://tkeep.com/YOUR_ACCOUNT", // استبدله برابط دكان تيب حقك لاحقاً
    tiktok: "https://www.tiktok.com/@YOUR_USER", 
    youtube: "https://www.youtube.com/@YOUR_CHANNEL", 
    twitch: "https://www.twitch.tv/YOUR_CHANNEL" 
};

// دالة لتحديث الروابط في الموقع تلقائياً
document.addEventListener("DOMContentLoaded", () => {
    if(document.getElementById('donation-link')) document.getElementById('donation-link').href = mySocialLinks.donation;
    if(document.getElementById('tiktok-link')) document.getElementById('tiktok-link').href = mySocialLinks.tiktok;
    if(document.getElementById('youtube-link')) document.getElementById('youtube-link').href = mySocialLinks.youtube;
    if(document.getElementById('twitch-link')) document.getElementById('twitch-link').href = mySocialLinks.twitch;
});