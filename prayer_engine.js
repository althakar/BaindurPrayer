var xmlPrayerDatabase = {};
var CURRENT_INSTALLED_VERSION_CODE = 7;
var CURRENT_INSTALLED_VERSION_NAME = "v2.4";
var SITE = { lat: 13.872767, lng: 74.624630, tz: 5.5, tzName: 'Asia/Kolkata' };
var PRAYERS = [
    { key: 'imsak', name: 'Imsak', ar: 'الإمساك', isSalah: false },
    { key: 'fajr', name: 'Fajr', ar: 'الفجر', isSalah: true },
    { key: 'sunrise', name: 'Sunrise', ar: 'الشروق', isSalah: false },
    { key: 'dhuhr', name: 'Dhuhr', ar: 'الظهر', isSalah: true },
    { key: 'asr', name: 'Asr', ar: 'العصر', isSalah: true },
    { key: 'sunset', name: 'Sunset', ar: 'الغروب', isSalah: false },
    { key: 'maghrib', name: 'Maghrib', ar: 'المغرب', isSalah: true },
    { key: 'isha', name: 'Isha', ar: 'العشاء', isSalah: true },
    { key: 'taraweeh', name: "Tara'weeh", ar: 'التراويح', isSalah: false }
];

document.addEventListener('DOMContentLoaded', function() {
    initSettingsWheels();
    setTimeout(checkStoredNotificationsState, 500);

    var nightToggle = document.getElementById('nightModeToggle');
    var nightEnabled = (localStorage.getItem('night_mode_enabled') === '1');
    if (nightToggle) nightToggle.checked = nightEnabled;
    if (nightEnabled) document.body.classList.add('dark-theme');

    loadXMLDatabase();
    renderView();

    startSplashTransition();
    var isDiagEnabled = (localStorage.getItem('advanced_diag_enabled') === '1');
    var diagToggle = document.getElementById('advancedDiagToggle');
    if (diagToggle) diagToggle.checked = isDiagEnabled;
    if (isDiagEnabled) scheduleDiagnosticUploadTimer();

    setTimeout(recordInstallOrUpdate, 3000);
    updateWeatherDisplay();
    fetchAndShowNotice();
    
    document.addEventListener('click', unlockAudioOnTouch, { once: true });
    updateWaterLenses();
});

window.addEventListener('scroll', updateWaterLenses, { passive: true });
window.addEventListener('touchmove', updateWaterLenses, { passive: true });
setInterval(updateWaterLenses, 50);

function unlockAudioOnTouch() {
    var az = document.getElementById('azaanAudio');
    var iq = document.getElementById('iqaamaAudio');
    if(az){ az.play().then(()=>{az.pause(); az.currentTime=0;}).catch(e=>{}); }
    if(iq){ iq.play().then(()=>{iq.pause(); iq.currentTime=0;}).catch(e=>{}); }
}

function initSettingsWheels() {
    let extraMinsHtml = '';
    for(let m=0; m<=20; m++) {
        extraMinsHtml += '<div class="wheel-item ' + (m===15?'selected':'') + '" data-val="'+m+'">'+m+' Min</div>';
    }
    var emScroll = document.getElementById('extraMinutesScroll');
    if(emScroll) emScroll.innerHTML = extraMinsHtml;

    let jumahHtml = '';
    for(let m=0; m<=45; m++) {
        let minStr = m < 10 ? '0' + m : m;
        let timeVal = '13:' + minStr;
        let displayTime = '1:' + minStr + ' PM';
        let isDefault = (timeVal === '13:15');
        jumahHtml += '<div class="wheel-item ' + (isDefault?'selected':'') + '" data-val="'+timeVal+'">'+displayTime+'</div>';
    }
    var jtScroll = document.getElementById('jumahTimeScroll');
    if(jtScroll) jtScroll.innerHTML = jumahHtml;

    const prayersConfig = [
        {key: 'fajr', label: 'Fajr', defaultDelay: 19},
        {key: 'dhuhr', label: 'Dhuhr', defaultDelay: 19},
        {key: 'asr', label: 'Asr', defaultDelay: 14},
        {key: 'maghrib', label: 'Maghrib', defaultDelay: 4},
        {key: 'isha', label: 'Isha', defaultDelay: 14}
    ];
    let delaysHtml = '';
    prayersConfig.forEach(function(p) {
        var pickerId = 'delayPicker_' + p.key;
        var inputId = 'iq_delay_' + p.key;
        delaysHtml += '<div class="settings-row-grid" style="padding: 3px 4px; border-bottom: 1px solid var(--line-soft);">' +
            '<span style="font-family:var(--serif); font-size:14px; font-weight:500; color:var(--ink); text-align:left;">' + p.label + '</span>' +
            '<div style="display:flex; justify-content:center;"><label class="switch small" style="margin:0;"><input type="checkbox" id="toggle_ad_' + p.key + '" onchange="saveSettings()"><span class="slider"></span></label></div>' +
            '<div style="display:flex; justify-content:center;"><label class="switch small" style="margin:0;"><input type="checkbox" id="toggle_iq_' + p.key + '" onchange="saveSettings()"><span class="slider"></span></label></div>' +
            '<div style="display:flex; flex-direction:column; align-items:center;">' +
                '<div class="wheel-picker-container" id="' + pickerId + '" onclick="scrollWheelToNext(\'' + pickerId + '\', \'' + inputId + '\')" style="width:75px; height:32px;">' +
                    '<div class="wheel-picker-scroll" onscroll="handleWheelScroll(this, \'' + inputId + '\')">';
        for(let d=0; d<=25; d++) {
            delaysHtml += '<div class="wheel-item ' + (d===p.defaultDelay?'selected':'') + '" data-val="'+d+'">'+d+' Min</div>';
        }
        delaysHtml += '</div></div><div class="wheel-picker-hint">Scroll / Tap</div><input type="hidden" id="' + inputId + '" value="' + p.defaultDelay + '"></div></div>';
    });
    var container = document.getElementById('prayerDelaysContainer');
    if(container) container.innerHTML = delaysHtml;
}

function openNotificationModal() { var modal = document.getElementById('notificationModal'); if (modal) { modal.style.display = 'flex'; loadNotificationHistory(); setBellStatus(false); } }
function closeNotificationModal() { var modal = document.getElementById('notificationModal'); if (modal) modal.style.display = 'none'; }
function loadNotificationHistory() {
    var container = document.getElementById('notificationListContainer');
    if (!container) return;
    var jsonStr = localStorage.getItem('app_notifications') || "[]";
    try {
        var list = JSON.parse(jsonStr);
        if (!list || list.length === 0) { container.innerHTML = '<div style="text-align:center; padding:24px; color:var(--ink-muted); font-size:14px;">No notifications yet.</div>'; return; }
        var html = '';
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            html += '<div style="background:var(--card-bg, #fff); border:1px solid var(--line-soft); border-radius:8px; padding:10px 12px; display:flex; flex-direction:column; gap:4px; position:relative;">' +
                    '<div style="display:flex; justify-content:space-between; align-items:center;">' +
                        '<span style="font-weight:600; font-size:14px; color:var(--ink);">' + (item.title || 'Notice') + '</span>' +
                        '<div style="display:flex; align-items:center; gap:8px;">' +
                            '<span style="font-size:11px; color:var(--ink-muted);">' + (item.time || '') + '</span>' +
                            '<button onclick="deleteNotification(' + i + ')" title="Delete" style="background:none; border:none; color:var(--ink-muted); cursor:pointer; font-size:14px; padding:2px 4px;">&times;</button>' +
                        '</div></div>' +
                    '<span style="font-size:13px; color:var(--ink-secondary, #444); line-height:1.4;">' + (item.body || '') + '</span></div>';
        }
        container.innerHTML = html;
    } catch (e) {}
}
function deleteNotification(index) {
    try {
        var stored = localStorage.getItem('app_notifications');
        if (stored) { var list = JSON.parse(stored); list.splice(index, 1); localStorage.setItem('app_notifications', JSON.stringify(list)); }
        loadNotificationHistory();
        checkStoredNotificationsState();
    } catch (e) {}
}
function checkStoredNotificationsState() {
    try {
        var jsonStr = localStorage.getItem('app_notifications') || "[]";
        var list = JSON.parse(jsonStr);
        setBellStatus(list && list.length > 0);
    } catch(e) {}
}
function setBellStatus(hasNotification) {
    const bellPath = document.getElementById('bellIcon');
    const bellBadge = document.getElementById('bellBadge');
    if (bellPath) {
        bellPath.setAttribute('fill', hasNotification ? '#d4af37' : '#8c8c8c');
        bellPath.style.animation = hasNotification ? 'bellShake 2.5s ease-in-out infinite' : 'none';
    }
    if (bellBadge) bellBadge.style.display = hasNotification ? 'block' : 'none';
}
function clearAllNotifications() {
    localStorage.removeItem('app_notifications');
    loadNotificationHistory();
    setBellStatus(false);
}

const BYNDOOR_QIBLA_BEARING = 289;
let lastHeading = 0;
let lastPointerAngle = 0;
function openQiblaModal() { var m = document.getElementById('qiblaModal'); if(m) m.style.display = 'flex'; initQiblaCompass(); }
function closeQiblaModal() { var m = document.getElementById('qiblaModal'); if(m) m.style.display = 'none'; window.removeEventListener('deviceorientation', handleOrientation); window.removeEventListener('deviceorientationabsolute', handleOrientation); }
function initQiblaCompass() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(response => { if (response === 'granted') startListening(); }).catch(console.error);
    } else { startListening(); }
    function startListening() {
        if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        else if ('ondeviceorientation' in window) window.addEventListener('deviceorientation', handleOrientation, true);
    }
}
function handleOrientation(event) {
    let heading = null;
    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) heading = event.webkitCompassHeading;
    else if (event.absolute && event.alpha !== null) heading = 360 - event.alpha;
    else if (event.alpha !== null) heading = 360 - event.alpha;
    if (heading !== null) {
        let smoothedHeading = lastHeading + (heading - lastHeading) * 0.2;
        lastHeading = smoothedHeading;
        document.getElementById('compassRing').style.transform = `rotate(${-smoothedHeading}deg)`;
        let targetAngle = BYNDOOR_QIBLA_BEARING - smoothedHeading;
        let smoothedPointer = lastPointerAngle + (targetAngle - lastPointerAngle) * 0.2;
        lastPointerAngle = smoothedPointer;
        document.getElementById('compassPointer').style.transform = `rotate(${smoothedPointer}deg)`;
        let diff = Math.abs(smoothedHeading - BYNDOOR_QIBLA_BEARING);
        if (diff > 180) diff = 360 - diff;
        const statusBox = document.getElementById('qiblaStatusBox');
        const statusText = document.getElementById('qiblaStatusText');
        const subText = document.getElementById('qiblaSubText');
        if (diff <= 6) {
            statusBox.classList.add('aligned');
            statusText.innerText = "Facing Qibla! 🕋";
            subText.innerText = "Perfect alignment";
        } else {
            statusBox.classList.remove('aligned');
            statusText.innerText = "Align arrow with Kaaba";
            subText.innerText = `Target bearing: ${BYNDOOR_QIBLA_BEARING}°`;
        }
    }
}

