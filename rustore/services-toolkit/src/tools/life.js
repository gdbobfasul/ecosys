// Version: 1.0021
// Стойност в живот — НОВА СЪРЦЕВИНА на приложението (Huawei 4.3, 10.09.2026).
// Моментен анализатор на стойността на една стока в ЖИВОТ: по профила на човека (доход, работни
// часове, отпуск, сън, семейство/издръжка, месечни разходи, кредити, имущество, цели) апът казва
// колко РАБОТНИ ЧАСА / ДНИ / МЕСЕЦИ от живота струва дадена цена, кога ще я изплатиш, как мести
// целите ти и колко от оставащия ти живот отива за нея. Четири под-таба:
//   • Профил — входните данни (може да се вземат от „Личен бюджет" и „Планировчик");
//   • Анализатор — цена ръчно или от снимка на етикет/обява (разпознаване на суми), резултат с
//     разбивка, вариант „на кредит", ефект върху целите и върху запаса без работа;
//   • Времето ми — оставащ живот (ориентировъчно по възраст) срещу парите: запас без работа,
//     сценарии „работя до…", „спирам след N г.", „+ покупка", графика на платно;
//   • История — записаните анализи.
// ВСИЧКО се пази САМО на устройството (localStorage). Разпознаването от снимка тегли модула Tesseract
// от мрежата ВЕДНЪЖ при първо ползване (както Pupikes Medicines); без връзка — ръчно въвеждане.
import { esc } from '../core/ui.js';
import { t, tf, register, getLang } from '../core/i18n.js';

