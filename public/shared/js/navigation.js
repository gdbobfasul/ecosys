// Version: 1.0085
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
        multisig: { name: "Multi-Sig", url: "/multisig/", admin: "/multisig/admin/", icon: "🔐" },
        chat: { name: "AMS Chat", url: "/chat/", admin: "/chat/admin/", icon: "💬" },
        eco3: { name: "ECO-3", url: "/eco-3/", admin: "/eco-3/admin/", icon: "🤖" }
    },
    
    injectNav: function() {
        if (document.querySelector('.kcy-nav')) return;
        
        const adm = this.isAdmin();
        const nav = document.createElement('nav');
        nav.className = 'kcy-nav';
        nav.innerHTML = `
            <div class="nav-container">
                <a href="/" class="nav-logo">
                    <span>🚀</span>
                    <span>KCY Ecosystem</span>
                </a>
                <div class="nav-links">
                    <a href="/">Home</a>
                    <a href="/token/">🪙 Token</a>
                    <a href="/multisig/">🔐 Multi-Sig</a>
                    <a href="/chat/">💬 Chat</a>
                    <a href="/eco-3/">🤖 ECO-3</a>
                </div>
                ${adm ? `<div class="nav-admin">
                    <select onchange="if(this.value) window.location.href=this.value">
                        <option value="">⚙️ Admin ▼</option>
                        <option value="/token/admin/scripts.html">Token Admin</option>
                        <option value="/multisig/admin/">Multi-Sig Admin</option>
                        <option value="/chat/admin/">Chat Admin</option>
                        <option value="/eco-3/admin/">ECO-3 Admin</option>
                        <option value="/shared/admin-status.html">System Status</option>
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
