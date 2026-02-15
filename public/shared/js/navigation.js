// Version: 1.0056
/**
 * KCY Ecosystem - Navigation System
 */

const KCY_NAV = {
    projects: {
        home: { name: "Home", url: "/", icon: "🏠" },
        token: { name: "KCY Token", url: "/token/", admin: "/token/admin/scripts.html", icon: "🪙" },
        multisig: { name: "Multi-Sig", url: "/multisig/", admin: "/multisig/admin/", icon: "🔐" },
        chat: { name: "AMS Chat", url: "/chat/", admin: "/chat/admin/", icon: "💬" }
    },
    
    injectNav: function() {
        if (document.querySelector('.kcy-nav')) return;
        
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
                </div>
                <div class="nav-admin">
                    <select onchange="if(this.value) window.location.href=this.value">
                        <option value="">⚙️ Admin ▼</option>
                        <option value="/token/admin/scripts.html">Token Admin</option>
                        <option value="/multisig/admin/">Multi-Sig Admin</option>
                        <option value="/chat/admin/">Chat Admin</option>
                    </select>
                </div>
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
    
    init: function() {
        this.injectNav();
        this.highlightCurrent();
    }
};

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', function() {
        KCY_NAV.init();
    });
    window.KCY_NAV = KCY_NAV;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = KCY_NAV;
}