register({
  lf_tab_prof: { bg:'Профил', ru:'Профиль', uk:'Профіль', en:'Profile', de:'Profil', fr:'Profil', es:'Perfil', 'es-MX':'Perfil', it:'Profilo', pt:'Perfil', ar:'الملف', hi:'प्रोफ़ाइल', ja:'プロフィール', ky:'Профиль', 'zh-Hant':'個人資料' },
  lf_tab_an: { bg:'Анализатор', ru:'Анализатор', uk:'Аналізатор', en:'Analyzer', de:'Analyse', fr:'Analyseur', es:'Analizador', 'es-MX':'Analizador', it:'Analizzatore', pt:'Analisador', ar:'المحلل', hi:'विश्लेषक', ja:'分析', ky:'Анализатор', 'zh-Hant':'分析器' },
  lf_tab_time: { bg:'Времето ми', ru:'Моё время', uk:'Мій час', en:'My time', de:'Meine Zeit', fr:'Mon temps', es:'Mi tiempo', 'es-MX':'Mi tiempo', it:'Il mio tempo', pt:'O meu tempo', ar:'وقتي', hi:'मेरा समय', ja:'私の時間', ky:'Менин убактым', 'zh-Hant':'我的時間' },
  lf_tab_hist: { bg:'История', ru:'История', uk:'Історія', en:'History', de:'Verlauf', fr:'Historique', es:'Historial', 'es-MX':'Historial', it:'Storico', pt:'Histórico', ar:'السجل', hi:'इतिहास', ja:'履歴', ky:'Тарых', 'zh-Hant':'歷史' },
  lf_local: { bg:'Всичко се пази само на устройството — без акаунт, без облак. Профилът се записва автоматично.', ru:'Всё хранится только на устройстве — без аккаунта, без облака. Профиль сохраняется автоматически.', uk:'Усе зберігається лише на пристрої — без акаунта, без хмари. Профіль зберігається автоматично.', en:'Everything is stored only on your device — no account, no cloud. The profile saves automatically.', de:'Alles wird nur auf dem Gerät gespeichert — kein Konto, keine Cloud. Das Profil speichert automatisch.', fr:'Tout est stocké uniquement sur l’appareil — sans compte, sans cloud. Le profil s’enregistre automatiquement.', es:'Todo se guarda solo en el dispositivo — sin cuenta, sin nube. El perfil se guarda automáticamente.', 'es-MX':'Todo se guarda solo en el dispositivo — sin cuenta, sin nube. El perfil se guarda automáticamente.', it:'Tutto resta solo sul dispositivo — senza account, senza cloud. Il profilo si salva da solo.', pt:'Tudo fica só no dispositivo — sem conta, sem nuvem. O perfil guarda-se automaticamente.', ar:'كل شيء يُحفظ على جهازك فقط — بلا حساب وبلا سحابة. يُحفظ الملف تلقائيًا.', hi:'सब कुछ केवल डिवाइस पर रहता है — न खाता, न क्लाउड। प्रोफ़ाइल अपने आप सहेजी जाती है।', ja:'すべて端末内にのみ保存 — アカウント・クラウド不要。プロフィールは自動保存。', ky:'Баары түзмөктө гана сакталат — аккаунтсуз, булутсуз. Профиль өзү сакталат.', 'zh-Hant':'一切僅儲存於裝置 — 無帳號、無雲端。個人資料自動儲存。' },
  lf_cur: { bg:'Валута (надпис)', ru:'Валюта (подпись)', uk:'Валюта (підпис)', en:'Currency (label)', de:'Währung (Kürzel)', fr:'Devise (libellé)', es:'Moneda (etiqueta)', 'es-MX':'Moneda (etiqueta)', it:'Valuta (sigla)', pt:'Moeda (rótulo)', ar:'العملة (رمز)', hi:'मुद्रा (लेबल)', ja:'通貨（表示）', ky:'Валюта (жазуу)', 'zh-Hant':'貨幣（標籤）' },
  lf_age: { bg:'Възраст (години)', ru:'Возраст (лет)', uk:'Вік (років)', en:'Age (years)', de:'Alter (Jahre)', fr:'Âge (ans)', es:'Edad (años)', 'es-MX':'Edad (años)', it:'Età (anni)', pt:'Idade (anos)', ar:'العمر (سنوات)', hi:'उम्र (वर्ष)', ja:'年齢（歳）', ky:'Жашы (жыл)', 'zh-Hant':'年齡（歲）' },
  lf_lifeexp: { bg:'Очаквана продължителност на живота (0 = по възрастта)', ru:'Ожидаемая продолжительность жизни (0 = по возрасту)', uk:'Очікувана тривалість життя (0 = за віком)', en:'Expected lifespan (0 = by age)', de:'Erwartete Lebensdauer (0 = nach Alter)', fr:'Espérance de vie (0 = selon l’âge)', es:'Esperanza de vida (0 = según la edad)', 'es-MX':'Esperanza de vida (0 = según la edad)', it:'Aspettativa di vita (0 = per età)', pt:'Esperança de vida (0 = pela idade)', ar:'العمر المتوقع (0 = حسب العمر)', hi:'अपेक्षित जीवनकाल (0 = उम्र अनुसार)', ja:'想定寿命（0 = 年齢から）', ky:'Күтүлгөн өмүр узактыгы (0 = жашы боюнча)', 'zh-Hant':'預期壽命（0 = 依年齡）' },
  lf_income: { bg:'Месечен нетен доход', ru:'Месячный чистый доход', uk:'Місячний чистий дохід', en:'Monthly net income', de:'Monatliches Nettoeinkommen', fr:'Revenu net mensuel', es:'Ingreso neto mensual', 'es-MX':'Ingreso neto mensual', it:'Reddito netto mensile', pt:'Rendimento líquido mensal', ar:'الدخل الشهري الصافي', hi:'मासिक शुद्ध आय', ja:'月の手取り収入', ky:'Айлык таза киреше', 'zh-Hant':'每月淨收入' },
  lf_hours: { bg:'Работни часове седмично', ru:'Рабочих часов в неделю', uk:'Робочих годин на тиждень', en:'Working hours per week', de:'Arbeitsstunden pro Woche', fr:'Heures de travail par semaine', es:'Horas de trabajo por semana', 'es-MX':'Horas de trabajo por semana', it:'Ore di lavoro a settimana', pt:'Horas de trabalho por semana', ar:'ساعات العمل أسبوعيًا', hi:'प्रति सप्ताह कार्य घंटे', ja:'週の労働時間', ky:'Жумасына иш сааттары', 'zh-Hant':'每週工作時數' },
  lf_vac: { bg:'Дни отпуск годишно', ru:'Дней отпуска в год', uk:'Днів відпустки на рік', en:'Vacation days per year', de:'Urlaubstage pro Jahr', fr:'Jours de congé par an', es:'Días de vacaciones al año', 'es-MX':'Días de vacaciones al año', it:'Giorni di ferie all’anno', pt:'Dias de férias por ano', ar:'أيام الإجازة سنويًا', hi:'प्रति वर्ष छुट्टी के दिन', ja:'年間の休暇日数', ky:'Жылына эс алуу күндөрү', 'zh-Hant':'每年休假天數' },
  lf_sleep: { bg:'Сън (часове на нощ)', ru:'Сон (часов в ночь)', uk:'Сон (годин на ніч)', en:'Sleep (hours per night)', de:'Schlaf (Stunden pro Nacht)', fr:'Sommeil (heures par nuit)', es:'Sueño (horas por noche)', 'es-MX':'Sueño (horas por noche)', it:'Sonno (ore a notte)', pt:'Sono (horas por noite)', ar:'النوم (ساعات في الليلة)', hi:'नींद (प्रति रात घंटे)', ja:'睡眠（1晩の時間）', ky:'Уйку (түнүнө саат)', 'zh-Hant':'睡眠（每晚小時）' },
  lf_retire: { bg:'Възраст за спиране на работа', ru:'Возраст прекращения работы', uk:'Вік припинення роботи', en:'Age to stop working', de:'Alter zum Aufhören', fr:'Âge d’arrêt du travail', es:'Edad para dejar de trabajar', 'es-MX':'Edad para dejar de trabajar', it:'Età per smettere di lavorare', pt:'Idade para parar de trabalhar', ar:'سن التوقف عن العمل', hi:'काम रोकने की उम्र', ja:'働くのをやめる年齢', ky:'Иштебей калуу жашы', 'zh-Hant':'停止工作年齡' },
  lf_deps: { bg:'Издържани членове на семейството (брой)', ru:'Иждивенцев в семье (число)', uk:'Утриманців у сім’ї (кількість)', en:'Family dependents (count)', de:'Unterhaltsberechtigte (Anzahl)', fr:'Personnes à charge (nombre)', es:'Familiares a cargo (número)', 'es-MX':'Familiares a cargo (número)', it:'Familiari a carico (numero)', pt:'Dependentes na família (número)', ar:'المعالون في الأسرة (العدد)', hi:'परिवार में आश्रित (संख्या)', ja:'扶養家族（人数）', ky:'Багуудагы үй-бүлө мүчөлөрү (саны)', 'zh-Hant':'家庭受扶養人數' },
  lf_depcost: { bg:'Издръжка на семейството месечно', ru:'Содержание семьи в месяц', uk:'Утримання сім’ї на місяць', en:'Family support per month', de:'Familienunterhalt pro Monat', fr:'Charges familiales par mois', es:'Manutención familiar al mes', 'es-MX':'Manutención familiar al mes', it:'Mantenimento familiare al mese', pt:'Sustento da família por mês', ar:'إعالة الأسرة شهريًا', hi:'परिवार का मासिक भरण-पोषण', ja:'家族の扶養費（月）', ky:'Үй-бүлөнү багуу айына', 'zh-Hant':'每月家庭扶養費' },
  lf_expenses: { bg:'Месечни разходи за живот (без издръжка и кредити)', ru:'Расходы на жизнь в месяц (без семьи и кредитов)', uk:'Витрати на життя на місяць (без сім’ї та кредитів)', en:'Monthly living expenses (without family and loans)', de:'Monatliche Lebenshaltung (ohne Familie und Kredite)', fr:'Dépenses de vie mensuelles (hors famille et crédits)', es:'Gastos de vida mensuales (sin familia ni créditos)', 'es-MX':'Gastos de vida mensuales (sin familia ni créditos)', it:'Spese di vita mensili (senza famiglia e prestiti)', pt:'Despesas de vida mensais (sem família e créditos)', ar:'نفقات المعيشة الشهرية (بدون الأسرة والقروض)', hi:'मासिक जीवन-यापन खर्च (परिवार और ऋण के बिना)', ja:'月の生活費（家族・ローンを除く）', ky:'Айлык жашоо чыгымдары (үй-бүлө жана насыясыз)', 'zh-Hant':'每月生活支出（不含家庭與貸款）' },
  lf_debtpay: { bg:'Вноски по кредити месечно', ru:'Платежи по кредитам в месяц', uk:'Платежі за кредитами на місяць', en:'Loan payments per month', de:'Kreditraten pro Monat', fr:'Mensualités de crédit', es:'Cuotas de préstamos al mes', 'es-MX':'Pagos de préstamos al mes', it:'Rate dei prestiti al mese', pt:'Prestações de crédito por mês', ar:'أقساط القروض شهريًا', hi:'मासिक ऋण किस्तें', ja:'ローン返済（月）', ky:'Насыя төлөмдөрү айына', 'zh-Hant':'每月貸款還款' },
  lf_debtbal: { bg:'Остатък по кредити общо', ru:'Остаток по кредитам всего', uk:'Залишок за кредитами разом', en:'Total loan balance', de:'Gesamter Kreditsaldo', fr:'Solde total des crédits', es:'Saldo total de préstamos', 'es-MX':'Saldo total de préstamos', it:'Saldo totale dei prestiti', pt:'Saldo total dos créditos', ar:'إجمالي رصيد القروض', hi:'कुल ऋण शेष', ja:'ローン残高合計', ky:'Насыялардын жалпы калдыгы', 'zh-Hant':'貸款總餘額' },
  lf_cash: { bg:'Пари и спестявания (налични)', ru:'Деньги и сбережения (доступные)', uk:'Гроші та заощадження (доступні)', en:'Cash and savings (available)', de:'Geld und Ersparnisse (verfügbar)', fr:'Argent et épargne (disponibles)', es:'Dinero y ahorros (disponibles)', 'es-MX':'Dinero y ahorros (disponibles)', it:'Denaro e risparmi (disponibili)', pt:'Dinheiro e poupanças (disponíveis)', ar:'النقد والمدخرات (المتاحة)', hi:'नकद और बचत (उपलब्ध)', ja:'現金と貯金（使える分）', ky:'Акча жана топтолгон каражат (колдо)', 'zh-Hant':'現金與存款（可用）' },
  lf_movable: { bg:'Движимо имущество (кола, техника…)', ru:'Движимое имущество (авто, техника…)', uk:'Рухоме майно (авто, техніка…)', en:'Movable property (car, equipment…)', de:'Bewegliches Vermögen (Auto, Geräte…)', fr:'Biens mobiliers (voiture, matériel…)', es:'Bienes muebles (coche, equipos…)', 'es-MX':'Bienes muebles (carro, equipos…)', it:'Beni mobili (auto, attrezzature…)', pt:'Bens móveis (carro, equipamentos…)', ar:'ممتلكات منقولة (سيارة، أجهزة…)', hi:'चल संपत्ति (कार, उपकरण…)', ja:'動産（車・機器など）', ky:'Кыймылдуу мүлк (унаа, техника…)', 'zh-Hant':'動產（汽車、設備…）' },
  lf_realty: { bg:'Недвижимо имущество', ru:'Недвижимость', uk:'Нерухомість', en:'Real estate', de:'Immobilien', fr:'Immobilier', es:'Bienes inmuebles', 'es-MX':'Bienes inmuebles', it:'Immobili', pt:'Imóveis', ar:'عقارات', hi:'अचल संपत्ति', ja:'不動産', ky:'Кыймылсыз мүлк', 'zh-Hant':'不動產' },
  lf_from_budget: { bg:'⤵ Вземи от „Личен бюджет"', ru:'⤵ Взять из «Личного бюджета»', uk:'⤵ Узяти з «Особистого бюджету»', en:'⤵ Take from “Personal budget”', de:'⤵ Aus „Persönliches Budget“ übernehmen', fr:'⤵ Reprendre du « Budget personnel »', es:'⤵ Tomar de «Presupuesto personal»', 'es-MX':'⤵ Tomar de «Presupuesto personal»', it:'⤵ Prendi da «Bilancio personale»', pt:'⤵ Obter do «Orçamento pessoal»', ar:'⤵ من «الميزانية الشخصية»', hi:'⤵ “व्यक्तिगत बजट” से लें', ja:'⤵ 「家計簿」から取り込む', ky:'⤵ «Жеке бюджеттен» алуу', 'zh-Hant':'⤵ 從「個人預算」取得' },
  lf_from_planner: { bg:'⤵ Вземи от „Планировчик"', ru:'⤵ Взять из «Планировщика»', uk:'⤵ Узяти з «Планувальника»', en:'⤵ Take from “Planner”', de:'⤵ Aus „Finanzplaner“ übernehmen', fr:'⤵ Reprendre du « Planificateur »', es:'⤵ Tomar de «Planificador»', 'es-MX':'⤵ Tomar de «Planificador»', it:'⤵ Prendi da «Pianificatore»', pt:'⤵ Obter do «Planeador»', ar:'⤵ من «المخطط»', hi:'⤵ “योजनाकार” से लें', ja:'⤵ 「プランナー」から取り込む', ky:'⤵ «Пландоочудан» алуу', 'zh-Hant':'⤵ 從「規劃器」取得' },
  lf_pulled_ok: { bg:'Данните са взети и попълнени.', ru:'Данные взяты и заполнены.', uk:'Дані взято й заповнено.', en:'Data taken and filled in.', de:'Daten übernommen und eingetragen.', fr:'Données reprises et remplies.', es:'Datos tomados y rellenados.', 'es-MX':'Datos tomados y llenados.', it:'Dati presi e compilati.', pt:'Dados obtidos e preenchidos.', ar:'تم أخذ البيانات وتعبئتها.', hi:'डेटा लिया और भरा गया।', ja:'データを取り込みました。', ky:'Маалымат алынып, толтурулду.', 'zh-Hant':'已取得並填入資料。' },
  lf_pulled_none: { bg:'Там няма записани данни.', ru:'Там нет сохранённых данных.', uk:'Там немає збережених даних.', en:'No saved data there.', de:'Dort sind keine Daten gespeichert.', fr:'Aucune donnée enregistrée là-bas.', es:'No hay datos guardados allí.', 'es-MX':'No hay datos guardados allí.', it:'Nessun dato salvato lì.', pt:'Não há dados guardados aí.', ar:'لا بيانات محفوظة هناك.', hi:'वहाँ कोई सहेजा डेटा नहीं।', ja:'保存データがありません。', ky:'Ал жерде сакталган маалымат жок.', 'zh-Hant':'那裡沒有已儲存的資料。' },
  lf_goals: { bg:'Цели и планове', ru:'Цели и планы', uk:'Цілі та плани', en:'Goals and plans', de:'Ziele und Pläne', fr:'Objectifs et projets', es:'Metas y planes', 'es-MX':'Metas y planes', it:'Obiettivi e piani', pt:'Objetivos e planos', ar:'الأهداف والخطط', hi:'लक्ष्य और योजनाएँ', ja:'目標と計画', ky:'Максаттар жана пландар', 'zh-Hant':'目標與計畫' },
  lf_goal_name: { bg:'Цел (напр. Кола)', ru:'Цель (напр. Авто)', uk:'Ціль (напр. Авто)', en:'Goal (e.g. Car)', de:'Ziel (z. B. Auto)', fr:'Objectif (ex. Voiture)', es:'Meta (p. ej. Coche)', 'es-MX':'Meta (p. ej. Carro)', it:'Obiettivo (es. Auto)', pt:'Objetivo (ex. Carro)', ar:'الهدف (مثال: سيارة)', hi:'लक्ष्य (जैसे कार)', ja:'目標（例：車）', ky:'Максат (мис. Унаа)', 'zh-Hant':'目標（例如 汽車）' },
  lf_goal_amount: { bg:'Сума', ru:'Сумма', uk:'Сума', en:'Amount', de:'Betrag', fr:'Montant', es:'Importe', 'es-MX':'Monto', it:'Importo', pt:'Valor', ar:'المبلغ', hi:'राशि', ja:'金額', ky:'Сумма', 'zh-Hant':'金額' },
  lf_goal_monthly: { bg:'Заделям месечно', ru:'Откладываю в месяц', uk:'Відкладаю на місяць', en:'I set aside monthly', de:'Ich lege monatlich zurück', fr:'J’épargne par mois', es:'Aparto al mes', 'es-MX':'Aparto al mes', it:'Metto da parte al mese', pt:'Ponho de lado por mês', ar:'أدّخر شهريًا', hi:'मासिक बचत', ja:'月々の積立', ky:'Айына бөлөм', 'zh-Hant':'每月存入' },
  lf_add_goal: { bg:'+ Добави цел', ru:'+ Добавить цель', uk:'+ Додати ціль', en:'+ Add goal', de:'+ Ziel hinzufügen', fr:'+ Ajouter un objectif', es:'+ Añadir meta', 'es-MX':'+ Agregar meta', it:'+ Aggiungi obiettivo', pt:'+ Adicionar objetivo', ar:'+ إضافة هدف', hi:'+ लक्ष्य जोड़ें', ja:'+ 目標を追加', ky:'+ Максат кошуу', 'zh-Hant':'+ 新增目標' },
  lf_no_goals: { bg:'Няма цели. Добави план със сума и колко заделяш месечно.', ru:'Целей нет. Добавьте план с суммой и сколько откладываете в месяц.', uk:'Цілей немає. Додайте план із сумою й скільки відкладаєте на місяць.', en:'No goals yet. Add a plan with an amount and how much you set aside monthly.', de:'Noch keine Ziele. Füge einen Plan mit Betrag und monatlicher Rücklage hinzu.', fr:'Aucun objectif. Ajoutez un projet avec un montant et l’épargne mensuelle.', es:'Sin metas. Añade un plan con importe y cuánto apartas al mes.', 'es-MX':'Sin metas. Agrega un plan con monto y cuánto apartas al mes.', it:'Nessun obiettivo. Aggiungi un piano con importo e quanto metti da parte al mese.', pt:'Sem objetivos. Adicione um plano com valor e quanto põe de lado por mês.', ar:'لا أهداف بعد. أضف خطة بمبلغ وما تدّخره شهريًا.', hi:'अभी कोई लक्ष्य नहीं। राशि और मासिक बचत के साथ योजना जोड़ें।', ja:'目標がありません。金額と月々の積立で計画を追加してください。', ky:'Максат жок. Сумма жана айлык бөлүү менен план кош.', 'zh-Hant':'尚無目標。新增含金額與每月存入的計畫。' },
  lf_goal_eta: { bg:'при това темпо — след {0}', ru:'при таком темпе — через {0}', uk:'за такого темпу — через {0}', en:'at this pace — in {0}', de:'bei diesem Tempo — in {0}', fr:'à ce rythme — dans {0}', es:'a este ritmo — en {0}', 'es-MX':'a este ritmo — en {0}', it:'a questo ritmo — tra {0}', pt:'a este ritmo — em {0}', ar:'بهذه الوتيرة — بعد {0}', hi:'इस गति से — {0} में', ja:'このペースなら — {0} 後', ky:'ушул темп менен — {0} кийин', 'zh-Hant':'依此速度 — {0} 後' },
  lf_goal_stalled: { bg:'не заделяш — целта стои', ru:'не откладываете — цель стоит', uk:'не відкладаєте — ціль стоїть', en:'nothing set aside — the goal stands still', de:'keine Rücklage — das Ziel steht still', fr:'rien d’épargné — l’objectif n’avance pas', es:'no apartas nada — la meta no avanza', 'es-MX':'no apartas nada — la meta no avanza', it:'non metti da parte — l’obiettivo è fermo', pt:'nada de lado — o objetivo não avança', ar:'لا ادخار — الهدف متوقف', hi:'कुछ नहीं बचता — लक्ष्य रुका है', ja:'積立なし — 目標は進まない', ky:'бөлбөйсүң — максат турат', 'zh-Hant':'未存入 — 目標停滯' },
  lf_your_hour: { bg:'Твоят час', ru:'Ваш час', uk:'Ваша година', en:'Your hour', de:'Deine Stunde', fr:'Votre heure', es:'Tu hora', 'es-MX':'Tu hora', it:'La tua ora', pt:'A sua hora', ar:'ساعتك', hi:'आपका घंटा', ja:'あなたの1時間', ky:'Сенин саатың', 'zh-Hant':'你的一小時' },
  lf_hourly: { bg:'Печелиш на работен час', ru:'Зарабатываете за рабочий час', uk:'Заробляєте за робочу годину', en:'You earn per working hour', de:'Du verdienst pro Arbeitsstunde', fr:'Vous gagnez par heure de travail', es:'Ganas por hora de trabajo', 'es-MX':'Ganas por hora de trabajo', it:'Guadagni per ora di lavoro', pt:'Ganha por hora de trabalho', ar:'تكسب في ساعة العمل', hi:'प्रति कार्य घंटे कमाई', ja:'労働1時間あたりの収入', ky:'Иш саатына табасың', 'zh-Hant':'每工作小時收入' },
  lf_work_hm: { bg:'Работни часове на месец', ru:'Рабочих часов в месяц', uk:'Робочих годин на місяць', en:'Working hours per month', de:'Arbeitsstunden pro Monat', fr:'Heures de travail par mois', es:'Horas de trabajo al mes', 'es-MX':'Horas de trabajo al mes', it:'Ore di lavoro al mese', pt:'Horas de trabalho por mês', ar:'ساعات العمل شهريًا', hi:'प्रति माह कार्य घंटे', ja:'月の労働時間', ky:'Айына иш сааттары', 'zh-Hant':'每月工作時數' },
  lf_out_month: { bg:'Задължителни разходи на месец (живот + издръжка + кредити)', ru:'Обязательные расходы в месяц (жизнь + семья + кредиты)', uk:'Обов’язкові витрати на місяць (життя + сім’я + кредити)', en:'Fixed outgoings per month (living + family + loans)', de:'Feste Ausgaben pro Monat (Leben + Familie + Kredite)', fr:'Sorties fixes par mois (vie + famille + crédits)', es:'Gastos fijos al mes (vida + familia + préstamos)', 'es-MX':'Gastos fijos al mes (vida + familia + préstamos)', it:'Uscite fisse al mese (vita + famiglia + prestiti)', pt:'Saídas fixas por mês (vida + família + créditos)', ar:'النفقات الثابتة شهريًا (معيشة + أسرة + قروض)', hi:'मासिक निश्चित खर्च (जीवन + परिवार + ऋण)', ja:'月の固定支出（生活＋家族＋ローン）', ky:'Айлык милдеттүү чыгымдар (жашоо + үй-бүлө + насыя)', 'zh-Hant':'每月固定支出（生活＋家庭＋貸款）' },
  lf_free_month: { bg:'Свободни пари на месец (след разходи и цели)', ru:'Свободные деньги в месяц (после расходов и целей)', uk:'Вільні гроші на місяць (після витрат і цілей)', en:'Free money per month (after outgoings and goals)', de:'Freies Geld pro Monat (nach Ausgaben und Zielen)', fr:'Argent libre par mois (après charges et objectifs)', es:'Dinero libre al mes (tras gastos y metas)', 'es-MX':'Dinero libre al mes (tras gastos y metas)', it:'Denaro libero al mese (dopo uscite e obiettivi)', pt:'Dinheiro livre por mês (após despesas e objetivos)', ar:'المال الحر شهريًا (بعد النفقات والأهداف)', hi:'मासिक मुक्त धन (खर्च और लक्ष्यों के बाद)', ja:'月の自由なお金（支出・目標の後）', ky:'Айлык эркин акча (чыгым жана максаттардан кийин)', 'zh-Hant':'每月自由資金（扣除支出與目標後）' },
  lf_need_profile: { bg:'Първо попълни профила — поне доход и работни часове.', ru:'Сначала заполните профиль — хотя бы доход и рабочие часы.', uk:'Спершу заповніть профіль — принаймні дохід і робочі години.', en:'Fill in the profile first — at least income and working hours.', de:'Fülle zuerst das Profil aus — mindestens Einkommen und Arbeitsstunden.', fr:'Remplissez d’abord le profil — au moins revenu et heures de travail.', es:'Primero rellena el perfil — al menos ingreso y horas de trabajo.', 'es-MX':'Primero llena el perfil — al menos ingreso y horas de trabajo.', it:'Compila prima il profilo — almeno reddito e ore di lavoro.', pt:'Preencha primeiro o perfil — pelo menos rendimento e horas de trabalho.', ar:'املأ الملف أولًا — الدخل وساعات العمل على الأقل.', hi:'पहले प्रोफ़ाइल भरें — कम से कम आय और कार्य घंटे।', ja:'まずプロフィールを入力 — 最低でも収入と労働時間。', ky:'Адегенде профилди толтур — жок дегенде киреше жана иш сааттары.', 'zh-Hant':'請先填寫個人資料 — 至少收入與工作時數。' },
  lf_price: { bg:'Цена', ru:'Цена', uk:'Ціна', en:'Price', de:'Preis', fr:'Prix', es:'Precio', 'es-MX':'Precio', it:'Prezzo', pt:'Preço', ar:'السعر', hi:'कीमत', ja:'価格', ky:'Баасы', 'zh-Hant':'價格' },
  lf_item: { bg:'Какво е (напр. кола, телефон)', ru:'Что это (напр. авто, телефон)', uk:'Що це (напр. авто, телефон)', en:'What is it (e.g. car, phone)', de:'Was ist es (z. B. Auto, Handy)', fr:'De quoi s’agit-il (ex. voiture, téléphone)', es:'Qué es (p. ej. coche, teléfono)', 'es-MX':'Qué es (p. ej. carro, teléfono)', it:'Cos’è (es. auto, telefono)', pt:'O que é (ex. carro, telemóvel)', ar:'ما هو (مثال: سيارة، هاتف)', hi:'क्या है (जैसे कार, फ़ोन)', ja:'何か（例：車、スマホ）', ky:'Эмне (мис. унаа, телефон)', 'zh-Hant':'是什麼（例如 汽車、手機）' },
  lf_scan: { bg:'📷 Снимай етикет / обява', ru:'📷 Снять ценник / объявление', uk:'📷 Зняти цінник / оголошення', en:'📷 Photograph a price tag / ad', de:'📷 Preisschild / Anzeige fotografieren', fr:'📷 Photographier une étiquette / annonce', es:'📷 Fotografiar etiqueta / anuncio', 'es-MX':'📷 Fotografiar etiqueta / anuncio', it:'📷 Fotografa cartellino / annuncio', pt:'📷 Fotografar etiqueta / anúncio', ar:'📷 صوّر بطاقة السعر / الإعلان', hi:'📷 मूल्य टैग / विज्ञापन की फ़ोटो लें', ja:'📷 値札／広告を撮影', ky:'📷 Баа жазуусун / жарнаманы тартуу', 'zh-Hant':'📷 拍攝價格標籤／廣告' },
  lf_scan_work: { bg:'Разпознавам сумите от снимката…', ru:'Распознаю суммы на снимке…', uk:'Розпізнаю суми на знімку…', en:'Recognizing amounts in the photo…', de:'Erkenne Beträge im Foto…', fr:'Reconnaissance des montants sur la photo…', es:'Reconociendo importes en la foto…', 'es-MX':'Reconociendo montos en la foto…', it:'Riconosco gli importi nella foto…', pt:'A reconhecer valores na foto…', ar:'جارٍ التعرف على المبالغ في الصورة…', hi:'फ़ोटो में राशियाँ पहचान रहा है…', ja:'写真の金額を認識中…', ky:'Сүрөттөгү суммаларды тааныйм…', 'zh-Hant':'正在辨識照片中的金額…' },
  lf_scan_pick: { bg:'Открити суми — избери цената:', ru:'Найденные суммы — выберите цену:', uk:'Знайдені суми — оберіть ціну:', en:'Amounts found — pick the price:', de:'Gefundene Beträge — wähle den Preis:', fr:'Montants trouvés — choisissez le prix :', es:'Importes encontrados — elige el precio:', 'es-MX':'Montos encontrados — elige el precio:', it:'Importi trovati — scegli il prezzo:', pt:'Valores encontrados — escolha o preço:', ar:'المبالغ المكتشفة — اختر السعر:', hi:'मिली राशियाँ — कीमत चुनें:', ja:'見つかった金額 — 価格を選択：', ky:'Табылган суммалар — баасын танда:', 'zh-Hant':'找到的金額 — 選擇價格：' },
  lf_scan_none: { bg:'Не открих цена на снимката — въведи я ръчно.', ru:'Цена на снимке не найдена — введите вручную.', uk:'Ціну на знімку не знайдено — введіть вручну.', en:'No price found in the photo — enter it manually.', de:'Kein Preis im Foto gefunden — bitte manuell eingeben.', fr:'Aucun prix trouvé sur la photo — saisissez-le manuellement.', es:'No se encontró precio en la foto — introdúcelo a mano.', 'es-MX':'No se encontró precio en la foto — escríbelo a mano.', it:'Nessun prezzo nella foto — inseriscilo a mano.', pt:'Sem preço na foto — introduza manualmente.', ar:'لم يُعثر على سعر في الصورة — أدخله يدويًا.', hi:'फ़ोटो में कीमत नहीं मिली — हाथ से दर्ज करें।', ja:'写真に価格が見つかりません — 手入力してください。', ky:'Сүрөттө баа табылган жок — кол менен киргиз.', 'zh-Hant':'照片中找不到價格 — 請手動輸入。' },
  lf_scan_offline: { bg:'Разпознаването тегли модула си от интернет веднъж при първо ползване. Сега няма връзка — въведи цената ръчно.', ru:'Распознавание один раз загружает модуль из интернета при первом использовании. Сейчас нет связи — введите цену вручную.', uk:'Розпізнавання один раз завантажує модуль з інтернету при першому використанні. Зараз немає зв’язку — введіть ціну вручну.', en:'Recognition downloads its module from the internet once, on first use. No connection now — enter the price manually.', de:'Die Erkennung lädt ihr Modul einmalig bei der ersten Nutzung. Keine Verbindung — bitte Preis manuell eingeben.', fr:'La reconnaissance télécharge son module une seule fois à la première utilisation. Pas de connexion — saisissez le prix manuellement.', es:'El reconocimiento descarga su módulo una vez, al primer uso. Sin conexión ahora — introduce el precio a mano.', 'es-MX':'El reconocimiento descarga su módulo una vez, al primer uso. Sin conexión ahora — escribe el precio a mano.', it:'Il riconoscimento scarica il modulo una sola volta al primo uso. Nessuna connessione — inserisci il prezzo a mano.', pt:'O reconhecimento descarrega o módulo uma vez, no primeiro uso. Sem ligação agora — introduza o preço manualmente.', ar:'يُحمّل التعرف وحدته مرة واحدة عند أول استخدام. لا اتصال الآن — أدخل السعر يدويًا.', hi:'पहचान पहली बार एक बार मॉड्यूल डाउनलोड करती है। अभी कनेक्शन नहीं — कीमत हाथ से दर्ज करें।', ja:'認識モジュールは初回のみダウンロードします。接続なし — 価格を手入力してください。', ky:'Таануу модулун биринчи колдонгондо бир жолу жүктөйт. Азыр байланыш жок — баасын кол менен киргиз.', 'zh-Hant':'辨識模組僅在首次使用時下載一次。目前無連線 — 請手動輸入價格。' },
  lf_analyze: { bg:'Изчисли стойността в живот', ru:'Посчитать стоимость в жизни', uk:'Порахувати вартість у житті', en:'Calculate the cost in life', de:'Preis in Lebenszeit berechnen', fr:'Calculer le coût en vie', es:'Calcular el coste en vida', 'es-MX':'Calcular el costo en vida', it:'Calcola il costo in vita', pt:'Calcular o custo em vida', ar:'احسب الثمن من حياتك', hi:'जीवन में लागत निकालें', ja:'人生換算のコストを計算', ky:'Өмүрдөгү баасын эсепте', 'zh-Hant':'計算生命成本' },
  lf_costs_you: { bg:'{0} ти струва', ru:'{0} стоит вам', uk:'{0} коштує вам', en:'{0} costs you', de:'{0} kostet dich', fr:'{0} vous coûte', es:'{0} te cuesta', 'es-MX':'{0} te cuesta', it:'{0} ti costa', pt:'{0} custa-lhe', ar:'{0} يكلّفك', hi:'{0} की कीमत आपके लिए', ja:'{0} のコスト', ky:'{0} сага турат', 'zh-Hant':'{0} 花費你' },
  lf_r_hours: { bg:'работни часа', ru:'рабочих часов', uk:'робочих годин', en:'working hours', de:'Arbeitsstunden', fr:'heures de travail', es:'horas de trabajo', 'es-MX':'horas de trabajo', it:'ore di lavoro', pt:'horas de trabalho', ar:'ساعة عمل', hi:'कार्य घंटे', ja:'労働時間', ky:'иш сааты', 'zh-Hant':'工作小時' },
  lf_r_days: { bg:'работни дни (по {0} ч)', ru:'рабочих дней (по {0} ч)', uk:'робочих днів (по {0} год)', en:'working days ({0} h each)', de:'Arbeitstage (je {0} Std.)', fr:'jours de travail ({0} h chacun)', es:'días de trabajo ({0} h cada uno)', 'es-MX':'días de trabajo ({0} h cada uno)', it:'giorni di lavoro ({0} h ciascuno)', pt:'dias de trabalho ({0} h cada)', ar:'يوم عمل ({0} ساعة لكل يوم)', hi:'कार्य दिवस (प्रत्येक {0} घं)', ja:'労働日（各 {0} 時間）', ky:'иш күнү ({0} сааттан)', 'zh-Hant':'工作天（每天 {0} 小時）' },
  lf_r_calendar: { bg:'цели заплати (месеца доход)', ru:'полных зарплат (месяцев дохода)', uk:'повних зарплат (місяців доходу)', en:'full salaries (months of income)', de:'volle Gehälter (Monate Einkommen)', fr:'salaires entiers (mois de revenu)', es:'sueldos completos (meses de ingreso)', 'es-MX':'sueldos completos (meses de ingreso)', it:'stipendi interi (mesi di reddito)', pt:'salários inteiros (meses de rendimento)', ar:'رواتب كاملة (أشهر دخل)', hi:'पूरे वेतन (आय के महीने)', ja:'月給（収入の月数）', ky:'толук айлык (киреше айлары)', 'zh-Hant':'整份薪水（收入月數）' },
  lf_r_payoff: { bg:'Ще я изплатиш от свободните пари след', ru:'Выплатите из свободных денег через', uk:'Виплатите з вільних грошей через', en:'Paid off from free money in', de:'Aus freiem Geld abbezahlt in', fr:'Remboursé avec l’argent libre dans', es:'Pagado con el dinero libre en', 'es-MX':'Pagado con el dinero libre en', it:'Ripagato con il denaro libero tra', pt:'Pago com o dinheiro livre em', ar:'تسدده من المال الحر خلال', hi:'मुक्त धन से चुकता होगा', ja:'自由なお金で払い終えるまで', ky:'Эркин акчадан төлөп бүтөсүң', 'zh-Hant':'用自由資金付清需要' },
  lf_r_payoff_ng: { bg:'…ако спреш да заделяш за целите — след', ru:'…если перестать откладывать на цели — через', uk:'…якщо припинити відкладати на цілі — через', en:'…if you pause saving for goals — in', de:'…wenn du das Sparen für Ziele pausierst — in', fr:'…si vous suspendez l’épargne des objectifs — dans', es:'…si dejas de apartar para las metas — en', 'es-MX':'…si dejas de apartar para las metas — en', it:'…se sospendi il risparmio per gli obiettivi — tra', pt:'…se parar de poupar para os objetivos — em', ar:'…إن أوقفت الادخار للأهداف — خلال', hi:'…यदि लक्ष्यों की बचत रोक दें — तो', ja:'…目標の積立を止めれば', ky:'…максаттарга бөлбөй турсаң — ', 'zh-Hant':'…若暫停目標存款 — 需要' },
  lf_never: { bg:'никога при сегашния бюджет', ru:'никогда при нынешнем бюджете', uk:'ніколи за нинішнього бюджету', en:'never with the current budget', de:'nie mit dem aktuellen Budget', fr:'jamais avec le budget actuel', es:'nunca con el presupuesto actual', 'es-MX':'nunca con el presupuesto actual', it:'mai con il bilancio attuale', pt:'nunca com o orçamento atual', ar:'أبدًا بالميزانية الحالية', hi:'वर्तमान बजट में कभी नहीं', ja:'今の予算では不可能', ky:'азыркы бюджет менен эч качан', 'zh-Hant':'以目前預算永遠無法' },
  lf_r_lifedays: { bg:'дни от живота ти (по дневен доход)', ru:'дней вашей жизни (по дневному доходу)', uk:'днів вашого життя (за денним доходом)', en:'days of your life (by daily income)', de:'Tage deines Lebens (nach Tageseinkommen)', fr:'jours de votre vie (selon le revenu quotidien)', es:'días de tu vida (por ingreso diario)', 'es-MX':'días de tu vida (por ingreso diario)', it:'giorni della tua vita (per reddito giornaliero)', pt:'dias da sua vida (por rendimento diário)', ar:'يومًا من حياتك (حسب الدخل اليومي)', hi:'आपके जीवन के दिन (दैनिक आय से)', ja:'人生の日数（1日の収入換算）', ky:'өмүрүңдүн күнү (күндүк киреше боюнча)', 'zh-Hant':'你生命中的天數（依日收入）' },
  lf_r_nights: { bg:'нощи сън, докато я изработиш', ru:'ночей сна, пока её заработаете', uk:'ночей сну, поки її заробите', en:'nights of sleep while you earn it', de:'Nächte Schlaf, bis du es verdient hast', fr:'nuits de sommeil le temps de la gagner', es:'noches de sueño mientras lo ganas', 'es-MX':'noches de sueño mientras lo ganas', it:'notti di sonno mentre lo guadagni', pt:'noites de sono enquanto o ganha', ar:'ليلة نوم حتى تكسبه', hi:'नींद की रातें जब तक आप इसे कमाते हैं', ja:'稼ぐ間に眠る夜の数', ky:'аны иштеп тапканча уктаган түндөр', 'zh-Hant':'賺到它之前的睡眠夜數' },
  lf_r_worklife: { bg:'от оставащия ти работен живот', ru:'оставшейся рабочей жизни', uk:'решти вашого робочого життя', en:'of your remaining working life', de:'deines restlichen Arbeitslebens', fr:'de votre vie active restante', es:'de tu vida laboral restante', 'es-MX':'de tu vida laboral restante', it:'della tua vita lavorativa rimanente', pt:'da sua vida de trabalho restante', ar:'من حياتك العملية المتبقية', hi:'आपके शेष कार्य-जीवन का', ja:'残りの労働人生に占める割合', ky:'калган иш өмүрүңдөн', 'zh-Hant':'佔你剩餘工作人生' },
  lf_r_freelife: { bg:'от всички свободни пари до края на живота', ru:'всех свободных денег до конца жизни', uk:'усіх вільних грошей до кінця життя', en:'of all free money for the rest of your life', de:'allen freien Geldes bis ans Lebensende', fr:'de tout l’argent libre jusqu’à la fin de la vie', es:'de todo el dinero libre hasta el final de la vida', 'es-MX':'de todo el dinero libre hasta el final de la vida', it:'di tutto il denaro libero fino a fine vita', pt:'de todo o dinheiro livre até ao fim da vida', ar:'من كل المال الحر لبقية حياتك', hi:'जीवन भर के कुल मुक्त धन का', ja:'生涯の自由なお金に占める割合', ky:'өмүрдүн аягына чейинки бардык эркин акчадан', 'zh-Hant':'佔你餘生全部自由資金' },
  lf_r_networth: { bg:'от нетното ти имущество', ru:'вашего чистого имущества', uk:'вашого чистого майна', en:'of your net worth', de:'deines Nettovermögens', fr:'de votre patrimoine net', es:'de tu patrimonio neto', 'es-MX':'de tu patrimonio neto', it:'del tuo patrimonio netto', pt:'do seu património líquido', ar:'من صافي ثروتك', hi:'आपकी शुद्ध संपत्ति का', ja:'純資産に占める割合', ky:'таза мүлкүңдөн', 'zh-Hant':'佔你的淨資產' },
  lf_loan_q: { bg:'Ако е на кредит', ru:'Если в кредит', uk:'Якщо в кредит', en:'If bought on credit', de:'Bei Finanzierung', fr:'Si acheté à crédit', es:'Si es a crédito', 'es-MX':'Si es a crédito', it:'Se a credito', pt:'Se for a crédito', ar:'إذا كان بالتقسيط', hi:'यदि ऋण पर', ja:'ローンで買う場合', ky:'Насыяга болсо', 'zh-Hant':'若以貸款購買' },
  lf_loan_rate: { bg:'Лихва (% годишно)', ru:'Ставка (% в год)', uk:'Ставка (% на рік)', en:'Rate (% per year)', de:'Zins (% pro Jahr)', fr:'Taux (% par an)', es:'Tasa (% anual)', 'es-MX':'Tasa (% anual)', it:'Tasso (% annuo)', pt:'Taxa (% ao ano)', ar:'الفائدة (% سنويًا)', hi:'ब्याज (% प्रति वर्ष)', ja:'金利（年 %）', ky:'Пайыз (% жылына)', 'zh-Hant':'利率（年 %）' },
  lf_loan_years: { bg:'Срок (години; 0 = без кредит)', ru:'Срок (лет; 0 = без кредита)', uk:'Термін (років; 0 = без кредиту)', en:'Term (years; 0 = no loan)', de:'Laufzeit (Jahre; 0 = kein Kredit)', fr:'Durée (années ; 0 = sans crédit)', es:'Plazo (años; 0 = sin crédito)', 'es-MX':'Plazo (años; 0 = sin crédito)', it:'Durata (anni; 0 = senza credito)', pt:'Prazo (anos; 0 = sem crédito)', ar:'المدة (سنوات؛ 0 = بلا قرض)', hi:'अवधि (वर्ष; 0 = ऋण नहीं)', ja:'期間（年；0 = ローンなし）', ky:'Мөөнөт (жыл; 0 = насыясыз)', 'zh-Hant':'期限（年；0 = 不貸款）' },
  lf_r_loan_pay: { bg:'Месечна вноска', ru:'Ежемесячный платёж', uk:'Щомісячний платіж', en:'Monthly payment', de:'Monatsrate', fr:'Mensualité', es:'Cuota mensual', 'es-MX':'Pago mensual', it:'Rata mensile', pt:'Prestação mensal', ar:'القسط الشهري', hi:'मासिक किस्त', ja:'月々の支払い', ky:'Айлык төлөм', 'zh-Hant':'每月還款' },
  lf_r_loan_int: { bg:'Лихва общо — още {0} работни часа', ru:'Проценты всего — ещё {0} рабочих часов', uk:'Відсотки разом — ще {0} робочих годин', en:'Total interest — {0} more working hours', de:'Zinsen gesamt — {0} weitere Arbeitsstunden', fr:'Intérêts totaux — {0} heures de travail de plus', es:'Intereses totales — {0} horas de trabajo más', 'es-MX':'Intereses totales — {0} horas de trabajo más', it:'Interessi totali — altre {0} ore di lavoro', pt:'Juros totais — mais {0} horas de trabalho', ar:'إجمالي الفائدة — {0} ساعة عمل إضافية', hi:'कुल ब्याज — {0} और कार्य घंटे', ja:'利息合計 — さらに {0} 労働時間', ky:'Жалпы пайыз — дагы {0} иш сааты', 'zh-Hant':'總利息 — 再多 {0} 工作小時' },
  lf_goals_effect: { bg:'Ефект върху целите', ru:'Влияние на цели', uk:'Вплив на цілі', en:'Effect on your goals', de:'Wirkung auf deine Ziele', fr:'Effet sur vos objectifs', es:'Efecto en tus metas', 'es-MX':'Efecto en tus metas', it:'Effetto sui tuoi obiettivi', pt:'Efeito nos seus objetivos', ar:'الأثر على أهدافك', hi:'आपके लक्ष्यों पर असर', ja:'目標への影響', ky:'Максаттарга таасири', 'zh-Hant':'對目標的影響' },
  lf_goal_delay: { bg:'„{0}": закъснява с {1} ({2} → {3})', ru:'«{0}»: сдвиг на {1} ({2} → {3})', uk:'«{0}»: зсув на {1} ({2} → {3})', en:'“{0}”: delayed by {1} ({2} → {3})', de:'„{0}“: verzögert um {1} ({2} → {3})', fr:'« {0} » : retardé de {1} ({2} → {3})', es:'«{0}»: se retrasa {1} ({2} → {3})', 'es-MX':'«{0}»: se retrasa {1} ({2} → {3})', it:'«{0}»: ritardo di {1} ({2} → {3})', pt:'«{0}»: atrasa {1} ({2} → {3})', ar:'«{0}»: يتأخر {1} ({2} → {3})', hi:'“{0}”: {1} की देरी ({2} → {3})', ja:'「{0}」：{1} 遅れ（{2} → {3}）', ky:'«{0}»: {1} кечигет ({2} → {3})', 'zh-Hant':'「{0}」：延後 {1}（{2} → {3}）' },
  lf_goal_nodelay: { bg:'„{0}": без промяна (не заделяш месечно)', ru:'«{0}»: без изменений (нет ежемесячных отчислений)', uk:'«{0}»: без змін (немає щомісячних відкладень)', en:'“{0}”: unchanged (nothing set aside monthly)', de:'„{0}“: unverändert (keine monatliche Rücklage)', fr:'« {0} » : inchangé (pas d’épargne mensuelle)', es:'«{0}»: sin cambio (no apartas al mes)', 'es-MX':'«{0}»: sin cambio (no apartas al mes)', it:'«{0}»: invariato (nessun risparmio mensile)', pt:'«{0}»: sem alteração (nada de lado por mês)', ar:'«{0}»: بلا تغيير (لا ادخار شهري)', hi:'“{0}”: कोई बदलाव नहीं (मासिक बचत नहीं)', ja:'「{0}」：変化なし（月々の積立なし）', ky:'«{0}»: өзгөрүүсүз (айына бөлбөйсүң)', 'zh-Hant':'「{0}」：不變（無每月存入）' },
  lf_runway_effect: { bg:'Ефект върху запаса', ru:'Влияние на запас', uk:'Вплив на запас', en:'Effect on your runway', de:'Wirkung auf deine Reserve', fr:'Effet sur votre réserve', es:'Efecto en tu reserva', 'es-MX':'Efecto en tu reserva', it:'Effetto sulla tua riserva', pt:'Efeito na sua reserva', ar:'الأثر على احتياطك', hi:'आपके रिज़र्व पर असर', ja:'蓄えへの影響', ky:'Запаска таасири', 'zh-Hant':'對儲備的影響' },
  lf_runway_before: { bg:'Без работа издържаш сега', ru:'Без работы продержитесь сейчас', uk:'Без роботи протримаєтесь зараз', en:'Without work you last now', de:'Ohne Arbeit reicht es jetzt', fr:'Sans travail vous tenez maintenant', es:'Sin trabajo aguantas ahora', 'es-MX':'Sin trabajo aguantas ahora', it:'Senza lavoro resisti ora', pt:'Sem trabalho aguenta agora', ar:'بلا عمل تصمد الآن', hi:'बिना काम अभी टिक सकते हैं', ja:'働かずに今もつ期間', ky:'Ишсиз азыр чыдайсың', 'zh-Hant':'不工作目前可撐' },
  lf_runway_after: { bg:'…след покупката', ru:'…после покупки', uk:'…після покупки', en:'…after the purchase', de:'…nach dem Kauf', fr:'…après l’achat', es:'…tras la compra', 'es-MX':'…tras la compra', it:'…dopo l’acquisto', pt:'…após a compra', ar:'…بعد الشراء', hi:'…खरीद के बाद', ja:'…購入後', ky:'…сатып алгандан кийин', 'zh-Hant':'…購買後' },
  lf_y: { bg:'{0} г.', ru:'{0} г.', uk:'{0} р.', en:'{0} yr', de:'{0} J.', fr:'{0} an(s)', es:'{0} año(s)', 'es-MX':'{0} año(s)', it:'{0} anno/i', pt:'{0} ano(s)', ar:'{0} سنة', hi:'{0} वर्ष', ja:'{0} 年', ky:'{0} ж.', 'zh-Hant':'{0} 年' },
  lf_m: { bg:'{0} мес.', ru:'{0} мес.', uk:'{0} міс.', en:'{0} mo', de:'{0} Mon.', fr:'{0} mois', es:'{0} mes(es)', 'es-MX':'{0} mes(es)', it:'{0} mese/i', pt:'{0} mês/meses', ar:'{0} شهر', hi:'{0} माह', ja:'{0} か月', ky:'{0} ай', 'zh-Hant':'{0} 個月' },
  lf_ym: { bg:'{0} г. {1} мес.', ru:'{0} г. {1} мес.', uk:'{0} р. {1} міс.', en:'{0} yr {1} mo', de:'{0} J. {1} Mon.', fr:'{0} an(s) {1} mois', es:'{0} año(s) {1} mes(es)', 'es-MX':'{0} año(s) {1} mes(es)', it:'{0} anno/i {1} mese/i', pt:'{0} ano(s) {1} mês/meses', ar:'{0} سنة {1} شهر', hi:'{0} वर्ष {1} माह', ja:'{0} 年 {1} か月', ky:'{0} ж. {1} ай', 'zh-Hant':'{0} 年 {1} 個月' },
  lf_d: { bg:'{0} дни', ru:'{0} дн.', uk:'{0} дн.', en:'{0} days', de:'{0} Tage', fr:'{0} jours', es:'{0} días', 'es-MX':'{0} días', it:'{0} giorni', pt:'{0} dias', ar:'{0} يومًا', hi:'{0} दिन', ja:'{0} 日', ky:'{0} күн', 'zh-Hant':'{0} 天' },
  lf_h: { bg:'{0} ч', ru:'{0} ч', uk:'{0} год', en:'{0} h', de:'{0} Std.', fr:'{0} h', es:'{0} h', 'es-MX':'{0} h', it:'{0} h', pt:'{0} h', ar:'{0} ساعة', hi:'{0} घं', ja:'{0} 時間', ky:'{0} с', 'zh-Hant':'{0} 小時' },
  lf_verdict_light: { bg:'Лека покупка — под един месец свободни пари.', ru:'Лёгкая покупка — меньше месяца свободных денег.', uk:'Легка покупка — менше місяця вільних грошей.', en:'Light purchase — under one month of free money.', de:'Leichter Kauf — weniger als ein Monat freies Geld.', fr:'Achat léger — moins d’un mois d’argent libre.', es:'Compra ligera — menos de un mes de dinero libre.', 'es-MX':'Compra ligera — menos de un mes de dinero libre.', it:'Acquisto leggero — meno di un mese di denaro libero.', pt:'Compra leve — menos de um mês de dinheiro livre.', ar:'شراء خفيف — أقل من شهر من المال الحر.', hi:'हल्की खरीद — एक महीने से कम मुक्त धन।', ja:'軽い買い物 — 自由なお金1か月分未満。', ky:'Жеңил сатып алуу — бир айлык эркин акчадан аз.', 'zh-Hant':'輕鬆購買 — 少於一個月的自由資金。' },
  lf_verdict_mid: { bg:'Средна покупка — до шест месеца свободни пари.', ru:'Средняя покупка — до шести месяцев свободных денег.', uk:'Середня покупка — до шести місяців вільних грошей.', en:'Medium purchase — up to six months of free money.', de:'Mittlerer Kauf — bis zu sechs Monate freies Geld.', fr:'Achat moyen — jusqu’à six mois d’argent libre.', es:'Compra media — hasta seis meses de dinero libre.', 'es-MX':'Compra media — hasta seis meses de dinero libre.', it:'Acquisto medio — fino a sei mesi di denaro libero.', pt:'Compra média — até seis meses de dinheiro livre.', ar:'شراء متوسط — حتى ستة أشهر من المال الحر.', hi:'मध्यम खरीद — छह महीने तक का मुक्त धन।', ja:'中程度の買い物 — 自由なお金6か月分まで。', ky:'Орточо сатып алуу — алты айга чейинки эркин акча.', 'zh-Hant':'中等購買 — 最多六個月的自由資金。' },
  lf_verdict_heavy: { bg:'Тежка покупка — над шест месеца свободни пари. Помисли дали си струва часовете.', ru:'Тяжёлая покупка — больше шести месяцев свободных денег. Подумайте, стоит ли она этих часов.', uk:'Важка покупка — понад шість місяців вільних грошей. Подумайте, чи варта вона цих годин.', en:'Heavy purchase — over six months of free money. Think whether it is worth the hours.', de:'Schwerer Kauf — über sechs Monate freies Geld. Überlege, ob er die Stunden wert ist.', fr:'Achat lourd — plus de six mois d’argent libre. Demandez-vous s’il vaut ces heures.', es:'Compra pesada — más de seis meses de dinero libre. Piensa si vale esas horas.', 'es-MX':'Compra pesada — más de seis meses de dinero libre. Piensa si vale esas horas.', it:'Acquisto pesante — oltre sei mesi di denaro libero. Pensa se vale quelle ore.', pt:'Compra pesada — mais de seis meses de dinheiro livre. Pense se vale essas horas.', ar:'شراء ثقيل — أكثر من ستة أشهر من المال الحر. فكّر إن كان يستحق تلك الساعات.', hi:'भारी खरीद — छह महीने से अधिक मुक्त धन। सोचें कि क्या यह उन घंटों के लायक है।', ja:'重い買い物 — 自由なお金6か月分超。その時間に見合うか考えて。', ky:'Оор сатып алуу — алты айдан ашык эркин акча. Ошол сааттарга арзыйбы, ойлон.', 'zh-Hant':'沉重購買 — 超過六個月的自由資金。想想是否值得這些時數。' },
  lf_save_hist: { bg:'💾 Запази в историята', ru:'💾 Сохранить в историю', uk:'💾 Зберегти в історію', en:'💾 Save to history', de:'💾 Im Verlauf speichern', fr:'💾 Enregistrer dans l’historique', es:'💾 Guardar en el historial', 'es-MX':'💾 Guardar en el historial', it:'💾 Salva nello storico', pt:'💾 Guardar no histórico', ar:'💾 حفظ في السجل', hi:'💾 इतिहास में सहेजें', ja:'💾 履歴に保存', ky:'💾 Тарыхка сактоо', 'zh-Hant':'💾 儲存到歷史' },
  lf_saved: { bg:'Записано в историята.', ru:'Сохранено в историю.', uk:'Збережено в історію.', en:'Saved to history.', de:'Im Verlauf gespeichert.', fr:'Enregistré dans l’historique.', es:'Guardado en el historial.', 'es-MX':'Guardado en el historial.', it:'Salvato nello storico.', pt:'Guardado no histórico.', ar:'تم الحفظ في السجل.', hi:'इतिहास में सहेजा गया।', ja:'履歴に保存しました。', ky:'Тарыхка сакталды.', 'zh-Hant':'已儲存到歷史。' },
  lf_time_title: { bg:'Оставащото ми време (ориентировъчно)', ru:'Моё оставшееся время (ориентировочно)', uk:'Мій залишок часу (орієнтовно)', en:'My remaining time (estimate)', de:'Meine verbleibende Zeit (Schätzung)', fr:'Mon temps restant (estimation)', es:'Mi tiempo restante (estimación)', 'es-MX':'Mi tiempo restante (estimación)', it:'Il mio tempo rimanente (stima)', pt:'O meu tempo restante (estimativa)', ar:'وقتي المتبقي (تقديري)', hi:'मेरा शेष समय (अनुमान)', ja:'残り時間（推定）', ky:'Калган убактым (болжолдуу)', 'zh-Hant':'我的剩餘時間（估計）' },
  lf_t_years_left: { bg:'Оставащи години (до {0} г. възраст)', ru:'Осталось лет (до {0} лет)', uk:'Залишилось років (до {0} років)', en:'Years left (to age {0})', de:'Verbleibende Jahre (bis Alter {0})', fr:'Années restantes (jusqu’à {0} ans)', es:'Años restantes (hasta los {0})', 'es-MX':'Años restantes (hasta los {0})', it:'Anni rimanenti (fino a {0} anni)', pt:'Anos restantes (até aos {0})', ar:'السنوات المتبقية (حتى سن {0})', hi:'शेष वर्ष ({0} की उम्र तक)', ja:'残りの年数（{0} 歳まで）', ky:'Калган жылдар ({0} жашка чейин)', 'zh-Hant':'剩餘年數（至 {0} 歲）' },
  lf_t_awake: { bg:'Будни часове до края', ru:'Часов бодрствования до конца', uk:'Годин неспання до кінця', en:'Waking hours left', de:'Wache Stunden bis zum Ende', fr:'Heures d’éveil restantes', es:'Horas despierto restantes', 'es-MX':'Horas despierto restantes', it:'Ore da sveglio rimanenti', pt:'Horas acordado restantes', ar:'ساعات اليقظة المتبقية', hi:'शेष जागृत घंटे', ja:'残りの起きている時間', ky:'Аягына чейин ойгоо сааттар', 'zh-Hant':'剩餘清醒時數' },
  lf_t_work: { bg:'Работни часове до спиране на работа', ru:'Рабочих часов до прекращения работы', uk:'Робочих годин до припинення роботи', en:'Working hours until you stop working', de:'Arbeitsstunden bis zum Aufhören', fr:'Heures de travail jusqu’à l’arrêt', es:'Horas de trabajo hasta dejar de trabajar', 'es-MX':'Horas de trabajo hasta dejar de trabajar', it:'Ore di lavoro fino allo stop', pt:'Horas de trabalho até parar', ar:'ساعات العمل حتى التوقف', hi:'काम रोकने तक कार्य घंटे', ja:'働くのをやめるまでの労働時間', ky:'Иштебей калганга чейинки иш сааттары', 'zh-Hant':'停止工作前的工作時數' },
  lf_t_split: { bg:'Дял от оставащия живот: сън / работа / свободно', ru:'Доля оставшейся жизни: сон / работа / свободное', uk:'Частка решти життя: сон / робота / вільне', en:'Share of remaining life: sleep / work / free', de:'Anteil des Restlebens: Schlaf / Arbeit / frei', fr:'Part de la vie restante : sommeil / travail / libre', es:'Parte de la vida restante: sueño / trabajo / libre', 'es-MX':'Parte de la vida restante: sueño / trabajo / libre', it:'Quota della vita rimanente: sonno / lavoro / libero', pt:'Parte da vida restante: sono / trabalho / livre', ar:'حصة ما تبقى من الحياة: نوم / عمل / حر', hi:'शेष जीवन का हिस्सा: नींद / काम / मुक्त', ja:'残りの人生の内訳：睡眠／労働／自由', ky:'Калган өмүрдүн үлүшү: уйку / иш / бош', 'zh-Hant':'剩餘人生佔比：睡眠／工作／自由' },
  lf_t_runway: { bg:'Без работа парите стигат за', ru:'Без работы денег хватит на', uk:'Без роботи грошей вистачить на', en:'Without work the money lasts', de:'Ohne Arbeit reicht das Geld', fr:'Sans travail l’argent dure', es:'Sin trabajo el dinero dura', 'es-MX':'Sin trabajo el dinero dura', it:'Senza lavoro i soldi durano', pt:'Sem trabalho o dinheiro dura', ar:'بلا عمل يكفي المال لمدة', hi:'बिना काम पैसा चलेगा', ja:'働かずにお金がもつ期間', ky:'Ишсиз акча жетет', 'zh-Hant':'不工作時錢可撐' },
  lf_t_runway_all: { bg:'…ако продадеш и цялото имущество', ru:'…если продать и всё имущество', uk:'…якщо продати й усе майно', en:'…if you also sell all property', de:'…wenn du auch alles Vermögen verkaufst', fr:'…si vous vendez aussi tous vos biens', es:'…si además vendes todos los bienes', 'es-MX':'…si además vendes todos los bienes', it:'…se vendi anche tutti i beni', pt:'…se vender também todos os bens', ar:'…إن بعت كل الممتلكات أيضًا', hi:'…यदि सारी संपत्ति भी बेच दें', ja:'…全財産も売れば', ky:'…бүт мүлктү да сатсаң', 'zh-Hant':'…若也賣掉全部財產' },
  lf_forever: { bg:'до края на живота', ru:'до конца жизни', uk:'до кінця життя', en:'for the rest of your life', de:'bis ans Lebensende', fr:'jusqu’à la fin de la vie', es:'hasta el final de la vida', 'es-MX':'hasta el final de la vida', it:'fino a fine vita', pt:'até ao fim da vida', ar:'لبقية حياتك', hi:'जीवन भर', ja:'生涯にわたって', ky:'өмүрдүн аягына чейин', 'zh-Hant':'直到生命結束' },
  lf_sc_title: { bg:'Сценарии', ru:'Сценарии', uk:'Сценарії', en:'Scenarios', de:'Szenarien', fr:'Scénarios', es:'Escenarios', 'es-MX':'Escenarios', it:'Scenari', pt:'Cenários', ar:'سيناريوهات', hi:'परिदृश्य', ja:'シナリオ', ky:'Сценарийлер', 'zh-Hant':'情境' },
  lf_sc_stop: { bg:'Спирам работа след (години)', ru:'Прекращаю работать через (лет)', uk:'Припиняю працювати через (років)', en:'I stop working in (years)', de:'Ich höre auf in (Jahren)', fr:'J’arrête de travailler dans (années)', es:'Dejo de trabajar en (años)', 'es-MX':'Dejo de trabajar en (años)', it:'Smetto di lavorare tra (anni)', pt:'Paro de trabalhar em (anos)', ar:'أتوقف عن العمل بعد (سنوات)', hi:'काम रोकूँगा (वर्षों में)', ja:'働くのをやめる時期（年後）', ky:'Иштебей калам (жылдан кийин)', 'zh-Hant':'幾年後停止工作' },
  lf_sc_buy: { bg:'Купувам нещо за (цена)', ru:'Покупаю что-то за (цена)', uk:'Купую щось за (ціна)', en:'I buy something for (price)', de:'Ich kaufe etwas für (Preis)', fr:'J’achète quelque chose pour (prix)', es:'Compro algo por (precio)', 'es-MX':'Compro algo por (precio)', it:'Compro qualcosa per (prezzo)', pt:'Compro algo por (preço)', ar:'أشتري شيئًا بسعر', hi:'कुछ खरीदता हूँ (कीमत)', ja:'何かを買う（価格）', ky:'Бир нерсе сатып алам (баасы)', 'zh-Hant':'購買某物（價格）' },
  lf_sc_sell: { bg:'Броя и имуществото (продажба)', ru:'Считать и имущество (продажа)', uk:'Рахувати й майно (продаж)', en:'Count property too (sale)', de:'Vermögen mitzählen (Verkauf)', fr:'Compter aussi les biens (vente)', es:'Contar también los bienes (venta)', 'es-MX':'Contar también los bienes (venta)', it:'Conta anche i beni (vendita)', pt:'Contar também os bens (venda)', ar:'احسب الممتلكات أيضًا (بيع)', hi:'संपत्ति भी गिनें (बिक्री)', ja:'財産も含める（売却）', ky:'Мүлктү да эсепте (сатуу)', 'zh-Hant':'也計入財產（出售）' },
  lf_sc_a: { bg:'Работя до {0} г.', ru:'Работаю до {0} лет', uk:'Працюю до {0} років', en:'Working until age {0}', de:'Arbeiten bis Alter {0}', fr:'Travail jusqu’à {0} ans', es:'Trabajo hasta los {0}', 'es-MX':'Trabajo hasta los {0}', it:'Lavoro fino a {0} anni', pt:'Trabalho até aos {0}', ar:'أعمل حتى سن {0}', hi:'{0} की उम्र तक काम', ja:'{0} 歳まで働く', ky:'{0} жашка чейин иштейм', 'zh-Hant':'工作到 {0} 歲' },
  lf_sc_b: { bg:'Спирам след {0}', ru:'Прекращаю через {0}', uk:'Припиняю через {0}', en:'Stop in {0}', de:'Aufhören in {0}', fr:'Arrêt dans {0}', es:'Paro en {0}', 'es-MX':'Paro en {0}', it:'Smetto tra {0}', pt:'Paro em {0}', ar:'أتوقف بعد {0}', hi:'{0} में रुकूँगा', ja:'{0} 後にやめる', ky:'{0} кийин токтойм', 'zh-Hant':'{0} 後停止' },
  lf_sc_c: { bg:'Спирам след {0} + покупка', ru:'Прекращаю через {0} + покупка', uk:'Припиняю через {0} + покупка', en:'Stop in {0} + purchase', de:'Aufhören in {0} + Kauf', fr:'Arrêt dans {0} + achat', es:'Paro en {0} + compra', 'es-MX':'Paro en {0} + compra', it:'Smetto tra {0} + acquisto', pt:'Paro em {0} + compra', ar:'أتوقف بعد {0} + شراء', hi:'{0} में रुकूँगा + खरीद', ja:'{0} 後にやめる＋購入', ky:'{0} кийин токтойм + сатып алуу', 'zh-Hant':'{0} 後停止＋購買' },
  lf_sc_out: { bg:'парите свършват на {0} г. възраст ({1})', ru:'деньги закончатся в {0} лет ({1})', uk:'гроші закінчаться у {0} років ({1})', en:'money runs out at age {0} ({1})', de:'Geld ist mit {0} Jahren aufgebraucht ({1})', fr:'l’argent s’épuise à {0} ans ({1})', es:'el dinero se acaba a los {0} ({1})', 'es-MX':'el dinero se acaba a los {0} ({1})', it:'i soldi finiscono a {0} anni ({1})', pt:'o dinheiro acaba aos {0} ({1})', ar:'ينفد المال في سن {0} ({1})', hi:'{0} की उम्र में पैसा खत्म ({1})', ja:'{0} 歳でお金が尽きる（{1}）', ky:'акча {0} жашта түгөнөт ({1})', 'zh-Hant':'{0} 歲時錢用完（{1}）' },
  lf_sc_ok: { bg:'стига до края; остават {0}', ru:'хватает до конца; остаётся {0}', uk:'вистачає до кінця; залишається {0}', en:'lasts to the end; {0} left', de:'reicht bis zum Ende; {0} übrig', fr:'suffit jusqu’à la fin ; il reste {0}', es:'alcanza hasta el final; quedan {0}', 'es-MX':'alcanza hasta el final; quedan {0}', it:'basta fino alla fine; restano {0}', pt:'chega até ao fim; sobram {0}', ar:'يكفي حتى النهاية؛ يتبقى {0}', hi:'अंत तक चलेगा; {0} बचेंगे', ja:'最後までもつ；残り {0}', ky:'аягына чейин жетет; {0} калат', 'zh-Hant':'撐到最後；剩餘 {0}' },
  lf_chart_note: { bg:'Пари срещу възраст до очаквания край на живота. Ориентировъчно: без инфлация и доходност; спестяванията за целите остават твои пари.', ru:'Деньги по возрасту до ожидаемого конца жизни. Ориентировочно: без инфляции и доходности; накопления на цели остаются вашими деньгами.', uk:'Гроші за віком до очікуваного кінця життя. Орієнтовно: без інфляції та дохідності; накопичення на цілі лишаються вашими грошима.', en:'Money by age until the expected end of life. Estimate only: no inflation or returns; goal savings remain your money.', de:'Geld nach Alter bis zum erwarteten Lebensende. Nur Schätzung: ohne Inflation und Rendite; Zielersparnisse bleiben dein Geld.', fr:'Argent selon l’âge jusqu’à la fin de vie attendue. Estimation : sans inflation ni rendement ; l’épargne des objectifs reste votre argent.', es:'Dinero por edad hasta el fin de vida esperado. Solo estimación: sin inflación ni rendimiento; el ahorro de metas sigue siendo tu dinero.', 'es-MX':'Dinero por edad hasta el fin de vida esperado. Solo estimación: sin inflación ni rendimiento; el ahorro de metas sigue siendo tu dinero.', it:'Denaro per età fino alla fine di vita attesa. Solo stima: senza inflazione né rendimento; i risparmi per gli obiettivi restano tuoi.', pt:'Dinheiro por idade até ao fim de vida esperado. Só estimativa: sem inflação nem rendimento; a poupança dos objetivos continua sua.', ar:'المال حسب العمر حتى نهاية الحياة المتوقعة. تقدير فقط: بلا تضخم أو عائد؛ مدخرات الأهداف تبقى مالك.', hi:'अपेक्षित जीवन-अंत तक उम्र के अनुसार पैसा। केवल अनुमान: मुद्रास्फीति/रिटर्न नहीं; लक्ष्य बचत आपका ही पैसा है।', ja:'想定寿命までの年齢別の資金。推定のみ：インフレ・運用益なし。目標の積立はあなたのお金のまま。', ky:'Күтүлгөн өмүр аягына чейин жаш боюнча акча. Болжолдуу: инфляциясыз, кирешесиз; максат үчүн топтолгон акча сеники бойдон калат.', 'zh-Hant':'依年齡至預期壽命終點的資金。僅為估計：不含通膨與報酬；目標存款仍是你的錢。' },
  lf_exp_note: { bg:'Очакваната продължителност е средна световна по възраст — само ориентир; смени я в профила.', ru:'Ожидаемая продолжительность — среднемировая по возрасту, только ориентир; измените её в профиле.', uk:'Очікувана тривалість — середньосвітова за віком, лише орієнтир; змініть її в профілі.', en:'Life expectancy is a world average by age — a guide only; change it in the profile.', de:'Die Lebenserwartung ist ein Weltdurchschnitt nach Alter — nur ein Anhaltspunkt; im Profil änderbar.', fr:'L’espérance de vie est une moyenne mondiale par âge — simple repère ; modifiez-la dans le profil.', es:'La esperanza de vida es una media mundial por edad — solo orientativa; cámbiala en el perfil.', 'es-MX':'La esperanza de vida es un promedio mundial por edad — solo orientativa; cámbiala en el perfil.', it:'L’aspettativa di vita è una media mondiale per età — solo indicativa; cambiala nel profilo.', pt:'A esperança de vida é uma média mundial por idade — apenas orientação; altere-a no perfil.', ar:'العمر المتوقع متوسط عالمي حسب العمر — للاسترشاد فقط؛ غيّره في الملف.', hi:'जीवन प्रत्याशा उम्र अनुसार विश्व औसत है — केवल संकेत; प्रोफ़ाइल में बदलें।', ja:'平均余命は年齢別の世界平均 — 目安のみ。プロフィールで変更可。', ky:'Күтүлгөн өмүр — жаш боюнча дүйнөлүк орточо, багыт гана; профилде өзгөрт.', 'zh-Hant':'預期壽命為依年齡的世界平均 — 僅供參考；可在個人資料中修改。' },
  lf_hist_empty: { bg:'Няма записани анализи. Направи първия в „Анализатор".', ru:'Сохранённых анализов нет. Сделайте первый в «Анализаторе».', uk:'Збережених аналізів немає. Зробіть перший в «Аналізаторі».', en:'No saved analyses. Make the first one in “Analyzer”.', de:'Keine gespeicherten Analysen. Erstelle die erste unter „Analyse“.', fr:'Aucune analyse enregistrée. Faites la première dans « Analyseur ».', es:'Sin análisis guardados. Haz el primero en «Analizador».', 'es-MX':'Sin análisis guardados. Haz el primero en «Analizador».', it:'Nessuna analisi salvata. Fai la prima in «Analizzatore».', pt:'Sem análises guardadas. Faça a primeira em «Analisador».', ar:'لا تحليلات محفوظة. أنشئ الأول في «المحلل».', hi:'कोई सहेजा विश्लेषण नहीं। पहला “विश्लेषक” में करें।', ja:'保存された分析はありません。「分析」で最初の分析を。', ky:'Сакталган анализ жок. Биринчисин «Анализаторда» жаса.', 'zh-Hant':'尚無已儲存的分析。請在「分析器」進行第一次。' },
  lf_clear_hist: { bg:'Изчисти историята', ru:'Очистить историю', uk:'Очистити історію', en:'Clear history', de:'Verlauf leeren', fr:'Vider l’historique', es:'Vaciar historial', 'es-MX':'Vaciar historial', it:'Svuota storico', pt:'Limpar histórico', ar:'مسح السجل', hi:'इतिहास साफ़ करें', ja:'履歴を消去', ky:'Тарыхты тазалоо', 'zh-Hant':'清除歷史' },
  lf_delete: { bg:'Изтрий', ru:'Удалить', uk:'Видалити', en:'Delete', de:'Löschen', fr:'Supprimer', es:'Eliminar', 'es-MX':'Eliminar', it:'Elimina', pt:'Eliminar', ar:'حذف', hi:'हटाएँ', ja:'削除', ky:'Өчүрүү', 'zh-Hant':'刪除' },
  lf_hist_line: { bg:'{0} работни часа · изплащане: {1}', ru:'{0} рабочих часов · выплата: {1}', uk:'{0} робочих годин · виплата: {1}', en:'{0} working hours · pay-off: {1}', de:'{0} Arbeitsstunden · abbezahlt: {1}', fr:'{0} heures de travail · remboursement : {1}', es:'{0} horas de trabajo · pago: {1}', 'es-MX':'{0} horas de trabajo · pago: {1}', it:'{0} ore di lavoro · rimborso: {1}', pt:'{0} horas de trabalho · pagamento: {1}', ar:'{0} ساعة عمل · السداد: {1}', hi:'{0} कार्य घंटे · चुकता: {1}', ja:'{0} 労働時間 · 完済：{1}', ky:'{0} иш сааты · төлөп бүтүү: {1}', 'zh-Hant':'{0} 工作小時 · 付清：{1}' },
  lf_networth: { bg:'Нетно имущество', ru:'Чистое имущество', uk:'Чисте майно', en:'Net worth', de:'Nettovermögen', fr:'Patrimoine net', es:'Patrimonio neto', 'es-MX':'Patrimonio neto', it:'Patrimonio netto', pt:'Património líquido', ar:'صافي الثروة', hi:'शुद्ध संपत्ति', ja:'純資産', ky:'Таза мүлк', 'zh-Hant':'淨資產' },
  lf_now: { bg:'сега', ru:'сейчас', uk:'зараз', en:'now', de:'jetzt', fr:'maintenant', es:'ahora', 'es-MX':'ahora', it:'ora', pt:'agora', ar:'الآن', hi:'अभी', ja:'今', ky:'азыр', 'zh-Hant':'現在' }
});

