/* Категории (групи) майстори/специалисти — обща истина за сървъра и клиента. */
'use strict';
const TRADES = ['power', 'water', 'software', 'hardware', 'medical', 'pharmacy'];
const LABEL = {
  power: 'Електричество (ток)',
  water: 'Водопровод (вода)',
  software: 'Компютри — софтуер',
  hardware: 'Компютри — хардуер',
  medical: 'Медицинска помощ',
  pharmacy: 'Доставка на лекарства',
};
module.exports = { TRADES, LABEL };
