#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// FILL DATA — пълнител на СИСТЕМНИ потребители в чата.
// Създава N бот-потребители от различни държави, всички с флаг is_system = 1.
// Те оживяват чата, но НЕ са реални хора (не могат да се договарят реално).
//
// Пуска се от старт менюто (секция FILL DATA) или ръчно на сървъра:
//   node private/chat/scripts/fill-system-users.js [брой]    (по подразбиране 20)
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', 'configs', '.env') });
const bcrypt = require('bcryptjs');
const { initializeDatabase } = require('../utils/database');
const filllog = require('../../shared/debug-helper').create('filldata');

// Държави с локални имена/градове/телефонен префикс — за реалистично разнообразие.
const COUNTRIES = [
  { country: 'Bulgaria', code: 'BG', prefix: '359', cities: ['София', 'Пловдив', 'Варна', 'Бургас', 'Русе'],
    male: ['Иван', 'Георги', 'Димитър', 'Николай', 'Петър', 'Стоян'], female: ['Мария', 'Елена', 'Десислава', 'Ивана', 'Виктория', 'Анна'], surnames: ['Иванов', 'Петров', 'Георгиев', 'Димитрова', 'Стоянова', 'Колева'] },
  { country: 'Russia', code: 'RU', prefix: '7', cities: ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Казань', 'Сочи'],
    male: ['Алексей', 'Дмитрий', 'Сергей', 'Иван', 'Андрей', 'Максим'], female: ['Анна', 'Ольга', 'Екатерина', 'Наталья', 'Мария', 'Татьяна'], surnames: ['Иванов', 'Смирнов', 'Кузнецов', 'Попова', 'Соколова', 'Волкова'] },
  { country: 'Ukraine', code: 'UA', prefix: '380', cities: ['Київ', 'Львів', 'Одеса', 'Харків', 'Дніпро'],
    male: ['Олександр', 'Андрій', 'Богдан', 'Дмитро', 'Тарас', 'Сергій'], female: ['Олена', 'Ірина', 'Наталія', 'Оксана', 'Юлія', 'Софія'], surnames: ['Шевченко', 'Коваленко', 'Бондаренко', 'Ткаченко', 'Мельник', 'Кравченко'] },
  { country: 'Kyrgyzstan', code: 'KG', prefix: '996', cities: ['Бишкек', 'Ош', 'Джалал-Абад', 'Каракол', 'Токмок'],
    male: ['Азамат', 'Нурлан', 'Бакыт', 'Эрлан', 'Тилек', 'Адилет'], female: ['Айгүл', 'Нургүл', 'Жылдыз', 'Айпери', 'Бегимай', 'Гүлназ'], surnames: ['Уулу', 'Кызы', 'Бекова', 'Асанов', 'Турсунова', 'Маматов'] },
  { country: 'Germany', code: 'DE', prefix: '49', cities: ['Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt'],
    male: ['Lukas', 'Felix', 'Jonas', 'Max', 'Leon', 'Paul'], female: ['Anna', 'Lena', 'Sophie', 'Marie', 'Laura', 'Emma'], surnames: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner'] },
  { country: 'France', code: 'FR', prefix: '33', cities: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice'],
    male: ['Louis', 'Hugo', 'Léo', 'Gabriel', 'Jules', 'Adam'], female: ['Emma', 'Léa', 'Chloé', 'Manon', 'Camille', 'Sarah'], surnames: ['Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Petit'] },
  { country: 'Italy', code: 'IT', prefix: '39', cities: ['Roma', 'Milano', 'Napoli', 'Torino', 'Firenze'],
    male: ['Marco', 'Luca', 'Matteo', 'Alessandro', 'Andrea', 'Davide'], female: ['Giulia', 'Sofia', 'Martina', 'Chiara', 'Sara', 'Francesca'], surnames: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano'] },
  { country: 'Spain', code: 'ES', prefix: '34', cities: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao'],
    male: ['Hugo', 'Daniel', 'Pablo', 'Álvaro', 'Adrián', 'Diego'], female: ['Lucía', 'Sofía', 'María', 'Paula', 'Daniela', 'Carla'], surnames: ['García', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez'] },
  { country: 'Mexico', code: 'MX', prefix: '52', cities: ['Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Cancún'],
    male: ['José', 'Luis', 'Juan', 'Carlos', 'Miguel', 'Jorge'], female: ['Guadalupe', 'María', 'Ana', 'Fernanda', 'Valeria', 'Daniela'], surnames: ['Hernández', 'García', 'Martínez', 'González', 'Rodríguez', 'Ramírez'] },
  { country: 'USA', code: 'US', prefix: '1', cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami'],
    male: ['James', 'Michael', 'David', 'John', 'Daniel', 'Chris'], female: ['Mary', 'Jennifer', 'Linda', 'Emily', 'Jessica', 'Ashley'], surnames: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis'] },
  { country: 'India', code: 'IN', prefix: '91', cities: ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Kolkata'],
    male: ['Aarav', 'Vivaan', 'Arjun', 'Rohan', 'Raj', 'Karan'], female: ['Aanya', 'Diya', 'Priya', 'Ananya', 'Riya', 'Neha'], surnames: ['Sharma', 'Verma', 'Patel', 'Singh', 'Kumar', 'Gupta'] },
  { country: 'Japan', code: 'JP', prefix: '81', cities: ['東京', '大阪', '名古屋', '札幌', '福岡'],
    male: ['Haruto', 'Yuto', 'Sota', 'Ren', 'Kaito', 'Riku'], female: ['Yui', 'Aoi', 'Hina', 'Sakura', 'Mei', 'Rin'], surnames: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito'] },
  { country: 'China', code: 'CN', prefix: '86', cities: ['北京', '上海', '广州', '深圳', '成都'],
    male: ['Wei', 'Hao', 'Jun', 'Lei', 'Ming', 'Tao'], female: ['Li', 'Fang', 'Yan', 'Xia', 'Mei', 'Jing'], surnames: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang'] },
  { country: 'Brazil', code: 'BR', prefix: '55', cities: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza'],
    male: ['João', 'Pedro', 'Lucas', 'Gabriel', 'Matheus', 'Rafael'], female: ['Maria', 'Ana', 'Júlia', 'Beatriz', 'Larissa', 'Camila'], surnames: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira'] },
  { country: 'Saudi Arabia', code: 'SA', prefix: '966', cities: ['الرياض', 'جدة', 'مكة', 'المدينة', 'الدمام'],
    male: ['محمد', 'أحمد', 'علي', 'خالد', 'عبدالله', 'فهد'], female: ['نورة', 'سارة', 'فاطمة', 'مريم', 'هند', 'ريم'], surnames: ['العتيبي', 'الغامدي', 'القحطاني', 'الشهري', 'الحربي', 'الدوسري'] },
];

// Профилни текстове (нужда / предлагане) — ЛОКАЛИЗИРАНИ по език на държавата.
const LANG_BY_CC = { BG: 'bg', RU: 'ru', UA: 'uk', KG: 'ky', DE: 'de', FR: 'fr', IT: 'it', ES: 'es', MX: 'es', US: 'en', IN: 'hi', JP: 'ja', CN: 'zh', BR: 'pt', SA: 'ar' };
const LOCALIZED = {
  bg: { needs: ['Търся приятели', 'Нов в града', 'Бизнес контакти', 'Език за практика', 'Помощ на място', 'Просто разговор', ''], offers: ['Местен гид', 'Преводач', 'Съвети за района', 'Споделяне на опит', 'Компания за кафе', ''] },
  en: { needs: ['Looking for friends', 'New in town', 'Business contacts', 'Language practice', 'Help on the ground', 'Just a chat', ''], offers: ['Local guide', 'Translator', 'Area tips', 'Sharing experience', 'Coffee company', ''] },
  ru: { needs: ['Ищу друзей', 'Новенький в городе', 'Деловые контакты', 'Практика языка', 'Помощь на месте', 'Просто общение', ''], offers: ['Местный гид', 'Переводчик', 'Советы по району', 'Делюсь опытом', 'Компания за кофе', ''] },
  uk: { needs: ['Шукаю друзів', 'Новенький у місті', 'Ділові контакти', 'Практика мови', 'Допомога на місці', 'Просто спілкування', ''], offers: ['Місцевий гід', 'Перекладач', 'Поради по району', 'Ділюся досвідом', 'Компанія за кавою', ''] },
  ky: { needs: ['Дос издейм', 'Шаарга жаңы келдим', 'Иштиктүү байланыштар', 'Тил практикасы', 'Жердеги жардам', 'Жөн эле баарлашуу', ''], offers: ['Жергиликтүү гид', 'Котормочу', 'Аймак боюнча кеңештер', 'Тажрыйба бөлүшөм', 'Кофеге шериктеш', ''] },
  de: { needs: ['Suche Freunde', 'Neu in der Stadt', 'Geschäftskontakte', 'Sprache üben', 'Hilfe vor Ort', 'Einfach plaudern', ''], offers: ['Lokaler Guide', 'Übersetzer', 'Tipps zur Gegend', 'Erfahrung teilen', 'Kaffee-Begleitung', ''] },
  fr: { needs: ['Cherche des amis', 'Nouveau en ville', 'Contacts professionnels', 'Pratiquer la langue', 'Aide sur place', 'Juste discuter', ''], offers: ['Guide local', 'Traducteur', 'Conseils sur le quartier', "Partager l'expérience", 'Compagnie pour un café', ''] },
  it: { needs: ['Cerco amici', 'Nuovo in città', 'Contatti di lavoro', 'Pratica della lingua', 'Aiuto sul posto', 'Solo due chiacchiere', ''], offers: ['Guida locale', 'Traduttore', 'Consigli sulla zona', 'Condividere esperienze', 'Compagnia per un caffè', ''] },
  es: { needs: ['Busco amigos', 'Nuevo en la ciudad', 'Contactos de negocios', 'Practicar el idioma', 'Ayuda en el lugar', 'Solo charlar', ''], offers: ['Guía local', 'Traductor', 'Consejos de la zona', 'Compartir experiencia', 'Compañía para un café', ''] },
  pt: { needs: ['Procuro amigos', 'Novo na cidade', 'Contatos de negócios', 'Praticar o idioma', 'Ajuda no local', 'Só conversar', ''], offers: ['Guia local', 'Tradutor', 'Dicas da região', 'Compartilhar experiência', 'Companhia para um café', ''] },
  hi: { needs: ['दोस्त ढूँढ रहा हूँ', 'शहर में नया हूँ', 'व्यापारिक संपर्क', 'भाषा का अभ्यास', 'मौके पर मदद', 'बस बातचीत', ''], offers: ['स्थानीय गाइड', 'अनुवादक', 'इलाके की सलाह', 'अनुभव साझा करना', 'कॉफ़ी का साथ', ''] },
  ja: { needs: ['友達を探してる', 'この街は初めて', 'ビジネスの繋がり', '語学の練習', '現地での手伝い', 'ただ話したい', ''], offers: ['地元ガイド', '通訳', '地域のヒント', '経験をシェア', 'コーヒーのお供', ''] },
  zh: { needs: ['想交朋友', '刚到这座城市', '商务联系', '练习语言', '当地帮忙', '只是聊聊', ''], offers: ['本地向导', '翻译', '本地建议', '分享经验', '一起喝咖啡', ''] },
  ar: { needs: ['أبحث عن أصدقاء', 'جديد في المدينة', 'علاقات عمل', 'ممارسة اللغة', 'مساعدة في الموقع', 'مجرد دردشة', ''], offers: ['مرشد محلي', 'مترجم', 'نصائح عن المنطقة', 'مشاركة الخبرة', 'رفقة لقهوة', ''] },
};

const COUNT = Math.max(1, Math.min(5000, parseInt(process.argv[2], 10) || 20));
const pick = a => a[Math.floor(Math.random() * a.length)];
const digits = n => { let s = ''; for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10); return s; };

(async () => {
  filllog.info('fill-system-users.js старт');
  console.log(`FILL DATA · чат — създавам ${COUNT} системни потребители…`);
  const db = await initializeDatabase();
  try { await db.exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system INTEGER DEFAULT 0'); } catch (e) { /* SQLite или вече има */ }

  const passHash = bcrypt.hashSync('system-' + digits(8), 10); // обща парола за ботовете (не за реален вход)
  let ok = 0, fail = 0;
  for (let i = 0; i < COUNT; i++) {
    const c = pick(COUNTRIES);
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const first = gender === 'male' ? pick(c.male) : pick(c.female);
    const full_name = `${first} ${pick(c.surnames)}`;
    const age = 18 + Math.floor(Math.random() * 48);
    const phone = `+${c.prefix}${digits(9)}`;
    const loc = LOCALIZED[LANG_BY_CC[c.code]] || LOCALIZED.en;   // профил на езика на държавата
    try {
      await db.prepare(
        `INSERT INTO users
          (phone, password_hash, full_name, gender, age, country, country_code, city,
           current_need, offerings, paid_until, subscription_active, is_system)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`
      ).run(phone, passHash, full_name, gender, age, c.country, c.code, pick(c.cities),
            pick(loc.needs), pick(loc.offers), '2099-12-31 00:00:00', 1);
      ok++;
    } catch (e) {
      fail++;
      if (fail <= 3) console.error('  ! insert:', e.message);
    }
  }
  // Колко системни има общо вече
  let total = '?';
  try { const r = await db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_system = 1').get(); total = r && (r.n ?? r.count); } catch (e) {}
  console.log(`✅ Добавени ${ok} системни потребители (грешки: ${fail}). Общо системни: ${total}.`);
  filllog.info('fill-system-users.js край', ok);
  if (db.close) await db.close();
  process.exit(0);
})().catch(e => { filllog.error('fill-system-users.js:', e && e.message); console.error('FILL DATA fatal:', e.message); process.exit(1); });