export const title = t('t_life_name');

// ── Хранилище (само localStorage) ────────────────────────────────────────────────
const LS_KEY = 'st_life_v1';
const EMPTY = () => ({ cur: '', age: 30, lifeExp: 0, income: 0, hoursWeek: 40, vacDays: 20, sleepH: 8, retireAge: 65, deps: 0, depCost: 0, expenses: 0, debtPay: 0, debtBal: 0, cash: 0, movable: 0, realty: 0, goals: [], hist: [] });
function load() { try { const d = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (d && typeof d === 'object') return Object.assign(EMPTY(), d); } catch (_) {} return EMPTY(); }
function save(d) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch (_) {} }
// Данни от другите инструменти (само четене) — „Личен бюджет" и „Планировчик".
function readLS(key) { try { const d = JSON.parse(localStorage.getItem(key) || 'null'); return d && typeof d === 'object' ? d : null; } catch (_) { return null; } }

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const isInf = (v) => !isFinite(v);
function money(n, cur) {
  let s; try { s = (isFinite(n) ? n : 0).toLocaleString(getLang(), { minimumFractionDigits: 0, maximumFractionDigits: 2 }); } catch (_) { s = (isFinite(n) ? n : 0).toFixed(2); }
  return cur ? s + ' ' + cur : s;
}
function fmtN(n, dec) { try { return (isFinite(n) ? n : 0).toLocaleString(getLang(), { maximumFractionDigits: dec == null ? 0 : dec }); } catch (_) { return (isFinite(n) ? n : 0).toFixed(dec || 0); } }
// Продължителност в месеци → „2 г. 3 мес." / „7 мес." / „никога"
function fmtDur(months) {
  if (isInf(months) || months < 0) return t('lf_never');
  const m = Math.round(months); if (m === 0) return t('lf_now');
  const y = Math.floor(m / 12), r = m % 12;
  if (y > 0 && r > 0) return tf('lf_ym', y, r);
  if (y > 0) return tf('lf_y', y);
  return tf('lf_m', r);
}
const pct = (v) => isFinite(v) ? fmtN(v, v < 10 ? 1 : 0) + ' %' : '—';

