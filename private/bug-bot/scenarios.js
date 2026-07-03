// Version: 1.0173
// Критични пътища на всяко приложение — само ЧЕТЕНЕ (read-only, безопасно за prod).
// Всеки сценарий отваря страниците, проверява статус + console/network грешки,
// и (по желание) пинга health endpoint-а. Без изпращане на форми/писане.
'use strict';

module.exports = [
  { app: 'main',    name: 'Начална страница',                 paths: ['/'] },
  { app: 'portals', name: 'Портали — начало, вход, регистрация',
    paths: ['/portals/index-services.html', '/portals/index-games.html', '/portals/login.html', '/portals/register.html'],
    health: '/api/portals/health' },
  { app: 'portals', name: 'Портали — услуги (извадка)',
    paths: ['/portals/services/watch20.html', '/portals/services/qr.html', '/portals/services/calc.html'] },
  { app: 'chat',    name: 'Чат — интерфейс',                   paths: ['/chat/'], health: '/api/health' },
  { app: 'eco3',    name: 'ECO-3 — начало + админ вход',       paths: ['/eco-3/', '/eco-3/admin/'], health: '/api/eco3/health' },
  { app: 'hlb',     name: 'House-Look-Book — начало + класация',
    paths: ['/houselookbook/', '/houselookbook/login.html', '/houselookbook/ranking.html'],
    health: '/api/hlb/health' },
  { app: 'wnb',     name: 'WhereNoBiz — начало + преглед',
    paths: ['/wherenobiz/', '/wherenobiz/login.html', '/wherenobiz/browse.html'],
    health: '/api/wnb/health' },
];