function handleNightModeToggle() {
    var toggle = document.getElementById('nightModeToggle');
    if (!toggle) return;
    if (toggle.checked) { document.body.classList.add('dark-theme'); localStorage.setItem('night_mode_enabled', '1'); } 
    else { document.body.classList.remove('dark-theme'); localStorage.setItem('night_mode_enabled', '0'); }
}
function saveAdhanReciter(reciterValue) {
    localStorage.setItem('setting_adhan_reciter', reciterValue);
    if (window.AndroidBridge && typeof window.AndroidBridge.saveAdhanReciter === 'function') window.AndroidBridge.saveAdhanReciter(reciterValue);
}

function getTagText(node, tag1, tag2) {
    var el = node.getElementsByTagName(tag1)[0];
    if (!el && tag2) el = node.getElementsByTagName(tag2)[0];
    return el && el.textContent ? el.textContent.trim() : "";
}
function formatXmlTime(time24) {
    if (!time24) return "--:--";
    var str = String(time24).trim();
    if (!str) return "--:--";
    if (str.indexOf("AM") !== -1 || str.indexOf("PM") !== -1) return str;
    var parts = str.split(":");
    if (parts.length < 2) return str;
    var h = parseInt(parts[0], 10);
    var m = parts[1].trim().substring(0, 2);
    var suffix = h >= 12 ? "PM" : "AM";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + m + " " + suffix;
}
function loadXMLDatabase() {
    if (typeof window.EMBEDDED_PRAYER_XML === 'undefined' || !window.EMBEDDED_PRAYER_XML) return;
    try {
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(window.EMBEDDED_PRAYER_XML, "text/xml");
        var year = xmlDoc.documentElement.getAttribute("year") || "2026";
        var monthNodes = xmlDoc.getElementsByTagName("month");
        var monthMap = { "January":"01", "February":"02", "March":"03", "April":"04", "May":"05", "June":"06", "July":"07", "August":"08", "September":"09", "October":"10", "November":"11", "December":"12" };
        for (var i = 0; i < monthNodes.length; i++) {
            var mNode = monthNodes[i];
            var mNum = monthMap[mNode.getAttribute("name")];
            if (!mNum) continue;
            var dayNodes = mNode.getElementsByTagName("day");
            for (var j = 0; j < dayNodes.length; j++) {
                var dNode = dayNodes[j];
                var dNum = dNode.getAttribute("number");
                if(dNum.length === 1) dNum = "0" + dNum;
                xmlPrayerDatabase[year + "-" + mNum + "-" + dNum] = {
                    imsak: formatXmlTime(getTagText(dNode, "imsak")), fajr: formatXmlTime(getTagText(dNode, "fajr")),
                    sunrise: formatXmlTime(getTagText(dNode, "sunrise")), dhuhr: formatXmlTime(getTagText(dNode, "dhuhr", "zuhar")),
                    asr: formatXmlTime(getTagText(dNode, "asr")), sunset: formatXmlTime(getTagText(dNode, "sunset")),
                    maghrib: formatXmlTime(getTagText(dNode, "maghrib", "magrib")), isha: formatXmlTime(getTagText(dNode, "isha"))
                };
            }
        }
    } catch(e) {}
}

function checkForAppUpdate(updateData) {
    if (!updateData || !updateData.downloadUrl) return false;
    var remoteCode = parseInt(updateData.latestVersionCode, 10) || 0;
    if (remoteCode > CURRENT_INSTALLED_VERSION_CODE || updateData.forceAllUsers) {
        var modal = document.getElementById('updateModal');
        var titleEl = document.getElementById('updateModalTitle');
        var notesEl = document.getElementById('updateNotes');
        var downloadBtn = document.getElementById('updateDownloadBtn');
        var laterBtn = document.getElementById('updateLaterBtn');
        if (modal && downloadBtn) {
            titleEl.textContent = updateData.versionName ? "Update Required (" + updateData.versionName + ")" : "App Update Required";
            if (updateData.releaseNotes) notesEl.textContent = updateData.releaseNotes;
            downloadBtn.onclick = function() {
                if (window.AndroidBridge && typeof window.AndroidBridge.openExternalUrl === 'function') window.AndroidBridge.openExternalUrl(updateData.downloadUrl);
                else window.open(updateData.downloadUrl, '_blank');
            };
            if (laterBtn) laterBtn.style.display = (updateData.forceUpdate || updateData.forceAllUsers) ? 'none' : 'block';
            modal.style.display = 'flex';
            return true;
        }
    }
    return false;
}
function dismissUpdateModal() { var m = document.getElementById('updateModal'); if (m) m.style.display = 'none'; }

function handleWheelScroll(scrollEl, targetInputId) {
    clearTimeout(scrollEl.scrollTimer);
    scrollEl.scrollTimer = setTimeout(function() {
        var items = scrollEl.querySelectorAll('.wheel-item');
        var index = Math.round(scrollEl.scrollTop / items[0].offsetHeight);
        if (items[index]) {
            items.forEach(function(i) { i.classList.remove('selected'); });
            items[index].classList.add('selected');
            var hiddenInput = document.getElementById(targetInputId);
            if (hiddenInput) { hiddenInput.value = items[index].getAttribute('data-val'); saveSettings(); }
        }
    }, 70);
}
function scrollWheelToNext(containerId, targetInputId) {
    var scrollEl = document.getElementById(containerId).querySelector('.wheel-picker-scroll');
    var items = scrollEl.querySelectorAll('.wheel-item');
    var currentIndex = Array.from(items).findIndex(i => i.classList.contains('selected'));
    var nextIndex = (currentIndex + 1) % items.length;
    scrollEl.scrollTop = nextIndex * items[0].offsetHeight;
    setTimeout(function() {
        if (items[nextIndex]) {
            var hiddenInput = document.getElementById(targetInputId);
            if (hiddenInput) { hiddenInput.value = items[nextIndex].getAttribute('data-val'); saveSettings(); }
        }
    }, 80);
}
function setWheelPickerValue(containerId, targetInputId, val) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var scrollEl = container.querySelector('.wheel-picker-scroll');
    if (!scrollEl) return;
    var items = scrollEl.querySelectorAll('.wheel-item');
    items.forEach(function(item, idx) {
        if (item.getAttribute('data-val') === String(val)) {
            items.forEach(function(i) { i.classList.remove('selected'); });
            item.classList.add('selected');
            setTimeout(function() { scrollEl.scrollTop = idx * (item.offsetHeight || 38); }, 10);
            var hiddenInput = document.getElementById(targetInputId);
            if (hiddenInput) hiddenInput.value = val;
        }
    });
}

function handleAutoSilentToggle() {
    try {
        var autoToggle = document.getElementById('autoSilentToggle');
        var extraPicker = document.getElementById('extraMinutesPicker');
        if (!autoToggle) return;
        if (extraPicker) {
            extraPicker.style.opacity = autoToggle.checked ? '1' : '0.4';
            extraPicker.style.pointerEvents = autoToggle.checked ? 'auto' : 'none';
        }
        if (autoToggle.checked && window.AndroidBridge && typeof window.AndroidBridge.checkDndPermission === 'function') {
            if (!window.AndroidBridge.checkDndPermission()) {
                if (confirm("To automatically silence your phone during Azaan and restore sound after Iqaama, this app requires Do Not Disturb access.\n\nOn the next settings screen, please find 'Baindur Prayer' and toggle ON the permission.")) {
                    window.AndroidBridge.openDndSettings();
                } else {
                    autoToggle.checked = false;
                    if (extraPicker) { extraPicker.style.opacity = '0.4'; extraPicker.style.pointerEvents = 'none'; }
                }
            }
        }
        saveSettings();
    } catch (e) {}
}

function loadSettingsToUI() {
    var autoToggle = document.getElementById('autoSilentToggle');
    var extraPicker = document.getElementById('extraMinutesPicker');
    var autoEnabled = false, extraMinsVal = 15;
    if (window.AndroidBridge) {
        if (typeof window.AndroidBridge.getAutoSilentEnabled === 'function') autoEnabled = window.AndroidBridge.getAutoSilentEnabled();
        if (typeof window.AndroidBridge.getExtraMinutes === 'function') extraMinsVal = window.AndroidBridge.getExtraMinutes();
    } else {
        autoEnabled = (localStorage.getItem('auto_silent_enabled') === '1');
        var savedExtra = localStorage.getItem('extra_minutes');
        extraMinsVal = savedExtra !== null ? parseInt(savedExtra, 10) : 15;
    }
    if (autoToggle) autoToggle.checked = autoEnabled;
    if (extraPicker) {
        extraPicker.style.opacity = autoEnabled ? '1' : '0.4';
        extraPicker.style.pointerEvents = autoEnabled ? 'auto' : 'none';
    }
    setWheelPickerValue('extraMinutesPicker', 'extraMinutes', extraMinsVal);
    var savedJumah = localStorage.getItem('jumah_custom_time');
    setWheelPickerValue('jumahTimePicker', 'jumah_time_input', savedJumah !== null ? savedJumah : "13:15");
    var savedOffset = localStorage.getItem('hijri_date_offset');
    setWheelPickerValue('hijriOffsetPicker', 'hijri_offset_val', savedOffset !== null ? savedOffset : "0");

    var prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    var defaultDelays = { fajr: 19, dhuhr: 19, asr: 14, maghrib: 4, isha: 14 };
    prayers.forEach(function(p) {
        var adEl = document.getElementById('toggle_ad_' + p);
        var iqEl = document.getElementById('toggle_iq_' + p);
        var adSaved = localStorage.getItem('setting_ad_' + p);
        var iqSaved = localStorage.getItem('setting_iq_' + p);
        var savedDelay = localStorage.getItem('setting_delay_' + p);
        if (adEl) adEl.checked = (adSaved === null || adSaved === '1');
        if (iqEl) iqEl.checked = (iqSaved === null || iqSaved === '1');
        setWheelPickerValue('delayPicker_' + p, 'iq_delay_' + p, savedDelay !== null ? savedDelay : defaultDelays[p]);
    });
}