// Средна оставаща продължителност на живота по възраст (световна, двата пола) — САМО ориентир.
const LIFE_TABLE = [[0, 73], [10, 64], [20, 54], [30, 45], [40, 36], [50, 27], [60, 19], [70, 12], [80, 7], [90, 4], [100, 2]];
function expectancy(age) {
  const a = Math.max(0, Math.min(100, age));
  for (let i = 1; i < LIFE_TABLE.length; i++) {
    const [a0, r0] = LIFE_TABLE[i - 1], [a1, r1] = LIFE_TABLE[i];
    if (a <= a1) return Math.round((a + r0 + (r1 - r0) * (a - a0) / (a1 - a0)) * 10) / 10;
  }
  return a + 2;
}

// ── Модел: производни величини от профила ─────────────────────────────────────────
function model(P) {
  const weeks = Math.max(0, 52 - P.vacDays / 5);           // работни седмици в годината
  const workHM = P.hoursWeek * weeks / 12;                  // работни часове на месец
  const hourly = workHM > 0 ? P.income / workHM : 0;        // печалба на работен час
  const out = P.expenses + P.depCost + P.debtPay;           // задължителни разходи на месец
  const goalsM = P.goals.reduce((a, g) => a + g.monthly, 0);
  const freeNoGoals = P.income - out, free = freeNoGoals - goalsM;
  const lifeExp = P.lifeExp > 0 ? P.lifeExp : expectancy(P.age);
  const yearsLeft = Math.max(0, lifeExp - P.age), monthsLeft = Math.round(yearsLeft * 12);
  const awakeH = yearsLeft * 365 * Math.max(0, 24 - P.sleepH), sleepHrs = yearsLeft * 365 * P.sleepH;
  const workYears = Math.max(0, Math.min(P.retireAge, lifeExp) - P.age);
  const workHLeft = workYears * P.hoursWeek * weeks;
  const assets = P.cash + P.movable + P.realty, net = assets - P.debtBal;
  const runway = out > 0 ? P.cash / out : Infinity, runwayAll = out > 0 ? assets / out : Infinity;
  return { weeks, workHM, hourly, out, goalsM, freeNoGoals, free, lifeExp, yearsLeft, monthsLeft, awakeH, sleepHrs, workYears, workHLeft, assets, net, runway, runwayAll };
}

