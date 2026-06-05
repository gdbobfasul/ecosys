// Version: 1.0173
/**
 * KCY Ecosystem - Navigation System
 * Admin dropdown visible ONLY with ?adm=bgmasters-set
 */

const KCY_NAV = {
    ADM_KEY: 'bgmasters-set',
    
    isAdmin: function() {
        // Check URL param
        const params = new URLSearchParams(window.location.search);
        if (params.get('adm') === this.ADM_KEY) {
            try { sessionStorage.setItem('kcy-adm', this.ADM_KEY); } catch {}
            return true;
        }
        // Check session
        try { return sessionStorage.getItem('kcy-adm') === this.ADM_KEY; } catch {}
        return false;
    },
    
    projects: {
        home: { name: "Home", url: "/", icon: "🏠" },
        token: { name: "KCY Token", url: "/token/", admin: "/token/admin/scripts.html", icon: "🪙" },
        brch1: { name: "BRCH1", url: "/brch1/", admin: "/brch1/admin/", icon: "/brch1/assets/brch1-icon.svg" },
        multisig: { name: "Multi-Sig", url: "/multisig/", admin: "/multisig/admin/", icon: "🔐" },
        chat: { name: "AMS Chat", url: "/chat/", admin: "/chat/admin/", icon: "💬" },
        eco3: { name: "ECO-3", url: "/eco-3/", admin: "/eco-3/admin/", icon: "🤖" }
    },
    
    injectNav: function() {
        if (document.querySelector('.kcy-nav')) return;
        
        const adm = this.isAdmin();
        const nav = document.createElement('nav');
        nav.className = 'kcy-nav';
        // тъмен вариант: ако body има data-nav-theme="dark" ИЛИ сме в игрите (тъмен фон).
        // Услугите имат светъл фон → светло меню (както billing/начало).
        var darkAttr = document.body.getAttribute('data-nav-theme');
        var path = window.location.pathname;
        if (darkAttr === 'dark' || /\/portals\/games\//.test(path)) {
            nav.className = 'kcy-nav dark';
        }
        nav.innerHTML = `
            <div class="nav-container">
                <a href="/" class="nav-logo">
                    <span>🚀</span>
                    <span>KCY Ecosystem</span>
                </a>
                <div class="nav-links">
                    <a href="/" data-i18n="nav.home">Home</a>
                    <a href="/token/" data-i18n="nav.token">🪙 Token</a>
                    <a href="/brch1/" class="nav-brch1"><img src="/brch1/assets/brch1-icon.svg" alt="" style="width:18px;height:18px;vertical-align:middle;margin-right:4px;">BRCH1</a>
                    <a href="/multisig/" data-i18n="nav.multisig">🔐 Multi-Sig</a>
                    <a href="/chat/" data-i18n="nav.chat">💬 Chat</a>
                    <a href="/eco-3/" data-i18n="nav.eco3">🤖 ECO-3</a>
                    <a href="/portals/games/" data-i18n="nav.games">🎮 Игри</a>
                    <a href="/portals/services/" data-i18n="nav.services">🛠️ Услуги</a>
                    <a href="/portals/billing.html" class="nav-login-only" data-i18n="nav.payment" style="display:none;">💳 Плащане</a>
                </div>
                <div class="nav-auth" id="kcy-nav-auth">
                    <a href="/portals/login.html" class="nav-login" data-i18n="r.137">🔑 Логин</a>
                    <a href="/portals/register.html" class="nav-register" data-i18n="r.131">📝 Регистрация</a>
                </div>
                <div class="nav-lang">
                    <select id="kcy-lang-select" onchange="if(window.KCY_I18N) KCY_I18N.set(this.value)" title="Language / Език"></select>
                </div>
                <div class="nav-admin" id="kcy-nav-admin" style="display:none;">
                    <span class="nav-adm-badge" id="kcy-adm-badge">🔴 ЛОГНАТ АДМИН</span>
                    <button class="nav-adm-toggle" id="kcy-guest-toggle" title="Превключи между админ изглед и изглед като обикновен посетител">изключи</button>
                    <select onchange="if(this.value) window.location.href=this.value">
                        <option value="">⚙️ Admin ▼</option>
                        <option value="/shared/admin-status.html">🩺 System Status</option>
                        <option value="/shared/robot.html">🤖 Робот (тест)</option>
                        <option value="" disabled>──────────────</option>
                        <option value="/token/admin/scripts.html">🪙 Token Admin</option>
                        <option value="/brch1/admin/">💰 BRCH1 Admin</option>
                        <option value="/multisig/admin/">🔐 Multi-Sig Admin</option>
                        <option value="/chat/admin/index.html">💬 Chat Admin</option>
                        <option value="/eco-3/admin/">🤖 ECO-3 Admin</option>
                        <option value="/portals/admin.html">🎮 Portals Admin</option>
                        <option value="/houselookbook/admin.html">🏠 House-Look-Book Admin</option>
                        <option value="/wherenobiz/admin.html">🌍 WhereNoBiz Admin</option>
                    </select>
                </div>
            </div>
        `;
        
        if (document.body.firstChild) {
            document.body.insertBefore(nav, document.body.firstChild);
        } else {
            document.body.appendChild(nav);
        }
        this.setupGuestToggle();
        this.revealLoginOnly();
        this.checkIpAdmin();
        this.setupLangSelect();
        this.setupAuth();
    },

    // Попълва език дропдауна + слуша за смяна на език
    setupLangSelect: function() {
        var sel = document.getElementById('kcy-lang-select');
        if (!sel || !window.KCY_I18N) return;
        sel.innerHTML = '';
        KCY_I18N.supported.forEach(function(l) {
            var o = document.createElement('option');
            o.value = l.code; o.textContent = l.name;
            sel.appendChild(o);
        });
        sel.value = KCY_I18N.lang;
        // когато i18n е готов/сменен — синхронизирай селектора + преведи nav-а
        document.addEventListener('kcy-lang-ready', function(e){ sel.value = e.detail.lang; });
        document.addEventListener('kcy-lang-changed', function(e){ sel.value = e.detail.lang; });
    },

    // Вход/регистрация в хедъра (до езика); ако потребителят е логнат → име + Изход.
    // Ползва /api/portals/me (proxy-нато глобално). Тихо пропуска, ако порталът не върви.
    setupAuth: function() {
        var box = document.getElementById('kcy-nav-auth');
        if (!box) return;
        fetch('/api/portals/me').then(function(r){ return r.ok ? r.json() : null; }).then(function(data){
            if (!data || !data.logged_in) return;
            var paid = data.paid_this_month ? ' ✅' : '';
            var adm = data.is_admin ? ' (admin)' : '';
            box.innerHTML = '<span class="nav-user">👤 ' + data.user.username + paid + adm + '</span>' +
                            '<button class="nav-logout" id="kcy-logout-btn" data-i18n="billing.logout">Изход</button>';
            var b = document.getElementById('kcy-logout-btn');
            if (b) b.onclick = function(){ fetch('/api/portals/logout', { method:'POST' }).then(function(){ location.reload(); }); };
        }).catch(function(){ /* порталът не върви — остави статичните бутони */ });
    },

    // ── Показва "ЛОГНАТ АДМИН" бутоните САМО ако сървърът третира IP-то като админ ──
    // Зависи изцяло от IP whitelist на сървъра (вкл. 0.0.0.0/0), НЕ от URL параметри.
    checkIpAdmin: function() {
        var block = document.getElementById('kcy-nav-admin');
        if (!block) return;
        fetch('/api/portals/ip-admin', { credentials: 'same-origin' })
            .then(function(r){ return r.ok ? r.json() : null; })
            .then(function(d){
                if (d && d.ip_admin) {
                    block.style.display = '';
                    // запомни админ статуса за тази сесия (за isAdmin() на други места)
                    try { sessionStorage.setItem('kcy-adm', 'bgmasters-set'); } catch (e) {}
                }
            })
            .catch(function(){ /* не е админ IP — остава скрит */ });
    },

    // ── Показва линкове само за логнати (напр. "Плащане") ──
    // Пита /api/portals/me. Ако е логнат (или админ без guest-mode) → показва ги.
    revealLoginOnly: function() {
        var self = this;
        var loginOnly = document.querySelectorAll('.nav-login-only');
        if (!loginOnly.length) return;
        function show(){ loginOnly.forEach(function(el){ el.style.display = ''; }); }
        // 1) логнат потребител → показва
        fetch('/api/portals/me', { credentials: 'same-origin' })
            .then(function(r){ return r.ok ? r.json() : null; })
            .then(function(d){ if (d && d.logged_in) show(); })
            .catch(function(){});
        // 2) админ по IP (whitelisted, без guest-mode) → също показва
        if (!self.isGuestMode()) {
            fetch('/api/portals/ip-admin', { credentials: 'same-origin' })
                .then(function(r){ return r.ok ? r.json() : null; })
                .then(function(d){ if (d && d.ip_admin) show(); })
                .catch(function(){});
        }
    },

    // ── Guest-mode toggle (само за админ) ──────────────────────
    // Слага/маха cookie kcy-guest-mode=1. Когато е сложено, сървърът третира
    // админа като обикновен посетител (редиректи към billing). Чисто клиентско —
    // не пипа .env/сървърни настройки. Засяга само този браузър.
    isGuestMode: function() {
        return /(?:^|;\s*)kcy-guest-mode=1(?:;|$)/.test(document.cookie);
    },
    setupGuestToggle: function() {
        var btn = document.getElementById('kcy-guest-toggle');
        var badge = document.getElementById('kcy-adm-badge');
        if (!btn) return;
        var guest = this.isGuestMode();
        // отрази текущото състояние
        if (guest) {
            btn.textContent = 'включи';
            if (badge) { badge.textContent = '⚪ АДМИН ИЗКЛЮЧЕН (изглед като гост)'; badge.style.opacity = '.6'; }
        } else {
            btn.textContent = 'изключи';
            if (badge) { badge.textContent = '🔴 ЛОГНАТ АДМИН'; badge.style.opacity = '1'; }
        }
        btn.addEventListener('click', function() {
            if (/(?:^|;\s*)kcy-guest-mode=1(?:;|$)/.test(document.cookie)) {
                // включи админ обратно — изтрий cookie
                document.cookie = 'kcy-guest-mode=; path=/; max-age=0';
            } else {
                // изключи админ — симулирай гост
                document.cookie = 'kcy-guest-mode=1; path=/; max-age=86400';
            }
            location.reload();
        });
    },
    
    highlightCurrent: function() {
        const path = window.location.pathname;
        const links = document.querySelectorAll('.nav-links a');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href === path || (href !== '/' && path.startsWith(href))) {
                link.classList.add('active');
            }
        });
    },
    
    // Hide .btn-admin elements on pages unless admin mode
    hideAdminButtons: function() {
        if (this.isAdmin()) return;
        document.querySelectorAll('.btn-admin, [href*="admin"]').forEach(el => {
            if (el.closest('.kcy-nav')) return; // skip nav (already handled)
            el.style.display = 'none';
        });
    },
    
    init: function() {
        this.injectNav();
        this.highlightCurrent();
        this.hideAdminButtons();
        this.ensureI18n();
    },

    // Зарежда i18n.js (ако още го няма) и прилага превода върху nav-а
    ensureI18n: function() {
        function applyNow(){
            if (window.KCY_I18N) {
                // ако вече е зареден речник — преведи; иначе init ще го направи
                if (window.KCY_I18N.dict && Object.keys(window.KCY_I18N.dict).length) {
                    window.KCY_I18N.apply();
                }
                KCY_NAV.setupLangSelect();
            }
        }
        if (window.KCY_I18N) { applyNow(); return; }
        var s = document.createElement('script');
        s.src = '/shared/js/i18n.js?v=1.0115';
        s.onload = applyNow;
        document.head.appendChild(s);
    }
};

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', function() { KCY_NAV.init(); });
    window.KCY_NAV = KCY_NAV;
}
if (typeof module !== 'undefined' && module.exports) { module.exports = KCY_NAV; }