const HIJRI_MONTHS = ['Muharram', 'Safar', 'Rabiʻ I', 'Rabiʻ II', 'Jumada I', 'Jumada II', 'Rajab', 'Shaʻban', 'Ramadan', 'Shawwal', 'Dhuʻl-Qiʻdah', 'Dhuʻl-Hijjah'];
function getHijriDetails(date) {
    var day = date.getDate(), month = date.getMonth(), year = date.getFullYear(), m = month + 1, y = year;
    if (m < 3) { y -= 1; m += 12; }
    var a = Math.floor(y / 100), b = 2 - a + Math.floor(a / 4);
    if (y < 1583) b = 0;
    if (y === 1582 && (m > 10 || (m === 10 && day > 4))) b = -10;
    var jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524;
    b = 0;
    if (jd > 2299160) { a = Math.floor((jd - 1867216.25) / 36524.25); b = 1 + a - Math.floor(a / 4); }
    var bb = jd + b + 1524, cc = Math.floor((bb - 122.1) / 365.25), dd = Math.floor(365.25 * cc), ee = Math.floor((bb - dd) / 30.6001);
    day = (bb - dd) - Math.floor(30.6001 * ee);
    month = ee - 1;
    if (ee > 13) { cc += 1; month = ee - 13; }
    year = cc - 4716;
    var iyear = 10631.0 / 30.0, epochastro = 1948084, shift1 = 8.01 / 60.0;
    var z = jd - epochastro, cyc = Math.floor(z / 10631.0);
    z = z - 10631 * cyc;
    var j = Math.floor((z - shift1) / iyear), iy = 30 * cyc + j;
    z = z - Math.floor(j * iyear + shift1);
    var im = Math.floor((z + 28.5001) / 29.5);
    if (im === 13) im = 12;
    var id = z - Math.floor(29.5001 * im - 29);
    return { day: id, monthName: HIJRI_MONTHS[im - 1], year: iy, full: HIJRI_MONTHS[im - 1] + ' ' + id + ', ' + iy + ' AH', short: id + ' ' + HIJRI_MONTHS[im - 1] };
}
function getAdjustedHijriDetails(date) {
    var offset = parseInt(localStorage.getItem('hijri_date_offset') || "0", 10);
    var adjustedDate = new Date(date.getTime());
    adjustedDate.setDate(adjustedDate.getDate() + offset);
    return getHijriDetails(adjustedDate);
}
function minsToTimeStr(totalMins) {
    totalMins = totalMins % (24 * 60);
    var h24 = Math.floor(totalMins / 60), m = totalMins % 60, h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + (m < 10 ? '0' : '') + m + " " + (h24 >= 12 ? 'PM' : 'AM');
}

function openNoticeLightbox(imgSrc) {
    var overlay = document.getElementById('noticeLightboxOverlay');
    var fullImg = document.getElementById('noticeLightboxImg');
    if (overlay && fullImg) { fullImg.src = imgSrc; overlay.style.display = 'flex'; }
}
function closeNoticeLightbox() { var m = document.getElementById('noticeLightboxOverlay'); if(m) m.style.display = 'none'; }
function navigateNoticeSlide(direction) {
    var galleryEl = document.getElementById('noticeGalleryViewport');
    if(galleryEl) galleryEl.scrollBy({ left: direction * galleryEl.offsetWidth, behavior: 'smooth' });
}
function getYouTubeEmbedUrl(url) {
    if (!url) return null;
    var match = String(url).trim().match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    return match ? "https://www.youtube.com/embed/" + match[1] : null;
}
function handleRemoteHijriUpdate(remoteHijri) {
    if (!remoteHijri || typeof remoteHijri.offset === 'undefined') return;
    var remoteOffset = parseInt(remoteHijri.offset, 10);
    var remoteTimestamp = parseInt(remoteHijri.updatedAt, 10) || 0;
    var localUserTimestamp = parseInt(localStorage.getItem('hijri_user_set_timestamp') || '0', 10);
    if (remoteTimestamp > localUserTimestamp) {
        localStorage.setItem('hijri_date_offset', remoteOffset.toString());
        setWheelPickerValue('hijriOffsetPicker', 'hijri_offset_val', remoteOffset.toString());
        renderView();
    }
}
function dismissNotice() {
    var m = document.getElementById('noticeModal');
    if (m) m.style.display = 'none';
    localStorage.setItem('last_notice_timestamp', Date.now().toString());
}
function fetchAndShowNotice() {
    fetch('https://script.google.com/macros/s/AKfycbyzUKAJqOwjaL4aUHbTyP4Sw3WhWImegoDRUOgiuhRF5Bst2_rcWG9c6qOMg87opO3h/exec')
        .then(response => { if (!response.ok) throw new Error("Notice offline"); return response.json(); })
        .then(data => {
            if (!data) return;
            if (data.hijri) handleRemoteHijriUpdate(data.hijri);
            if (checkForAppUpdate(data.update) && data.update && (data.update.forceUpdate || data.update.forceAllUsers)) return;

            if ((data.message && data.message.trim().length > 0) || (data.images && data.images.length > 0) || data.imageUrl || data.image || data.videoUrl) {
                var titleText = String(data.title || "Notice").trim();
                var mediaList = [];
                if (Array.isArray(data.images) && data.images.length > 0) mediaList = data.images;
                else if (data.imageUrl || data.image || data.videoUrl) {
                    var rawItem = String(data.imageUrl || data.image || data.videoUrl).trim();
                    mediaList = rawItem.indexOf(",") !== -1 ? rawItem.split(",").map(s => s.trim()).filter(Boolean) : [rawItem];
                }

                var titleEl = document.getElementById('noticeTitle'), contentEl = document.getElementById('noticeContent'), btnEl = document.getElementById('noticeBtn');
                var modalEl = document.getElementById('noticeModal'), imgContainerEl = document.getElementById('noticeImageContainer');
                var galleryEl = document.getElementById('noticeGalleryViewport'), dotsContainer = document.getElementById('noticeDotsContainer');
                
                if (contentEl && modalEl) {
                    titleEl.textContent = titleText;
                    contentEl.textContent = String(data.message || "").trim();
                    if (btnEl) btnEl.textContent = String(data.button || "Got It").trim();

                    if (mediaList.length > 0 && imgContainerEl && galleryEl) {
                        galleryEl.innerHTML = '';
                        if (dotsContainer) dotsContainer.innerHTML = '';
                        mediaList.forEach(function(url, idx) {
                            var slide = document.createElement('div'); slide.className = 'notice-gallery-slide';
                            var ytEmbed = getYouTubeEmbedUrl(url);
                            if (ytEmbed) {
                                var iframe = document.createElement('iframe'); iframe.src = ytEmbed;
                                iframe.style.width = "100%"; iframe.style.height = "220px"; iframe.style.border = "none"; iframe.style.borderRadius = "6px";
                                slide.appendChild(iframe);
                            } else if (url.toLowerCase().indexOf('.mp4') !== -1 || url.toLowerCase().indexOf('.webm') !== -1) {
                                var video = document.createElement('video'); video.src = url; video.controls = true; video.playsInline = true;
                                video.style.width = "100%"; video.style.maxHeight = "240px"; video.style.borderRadius = "6px"; video.style.background = "#000";
                                slide.appendChild(video);
                            } else {
                                var img = document.createElement('img'); img.src = url; img.style.cursor = "pointer"; img.setAttribute('draggable', 'false');
                                img.addEventListener('click', function(e) { e.stopPropagation(); openNoticeLightbox(url); });
                                slide.appendChild(img);
                            }
                            galleryEl.appendChild(slide);
                            if (mediaList.length > 1 && dotsContainer) {
                                var dot = document.createElement('div'); dot.className = 'notice-dot' + (idx === 0 ? ' active' : '');
                                dot.addEventListener('click', function(e) { e.stopPropagation(); galleryEl.scrollTo({ left: idx * galleryEl.offsetWidth, behavior: 'smooth' }); });
                                dotsContainer.appendChild(dot);
                            }
                        });
                        imgContainerEl.style.display = 'block';
                    } else if (imgContainerEl) imgContainerEl.style.display = 'none';

                    if (titleText.toLowerCase() === 'warning') { titleEl.style.color = 'var(--terra)'; modalEl.querySelector('.info-modal-box').style.borderLeftColor = 'var(--terra)'; if (btnEl) btnEl.style.background = 'var(--terra)'; } 
                    else { titleEl.style.color = 'var(--accent)'; modalEl.querySelector('.info-modal-box').style.borderLeftColor = 'var(--accent)'; if (btnEl) btnEl.style.background = 'var(--accent)'; }

                    var now = Date.now(), lastShown = localStorage.getItem('last_notice_timestamp');
                    if (!lastShown || (now - parseInt(lastShown, 10) >= 259200000)) modalEl.style.display = 'flex';
                }
            }
        }).catch(error => console.log("Could not load notice:", error));
}