// ── Анализ на една цена ─────────────────────────────────────────────────────────
function analyze(P, M, price, loanRate, loanYears) {
  const hours = M.hourly > 0 ? price / M.hourly : Infinity;
  const dayH = P.hoursWeek > 0 ? P.hoursWeek / 5 : 8;
  const calMonths = P.income > 0 ? price / P.income : Infinity;
  const r = {
    hours, dayH, days: hours / dayH, calMonths,
    payoff: M.free > 0 ? price / M.free : Infinity,
    payoffNG: M.freeNoGoals > 0 ? price / M.freeNoGoals : Infinity,
    lifeDays: P.income > 0 ? price / (P.income * 12 / 365) : Infinity,
    nights: calMonths * 30.44,
    workLifePct: M.workHLeft > 0 && isFinite(hours) ? hours / M.workHLeft * 100 : NaN,
    freeLifePct: M.free > 0 && M.monthsLeft > 0 ? price / (M.free * M.monthsLeft) * 100 : NaN,
    netPct: M.net > 0 ? price / M.net * 100 : NaN,
    loan: null, goals: [], runwayBefore: M.runway, runwayAfter: M.out > 0 ? (P.cash - price) / M.out : Infinity,
    verdict: M.free <= 0 ? 'heavy' : price < M.free ? 'light' : price < M.free * 6 ? 'mid' : 'heavy'
  };
  if (loanYears > 0) { // анюитетна вноска
    const rr = Math.max(0, loanRate) / 100 / 12, n = Math.round(loanYears * 12);
    const pay = rr > 0 ? price * rr / (1 - Math.pow(1 + rr, -n)) : price / n;
    const interest = pay * n - price;
    r.loan = { pay, interest, intHours: M.hourly > 0 ? interest / M.hourly : Infinity };
  }
  r.goals = P.goals.map((g) => g.monthly > 0
    ? { name: g.name, before: Math.ceil(g.amount / g.monthly), delay: Math.ceil(price / g.monthly) }
    : { name: g.name, none: true });
  return r;
}

