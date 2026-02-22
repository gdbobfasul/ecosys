// Version: 1.0084
// ECO-3 AI Studio - Main Application
// Този файл е placeholder - замени с пълния eco3.jsx от предишната разработка
// Използва глобалните настройки от /shared/js/config.js

const { useState, useEffect } = React;

// ═══ ECO-3 Config Bridge ═══
const getConfig = () => window.ECO3_CONFIG || {};
const getStripeKey = () => getConfig().STRIPE_PUBLISHABLE_KEY;
const getApiBase = () => getConfig().API_BASE || '/api/eco3/';
const getPricing = () => getConfig().PRICING || {};
const getCryptoWallets = () => getConfig().CRYPTO_WALLETS || {};

// ═══ MAIN COMPONENT ═══
function ECO3() {
    const [ready, setReady] = useState(false);
    const [config, setConfig] = useState({});
    const [stripeLoaded, setStripeLoaded] = useState(false);
    
    useEffect(() => {
        // Load ecosystem config
        const cfg = getConfig();
        setConfig(cfg);
        setReady(true);
        
        // Check Stripe availability
        if (cfg.STRIPE_PUBLISHABLE_KEY) {
            setStripeLoaded(true);
        } else {
            // Retry after fetch completes
            const t = setTimeout(() => {
                if (getStripeKey()) setStripeLoaded(true);
            }, 2000);
            return () => clearTimeout(t);
        }
    }, []);

    const S = {
        wrap: { minHeight: "100vh", background: "#0a0a0f", color: "white", fontFamily: "'JetBrains Mono', monospace" },
        header: { padding: "60px 20px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,.06)" },
        title: { fontSize: 48, fontWeight: 700, fontFamily: "'Crimson Pro', serif",
            background: "linear-gradient(135deg, #00ff88, #00b4d8, #9b5de5)", 
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
        subtitle: { fontSize: 14, color: "rgba(255,255,255,.4)", marginTop: 10 },
        grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
            gap: 20, padding: 40, maxWidth: 1200, margin: "0 auto" },
        card: { background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
            borderRadius: 16, padding: 30, transition: "all .3s" },
        cardTitle: { fontSize: 18, fontWeight: 600, marginBottom: 12, color: "#00ff88" },
        cardText: { fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.8 },
        badge: (ok) => ({ display: "inline-block", padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: ok ? "rgba(0,255,136,.1)" : "rgba(255,107,107,.1)",
            color: ok ? "#00ff88" : "#ff6b6b", border: `1px solid ${ok ? "rgba(0,255,136,.2)" : "rgba(255,107,107,.2)"}` }),
        section: { padding: "40px", maxWidth: 1200, margin: "0 auto" },
        sectionTitle: { fontSize: 20, fontWeight: 600, color: "rgba(255,255,255,.8)", marginBottom: 20 },
        infoRow: { display: "flex", justifyContent: "space-between", padding: "10px 0", 
            borderBottom: "1px solid rgba(255,255,255,.04)", fontSize: 13 },
        label: { color: "rgba(255,255,255,.4)" },
        value: { color: "rgba(255,255,255,.8)", fontWeight: 500 },
        btn: { padding: "14px 40px", background: "linear-gradient(135deg, #00ff88, #00b4d8)", 
            color: "#0a0a0f", border: "none", borderRadius: 30, cursor: "pointer",
            fontSize: 16, fontWeight: 700, fontFamily: "'Crimson Pro', serif", letterSpacing: 1 },
        placeholder: { textAlign: "center", padding: "80px 20px", color: "rgba(255,255,255,.3)" }
    };

    const pricing = getPricing();
    const wallets = getCryptoWallets();

    return (
        <div style={S.wrap}>
            {/* Header */}
            <div style={S.header}>
                <div style={S.title}>ECO-3 AI Studio</div>
                <div style={S.subtitle}>
                    Интерактивно медийно съдържание • 3 AI агента • KCY Ecosystem v{config.VERSION || '1.0084'}
                </div>
            </div>

            {/* Status Cards */}
            <div style={S.grid}>
                <div style={S.card}>
                    <div style={S.cardTitle}>🌐 Ecosystem</div>
                    <div style={S.cardText}>
                        <div style={S.infoRow}>
                            <span style={S.label}>Base URL</span>
                            <span style={S.value}>{config.BASE_URL || 'localhost'}</span>
                        </div>
                        <div style={S.infoRow}>
                            <span style={S.label}>API Endpoint</span>
                            <span style={S.value}>{getApiBase()}</span>
                        </div>
                        <div style={S.infoRow}>
                            <span style={S.label}>Config</span>
                            <span style={S.badge(!!window.KCY_CONFIG)}>
                                {window.KCY_CONFIG ? 'Свързан' : 'Offline'}
                            </span>
                        </div>
                    </div>
                </div>

                <div style={S.card}>
                    <div style={S.cardTitle}>💳 Stripe</div>
                    <div style={S.cardText}>
                        <div style={S.infoRow}>
                            <span style={S.label}>Publishable Key</span>
                            <span style={S.badge(stripeLoaded)}>
                                {stripeLoaded ? 'Заредена' : 'Чака сървър'}
                            </span>
                        </div>
                        <div style={S.infoRow}>
                            <span style={S.label}>Basic</span>
                            <span style={S.value}>{pricing.BASIC ? `€${pricing.BASIC.EUR}` : '—'}</span>
                        </div>
                        <div style={S.infoRow}>
                            <span style={S.label}>Standard</span>
                            <span style={S.value}>{pricing.STANDARD ? `€${pricing.STANDARD.EUR}` : '—'}</span>
                        </div>
                        <div style={S.infoRow}>
                            <span style={S.label}>Premium</span>
                            <span style={S.value}>{pricing.PREMIUM ? `€${pricing.PREMIUM.EUR}` : '—'}</span>
                        </div>
                    </div>
                </div>

                <div style={S.card}>
                    <div style={S.cardTitle}>🪙 Crypto</div>
                    <div style={S.cardText}>
                        {Object.entries(wallets).length > 0 ? (
                            Object.entries(wallets).map(([coin, addr]) => (
                                <div key={coin} style={S.infoRow}>
                                    <span style={S.label}>{coin}</span>
                                    <span style={{...S.value, fontSize: 10, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis"}}>
                                        {addr}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div style={{color: "rgba(255,255,255,.3)", fontSize: 12}}>
                                Конфигурирай в shared/js/config.js
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* AI Agents */}
            <div style={S.section}>
                <div style={S.sectionTitle}>🤖 AI Агенти</div>
                <div style={{display: "flex", gap: 20, flexWrap: "wrap"}}>
                    {[
                        { icon: "🎯", name: "Директор", desc: "Задава рамки, контролира и одобрява", color: "#ff6b6b" },
                        { icon: "🏗️", name: "Архитект", desc: "Детайлно планиране и маркетинг", color: "#4ecdc4" },
                        { icon: "⚡", name: "Изпълнител", desc: "Реализация, данни, визуализации", color: "#ffe66d" }
                    ].map(a => (
                        <div key={a.name} style={{...S.card, flex: "1 1 200px", borderLeft: `3px solid ${a.color}`}}>
                            <div style={{fontSize: 28, marginBottom: 8}}>{a.icon}</div>
                            <div style={{fontSize: 16, fontWeight: 600, color: a.color, marginBottom: 6}}>{a.name}</div>
                            <div style={{fontSize: 12, color: "rgba(255,255,255,.4)"}}>{a.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Placeholder for full app */}
            <div style={S.placeholder}>
                <div style={{fontSize: 60, marginBottom: 20}}>🚀</div>
                <div style={{fontSize: 20, fontFamily: "'Crimson Pro', serif", fontWeight: 600, marginBottom: 10, color: "rgba(255,255,255,.6)"}}>
                    Интеграция завършена
                </div>
                <div style={{fontSize: 13, color: "rgba(255,255,255,.3)", maxWidth: 500, margin: "0 auto", lineHeight: 1.8, marginBottom: 30}}>
                    ECO-3 е свързан с KCY Ecosystem. Замени този файл (app.jsx) с пълния ECO-3 компонент от предишната разработка.
                    Споделеният config, Stripe ключове и крипто портфейли са достъпни чрез window.ECO3_CONFIG.
                </div>
                <div style={{display: "flex", gap: 15, justifyContent: "center", flexWrap: "wrap"}}>
                    <button style={S.btn} onClick={() => window.location.href = '/'}>← Ecosystem Home</button>
                    <button style={{...S.btn, background: "rgba(255,255,255,.08)", color: "#00ff88"}} 
                        onClick={() => console.log('ECO3_CONFIG:', window.ECO3_CONFIG)}>
                        🔧 Log Config
                    </button>
                </div>
            </div>
        </div>
    );
}

// Export for mounting
window.ECO3 = ECO3;
