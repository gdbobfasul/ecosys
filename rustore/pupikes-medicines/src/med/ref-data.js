// ref-data.js — справочни данни за таба „Справочник" (Reference): какво трябва да има в
// АВТОМОБИЛНАТА аптечка (по държавна норма) и в ДОМАШНАТА аптечка за първа помощ, плюс
// основни правила/норми за лекарствата. Текстовете идват от i18n-med.js по ключ (15 езика);
// тук са само структурата, количествата и препратките към нормите.
//
// Формат на артикул: [i18nKey, qty]  (qty '' = без число; число = „× N").

export const COUNTRIES = [
  { code: 'de', flag: '🇩🇪', nameKey: 'ctry_de' },
  { code: 'ru', flag: '🇷🇺', nameKey: 'ctry_ru' },
  { code: 'bg', flag: '🇧🇬', nameKey: 'ctry_bg' },
  { code: 'kg', flag: '🇰🇬', nameKey: 'ctry_kg' },
  { code: 'intl', flag: '🌍', nameKey: 'ctry_intl' },
];

// Обща домашна аптечка (препоръчителна, еднаква навсякъде — СЗО/Червен кръст стил).
const HOME = [
  ['it_thermometer', ''], ['it_painkiller', ''], ['it_antihistamine', ''], ['it_ors', ''],
  ['it_antiseptic', ''], ['it_plaster', ''], ['it_gauze', ''], ['it_bandage', ''],
  ['it_elastic_bandage', ''], ['it_adhesive_tape', ''], ['it_scissors', '1'], ['it_tweezers', '1'],
  ['it_gloves', '2'], ['it_burn_gel', ''], ['it_cold_pack', ''], ['it_charcoal', ''], ['it_cotton', ''],
];

export const REF = {
  de: {
    carNormKey: 'norm_de_car',
    car: [
      ['it_plaster', ''], ['it_sterile_dressing', ''], ['it_gauze', ''], ['it_bandage', ''],
      ['it_triangular', '2'], ['it_gloves', '4'], ['it_scissors', '1'], ['it_rescue_blanket', '1'],
      ['it_face_mask', '2'], ['it_manual', '1'],
    ],
    carExtra: ['ex_warning_triangle', 'ex_vest'],
    home: HOME,
    rules: ['rule_rx', 'rule_store', 'rule_expiry', 'rule_travel', 'rule_dispose', 'rule_children', 'rule_interactions'],
  },
  ru: {
    carNormKey: 'norm_ru_car',
    car: [
      ['it_tourniquet', '1'], ['it_bandage', ''], ['it_gauze', ''], ['it_plaster', ''],
      ['it_gloves', '2'], ['it_cpr_mask', '1'], ['it_scissors', '1'], ['it_manual', '1'],
    ],
    carExtra: ['ex_warning_triangle', 'ex_extinguisher', 'ex_vest'],
    home: HOME,
    rules: ['rule_rx', 'rule_store', 'rule_expiry', 'rule_travel', 'rule_dispose', 'rule_children', 'rule_interactions'],
  },
  bg: {
    carNormKey: 'norm_bg_car',
    car: [
      ['it_bandage', ''], ['it_gauze', ''], ['it_triangular', '1'], ['it_plaster', ''],
      ['it_gloves', '2'], ['it_scissors', '1'], ['it_tourniquet', '1'], ['it_safety_pins', ''],
      ['it_rescue_blanket', '1'], ['it_cpr_mask', '1'],
    ],
    carExtra: ['ex_warning_triangle', 'ex_vest', 'ex_extinguisher'],
    home: HOME,
    rules: ['rule_rx', 'rule_store', 'rule_expiry', 'rule_travel', 'rule_dispose', 'rule_children', 'rule_interactions'],
  },
  kg: {
    carNormKey: 'norm_kg_car',
    car: [
      ['it_tourniquet', '1'], ['it_bandage', ''], ['it_gauze', ''], ['it_plaster', ''],
      ['it_gloves', '2'], ['it_cpr_mask', '1'], ['it_scissors', '1'], ['it_manual', '1'],
    ],
    carExtra: ['ex_warning_triangle', 'ex_extinguisher'],
    home: HOME,
    rules: ['rule_rx', 'rule_store', 'rule_expiry', 'rule_travel', 'rule_dispose', 'rule_children', 'rule_interactions'],
  },
  intl: {
    carNormKey: 'norm_intl_car',
    car: [
      ['it_plaster', ''], ['it_sterile_dressing', ''], ['it_gauze', ''], ['it_bandage', ''],
      ['it_triangular', '1'], ['it_gloves', '2'], ['it_scissors', '1'], ['it_rescue_blanket', '1'],
      ['it_cpr_mask', '1'], ['it_manual', '1'],
    ],
    carExtra: ['ex_warning_triangle', 'ex_vest'],
    home: HOME,
    rules: ['rule_rx', 'rule_store', 'rule_expiry', 'rule_travel', 'rule_dispose', 'rule_children', 'rule_interactions'],
  },
};
