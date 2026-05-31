// Version: 1.0094
/**
 * Stripe конфигурация — избира LIVE или TEST според STRIPE_TEST_MODE.
 * ============================================================
 * STRIPE_TEST_MODE=1 → тестови ключове/линкове (фалшиви карти)
 * STRIPE_TEST_MODE=0 (или липсва) → live (реални пари)
 *
 * Връща нормализирани имена: secretKey, publishableKey, paymentLinks{...}.
 * Всички сървъри (chat, eco-3, portals) ползват ТОЗИ модул, за да няма
 * дублирана логика и да се сменя режимът само от .env.
 */

function resolveStripeConfig(env) {
    env = env || process.env;
    const TEST = String(env.STRIPE_TEST_MODE || '0') === '1';
    const sfx = TEST ? '_TEST' : '_LIVE';

    // ключове — с fallback към старите имена без суфикс (за съвместимост)
    const secretKey = env['STRIPE_SECRET_KEY' + sfx] || env.STRIPE_SECRET_KEY || null;
    const publishableKey = env['STRIPE_PUBLISHABLE_KEY' + sfx] || env.STRIPE_PUBLISHABLE_KEY || null;

    const link = (base) => env['STRIPE_PAYMENT_LINK_' + base + sfx] || env['STRIPE_PAYMENT_LINK_' + base] || null;

    return {
        testMode: TEST,
        secretKey,
        publishableKey,
        paymentLinks: {
            chat:            link('CHAT'),
            portals:         link('PORTALS'),
            eco3_economy:    link('ECO3_ECONOMY'),
            eco3_standard:   link('ECO3_STANDARD'),
            eco3_premium:    link('ECO3_PREMIUM'),
            eco3_enterprise: link('ECO3_ENTERPRISE')
        }
    };
}

module.exports = { resolveStripeConfig };