function timesFor(date) {
    var y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
    var rawTimes = xmlPrayerDatabase[y + "-" + m + "-" + d] || xmlPrayerDatabase["2026-" + m + "-" + d] || xmlPrayerDatabase[m + "-" + d];
    if (!rawTimes) return {
        imsak: {h:0,m:0,mins:0,label:"--:--"}, fajr: {h:0,m:0,mins:0,label:"--:--"}, sunrise: {h:0,m:0,mins:0,label:"--:--"},
        dhuhr: {h:0,m:0,mins:0,label:"--:--"}, asr: {h:0,m:0,mins:0,label:"--:--"}, sunset: {h:0,m:0,mins:0,label:"--:--"},
        maghrib: {h:0,m:0,mins:0,label:"--:--"}, isha: {h:0,m:0,mins:0,label:"--:--"}, taraweeh: {h:0,m:0,mins:0,label:"--:--"}
    };
    var out = {};
    for (var i = 0; i < PRAYERS.length; i++) {
        var k = PRAYERS[i].key;
        if (k === 'taraweeh') continue;
        var timeStr = rawTimes[k] || "--:--";
        var match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(timeStr.trim());
        if (match) {
            var hr = parseInt(match[1], 10), min = parseInt(match[2], 10), ampm = match[3] ? match[3].toUpperCase() : null;
            var h24 = hr;
            if (ampm) { if (ampm === 'PM' && hr < 12) h24 = hr + 12; if (ampm === 'AM' && hr === 12) h24 = 0; }
            var h12 = h24 % 12; if (h12 === 0) h12 = 12;
            var finalAmpm = h24 >= 12 ? 'PM' : 'AM';
            out[k] = { h: h24, m: min, mins: h24 * 60 + min, label: h12 + ":" + (min < 10 ? '0' : '') + min + " " + finalAmpm, ampm: finalAmpm };
        } else { out[k] = { h: 12, m: 0, mins: 720, label: timeStr, ampm: 'PM' }; }
    }
    if (out['isha'] && out['isha'].label !== "--:--") {
        var tm = out['isha'].mins + 35, h24 = Math.floor(tm / 60) % 24;
        out['taraweeh'] = { h: h24, m: tm % 60, mins: tm, label: minsToTimeStr(tm), ampm: h24 >= 12 ? 'PM' : 'AM' };
    } else { out['taraweeh'] = { h: 0, m: 0, mins: 0, label: "--:--", ampm: "" }; }
    return out;
}

function siteNow(ms) {
    var ref = new Date(ms || Date.now());
    try {
        var f = new Intl.DateTimeFormat('en-GB', { timeZone: SITE.tzName, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        var p = {}, arr = f.formatToParts(ref);
        for (var i = 0; i < arr.length; i++) p[arr[i].type] = arr[i].value;
        return { y: +p.year, m: +p.month - 1, d: +p.day, hh: (+p.hour) % 24, mm: +p.minute, ss: +p.second };
    } catch (e) { return { y: ref.getFullYear(), m: ref.getMonth(), d: ref.getDate(), hh: ref.getHours(), mm: ref.getMinutes(), ss: ref.getSeconds() }; }
}

function epochFor(y, m, d, t) { return Date.UTC(y, m, d, t.h, t.m) - SITE.tz * 3600 * 1000; }
function isTaraweehEnabled(dateObj, nowMs) {
    var adjH = getAdjustedHijriDetails(dateObj), t = timesFor(dateObj), maghribEp = epochFor(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), t.maghrib);
    if (adjH.monthName === 'Ramadan') return true;
    if (adjH.monthName === 'Shaʻban' && (adjH.day === 29 || adjH.day === 30)) return (nowMs >= maghribEp);
    return false;
}

function scheduleNow(nowMs) {
    var n = siteNow(nowMs), todayDateObj = new Date(n.y, n.m, n.d), isFriday = todayDateObj.getDay() === 5;
    var today = timesFor(todayDateObj), list = [], salahList = [];
    for (var i = 0; i < PRAYERS.length; i++) {
        var p = PRAYERS[i], t = today[p.key];
        var pName = (isFriday && p.key === 'dhuhr') ? "Jum'ah" : p.name;
        var pAr = (isFriday && p.key === 'dhuhr') ? "الجمعة" : p.ar;
        var entry = { i: i, key: p.key, name: pName, ar: pAr, isSalah: p.isSalah, mins: t.mins, label: t.label, epoch: epochFor(n.y, n.m, n.d, t) };
        list.push(entry);
        if (p.isSalah || (p.key === 'taraweeh' && isTaraweehEnabled(todayDateObj, nowMs))) salahList.push(entry);
    }
    salahList.sort(function(a, b) { return a.epoch - b.epoch; });

    var next = null, prev = null, i2;
    for (i2 = 0; i2 < salahList.length; i2++) { if (salahList[i2].epoch > nowMs) { next = salahList[i2]; break; } }
    if (!next) {
        var tm = new Date(n.y, n.m, n.d + 1), tt = timesFor(tm);
        next = { i: 1, key: 'fajr', name: 'Fajr', ar: PRAYERS[1].ar, isSalah: true, mins: tt.fajr.mins, label: tt.fajr.label, epoch: epochFor(tm.getFullYear(), tm.getMonth(), tm.getDate(), tt.fajr), tomorrow: true };
    }
    for (i2 = salahList.length - 1; i2 >= 0; i2--) { if (salahList[i2].epoch <= nowMs) { prev = salahList[i2]; break; } }
    return { parts: n, today: today, list: list, next: next, prev: prev };
}

function getIqaamaDelayMinutes(prayerKey) {
    var defaultDelays = { fajr: 20, dhuhr: 20, asr: 15, maghrib: 5, isha: 15, taraweeh: 15 };
    var saved = localStorage.getItem('setting_delay_' + prayerKey);
    var delay = saved !== null ? parseInt(saved, 10) : defaultDelays[prayerKey];
    return (isNaN(delay) || delay <= 0) ? (defaultDelays[prayerKey] || 5) : delay;
}

function getIqaamaTargetEpoch(prevEntry, S) {
    if (prevEntry.key === 'taraweeh') return prevEntry.epoch;
    var n = S.parts;
    if (new Date(n.y, n.m, n.d).getDay() === 5 && prevEntry.key === 'dhuhr') {
        var parts = (localStorage.getItem('jumah_custom_time') || "13:15").split(":");
        return epochFor(n.y, n.m, n.d, {h: parseInt(parts[0], 10), m: parseInt(parts[1], 10)});
    }
    return prevEntry.epoch + (getIqaamaDelayMinutes(prevEntry.key) * 60 * 1000);
}

function fmtRemain(ms) {
    if (ms <= 0) return '00:00:00';
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
}

function openSettingsModal() { loadSettingsToUI(); document.getElementById('settingsModal').style.display = 'flex'; }
function closeSettingsModal() { document.getElementById('settingsModal').style.display = 'none'; }
function saveSettings() {
    var autoToggle = document.getElementById('autoSilentToggle');
    var extraInput = document.getElementById('extraMinutes');
    var jumahTimeInput = document.getElementById('jumah_time_input');
    var hijriOffsetInput = document.getElementById('hijri_offset_val');

    var autoSilent = autoToggle ? autoToggle.checked : false;
    var extraMins = extraInput ? (parseInt(extraInput.value, 10) || 15) : 15;
    var jumahTimeVal = jumahTimeInput ? jumahTimeInput.value : "13:15";
    var hijriOffsetVal = hijriOffsetInput ? (parseInt(hijriOffsetInput.value, 10) || 0) : 0;

    localStorage.setItem('auto_silent_enabled', autoSilent ? '1' : '0');
    localStorage.setItem('extra_minutes', extraMins.toString());
    localStorage.setItem('jumah_custom_time', jumahTimeVal);
    var prevOffset = localStorage.getItem('hijri_date_offset');
    if (prevOffset === null || parseInt(prevOffset, 10) !== hijriOffsetVal) localStorage.setItem('hijri_user_set_timestamp', Date.now().toString());
    localStorage.setItem('hijri_date_offset', hijriOffsetVal.toString());

    if (window.AndroidBridge && typeof window.AndroidBridge.saveAutoSilentPreferences === 'function') window.AndroidBridge.saveAutoSilentPreferences(autoSilent, extraMins);

    ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(function(p) {
        var adEl = document.getElementById('toggle_ad_' + p), iqEl = document.getElementById('toggle_iq_' + p), delayEl = document.getElementById('iq_delay_' + p);
        var adhanChecked = adEl ? adEl.checked : true, iqaamaChecked = iqEl ? iqEl.checked : true, delayVal = delayEl ? (parseInt(delayEl.value, 10) || 0) : 15;
        localStorage.setItem('setting_ad_' + p, adhanChecked ? '1' : '0');
        localStorage.setItem('setting_iq_' + p, iqaamaChecked ? '1' : '0');
        localStorage.setItem('setting_delay_' + p, delayVal.toString());
        if (window.AndroidBridge && typeof window.AndroidBridge.saveAdhanIqaamaSettings === 'function') window.AndroidBridge.saveAdhanIqaamaSettings(p, adhanChecked, iqaamaChecked, delayVal);
    });

    syncWithAndroidAlarms();
    renderView();
}

var mediaRecorder = null, audioChunks = [], audioBlob = null, recordInterval = null, recordSeconds = 0;
function toggleVoiceRecording() { if (mediaRecorder && mediaRecorder.state === "recording") stopRecording(); else startRecording(); }
function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { alert("Audio recording is not supported."); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
        audioChunks = [];
        var options = MediaRecorder.isTypeSupported('audio/mp4') ? { mimeType: 'audio/mp4' } : { mimeType: 'audio/webm' };
        mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorder.ondataavailable = function(e) { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = function() {
            audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
            var audioPreview = document.getElementById('audioPreview');
            if (audioPreview) { audioPreview.src = URL.createObjectURL(audioBlob); audioPreview.style.display = 'block'; }
            document.getElementById('recordingIndicator').style.display = 'none';
            document.getElementById('stopRecordBtn').style.display = 'none';
            document.getElementById('uploadVoiceBtn').style.display = 'inline-block';
            document.getElementById('deleteAudioBtn').style.display = 'inline-block';
            stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start();
        document.getElementById('voiceRecorderBox').style.display = 'block';
        document.getElementById('recordingIndicator').style.display = 'block';
        document.getElementById('stopRecordBtn').style.display = 'inline-block';
        document.getElementById('audioPreview').style.display = 'none';
        document.getElementById('uploadVoiceBtn').style.display = 'none';
        document.getElementById('deleteAudioBtn').style.display = 'none';
        recordSeconds = 0; document.getElementById('recordTimer').textContent = "00:00";
        if (recordInterval) clearInterval(recordInterval);
        recordInterval = setInterval(function() {
            recordSeconds++;
            var m = Math.floor(recordSeconds / 60), s = recordSeconds % 60;
            document.getElementById('recordTimer').textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
            if (recordSeconds >= 120) stopRecording();
        }, 1000);
    }).catch(function(err) { alert("Microphone permission required."); });
}
function stopRecording() { if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop(); if (recordInterval) clearInterval(recordInterval); }
function discardAudio() {
    audioBlob = null; audioChunks = [];
    document.getElementById('voiceRecorderBox').style.display = 'none';
    document.getElementById('audioPreview').style.display = 'none';
    document.getElementById('uploadVoiceBtn').style.display = 'none';
    document.getElementById('deleteAudioBtn').style.display = 'none';
}
function submitVoiceRecording() {
    if (!audioBlob) { alert("No audio recorded."); return; }
    var uploadBtn = document.getElementById('uploadVoiceBtn');
    if (uploadBtn) { uploadBtn.textContent = "Uploading..."; uploadBtn.disabled = true; }
    var uploadTimeout = setTimeout(function() {
        alert("Upload timed out.");
        if (uploadBtn) { uploadBtn.textContent = "Send Voice Feedback ☁️"; uploadBtn.disabled = false; }
    }, 30000);
    var nameInput = document.getElementById('issueName'), name = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : "Anonymous";
    var reader = new FileReader();
    reader.onloadend = function() {
        var base64data = reader.result.split(',')[1];
        var ext = (audioBlob.type && audioBlob.type.includes('mp4')) ? 'm4a' : 'webm';
        fetch('https://script.google.com/macros/s/AKfycbyzUKAJqOwjaL4aUHbTyP4Sw3WhWImegoDRUOgiuhRF5Bst2_rcWG9c6qOMg87opO3h/exec', {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ type: "voice_feedback", name: name, message: "Voice recording from app user", filename: "voice_" + Date.now() + "." + ext, mimeType: audioBlob.type || 'audio/webm', audioBase64: base64data })
        }).then(res => { clearTimeout(uploadTimeout); return res.text(); })
        .then(data => { alert("Thank you! Your voice note has been sent."); discardAudio(); if (uploadBtn) { uploadBtn.textContent = "Send Voice Feedback ☁️"; uploadBtn.disabled = false; } })
        .catch(err => { clearTimeout(uploadTimeout); alert("Upload failed."); if (uploadBtn) { uploadBtn.textContent = "Send Voice Feedback ☁️"; uploadBtn.disabled = false; } });
    };
    reader.readAsDataURL(audioBlob);
}

