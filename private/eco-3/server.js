// Version: 1.0084
// ECO-3 AI Studio - Backend Server
// Проксира Anthropic API и споделя Stripe с Chat backend
// Използва същия шаблон като private/chat/server.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: './configs/.env' });

const app = express();
const PORT = process.env.ECO3_PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost', 'https://alsec.strangled.net'],
    credentials: true
}));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 100,
    message: { error: 'Too many requests. Try again later.' }
});
app.use('/generate', apiLimiter);

// Logging middleware
const logFile = path.join(__dirname, 'logs', 'eco3.log');
function logRequest(type, msg) {
    const line = `[${new Date().toISOString()}] [${type}] ${msg}\n`;
    console.log(line.trim());
    fs.appendFileSync(logFile, line);
}

// ============================================
// HEALTH & STATUS
// ============================================

app.get('/health', (req, res) => {
    res.json({ 
        ok: true, 
        service: 'eco-3',
        version: '1.0084',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/anthropic-status', (req, res) => {
    res.json({ 
        configured: !!process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
    });
});

// ============================================
// STRIPE (shared keys with Chat)
// ============================================

const stripe = process.env.STRIPE_SECRET_KEY 
    ? require('stripe')(process.env.STRIPE_SECRET_KEY) 
    : null;

app.get('/stripe-key', (req, res) => {
    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null });
});

// Create payment intent for ECO-3 generation
app.post('/create-payment', async (req, res) => {
    if (!stripe) {
        return res.status(503).json({ error: 'Stripe not configured' });
    }
    
    try {
        const { budget, duration, topic } = req.body;
        
        // Calculate price based on budget tier
        const prices = {
            basic:    { base: 299, perMin: 10 },   // €2.99 + €0.10/min
            standard: { base: 499, perMin: 15 },   // €4.99 + €0.15/min
            premium:  { base: 999, perMin: 25 }     // €9.99 + €0.25/min
        };
        
        const tier = prices[budget] || prices.standard;
        const amount = tier.base + (duration || 10) * tier.perMin;
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'eur',
            metadata: { 
                service: 'eco-3',
                budget: budget || 'standard',
                duration: String(duration || 10),
                topic: (topic || '').substring(0, 200)
            },
            automatic_payment_methods: { enabled: true }
        });

        logRequest('PAYMENT', `Created intent ${paymentIntent.id} for €${(amount/100).toFixed(2)} [${budget}/${duration}min]`);

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: amount / 100,
            currency: 'EUR'
        });
    } catch (err) {
        logRequest('ERROR', `Payment error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Confirm payment
app.post('/confirm-payment', async (req, res) => {
    if (!stripe) {
        return res.status(503).json({ error: 'Stripe not configured' });
    }
    
    try {
        const { paymentIntentId } = req.body;
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (intent.status === 'succeeded') {
            logRequest('PAYMENT', `Confirmed ${paymentIntentId} - €${(intent.amount/100).toFixed(2)}`);
            res.json({ success: true, status: intent.status });
        } else {
            res.json({ success: false, status: intent.status });
        }
    } catch (err) {
        logRequest('ERROR', `Confirm error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ANTHROPIC API PROXY
// ============================================

app.post('/generate', async (req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return res.status(503).json({ error: 'Anthropic API key not configured' });
    }

    try {
        const { model, system, messages, max_tokens } = req.body;
        
        logRequest('GENERATE', `Request: model=${model || 'default'}, msgs=${messages?.length || 0}, max_tokens=${max_tokens || 4096}`);
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
                system: system || undefined,
                messages: messages || [],
                max_tokens: Math.min(max_tokens || 4096, 8192)
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            logRequest('ERROR', `Anthropic ${response.status}: ${JSON.stringify(errData)}`);
            return res.status(response.status).json({ error: errData.error?.message || 'Anthropic API error' });
        }

        const data = await response.json();
        logRequest('GENERATE', `Response: ${data.usage?.output_tokens || '?'} tokens`);
        
        res.json(data);
    } catch (err) {
        logRequest('ERROR', `Generate error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// Simple IP-based admin check (same as Chat)
const adminCheck = (req, res, next) => {
    const allowedIPs = (process.env.ADMIN_ALLOWED_IPS || '127.0.0.1,::1').split(',');
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    // In development, allow all
    if (process.env.NODE_ENV !== 'production' || allowedIPs.some(ip => clientIP.includes(ip.trim()))) {
        return next();
    }
    res.status(403).json({ error: 'Forbidden' });
};

app.get('/admin/stats', adminCheck, (req, res) => {
    // TODO: Implement with database
    res.json({
        totalRequests: 0,
        successfulGenerations: 0,
        revenue: '0.00',
        apiCosts: '0.00',
        period: '24h'
    });
});

app.get('/admin/logs', adminCheck, (req, res) => {
    try {
        const logs = fs.existsSync(logFile) 
            ? fs.readFileSync(logFile, 'utf8').split('\n').slice(-100).join('\n')
            : 'No logs yet';
        res.json({ logs });
    } catch (e) {
        res.json({ logs: 'Error reading logs: ' + e.message });
    }
});

app.delete('/admin/logs', adminCheck, (req, res) => {
    try {
        fs.writeFileSync(logFile, '');
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// START
// ============================================

app.listen(PORT, () => {
    console.log(`\n🤖 ECO-3 AI Studio Backend`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Stripe: ${stripe ? '✓ configured' : '✗ not configured'}`);
    console.log(`   Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✓ configured' : '✗ not configured'}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Log: ${logFile}\n`);
    
    logRequest('START', `ECO-3 server started on port ${PORT}`);
});

module.exports = app;
