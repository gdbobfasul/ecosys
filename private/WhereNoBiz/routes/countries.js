// WhereNoBiz — страни и континенти (за листването: континент → държава → постове).
// Континентът на всяка страна идва от data/countries.js (не пазим в базата).

const express = require('express');
const { all } = require('../db');
const { COUNTRIES, CONTINENTS } = require('../data/countries');

const router = express.Router();

// Бърза справка code → continent.
const CONT_BY_CODE = Object.fromEntries(COUNTRIES.map(c => [c.code, c.continent]));

// GET /api/wnb/continents — списък континенти + колко одобрени поста имат
router.get('/continents', async (req, res, next) => {
  try {
    // Брой одобрени постове по страна → агрегираме по континент.
    const rows = await all(
      `SELECT country_code, count(*)::int AS c
       FROM posts WHERE status = 'approved' GROUP BY country_code`
    );
    const byCont = Object.fromEntries(CONTINENTS.map(k => [k, 0]));
    for (const r of rows) {
      const cont = CONT_BY_CODE[r.country_code];
      if (cont) byCont[cont] += r.c;
    }
    res.json({ continents: CONTINENTS.map(name => ({ name, postCount: byCont[name] })) });
  } catch (e) { next(e); }
});

// GET /api/wnb/countries?continent=Asia — държавите в континент + брой одобрени постове
router.get('/countries', async (req, res, next) => {
  try {
    const continent = req.query.continent;
    let list = COUNTRIES;
    if (continent) list = COUNTRIES.filter(c => c.continent === continent);

    const counts = await all(
      `SELECT country_code, count(*)::int AS c
       FROM posts WHERE status = 'approved' GROUP BY country_code`
    );
    const cmap = Object.fromEntries(counts.map(r => [r.country_code, r.c]));

    const out = list
      .map(c => ({ code: c.code, name: c.name, continent: c.continent, postCount: cmap[c.code] || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ countries: out });
  } catch (e) { next(e); }
});

module.exports = router;