function openInfoModal() { var m = document.getElementById('infoModal'); if(m) { m.style.display = 'flex'; var s = m.querySelector('[style*="overflow-y:auto"]'); if(s) s.scrollTop = 0; } }
function closeInfoModal() { document.getElementById('infoModal').style.display = 'none'; }
function submitIssue() {
    var nameInput = document.getElementById('issueName'), name = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'Anonymous';
    var messageInput = document.getElementById('issueMessage'), message = messageInput ? messageInput.value.trim() : '';
    if (!message) { alert("Please enter a message or issue."); return; }
    fetch('https://formspree.io/f/moevazbp', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ name: name, message: message })
    }).then(r => {
        if (r.ok) { alert("Thank you! Your feedback has been sent successfully."); if(messageInput) messageInput.value = ''; if(nameInput) nameInput.value = ''; closeInfoModal(); } 
        else alert("Failed to send message.");
    }).catch(e => alert("Network error."));
}

var detailDataCache = {};
function openZoomModal(cacheKey) {
    var item = detailDataCache[cacheKey];
    if (!item) return;
    document.getElementById('modalTitle').textContent = item.title;
    document.getElementById('modalSub').textContent = item.sub;
    var html = '';
    PRAYERS.forEach(function(p) {
        var val = item.times[p.key] ? item.times[p.key].label : '---';
        var displayNm = p.name, displayAr = p.ar;
        if (p.key === 'dhuhr' && item.isFriday) { displayNm = "Jum'ah"; displayAr = "الجمعة"; }
        html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--line-soft);"><span>' + displayNm + ' <small style="color:var(--muted)">' + displayAr + '</small></span><strong>' + val + '</strong></div>';
    });
    document.getElementById('modalList').innerHTML = html;
    document.getElementById('zoomModal').style.display = 'flex';
}
function closeZoom() { document.getElementById('zoomModal').style.display = 'none'; }

var currentTab = 'today', selectedYear = 2026, selectedMonth = new Date().getMonth();
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav a').forEach(function(el) { el.removeAttribute('aria-current'); });
    var activeNav = document.getElementById('nav-' + tab);
    if (activeNav) activeNav.setAttribute('aria-current', 'page');
    renderView();
}
function renderView() {
    var container = document.getElementById('app-view');
    if (currentTab === 'today') {
        container.innerHTML = `
            <section>
                <div class="nextbox" id="nextbox">
                    <div class="nb-half"><span class="nb-label" id="nbMainLabel">Next prayer</span><span class="nb-name" id="nbName">&mdash;</span><span class="nb-at" id="nbAt"></span></div>
                    <div class="nb-half right"><span class="nb-label" id="nbSubLabel">Time remaining</span><span class="nb-count" id="nbCount">&mdash;:--:--</span><span class="nb-when" id="nbWhen"></span></div>
                </div>
                <div class="day-carousel-viewport" id="dayCarousel">
                    <div class="day-carousel-track" id="dayCarouselTrack">
                        <div class="day-slide" id="slide-today"><ul class="plist" id="plist"></ul></div>
                        <div class="day-slide" id="slide-tomorrow">
                            <div class="tomorrow-banner"><span>Tomorrow</span><span class="date" id="tomorrowDateLabel"></span></div>
                            <ul class="plist" id="plistTomorrow"></ul>
                        </div>
                    </div>
                </div>
            </section>`;
        initTodayPage();
    } else if (currentTab === 'monthly') {
        var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        container.innerHTML = `
            <section>
                <div class="pager">
                    <button class="linkbtn" onclick="changeMonth(-1)">&larr; Prev</button>
                    <span id="monthLabel" style="font-weight:500; font-size:14px">${monthNames[selectedMonth]} ${selectedYear}</span>
                    <button class="linkbtn" onclick="changeMonth(1)">Next &rarr;</button>
                </div>
                <button class="floating-side-btn left" onclick="changeMonth(-1)"><span class="water-lens-content">&#10094;</span></button>
                <button class="floating-side-btn right" onclick="changeMonth(1)"><span class="water-lens-content">&#10095;</span></button>
                <div class="scroll-x">
                    <table class="tt" id="monthlyTable">
                        <thead><tr><th>Date</th><th class="num">Imsak</th><th class="num">Fajr</th><th class="num">Sunrise</th><th class="num">Dhuhr</th><th class="num">Asr</th><th class="num">Sunset</th><th class="num">Maghrib</th><th class="num">Isha</th></tr></thead>
                        <tbody id="monthlyRows"></tbody>
                    </table>
                </div>
            </section>`;
        loadMonthlyTable();
    } else if (currentTab === 'yearly') {
        container.innerHTML = `
            <section>
                <div class="pager">
                    <button class="linkbtn" onclick="changeYear(-1)">&larr; Prev year</button><span style="font-weight:500; font-size:14px">Year ${selectedYear}</span><button class="linkbtn" onclick="changeYear(1)">Next year &rarr;</button>
                </div>
                <div class="yearly-wrapper" id="yearlyGrid"></div>
            </section>`;
        loadYearlyGrid();
    }
}

function changeMonth(dir) { selectedMonth += dir; if (selectedMonth > 11) { selectedMonth = 0; selectedYear++; } else if (selectedMonth < 0) { selectedMonth = 11; selectedYear--; } renderView(); }
function changeYear(dir) { selectedYear += dir; renderView(); }

var showJumahFlip = false, globalRenderTodayRef = null;
setInterval(function() {
    if (currentTab === 'today' && typeof globalRenderTodayRef === 'function') {
        var now = Date.now(), S = scheduleNow(now), isFriday = new Date(S.parts.y, S.parts.m, S.parts.d).getDay() === 5;
        if (isFriday) {
            var dhuhrEpoch = epochFor(S.parts.y, S.parts.m, S.parts.d, timesFor(new Date(S.parts.y, S.parts.m, S.parts.d))['dhuhr']);
            showJumahFlip = (now >= dhuhrEpoch) ? true : !showJumahFlip;
        } else showJumahFlip = !showJumahFlip;
        globalRenderTodayRef(S, S.next.epoch - now);
    }
}, 5000);

