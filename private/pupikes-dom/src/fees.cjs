/* Възнаграждение на специалист (на посетен обект), в сома. Определя се от РАНГА (1–5) при
 * регистрация; впоследствие центърът може да зададе индивидуална сума (override). */
'use strict';
const RANK_FEE = { 1: 1000, 2: 2000, 3: 4000, 4: 6000, 5: 10000 };

const feeForRank = rank => RANK_FEE[Math.min(5, Math.max(1, Number(rank) || 1))];

/* ефективна такса: индивидуалната (override) има приоритет, иначе по ранг */
function effective(visit_fee, rank) { return (visit_fee && visit_fee > 0) ? visit_fee : feeForRank(rank); }

module.exports = { RANK_FEE, feeForRank, effective };
