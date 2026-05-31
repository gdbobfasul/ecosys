// Version: 1.0093
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
        // тъмен вариант: ако body има data-nav-theme="dark" ИЛИ сме в игрите/порталните под-страници
        var darkAttr = document.body.getAttribute('data-nav-theme');
        var path = window.location.pathname;
        if (darkAttr === 'dark' || /\/portals\/(games|services)\//.test(path)) {
            nav.className = 'kcy-nav dark';
        }
        nav.innerHTML = `
            <div class="nav-container">
                <a href="/" class="nav-logo">
                    <span>🚀</span>
                    <span>KCY Ecosystem</span>
                </a>
                <div class="nav-links">
                    <a href="/">Home</a>
                    <a href="/token/">🪙 Token</a>
                    <a href="/brch1/" class="nav-brch1"><img src="/brch1/assets/brch1-icon.svg" alt="" style="width:18px;height:18px;vertical-align:middle;margin-right:4px;">BRCH1</a>
                    <a href="/multisig/">🔐 Multi-Sig</a>
                    <a href="/chat/">💬 Chat</a>
                    <a href="/eco-3/">🤖 ECO-3</a>
                    <a href="/portals/games/">🎮 Игри</a>
                    <a href="/portals/services/">🛠️ Услуги</a>
                    <a href="/portals/billing.html">💳 Плащане</a>
                </div>
                ${adm ? `<div class="nav-admin">
                    <select onchange="if(this.value) window.location.href=this.value + (location.search.indexOf('adm=')>-1 ? (this.value.indexOf('?')>-1?'&':'?')+'adm=bgmasters-set' : '')">
                        <option value="">⚙️ Admin ▼</option>
                        <option value="/shared/admin-status.html">🩺 System Status</option>
                        <option value="" disabled>──────────────</option>
                        <option value="/token/admin/scripts.html">🪙 Token Admin</option>
                        <option value="/brch1/admin/">💰 BRCH1 Admin</option>
                        <option value="/multisig/admin/">🔐 Multi-Sig Admin</option>
                        <option value="/chat/admin/index.html">💬 Chat Admin</option>
                        <option value="/eco-3/admin/">🤖 ECO-3 Admin</option>
                        <option value="/portals/admin.html">🎮 Portals Admin</option>
                    </select>
                </div>` : ''}
            </div>
        `;
        
        if (document.body.firstChild) {
            document.body.insertBefore(nav, document.body.firstChild);
        } else {
            document.body.appendChild(nav);
        }
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
    }
};

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', function() { KCY_NAV.init(); });
    window.KCY_NAV = KCY_NAV;
}
if (typeof module !== 'undefined' && module.exports) { module.exports = KCY_NAV; }