var liveTimer = null, firedAdhan = {}, firedIq = {};
function initTodayPage() {
    var track = document.getElementById('dayCarouselTrack');
    if (!track) return; track.innerHTML = '';
    var slidesData = [];
    for (var dayOffset = 0; dayOffset < 7; dayOffset++) {
        var slide = document.createElement('div'); slide.className = 'day-slide'; slide.id = 'slide-day-' + dayOffset;
        var bannerHtml = dayOffset > 0 ? `<div class="tomorrow-banner"><span id="bannerTitle_${dayOffset}">${dayOffset === 1 ? 'Tomorrow' : ''}</span><span class="date" id="dateLabel_${dayOffset}"></span></div>` : '';
        slide.innerHTML = bannerHtml + `<ul class="plist" id="plist_${dayOffset}"></ul>`;
        track.appendChild(slide);
        var plist = slide.querySelector('.plist'), timeCells = {}, liElements = {};
        for (var pIdx = 0; pIdx < PRAYERS.length; pIdx++) {
            var prayer = PRAYERS[pIdx], el = document.createElement('li');
            el.setAttribute('data-key', prayer.key);
            el.innerHTML = '<span class="p-name">' + prayer.name + ' <span class="p-ar">' + prayer.ar + '</span></span><span class="p-time num"></span>';
            plist.appendChild(el);
            liElements[prayer.key] = el; timeCells[prayer.key] = el.querySelector('.p-time');
        }
        slidesData.push({ offset: dayOffset, timeCells: timeCells, liElements: liElements });
    }

    var nbMainLabel = document.getElementById('nbMainLabel'), nbSubLabel = document.getElementById('nbSubLabel'), nbName = document.getElementById('nbName'), nbAt = document.getElementById('nbAt'), nbCount = document.getElementById('nbCount'), nextbox = document.getElementById('nextbox');
    var isIqaamaActive = false, activeIqaamaTargetEpoch = 0, activePrayerName = "", activePrayerKey = null;

    function renderToday(S, remainMs) {
        var n = S.parts, nowMs = Date.now(), todayDateObj = new Date(n.y, n.m, n.d), isFriday = todayDateObj.getDay() === 5;
        var hToday = getAdjustedHijriDetails(todayDateObj);
        var hijriEl = document.getElementById('hijri');
        if (hijriEl) hijriEl.textContent = hToday.full + ' \u00b7 ' + todayDateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

        if (window.AndroidBridge && typeof window.AndroidBridge.updateWidgetData === 'function') {
            var widgetName = (S.next && S.next.name) ? S.next.name : "Fajr", widgetTime = (S.next && S.next.label) ? S.next.label : "5:05 AM";
            var followingName = "Sunrise", followingTime = "6:20 AM";
            if (S.list && S.next) {
                var nextIdx = S.list.findIndex(i => i.key === S.next.key);
                if (nextIdx !== -1 && nextIdx + 1 < S.list.length) { followingName = S.list[nextIdx + 1].name || S.list[nextIdx + 1].key; followingTime = S.list[nextIdx + 1].label || ""; }
            }
            window.AndroidBridge.updateWidgetData(widgetName, widgetTime, followingName, followingTime, new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
        }

        var activeHighlightKey = S.next ? S.next.key : 'fajr';
        var highlightTomorrow = S.next ? (S.next.tomorrow === true) : true;

        if (S.prev) {
            var isFridayDhuhr = (isFriday && S.prev.key === 'dhuhr');
            var pDur = (S.prev.key === 'maghrib') ? 20*60000 : (S.prev.key === 'asr' || S.prev.key === 'isha') ? 30*60000 : 35*60000;

            if (isFridayDhuhr) {
                var p = (localStorage.getItem('jumah_custom_time') || "13:15").split(":");
                var jumahIqEpoch = epochFor(n.y, n.m, n.d, { h: parseInt(p[0], 10), m: parseInt(p[1], 10) });
                if (nowMs >= S.prev.epoch && nowMs < jumahIqEpoch + 15*60000) {
                    activeHighlightKey = S.prev.key;
                    highlightTomorrow = false;
                }
            } else if (S.prev.key === 'taraweeh') {
                if (nowMs >= S.prev.epoch && nowMs < S.prev.epoch + 60*60000) {
                    activeHighlightKey = S.prev.key;
                    highlightTomorrow = false;
                }
            } else {
                if (nowMs >= S.prev.epoch && nowMs < S.prev.epoch + pDur) {
                    activeHighlightKey = S.prev.key;
                    highlightTomorrow = false;
                }
            }
        }

        var jParts = (localStorage.getItem('jumah_custom_time') || "13:15").split(":"), iqMinutes = parseInt(jParts[0], 10) * 60 + parseInt(jParts[1], 10);
        var jumahAdhanEpoch = epochFor(n.y, n.m, n.d, { h: Math.floor((iqMinutes - 10) / 60), m: (iqMinutes - 10) % 60 }), jumahIqEpoch = epochFor(n.y, n.m, n.d, { h: parseInt(jParts[0], 10), m: parseInt(jParts[1], 10) });
        var jumahTimeStr = (Math.floor((iqMinutes - 10) / 60) % 12 || 12) + ":" + ((iqMinutes - 10) % 60 < 10 ? '0' : '') + ((iqMinutes - 10) % 60) + " " + (Math.floor((iqMinutes - 10) / 60) >= 12 ? "PM" : "AM");

        var getDur = k => k==='maghrib'?20*60000 : k==='asr'||k==='isha'?30*60000 : 35*60000;
        
        // --- FIX: Ensure Jum'ah logic exactly encapsulates its active timeframe ---
        var isFridayDhuhrActive = (isFriday && S.prev && S.prev.key === 'dhuhr' && nowMs >= S.prev.epoch && nowMs < (jumahIqEpoch + 900000));

        if (isFridayDhuhrActive) {
            if (nowMs < jumahAdhanEpoch) {
                if (nbMainLabel) nbMainLabel.textContent = "Next prayer"; if (nbSubLabel) nbSubLabel.textContent = "Time remaining"; if (nbName) nbName.textContent = "Jum'ah"; if (nbAt) nbAt.textContent = jumahTimeStr;
                if (nbCount) { nbCount.textContent = fmtRemain(jumahAdhanEpoch - nowMs); nbCount.classList.toggle('timer-flashing', (jumahAdhanEpoch - nowMs) <= 60000); }
            } else if (nowMs >= jumahAdhanEpoch && nowMs < jumahIqEpoch) {
                if (nbMainLabel) nbMainLabel.textContent = "Iqaama"; if (nbSubLabel) nbSubLabel.textContent = "Time remaining"; if (nbName) nbName.textContent = "Jum'ah"; if (nbAt) nbAt.textContent = new Date(jumahIqEpoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (nbCount) { nbCount.textContent = fmtRemain(jumahIqEpoch - nowMs); nbCount.classList.toggle('timer-flashing', (jumahIqEpoch - nowMs) <= 60000); }
            } else {
                if (nbMainLabel) nbMainLabel.textContent = "Current Prayer"; if (nbSubLabel) nbSubLabel.textContent = "Time remaining"; if (nbName) nbName.textContent = "Jum'ah"; if (nbAt) nbAt.textContent = jumahTimeStr;
                if (nbCount) { nbCount.textContent = fmtRemain((jumahIqEpoch + 900000) - nowMs); nbCount.classList.toggle('timer-flashing', false); }
            }
        } else {
            var targetIqaamaMs = S.prev ? getIqaamaTargetEpoch(S.prev, S) : 0, pDur = S.prev ? getDur(S.prev.key) : 1800000;
            if (S.prev && nowMs >= S.prev.epoch && nowMs < targetIqaamaMs) {
                if (!isIqaamaActive || activePrayerKey !== S.prev.key) {
                    isIqaamaActive = true; activePrayerKey = S.prev.key; activePrayerName = S.prev.name; activeIqaamaTargetEpoch = targetIqaamaMs;
                    if (nextbox) { nextbox.classList.remove('current-prayer-active'); nextbox.style.transition = 'transform 1.2s'; nextbox.style.transform = 'rotateX(90deg)'; setTimeout(()=>{if(nbMainLabel)nbMainLabel.textContent="Iqaama"; if(nbSubLabel)nbSubLabel.textContent="Time remaining"; nextbox.style.transform='rotateX(0deg)';}, 600); }
                }
                if (nbName) nbName.textContent = activePrayerName; if (nbAt) nbAt.textContent = new Date(activeIqaamaTargetEpoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (nbCount) { nbCount.textContent = fmtRemain(activeIqaamaTargetEpoch - nowMs); nbCount.classList.toggle('timer-flashing', (activeIqaamaTargetEpoch - nowMs) <= 60000); }
            } else if (S.prev && nowMs >= targetIqaamaMs && nowMs < (S.prev.epoch + pDur)) {
                if (isIqaamaActive || activePrayerKey !== S.prev.key) { isIqaamaActive = false; activePrayerKey = S.prev.key; if (nextbox) { nextbox.classList.add('current-prayer-active'); nextbox.style.transform = 'rotateX(0deg)'; } }
                if (nbMainLabel) nbMainLabel.textContent = "Current Prayer"; if (nbSubLabel) nbSubLabel.textContent = "Time elapsed"; if (nbName) nbName.textContent = S.prev.name; if (nbAt) nbAt.textContent = new Date(targetIqaamaMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (nbCount) { nbCount.textContent = fmtRemain(nowMs - targetIqaamaMs); nbCount.classList.toggle('timer-flashing', false); }
            } else {
                if (isIqaamaActive) { isIqaamaActive = false; activePrayerKey = null; if (nextbox) { nextbox.classList.remove('current-prayer-active'); nextbox.style.transition = 'transform 1.2s'; nextbox.style.transform = 'rotateX(-90deg)'; setTimeout(()=>{if(nbMainLabel)nbMainLabel.textContent="Next prayer"; if(nbSubLabel)nbSubLabel.textContent="Time remaining"; nextbox.style.transform='rotateX(0deg)';}, 600); } }
                if (nbMainLabel) nbMainLabel.textContent = "Next prayer"; if (nbSubLabel) nbSubLabel.textContent = "Time remaining";
                if (isFriday && S.next.key === 'dhuhr') {
                    if (nowMs < S.next.epoch) {
                        if (showJumahFlip) { if (nbName) nbName.textContent = "Jum'ah"; if (nbAt) nbAt.textContent = jumahTimeStr; if (nbCount) { nbCount.textContent = fmtRemain(jumahAdhanEpoch - nowMs); nbCount.classList.toggle('timer-flashing', (jumahAdhanEpoch - nowMs) <= 60000); } } 
                        else { if (nbName) nbName.textContent = "Dhuhr"; if (nbAt) nbAt.textContent = S.next.label; if (nbCount) { nbCount.textContent = fmtRemain(remainMs); nbCount.classList.toggle('timer-flashing', remainMs <= 60000); } }
                    } else { if (nbName) nbName.textContent = "Jum'ah"; if (nbAt) nbAt.textContent = jumahTimeStr; if (nbCount) { nbCount.textContent = fmtRemain(jumahAdhanEpoch - nowMs); nbCount.classList.toggle('timer-flashing', (jumahAdhanEpoch - nowMs) <= 60000); } }
                } else {
                    if (nbName) nbName.textContent = S.next.name; if (nbAt) nbAt.textContent = S.next.label;
                    if (nbCount) { nbCount.textContent = fmtRemain(remainMs); nbCount.classList.toggle('timer-flashing', remainMs <= 60000); }
                }
            }
        }

        slidesData.forEach(function(slideObj) {
            var currentD = new Date(n.y, n.m, n.d + slideObj.offset), currentTimes = timesFor(currentD), currentHijri = getAdjustedHijriDetails(currentD), isF = currentD.getDay() === 5;
            if (slideObj.offset > 0) {
                var titleSpan = document.getElementById('bannerTitle_' + slideObj.offset), dateLabel = document.getElementById('dateLabel_' + slideObj.offset);
                if (titleSpan) titleSpan.textContent = (slideObj.offset === 1) ? 'Tomorrow' : currentD.toLocaleDateString('en-IN', { weekday: 'long' });
                if (dateLabel) dateLabel.textContent = currentHijri.short + ' \u00b7 ' + currentD.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            }
            for (var i = 0; i < PRAYERS.length; i++) {
                var k = PRAYERS[i].key, timeLabel = currentTimes[k] ? currentTimes[k].label : '', rowEl = slideObj.liElements[k], timeEl = slideObj.timeCells[k];
                if (k === 'imsak' && rowEl) rowEl.style.display = (currentHijri.monthName === 'Ramadan') ? 'flex' : 'none';
                if (k === 'taraweeh' && rowEl) rowEl.style.display = isTaraweehEnabled(currentD, nowMs + (slideObj.offset * 86400000)) ? 'flex' : 'none';
                var isHighlighted = false;
                if ((slideObj.offset === 0 && k === activeHighlightKey && !highlightTomorrow) || (slideObj.offset === 1 && k === activeHighlightKey && highlightTomorrow)) isHighlighted = true;
                if (k === 'dhuhr' && isF) {
                    var isBeforeAdhan = nowMs < epochFor(currentD.getFullYear(), currentD.getMonth(), currentD.getDate(), currentTimes['dhuhr']);
                    if (!rowEl.querySelector('.friday-flip-inner')) rowEl.innerHTML = '<div class="friday-flip-inner"><div class="flip-face flip-front"><span class="p-name">Dhuhr <span class="p-ar">الظهر</span></span><span class="p-time num front-time"></span></div><div class="flip-face flip-back"><span class="p-name">Jum\'ah <span class="p-ar">الجمعة</span></span><span class="p-time num back-time"></span></div></div>';
                    var pj = (localStorage.getItem('jumah_custom_time') || "13:15").split(":"), iqM = parseInt(pj[0], 10) * 60 + parseInt(pj[1], 10) - 10;
                    rowEl.querySelector('.flip-front').className = 'flip-face flip-front' + (isHighlighted && isBeforeAdhan ? ' active-face' : '');
                    rowEl.querySelector('.flip-back').className = 'flip-face flip-back' + (isHighlighted && !isBeforeAdhan ? ' active-face' : '');
                    rowEl.querySelector('.front-time').textContent = timeLabel;
                    rowEl.querySelector('.back-time').textContent = (Math.floor(iqM / 60) % 12 || 12) + ":" + (iqM % 60 < 10 ? '0' : '') + (iqM % 60) + " " + (Math.floor(iqM / 60) >= 12 ? "PM" : "AM");
                    rowEl.className = 'friday-flip-row' + (showJumahFlip ? ' is-flipped' : '');
                    continue;
                }
                if (rowEl.classList.contains('friday-flip-row')) { rowEl.className = ''; rowEl.innerHTML = '<span class="p-name"></span><span class="p-time num"></span>'; slideObj.timeCells[k] = rowEl.querySelector('.p-time'); timeEl = slideObj.timeCells[k]; }
                if (timeEl) timeEl.textContent = timeLabel;
                if (rowEl) { rowEl.className = isHighlighted ? 'next' : ''; var pNameSpan = rowEl.querySelector('.p-name'); if (pNameSpan && k === 'dhuhr') pNameSpan.innerHTML = isF ? 'Jum\'ah <span class="p-ar">الجمعة</span>' : 'Dhuhr <span class="p-ar">الظهر</span>'; }
            }
        });
    }

    globalRenderTodayRef = renderToday;
    if (liveTimer) clearInterval(liveTimer);
    var step = function() {
        if (currentTab !== 'today') return;
        var now = Date.now(), S = scheduleNow(now);
        S.list.forEach(i => { if (now < i.epoch) { firedAdhan[i.key] = false; firedIq[i.key] = false; } });
        if (S.prev) {
            var pk = S.prev.key, ts = now - S.prev.epoch;
            if (ts >= 0 && ts <= 60000) { if (!firedAdhan[pk] && pk !== 'taraweeh') { firedAdhan[pk] = true; playAzaanAudio(pk); } } else if (ts < 0 || ts > 65000) firedAdhan[pk] = false;
            if (pk !== 'taraweeh') {
                var ti = now - getIqaamaTargetEpoch(S.prev, S);
                if (ti >= 0 && ti <= 60000) {
                    if (!firedIq[pk]) {
                        firedIq[pk] = true;
                        if ((localStorage.getItem('setting_iq_' + pk) || '1') === '1' && !(new Date(S.parts.y, S.parts.m, S.parts.d).getDay() === 5 && pk === 'dhuhr')) playIqaamaAudio();
                    }
                } else if (ti < 0 || ti > 65000) firedIq[pk] = false;
            }
        }
        renderToday(S, S.next.epoch - now);
    };
    step(); liveTimer = setInterval(step, 1000);
}

function playAzaanAudio(prayerKey) {
    if (prayerKey === 'taraweeh') return;
    try {
        var adhanState = localStorage.getItem('setting_ad_' + prayerKey);
        if (adhanState === null || adhanState === '1') {
            if (window.AndroidBridge && typeof window.AndroidBridge.playAudio === 'function') window.AndroidBridge.playAudio(prayerKey);
            else { var az = document.getElementById('azaanAudio'); if (az) { az.src = (prayerKey === 'fajr') ? "fajradhan.mp3" : "adhan.mp3"; az.currentTime = 0; az.play().catch(e => {}); } }
        }
    } catch (e) {}
}
function playIqaamaAudio() { try { var iq = document.getElementById('iqaamaAudio'); if (iq) { iq.currentTime = 0; iq.play().catch(e => {}); } } catch (e) {} }

function loadMonthlyTable() {
    var tbody = document.getElementById('monthlyRows'), daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate(), todayDate = new Date();
    var html = '', isCurrentMonthSelected = (selectedYear === todayDate.getFullYear() && selectedMonth === todayDate.getMonth());
    for (var d = 1; d <= daysInMonth; d++) {
        var dateObj = new Date(selectedYear, selectedMonth, d), t = timesFor(dateObj), isToday = (isCurrentMonthSelected && d === todayDate.getDate()), hObj = getAdjustedHijriDetails(dateObj), isFriday = dateObj.getDay() === 5, cacheKey = 'm-' + d;
        detailDataCache[cacheKey] = { title: d + ' ' + dateObj.toLocaleDateString('en-IN', {month:'short'}) + ' ' + selectedYear, sub: hObj.full + ' \u00b7 ' + dateObj.toLocaleDateString('en-IN', {weekday:'long'}), times: t, isFriday: isFriday };
        html += '<tr onclick="openZoomModal(\'' + cacheKey + '\')" id="' + (isToday ? 'monthlyTodayRow' : '') + '" class="clickable-row ' + (isToday ? 'today' : '') + '"><td class="day">' + d + ' ' + dateObj.toLocaleDateString('en-IN', {month:'short'}) + ' <span class="wd">' + dateObj.toLocaleDateString('en-IN', {weekday:'short'}) + '</span><span class="arabic-date">' + hObj.short + '</span></td><td class="num">' + t.imsak.label + '</td><td class="num">' + t.fajr.label + '</td><td class="num">' + t.sunrise.label + '</td><td class="num">' + t.dhuhr.label + '</td><td class="num">' + t.asr.label + '</td><td class="num">' + t.sunset.label + '</td><td class="num">' + t.maghrib.label + '</td><td class="num">' + t.isha.label + '</td></tr>';
    }
    tbody.innerHTML = html;
    if (isCurrentMonthSelected) setTimeout(function() { requestAnimationFrame(function() { requestAnimationFrame(function() { var target = document.getElementById('monthlyTodayRow'); if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }); try { var rect = target.getBoundingClientRect(); window.scrollTo({ top: Math.max(0, rect.top + window.pageYOffset - (window.innerHeight / 2) + (rect.height / 2)), behavior: 'smooth' }); } catch (e) {} } }); }); }, 150);
}

function loadYearlyGrid() {
    var container = document.getElementById('yearlyGrid'), monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], todayDate = new Date(), isCurrentYearSelected = (selectedYear === todayDate.getFullYear()), html = '';
    for (var m = 0; m < 12; m++) {
        var isCurrentMonth = (isCurrentYearSelected && m === todayDate.getMonth());
        html += '<div id="' + (isCurrentMonth ? 'yearlyCurrentMonthCard' : '') + '" class="mcard ' + (isCurrentMonth ? 'current-month-card' : '') + '"><div class="mtitle">' + monthNames[m] + (isCurrentMonth ? ' <span style="font-size:13px; color:var(--accent); font-family:var(--mono)">(Current)</span>' : '') + '</div><div class="scroll-x"><table class="tt mini"><thead><tr><th>Date</th><th class="num">Fajr</th><th class="num">Dhuhr</th><th class="num">Asr</th><th class="num">Maghrib</th><th class="num">Isha</th></tr></thead><tbody>';
        for (var d = 1, days = new Date(selectedYear, m + 1, 0).getDate(); d <= days; d++) {
            var dateObj = new Date(selectedYear, m, d), t = timesFor(dateObj), isToday = (isCurrentYearSelected && m === todayDate.getMonth() && d === todayDate.getDate()), hObj = getAdjustedHijriDetails(dateObj), isFriday = dateObj.getDay() === 5, cacheKey = 'y-' + m + '-' + d;
            detailDataCache[cacheKey] = { title: d + ' ' + dateObj.toLocaleDateString('en-IN', {month:'short'}) + ' ' + selectedYear, sub: hObj.full + ' \u00b7 ' + dateObj.toLocaleDateString('en-IN', {weekday:'long'}), times: t, isFriday: isFriday };
            html += '<tr onclick="openZoomModal(\'' + cacheKey + '\')" class="clickable-row ' + (isToday ? 'today' : '') + '"><td class="day">' + d + ' ' + dateObj.toLocaleDateString('en-IN', {month:'short'}) + '<span class="arabic-date" style="font-size:10.5px">' + hObj.short + '</span></td><td class="num">' + t.fajr.label + '</td><td class="num">' + t.dhuhr.label + '</td><td class="num">' + t.asr.label + '</td><td class="num">' + t.maghrib.label + '</td><td class="num">' + t.isha.label + '</td></tr>';
        }
        html += '</tbody></table></div></div>';
    }
    container.innerHTML = html;
    if (isCurrentYearSelected) setTimeout(function() { var target = document.getElementById('yearlyCurrentMonthCard'); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120);
}

function syncWithAndroidAlarms() {
    if (window.AndroidBridge && typeof window.AndroidBridge.scheduleAlarm === 'function') {
        var nowMs = Date.now();
        var n = siteNow(nowMs);
        for (var dayOffset = 0; dayOffset <= 30; dayOffset++) {
            var targetDate = new Date(n.y, n.m, n.d + dayOffset);
            var targetTimes = timesFor(targetDate);
            PRAYERS.forEach(function(p, index) {
                if (p.isSalah) {
                    var t = targetTimes[p.key];
                    if (t) {
                        var epoch = epochFor(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), t);
                        if (epoch > nowMs) {
                            var adhanState = localStorage.getItem('setting_ad_' + p.key);
                            if (adhanState === null || adhanState === '1') {
                                var uniqueId = (dayOffset * 10) + index; 
                                window.AndroidBridge.scheduleAlarm(epoch, p.name, uniqueId);
                            }
                        }
                    }
                }
            });
        }
    }
}