// ── Сценарий: пари по месеци до края на живота ─────────────────────────────────
// Спестяванията за целите НЕ се вадят (остават пари на човека); кредитът спира, щом остатъкът е платен.
function simulate(P, M, stopYears, price, sellAll) {
  let money = (sellAll ? M.assets : P.cash) - (price || 0), debt = P.debtBal;
  const stopM = Math.round(Math.max(0, stopYears) * 12), pts = [money];
  let zeroAt = money < 0 ? 0 : -1;
  for (let m = 1; m <= M.monthsLeft; m++) {
    const inc = m <= stopM ? P.income : 0;
    let pay = 0; if (debt > 0) { pay = Math.min(P.debtPay, debt); debt -= pay; }
    money += inc - P.expenses - P.depCost - pay;
    pts.push(money);
    if (zeroAt < 0 && money < 0) zeroAt = m;
  }
  return { pts, zeroAt, end: money };
}

// ── Графика на платно: няколко линии пари срещу възраст ──────────────────────────
function cssVar(name, fb) { try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; } catch (_) { return fb; } }
const shortNum = (v) => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(0) + 'k' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : Math.round(v).toString();
function drawSeries(cv, series, startAge, monthsLeft) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 300, H = 220;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
  ctx.font = '11px system-ui, sans-serif';
  const padL = 40, padR = 8, padT = 10, padB = 42;
  let lo = 0, hi = 0; series.forEach((s) => s.pts.forEach((v) => { if (v < lo) lo = v; if (v > hi) hi = v; }));
  if (hi === lo) hi = lo + 1;
  const n = Math.max(1, monthsLeft);
  const x = (m) => padL + (W - padL - padR) * m / n;
  const y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
  const line = cssVar('--line', '#30363d'), dim = cssVar('--text-dim', '#8b949e'), text = cssVar('--text', '#e6edf3');
  // мрежа по възраст (на всеки 5 или 10 години)
  const step = n > 40 * 12 ? 10 : 5;
  ctx.strokeStyle = line; ctx.fillStyle = dim; ctx.textAlign = 'center';
  for (let a = Math.ceil(startAge / step) * step; (a - startAge) * 12 <= n; a += step) {
    const xx = x((a - startAge) * 12); ctx.beginPath(); ctx.moveTo(xx, padT); ctx.lineTo(xx, H - padB); ctx.stroke();
    ctx.fillText(String(a), xx, H - padB + 14);
  }
  ctx.textAlign = 'right'; ctx.fillText(shortNum(hi), padL - 4, padT + 4); ctx.fillText(shortNum(lo), padL - 4, H - padB);
  // нулева линия
  ctx.strokeStyle = cssVar('--err', '#f85149'); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(padL, y(0) + .5); ctx.lineTo(W - padR, y(0) + .5); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = dim; ctx.textAlign = 'right'; ctx.fillText('0', padL - 4, y(0) + 4);
  // линии
  series.forEach((s) => {
    ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath();
    const stepPts = Math.max(1, Math.floor(s.pts.length / 400));
    s.pts.forEach((v, i) => { if (i % stepPts && i !== s.pts.length - 1) return; i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)); });
    ctx.stroke();
  });
  // легенда
  ctx.textAlign = 'left'; let lx = padL;
  series.forEach((s) => { ctx.fillStyle = s.color; ctx.fillRect(lx, H - 14, 12, 3); ctx.fillStyle = text; ctx.fillText(s.label, lx + 16, H - 10); lx += 16 + ctx.measureText(s.label).width + 14; });
}