function updateWeatherDisplay() {
    var lat = 13.8728, lng = 74.6246, currentHour = new Date().getHours(), isDay = (currentHour >= 6 && currentHour < 18);
    var sunSvg = '<svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    var moonSvg = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    var container = document.getElementById('weatherIconContainer');
    if (container) container.innerHTML = isDay ? sunSvg : moonSvg;
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lng + "&current=temperature_2m")
        .then(response => response.json()).then(data => { if (data && data.current) document.getElementById('tempValue').textContent = Math.round(data.current.temperature_2m) + "°C"; })
        .catch(error => { document.getElementById('tempValue').textContent = "--°C"; });
}

function handleBatteryOptToggle(element) {
    if (window.AndroidBridge && typeof window.AndroidBridge.openBatteryOptimizationSettings === 'function') { window.AndroidBridge.openBatteryOptimizationSettings(); setTimeout(updateBatteryOptState, 1500); } 
    else { element.checked = false; alert("Battery optimization is managed automatically in browser mode."); }
}
function updateBatteryOptState() {
    try { if (window.AndroidBridge && typeof window.AndroidBridge.isIgnoringBatteryOptimizations === 'function') { var toggle = document.getElementById('batteryOptToggle'); if (toggle) toggle.checked = window.AndroidBridge.isIgnoringBatteryOptimizations(); } } catch(e) {}
}
function uploadAndDisableDiagnostics() {
    try { var logs = JSON.parse(localStorage.getItem('app_diag_session_logs') || '[]');
        if (logs.length === 0) return;
        if (!localStorage.getItem('app_device_tag')) localStorage.setItem('app_device_tag', "Android_User_" + Math.random().toString(36).substring(2, 6));
        fetch('https://script.google.com/macros/s/AKfycbyzUKAJqOwjaL4aUHbTyP4Sw3WhWImegoDRUOgiuhRF5Bst2_rcWG9c6qOMg87opO3h/exec', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ type: "diagnostic_report", name: localStorage.getItem('app_device_tag'), reason: "Automatic 24-hour compliant diagnostic completion", device: navigator.userAgent, logs: logs }) })
        .then(res => res.json()).then(data => { localStorage.removeItem('advanced_diag_enabled'); localStorage.removeItem('diag_start_timestamp'); localStorage.removeItem('app_diag_session_logs'); var toggleEl = document.getElementById('advancedDiagToggle'); if (toggleEl) toggleEl.checked = false; }).catch(err=>{});
    } catch(e) {}
}
function handleAdvancedDiagToggle() {
    var toggle = document.getElementById('advancedDiagToggle');
    if (!toggle) return;
    if (toggle.checked) {
        localStorage.setItem('advanced_diag_enabled', '1'); localStorage.setItem('diag_start_timestamp', Date.now().toString());
        if (!localStorage.getItem('app_diag_session_logs')) localStorage.setItem('app_diag_session_logs', JSON.stringify([{ time: new Date().toISOString(), event: 'Diagnostics enabled' }]));
        scheduleDiagnosticUploadTimer();
    } else { localStorage.removeItem('advanced_diag_enabled'); localStorage.removeItem('diag_start_timestamp'); localStorage.removeItem('app_diag_session_logs'); }
}
function scheduleDiagnosticUploadTimer() {
    var startTime = parseInt(localStorage.getItem('diag_start_timestamp') || '0', 10);
    if (!startTime) return;
    var remaining = (24 * 60 * 60 * 1000) - (Date.now() - startTime);
    if (remaining <= 0) uploadAndDisableDiagnostics(); else setTimeout(uploadAndDisableDiagnostics, remaining);
}
function startSplashTransition() {
    var splash = document.getElementById('splashScreen'), logo = document.getElementById('splashLogo');
    if (logo && splash) { setTimeout(function() { logo.style.transform = 'scale(3.5)'; }, 100); setTimeout(function() { logo.style.transform = 'scale(7)'; splash.style.opacity = '0'; setTimeout(function() { splash.style.display = 'none'; }, 2800); }, 2100); }
}
function recordInstallOrUpdate() {
    var currentInstallTime = (window.AndroidBridge && typeof window.AndroidBridge.getAppInstallTimestamp === 'function') ? window.AndroidBridge.getAppInstallTimestamp() : "web_dev";
    var lastRecordedTime = localStorage.getItem('recorded_install_timestamp');
    if (currentInstallTime !== "0" && currentInstallTime !== lastRecordedTime) {
        var sendPing = function(loc) {
            fetch('https://script.google.com/macros/s/AKfycbyzUKAJqOwjaL4aUHbTyP4Sw3WhWImegoDRUOgiuhRF5Bst2_rcWG9c6qOMg87opO3h/exec', { method: 'POST', body: JSON.stringify({ event: !lastRecordedTime ? "New Install" : "Reinstall / Upgrade", version: CURRENT_INSTALLED_VERSION_NAME, device: navigator.userAgent || "Unknown Device", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown", location: loc }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
            .then(function() { localStorage.setItem('recorded_install_timestamp', currentInstallTime); }).catch(function() {});
        };
        if ("geolocation" in navigator) navigator.geolocation.getCurrentPosition(function(pos) { sendPing(pos.coords.latitude.toFixed(5) + ", " + pos.coords.longitude.toFixed(5)); }, function() { sendPing("Denied / Unavailable"); }, { timeout: 10000, enableHighAccuracy: true });
        else sendPing("Not Supported");
    }
}
function updateWaterLenses() {
    const buttons = document.querySelectorAll('.floating-side-btn'), paperContainer = document.querySelector('.wrap');
    if (buttons.length === 0 || !paperContainer) return;
    let activeMasks = []; const paperRect = paperContainer.getBoundingClientRect();
    buttons.forEach(btn => {
        if (btn.offsetParent === null) return;
        const btnRect = btn.getBoundingClientRect(), lensCenterX = btnRect.left + btnRect.width / 2, lensCenterY = btnRect.top + btnRect.height / 2;
        const candidateElements = document.querySelectorAll('#monthlyTable td.num, .p-time'); let targetEl = null;
        for (let i = 0; i < candidateElements.length; i++) {
            const elRect = candidateElements[i].getBoundingClientRect();
            if (!(elRect.right < btnRect.left || elRect.left > btnRect.right || elRect.bottom < btnRect.top || elRect.top > btnRect.bottom) && candidateElements[i].textContent.trim().length > 0) { targetEl = candidateElements[i]; break; }
        }
        const arrowSpan = btn.querySelector('.water-lens-content');
        if (targetEl) {
            if (arrowSpan) arrowSpan.style.setProperty('display', 'none', 'important');
            const rect = targetEl.getBoundingClientRect(), computedStyle = window.getComputedStyle(targetEl), fontSize = parseFloat(computedStyle.fontSize) * 1.6;
            const canvas = document.createElement('canvas'); canvas.width = 150; canvas.height = 70;
            const ctx = canvas.getContext('2d'); ctx.font = `bold ${fontSize}px ${computedStyle.fontFamily || 'Georgia, serif'}`; ctx.fillStyle = computedStyle.color || '#26231d'; ctx.textBaseline = 'middle'; ctx.fillText(targetEl.textContent.trim(), 10, 35);
            btn.style.background = `url(${canvas.toDataURL()})`; btn.style.backgroundColor = 'transparent'; btn.style.backgroundPosition = `-${(lensCenterX - rect.left) * 1.6 - (btnRect.width / 2) + 10}px -${(lensCenterY - rect.top) * 1.6 - (btnRect.height / 2)}px`; btn.style.backgroundRepeat = 'no-repeat';
            activeMasks.push({ x: lensCenterX - paperRect.left, y: lensCenterY - paperRect.top });
        } else {
            if (arrowSpan) arrowSpan.style.setProperty('display', 'flex', 'important');
            btn.style.background = 'none'; btn.style.backgroundColor = 'transparent';
        }
    });
    if (activeMasks.length > 0) {
        let polygonStr = 'polygon(0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%';
        activeMasks.forEach(m => { polygonStr += `, ${m.x}px ${m.y - 35}px, ${m.x + 35}px ${m.y}px, ${m.x}px ${m.y + 35}px, ${m.x - 35}px ${m.y}px, ${m.x}px ${m.y - 35}px`; });
        paperContainer.style.clipPath = polygonStr + ')';
    } else paperContainer.style.clipPath = 'none';
}