// ── Разпознаване на суми от снимка (Tesseract от мрежата, ВЕДНЪЖ при първо ползване) ──
let tessP = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tessP) return tessP;
  tessP = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => resolve(window.Tesseract || null);
    s.onerror = () => { tessP = null; resolve(null); };
    document.head.appendChild(s);
  });
  return tessP;
}
// Смалява снимката до разумен размер (по-бързо разпознаване на телефона).
function shrink(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); resolve(cv);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
// От текста вади кандидати за цена: „1 299,99", „12.500", „19 990", „1299.99" → числа, най-големите първи.
function priceCandidates(text) {
  const re = /\d{1,3}(?:[ \u00a0.,']\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/g;
  const seen = new Set(), out = []; let m;
  while ((m = re.exec(text))) {
    let s = m[0].replace(/[ \u00a0']/g, ''), dec = '';
    const md = s.match(/^(.*)[.,](\d{1,2})$/);
    if (md && (/[.,]/.test(md[1]) || md[2].length === 2 && md[1].length <= 3)) { s = md[1]; dec = md[2]; }
    const v = parseFloat(s.replace(/[.,]/g, '') + (dec ? '.' + dec : ''));
    if (!isFinite(v) || v < 1 || v > 1e9 || seen.has(v)) continue;
    seen.add(v); out.push(v);
  }
  return out.sort((a, b) => b - a).slice(0, 8);
}

const CSS = `<style>
.lf-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed var(--line);font-size:.92em}
.lf-row:last-child{border-bottom:none}
.lf-row .g{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.lf-row .g small{display:block;color:var(--text-dim);font-size:.85em}
.lf-row .v{white-space:nowrap;font-weight:600}
.lf-x{background:var(--bg-3);border:1px solid var(--line);color:var(--text-dim);width:34px;height:34px;border-radius:8px;cursor:pointer;flex-shrink:0;font-size:1em}
h4.lf-h{margin:16px 0 6px;font-size:.95em}
.lf-big{font-size:1.5em;font-weight:800;color:var(--accent-2);margin:6px 0 2px}
.lf-big small{font-size:.55em;font-weight:600;color:var(--text)}
.lf-kpi{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.lf-kpi > div{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px}
.lf-kpi b{display:block;font-size:1.25em;color:var(--accent-2)}
.lf-kpi span{font-size:.8em;color:var(--text-dim)}
.lf-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.lf-chip{background:var(--bg-3);border:1px solid var(--line);color:var(--text);padding:7px 12px;border-radius:20px;cursor:pointer;font-weight:600}
.lf-verdict{margin-top:12px;padding:10px 12px;border-radius:10px;font-size:.9em;font-weight:600}
.lf-verdict.light{background:rgba(46,160,67,.15);color:#56d364}
.lf-verdict.mid{background:rgba(210,153,34,.15);color:#e3b341}
.lf-verdict.heavy{background:rgba(248,81,73,.15);color:#ff7b72}
.lf-split{display:flex;height:14px;border-radius:7px;overflow:hidden;margin-top:8px}
.lf-split > div{height:100%}
canvas.lf-cv{width:100%;display:block;margin-top:8px}
.lf-neg{color:var(--err)}
</style>`;

export function render(root) {
  let D = load();
  const persist = () => save(D);
  const cur = () => D.cur;

  root.innerHTML = CSS + `
    <div class="tabs">
      <button class="tab active" data-tab="an">${t('lf_tab_an')}</button>
      <button class="tab" data-tab="prof">${t('lf_tab_prof')}</button>
      <button class="tab" data-tab="time">${t('lf_tab_time')}</button>
      <button class="tab" data-tab="hist">${t('lf_tab_hist')}</button>
    </div>

    <div data-panel="an">
      <div class="tool-card">
        <div id="lfNeedProf" class="notice" style="display:none;margin-bottom:12px">${t('lf_need_profile')}</div>
        <label>${t('lf_item')}</label><input id="lfItem" maxlength="60" />
        <div class="row">
          <div><label>${t('lf_price')}</label><input type="number" id="lfPrice" min="0" step="any" inputmode="decimal" /></div>
          <div><label>&nbsp;</label><button class="btn sec" id="lfScanBtn" style="margin-top:0">${t('lf_scan')}</button></div>
        </div>
        <input type="file" id="lfPhoto" accept="image/*" capture="environment" style="display:none" />
        <div class="status" id="lfScanSt"></div>
        <div id="lfChips"></div>
        <div class="row">
          <div><label>${t('lf_loan_rate')}</label><input type="number" id="lfLoanRate" min="0" step="any" value="0" /></div>
          <div><label>${t('lf_loan_years')}</label><input type="number" id="lfLoanYears" min="0" step="any" value="0" /></div>
        </div>
        <button class="btn" id="lfGo">${t('lf_analyze')}</button>
      </div>
      <div id="lfResult"></div>
    </div>

    <div data-panel="prof" style="display:none">
      <div class="tool-card">
        <p class="hint" style="margin-top:0">${t('lf_local')}</p>
        <div class="row">
          <div><label>${t('lf_age')}</label><input type="number" id="pAge" min="0" max="110" /></div>
          <div><label>${t('lf_cur')}</label><input id="pCur" maxlength="8" placeholder="EUR" /></div>
        </div>
        <label>${t('lf_lifeexp')}</label><input type="number" id="pLifeExp" min="0" max="120" />
        <div class="row">
          <div><label>${t('lf_income')}</label><input type="number" id="pIncome" min="0" step="any" /></div>
          <div><label>${t('lf_hours')}</label><input type="number" id="pHours" min="0" max="120" step="any" /></div>
        </div>
        <div class="row">
          <div><label>${t('lf_vac')}</label><input type="number" id="pVac" min="0" max="200" /></div>
          <div><label>${t('lf_sleep')}</label><input type="number" id="pSleep" min="0" max="16" step="any" /></div>
        </div>
        <label>${t('lf_retire')}</label><input type="number" id="pRetire" min="0" max="120" />
      </div>
      <div class="tool-card">
        <div class="row">
          <div><label>${t('lf_deps')}</label><input type="number" id="pDeps" min="0" max="30" /></div>
          <div><label>${t('lf_depcost')}</label><input type="number" id="pDepCost" min="0" step="any" /></div>
        </div>
        <label>${t('lf_expenses')}</label><input type="number" id="pExpenses" min="0" step="any" />
        <div class="row">
          <div><label>${t('lf_debtpay')}</label><input type="number" id="pDebtPay" min="0" step="any" /></div>
          <div><label>${t('lf_debtbal')}</label><input type="number" id="pDebtBal" min="0" step="any" /></div>
        </div>
        <label>${t('lf_cash')}</label><input type="number" id="pCash" min="0" step="any" />
        <div class="row">
          <div><label>${t('lf_movable')}</label><input type="number" id="pMovable" min="0" step="any" /></div>
          <div><label>${t('lf_realty')}</label><input type="number" id="pRealty" min="0" step="any" /></div>
        </div>
        <div class="row">
          <div><button class="btn sec" id="pFromBudget">${t('lf_from_budget')}</button></div>
          <div><button class="btn sec" id="pFromPlanner">${t('lf_from_planner')}</button></div>
        </div>
        <div class="status" id="pPullSt"></div>
      </div>
      <div class="tool-card">
        <h4 class="lf-h" style="margin-top:0">${t('lf_goals')}</h4>
        <div id="pGoals"></div>
        <label>${t('lf_goal_name')}</label><input id="pGName" maxlength="40" />
        <div class="row">
          <div><label>${t('lf_goal_amount')}</label><input type="number" id="pGAmt" min="0" step="any" /></div>
          <div><label>${t('lf_goal_monthly')}</label><input type="number" id="pGMon" min="0" step="any" /></div>
        </div>
        <button class="btn sec" id="pAddGoal">${t('lf_add_goal')}</button>
      </div>
      <div class="tool-card">
        <h4 class="lf-h" style="margin-top:0">${t('lf_your_hour')}</h4>
        <div class="out-block" id="pSummary" style="margin-top:0"></div>
      </div>
    </div>

    <div data-panel="time" style="display:none">
      <div class="tool-card">
        <h4 class="lf-h" style="margin-top:0">${t('lf_time_title')}</h4>
        <div id="tmKpi" class="lf-kpi"></div>
        <p class="hint" id="tmSplitLbl"></p>
        <div class="lf-split" id="tmSplit"></div>
        <div class="out-block" id="tmRunway"></div>
        <p class="hint">${t('lf_exp_note')}</p>
      </div>
      <div class="tool-card">
        <h4 class="lf-h" style="margin-top:0">${t('lf_sc_title')}</h4>
        <div class="row">
          <div><label>${t('lf_sc_stop')}</label><input type="number" id="scStop" min="0" step="any" /></div>
          <div><label>${t('lf_sc_buy')}</label><input type="number" id="scBuy" min="0" step="any" value="0" /></div>
        </div>
        <label class="check"><input type="checkbox" id="scSell" /> ${t('lf_sc_sell')}</label>
        <canvas class="lf-cv" id="scCv"></canvas>
        <div id="scOut"></div>
        <p class="hint">${t('lf_chart_note')}</p>
      </div>
    </div>

    <div data-panel="hist" style="display:none">
      <div class="tool-card">
        <div id="hsList"></div>
        <button class="btn sec" id="hsClear">${t('lf_clear_hist')}</button>
      </div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);
  const setSt = (node, kind, msg) => { node.className = 'status show ' + kind; node.textContent = msg; };
  const hideSt = (node) => { node.className = 'status'; node.textContent = ''; };

  // ── Профил ──
  const FIELDS = { pAge: 'age', pCur: 'cur', pLifeExp: 'lifeExp', pIncome: 'income', pHours: 'hoursWeek', pVac: 'vacDays', pSleep: 'sleepH', pRetire: 'retireAge', pDeps: 'deps', pDepCost: 'depCost', pExpenses: 'expenses', pDebtPay: 'debtPay', pDebtBal: 'debtBal', pCash: 'cash', pMovable: 'movable', pRealty: 'realty' };
  function fillProfile() { for (const id in FIELDS) $('#' + id).value = D[FIELDS[id]]; }
  for (const id in FIELDS) {
    $('#' + id).addEventListener('input', () => {
      const v = $('#' + id).value;
      D[FIELDS[id]] = id === 'pCur' ? v.trim().slice(0, 8) : Math.max(0, num(v));
      persist(); drawSummary();
    });
  }
  function drawGoals() {
    $('#pGoals').innerHTML = D.goals.length ? D.goals.map((g) => `<div class="lf-row"><div class="g">${esc(g.name)}<small>${money(g.amount, cur())} · ${g.monthly > 0 ? tf('lf_goal_eta', fmtDur(g.amount / g.monthly)) : t('lf_goal_stalled')}</small></div><span class="v">${money(g.monthly, cur())}</span><button class="lf-x" data-act="delgoal" data-id="${g.id}" title="${esc(t('lf_delete'))}">✕</button></div>`).join('') : `<p class="hint">${t('lf_no_goals')}</p>`;
  }
  $('#pAddGoal').addEventListener('click', () => {
    const name = $('#pGName').value.trim(), amount = num($('#pGAmt').value), monthly = num($('#pGMon').value);
    if (!name) { $('#pGName').focus(); return; }
    D.goals.push({ id: uid(), name, amount: Math.max(0, amount), monthly: Math.max(0, monthly) }); persist();
    $('#pGName').value = ''; $('#pGAmt').value = ''; $('#pGMon').value = ''; drawGoals(); drawSummary();
  });
  function drawSummary() {
    const M = model(D);
    $('#pSummary').innerHTML = `
      <div class="line"><span>${t('lf_work_hm')}</span><span>${fmtN(M.workHM)}</span></div>
      <div class="line"><span>${t('lf_out_month')}</span><span>${money(M.out, cur())}</span></div>
      <div class="line"><span>${t('lf_free_month')}</span><span class="${M.free < 0 ? 'lf-neg' : ''}">${money(M.free, cur())}</span></div>
      <div class="line"><span>${t('lf_hourly')}</span><span>${money(M.hourly, cur())}</span></div>`;
    $('#lfNeedProf').style.display = (D.income > 0 && D.hoursWeek > 0) ? 'none' : 'block';
  }
  // Данни от „Личен бюджет": разходи = лимити на пликовете (или разходите за текущия месец) + абонаменти;
  // доход = повтарящи се приходи; налични пари = активи; кредити = пасиви; валута.
  $('#pFromBudget').addEventListener('click', () => {
    const B = readLS('st_budget_v1'); const st = $('#pPullSt');
    if (!B) { setSt(st, 'err', t('lf_pulled_none')); return; }
    const monthlyEq = (amt, per) => per === 'w' ? amt * 52 / 12 : per === 'y' ? amt / 12 : amt;
    const ym = new Date().toISOString().slice(0, 7);
    const limits = (B.cats || []).reduce((a, c) => a + num(c.limit), 0);
    const spent = (B.tx || []).filter((x) => String(x.d || '').slice(0, 7) === ym).reduce((a, x) => a + num(x.amt), 0);
    const subsExp = (B.subs || []).filter((s) => s.kind !== 'inc').reduce((a, s) => a + monthlyEq(num(s.amt), s.per), 0);
    const subsInc = (B.subs || []).filter((s) => s.kind === 'inc').reduce((a, s) => a + monthlyEq(num(s.amt), s.per), 0);
    const assets = (B.assets || []).reduce((a, x) => a + num(x.val), 0), liab = (B.liab || []).reduce((a, x) => a + num(x.val), 0);
    let any = false;
    if (limits > 0 || spent > 0 || subsExp > 0) { D.expenses = Math.max(limits, spent) + subsExp; any = true; }
    if (subsInc > 0) { D.income = subsInc; any = true; }
    if (assets > 0) { D.cash = assets; any = true; }
    if (liab > 0) { D.debtBal = liab; any = true; }
    if (B.cur && !D.cur) { D.cur = String(B.cur).slice(0, 8); any = true; }
    if (!any) { setSt(st, 'err', t('lf_pulled_none')); return; }
    persist(); fillProfile(); drawSummary(); setSt(st, 'ok', t('lf_pulled_ok'));
  });
  // Данни от „Планировчик": остатък по дългове и месечни минимални вноски.
  $('#pFromPlanner').addEventListener('click', () => {
    const PL = readLS('st_planner_v1'); const st = $('#pPullSt');
    const debts = PL && Array.isArray(PL.debts) ? PL.debts : [];
    if (!debts.length) { setSt(st, 'err', t('lf_pulled_none')); return; }
    D.debtBal = debts.reduce((a, d) => a + num(d.bal), 0); D.debtPay = debts.reduce((a, d) => a + num(d.min), 0);
    persist(); fillProfile(); drawSummary(); setSt(st, 'ok', t('lf_pulled_ok'));
  });

  // ── Анализатор ──
  function drawResult(name, price, R) {
    const box = $('#lfResult'); const nm = name || t('lf_price');
    const kpi = (v, lbl) => `<div><b>${v}</b><span>${lbl}</span></div>`;
    box.innerHTML = `
      <div class="tool-card">
        <div class="hint" style="margin:0">${esc(tf('lf_costs_you', nm + ' · ' + money(price, cur())))}</div>
        <div class="lf-big">${isInf(R.hours) ? '—' : fmtN(R.hours, R.hours < 10 ? 1 : 0)} <small>${t('lf_r_hours')}</small></div>
        <div class="lf-kpi">
          ${kpi(isInf(R.days) ? '—' : fmtN(R.days, R.days < 10 ? 1 : 0), tf('lf_r_days', fmtN(R.dayH, 1)))}
          ${kpi(isInf(R.calMonths) ? '—' : fmtN(R.calMonths, 1), t('lf_r_calendar'))}
          ${kpi(isInf(R.lifeDays) ? '—' : fmtN(R.lifeDays, R.lifeDays < 10 ? 1 : 0), t('lf_r_lifedays'))}
          ${kpi(isInf(R.nights) ? '—' : fmtN(R.nights), t('lf_r_nights'))}
          ${kpi(pct(R.workLifePct), t('lf_r_worklife'))}
          ${kpi(pct(R.freeLifePct), t('lf_r_freelife'))}
        </div>
        <div class="out-block">
          <div class="line"><span>${t('lf_r_payoff')}</span><span>${fmtDur(R.payoff)}</span></div>
          ${D.goals.some((g) => g.monthly > 0) ? `<div class="line"><span>${t('lf_r_payoff_ng')}</span><span>${fmtDur(R.payoffNG)}</span></div>` : ''}
          ${isFinite(R.netPct) ? `<div class="line"><span>${t('lf_r_networth')}</span><span>${pct(R.netPct)}</span></div>` : ''}
          ${R.loan ? `<div class="line"><span>${t('lf_loan_q')} — ${t('lf_r_loan_pay')}</span><span>${money(R.loan.pay, cur())}</span></div><div class="line"><span>${tf('lf_r_loan_int', isInf(R.loan.intHours) ? '—' : fmtN(R.loan.intHours))}</span><span>${money(R.loan.interest, cur())}</span></div>` : ''}
        </div>
        <div class="lf-verdict ${R.verdict}">${t('lf_verdict_' + R.verdict)}</div>
        ${R.goals.length ? `<h4 class="lf-h">${t('lf_goals_effect')}</h4>` + R.goals.map((g) => `<div class="lf-row"><div class="g">${g.none ? esc(tf('lf_goal_nodelay', g.name)) : esc(tf('lf_goal_delay', g.name, fmtDur(g.delay), fmtDur(g.before), fmtDur(g.before + g.delay)))}</div></div>`).join('') : ''}
        <h4 class="lf-h">${t('lf_runway_effect')}</h4>
        <div class="out-block" style="margin-top:0">
          <div class="line"><span>${t('lf_runway_before')}</span><span>${isInf(R.runwayBefore) ? t('lf_forever') : fmtDur(R.runwayBefore)}</span></div>
          <div class="line"><span>${t('lf_runway_after')}</span><span class="${R.runwayAfter < 0 ? 'lf-neg' : ''}">${isInf(R.runwayAfter) ? t('lf_forever') : R.runwayAfter < 0 ? '−' + fmtDur(-R.runwayAfter) : fmtDur(R.runwayAfter)}</span></div>
        </div>
        <button class="btn sec" id="lfSave">${t('lf_save_hist')}</button>
        <div class="status" id="lfSaveSt"></div>
      </div>`;
    $('#lfSave').addEventListener('click', () => {
      D.hist.unshift({ id: uid(), d: new Date().toISOString().slice(0, 10), name: nm, price, hours: isInf(R.hours) ? -1 : R.hours, payoff: isInf(R.payoff) ? -1 : R.payoff });
      if (D.hist.length > 200) D.hist.length = 200;
      persist(); setSt($('#lfSaveSt'), 'ok', t('lf_saved')); drawHist();
    });
  }
  $('#lfGo').addEventListener('click', () => {
    const price = num($('#lfPrice').value);
    if (!(price > 0)) { $('#lfPrice').focus(); return; }
    const M = model(D);
    const R = analyze(D, M, price, num($('#lfLoanRate').value), num($('#lfLoanYears').value));
    $('#scBuy').value = price; // цената влиза и в сценария „+ покупка"
    drawResult($('#lfItem').value.trim(), price, R);
  });
  // снимка на етикет/обява → кандидати за цена
  $('#lfScanBtn').addEventListener('click', () => $('#lfPhoto').click());
  $('#lfPhoto').addEventListener('change', async () => {
    const f = $('#lfPhoto').files && $('#lfPhoto').files[0]; $('#lfPhoto').value = '';
    if (!f) return;
    const st = $('#lfScanSt'), chips = $('#lfChips'); chips.innerHTML = '';
    setSt(st, 'work', t('lf_scan_work'));
    const T = await loadTesseract();
    if (!T) { setSt(st, 'err', t('lf_scan_offline')); return; }
    try {
      const src = await shrink(f);
      const res = await T.recognize(src, 'eng');
      const cands = priceCandidates((res && res.data && res.data.text) || '');
      if (!cands.length) { setSt(st, 'err', t('lf_scan_none')); return; }
      hideSt(st);
      chips.innerHTML = `<p class="hint">${t('lf_scan_pick')}</p><div class="lf-chips">${cands.map((v) => `<button class="lf-chip" data-v="${v}">${money(v, cur())}</button>`).join('')}</div>`;
      chips.querySelectorAll('.lf-chip').forEach((b) => b.addEventListener('click', () => { $('#lfPrice').value = b.dataset.v; chips.innerHTML = ''; $('#lfGo').click(); }));
    } catch (e) { setSt(st, 'err', t('lf_scan_none')); }
  });

  // ── Времето ми ──
  function drawTime() {
    const M = model(D);
    const totalH = M.yearsLeft * 365 * 24 || 1;
    const sleepP = M.sleepHrs / totalH * 100, workP = Math.min(100 - sleepP, M.workHLeft / totalH * 100), freeP = Math.max(0, 100 - sleepP - workP);
    $('#tmKpi').innerHTML = `
      <div><b>${fmtN(M.yearsLeft, 1)}</b><span>${tf('lf_t_years_left', fmtN(M.lifeExp, 1))}</span></div>
      <div><b>${fmtN(M.awakeH)}</b><span>${t('lf_t_awake')}</span></div>
      <div><b>${fmtN(M.workHLeft)}</b><span>${t('lf_t_work')}</span></div>
      <div><b>${money(M.net, cur())}</b><span>${t('lf_networth')}</span></div>`;
    $('#tmSplitLbl').textContent = t('lf_t_split') + ': ' + pct(sleepP) + ' / ' + pct(workP) + ' / ' + pct(freeP);
    $('#tmSplit').innerHTML = `<div style="width:${sleepP}%;background:var(--text-dim)"></div><div style="width:${workP}%;background:var(--accent)"></div><div style="width:${freeP}%;background:var(--ok)"></div>`;
    $('#tmRunway').innerHTML = `
      <div class="line"><span>${t('lf_t_runway')}</span><span>${isInf(M.runway) ? t('lf_forever') : fmtDur(M.runway)}</span></div>
      <div class="line"><span>${t('lf_t_runway_all')}</span><span>${isInf(M.runwayAll) ? t('lf_forever') : fmtDur(M.runwayAll)}</span></div>`;
    if ($('#scStop').value === '') $('#scStop').value = Math.max(0, Math.round(M.workYears * 10) / 10);
    drawScenarios(M);
  }
  function drawScenarios(M) {
    const stopY = num($('#scStop').value), buy = num($('#scBuy').value), sell = $('#scSell').checked;
    const A = simulate(D, M, M.workYears, 0, sell), B = simulate(D, M, stopY, 0, sell), C = buy > 0 ? simulate(D, M, stopY, buy, sell) : null;
    const series = [
      { pts: A.pts, color: cssVar('--ok', '#2ea043'), label: tf('lf_sc_a', fmtN(Math.min(D.retireAge, M.lifeExp), 0)), r: A },
      { pts: B.pts, color: cssVar('--warn', '#d29922'), label: tf('lf_sc_b', fmtDur(stopY * 12)), r: B }
    ];
    if (C) series.push({ pts: C.pts, color: cssVar('--accent-2', '#e8536a'), label: tf('lf_sc_c', fmtDur(stopY * 12)), r: C });
    const cv = $('#scCv'); if (M.monthsLeft > 0) { cv.style.display = 'block'; drawSeries(cv, series, D.age, M.monthsLeft); } else cv.style.display = 'none';
    $('#scOut').innerHTML = series.map((s) => `<div class="lf-row"><div class="g"><span style="color:${s.color}">■</span> ${esc(s.label)}<small>${s.r.zeroAt >= 0 ? esc(tf('lf_sc_out', fmtN(D.age + s.r.zeroAt / 12, 1), fmtDur(s.r.zeroAt))) : esc(tf('lf_sc_ok', money(s.r.end, cur())))}</small></div></div>`).join('');
  }
  ['scStop', 'scBuy'].forEach((id) => $('#' + id).addEventListener('input', () => drawScenarios(model(D))));
  $('#scSell').addEventListener('change', () => drawScenarios(model(D)));

  // ── История ──
  function drawHist() {
    $('#hsList').innerHTML = D.hist.length ? D.hist.map((h) => `<div class="lf-row"><div class="g">${esc(h.name)} · ${money(h.price, cur())}<small>${h.d} · ${esc(tf('lf_hist_line', h.hours < 0 ? '—' : fmtN(h.hours, h.hours < 10 ? 1 : 0), h.payoff < 0 ? t('lf_never') : fmtDur(h.payoff)))}</small></div><button class="lf-x" data-act="delhist" data-id="${h.id}" title="${esc(t('lf_delete'))}">✕</button></div>`).join('') : `<p class="hint">${t('lf_hist_empty')}</p>`;
  }
  $('#hsClear').addEventListener('click', () => { D.hist = []; persist(); drawHist(); });

  // ── Общи: изтриване (делегирано), табове ──
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.lf-x'); if (!b) return;
    if (b.dataset.act === 'delgoal') { D.goals = D.goals.filter((g) => g.id !== b.dataset.id); persist(); drawGoals(); drawSummary(); }
    else if (b.dataset.act === 'delhist') { D.hist = D.hist.filter((h) => h.id !== b.dataset.id); persist(); drawHist(); }
  });
  root.querySelectorAll('.tab').forEach((tb) => {
    tb.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      tb.classList.add('active');
      root.querySelectorAll('[data-panel]').forEach((p) => { p.style.display = p.dataset.panel === tb.dataset.tab ? 'block' : 'none'; });
      if (tb.dataset.tab === 'time') drawTime(); // платното иска видима ширина
    });
  });

  fillProfile(); drawGoals(); drawSummary(); drawHist();
}
