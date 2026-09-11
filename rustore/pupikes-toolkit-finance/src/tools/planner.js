// Version: 1.0020
// Финансов планировчик — обогатяване по Huawei 4.3 (09.09.2026). Три под-таба:
//   • Кредит / ипотека — месечна вноска, обща лихва, ПОГАСИТЕЛЕН ПЛАН по месеци и ефект от
//     надплащане (спестена лихва, по-ранно изплащане);
//   • Спестяване — цел „кога ще стигна X": сложна лихва с месечни вноски → месеци и дата,
//     растеж по години;
//   • Дългове — списък дългове (остатък, лихва, минимална вноска) и месечен бюджет; методи
//     „снежна топка" (първо най-малкия) и „лавина" (първо най-скъпия) със сравнение, ред и месеци.
// Всичко се смята на устройството; дълговете се пазят в localStorage. Без мрежа.
import { esc } from '../core/ui.js';
import { t, tf, register, getLang } from '../core/i18n.js';

register({
  pl_title: { bg:'Финансов планировчик', ru:'Финансовый планировщик', uk:'Фінансовий планувальник', en:'Financial planner', de:'Finanzplaner', fr:'Planificateur financier', es:'Planificador financiero', 'es-MX':'Planificador financiero', it:'Pianificatore finanziario', pt:'Planeador financeiro', ar:'المخطط المالي', hi:'वित्तीय योजनाकार', ja:'ファイナンシャルプランナー', ky:'Каржы пландоочу', 'zh-Hant':'理財規劃' },
  pl_tab_loan: { bg:'Кредит / ипотека', ru:'Кредит / ипотека', uk:'Кредит / іпотека', en:'Loan / mortgage', de:'Kredit / Hypothek', fr:'Prêt / hypothèque', es:'Préstamo / hipoteca', 'es-MX':'Préstamo / hipoteca', it:'Prestito / mutuo', pt:'Empréstimo / hipoteca', ar:'قرض / رهن', hi:'ऋण / बंधक', ja:'ローン／住宅ローン', ky:'Насыя / ипотека', 'zh-Hant':'貸款／房貸' },
  pl_tab_save: { bg:'Спестяване', ru:'Накопление', uk:'Заощадження', en:'Savings goal', de:'Sparziel', fr:'Objectif d’épargne', es:'Meta de ahorro', 'es-MX':'Meta de ahorro', it:'Obiettivo di risparmio', pt:'Meta de poupança', ar:'هدف الادخار', hi:'बचत लक्ष्य', ja:'貯蓄目標', ky:'Топтоо максаты', 'zh-Hant':'儲蓄目標' },
  pl_tab_debt: { bg:'Дългове', ru:'Долги', uk:'Борги', en:'Debts', de:'Schulden', fr:'Dettes', es:'Deudas', 'es-MX':'Deudas', it:'Debiti', pt:'Dívidas', ar:'الديون', hi:'क़र्ज़', ja:'借金', ky:'Карыздар', 'zh-Hant':'債務' },
  pl_amount: { bg:'Сума на кредита', ru:'Сумма кредита', uk:'Сума кредиту', en:'Loan amount', de:'Kreditsumme', fr:'Montant du prêt', es:'Importe del préstamo', 'es-MX':'Monto del préstamo', it:'Importo del prestito', pt:'Valor do empréstimo', ar:'مبلغ القرض', hi:'ऋण राशि', ja:'借入額', ky:'Насыянын суммасы', 'zh-Hant':'貸款金額' },
  pl_rate: { bg:'Годишна лихва (%)', ru:'Годовая ставка (%)', uk:'Річна ставка (%)', en:'Annual rate (%)', de:'Jahreszins (%)', fr:'Taux annuel (%)', es:'Tasa anual (%)', 'es-MX':'Tasa anual (%)', it:'Tasso annuo (%)', pt:'Taxa anual (%)', ar:'المعدل السنوي (%)', hi:'वार्षिक दर (%)', ja:'年利（%）', ky:'Жылдык чен (%)', 'zh-Hant':'年利率（%）' },
  pl_years: { bg:'Срок (години)', ru:'Срок (лет)', uk:'Термін (років)', en:'Term (years)', de:'Laufzeit (Jahre)', fr:'Durée (années)', es:'Plazo (años)', 'es-MX':'Plazo (años)', it:'Durata (anni)', pt:'Prazo (anos)', ar:'المدة (سنوات)', hi:'अवधि (वर्ष)', ja:'期間（年）', ky:'Мөөнөтү (жыл)', 'zh-Hant':'期限（年）' },
  pl_extra: { bg:'Надплащане на месец (по избор)', ru:'Переплата в месяц (необязательно)', uk:'Переплата на місяць (необов’язково)', en:'Extra payment per month (optional)', de:'Sondertilgung pro Monat (optional)', fr:'Remboursement supplémentaire par mois (facultatif)', es:'Pago extra mensual (opcional)', 'es-MX':'Pago extra mensual (opcional)', it:'Pagamento extra mensile (facoltativo)', pt:'Pagamento extra mensal (opcional)', ar:'دفعة إضافية شهريًا (اختياري)', hi:'मासिक अतिरिक्त भुगतान (वैकल्पिक)', ja:'毎月の繰上返済額（任意）', ky:'Айына кошумча төлөм (милдеттүү эмес)', 'zh-Hant':'每月額外還款（選填）' },
  pl_calc: { bg:'Изчисли', ru:'Рассчитать', uk:'Розрахувати', en:'Calculate', de:'Berechnen', fr:'Calculer', es:'Calcular', 'es-MX':'Calcular', it:'Calcola', pt:'Calcular', ar:'احسب', hi:'गणना करें', ja:'計算', ky:'Эсепте', 'zh-Hant':'計算' },
  pl_monthly: { bg:'Месечна вноска', ru:'Ежемесячный платёж', uk:'Щомісячний платіж', en:'Monthly payment', de:'Monatsrate', fr:'Mensualité', es:'Cuota mensual', 'es-MX':'Pago mensual', it:'Rata mensile', pt:'Prestação mensal', ar:'القسط الشهري', hi:'मासिक किस्त', ja:'毎月の返済額', ky:'Айлык төлөм', 'zh-Hant':'每月還款' },
  pl_tot_int: { bg:'Обща лихва', ru:'Общая переплата (проценты)', uk:'Загальна переплата (відсотки)', en:'Total interest', de:'Gesamtzinsen', fr:'Intérêts totaux', es:'Interés total', 'es-MX':'Interés total', it:'Interessi totali', pt:'Juros totais', ar:'إجمالي الفائدة', hi:'कुल ब्याज', ja:'利息総額', ky:'Жалпы пайыз', 'zh-Hant':'總利息' },
  pl_tot_pay: { bg:'Общо платено', ru:'Всего выплачено', uk:'Усього сплачено', en:'Total paid', de:'Gesamt gezahlt', fr:'Total payé', es:'Total pagado', 'es-MX':'Total pagado', it:'Totale pagato', pt:'Total pago', ar:'الإجمالي المدفوع', hi:'कुल भुगतान', ja:'支払総額', ky:'Жалпы төлөндү', 'zh-Hant':'總付款' },
  pl_payoff: { bg:'Изплащане за', ru:'Срок погашения', uk:'Строк погашення', en:'Paid off in', de:'Abbezahlt in', fr:'Remboursé en', es:'Pagado en', 'es-MX':'Pagado en', it:'Estinto in', pt:'Liquidado em', ar:'السداد خلال', hi:'चुकता होगा', ja:'完済まで', ky:'Төлөнүп бүтөт', 'zh-Hant':'還清時間' },
  pl_months_fmt: { bg:'{0} мес. ({1} г.)', ru:'{0} мес. ({1} г.)', uk:'{0} міс. ({1} р.)', en:'{0} months ({1} yrs)', de:'{0} Monate ({1} J.)', fr:'{0} mois ({1} ans)', es:'{0} meses ({1} años)', 'es-MX':'{0} meses ({1} años)', it:'{0} mesi ({1} anni)', pt:'{0} meses ({1} anos)', ar:'{0} شهرًا ({1} سنة)', hi:'{0} महीने ({1} वर्ष)', ja:'{0} か月（{1} 年）', ky:'{0} ай ({1} жыл)', 'zh-Hant':'{0} 個月（{1} 年）' },
  pl_with_extra: { bg:'С надплащане {0}/мес.', ru:'С переплатой {0}/мес.', uk:'З переплатою {0}/міс.', en:'With extra {0}/month', de:'Mit Sondertilgung {0}/Monat', fr:'Avec {0}/mois en plus', es:'Con extra {0}/mes', 'es-MX':'Con extra {0}/mes', it:'Con extra {0}/mese', pt:'Com extra {0}/mês', ar:'مع دفعة إضافية {0}/شهر', hi:'{0}/माह अतिरिक्त के साथ', ja:'毎月 {0} 繰上げの場合', ky:'Айына {0} кошумча менен', 'zh-Hant':'每月額外 {0}' },
  pl_saved_int: { bg:'Спестена лихва', ru:'Сэкономлено на процентах', uk:'Заощаджено на відсотках', en:'Interest saved', de:'Gesparte Zinsen', fr:'Intérêts économisés', es:'Interés ahorrado', 'es-MX':'Interés ahorrado', it:'Interessi risparmiati', pt:'Juros poupados', ar:'الفائدة الموفَّرة', hi:'बचा हुआ ब्याज', ja:'節約できる利息', ky:'Үнөмдөлгөн пайыз', 'zh-Hant':'節省利息' },
  pl_saved_time: { bg:'По-рано с', ru:'Раньше на', uk:'Раніше на', en:'Earlier by', de:'Früher um', fr:'Plus tôt de', es:'Antes en', 'es-MX':'Antes en', it:'In anticipo di', pt:'Mais cedo em', ar:'أبكر بـ', hi:'इतना पहले', ja:'短縮期間', ky:'Эртерээк', 'zh-Hant':'提早' },
  pl_schedule: { bg:'Погасителен план', ru:'График погашения', uk:'Графік погашення', en:'Amortization schedule', de:'Tilgungsplan', fr:'Tableau d’amortissement', es:'Cuadro de amortización', 'es-MX':'Tabla de amortización', it:'Piano di ammortamento', pt:'Plano de amortização', ar:'جدول السداد', hi:'भुगतान अनुसूची', ja:'返済スケジュール', ky:'Төлөм графиги', 'zh-Hant':'還款計畫表' },
  pl_show_all: { bg:'Покажи всички месеци', ru:'Показать все месяцы', uk:'Показати всі місяці', en:'Show all months', de:'Alle Monate anzeigen', fr:'Afficher tous les mois', es:'Mostrar todos los meses', 'es-MX':'Mostrar todos los meses', it:'Mostra tutti i mesi', pt:'Mostrar todos os meses', ar:'عرض كل الأشهر', hi:'सभी महीने दिखाएँ', ja:'全期間を表示', ky:'Бардык айларды көрсөт', 'zh-Hant':'顯示全部月份' },
  pl_show_less: { bg:'Покажи по-малко', ru:'Показать меньше', uk:'Показати менше', en:'Show less', de:'Weniger anzeigen', fr:'Afficher moins', es:'Mostrar menos', 'es-MX':'Mostrar menos', it:'Mostra meno', pt:'Mostrar menos', ar:'عرض أقل', hi:'कम दिखाएँ', ja:'表示を減らす', ky:'Азыраак көрсөт', 'zh-Hant':'顯示較少' },
  pl_col_n: { bg:'№', ru:'№', uk:'№', en:'#', de:'Nr.', fr:'N°', es:'N.º', 'es-MX':'N.º', it:'N.', pt:'N.º', ar:'#', hi:'क्र.', ja:'回', ky:'№', 'zh-Hant':'期' },
  pl_col_pay: { bg:'Вноска', ru:'Платёж', uk:'Платіж', en:'Payment', de:'Rate', fr:'Paiement', es:'Pago', 'es-MX':'Pago', it:'Rata', pt:'Prestação', ar:'الدفعة', hi:'भुगतान', ja:'返済額', ky:'Төлөм', 'zh-Hant':'付款' },
  pl_col_int: { bg:'Лихва', ru:'Проценты', uk:'Відсотки', en:'Interest', de:'Zinsen', fr:'Intérêts', es:'Interés', 'es-MX':'Interés', it:'Interessi', pt:'Juros', ar:'الفائدة', hi:'ब्याज', ja:'利息', ky:'Пайыз', 'zh-Hant':'利息' },
  pl_col_princ: { bg:'Главница', ru:'Основной долг', uk:'Основний борг', en:'Principal', de:'Tilgung', fr:'Capital', es:'Capital', 'es-MX':'Capital', it:'Capitale', pt:'Capital', ar:'الأصل', hi:'मूलधन', ja:'元金', ky:'Негизги карыз', 'zh-Hant':'本金' },
  pl_col_bal: { bg:'Остатък', ru:'Остаток', uk:'Залишок', en:'Balance', de:'Restschuld', fr:'Solde', es:'Saldo', 'es-MX':'Saldo', it:'Residuo', pt:'Saldo', ar:'المتبقي', hi:'शेष', ja:'残高', ky:'Калдык', 'zh-Hant':'餘額' },
  pl_goal: { bg:'Цел (сума)', ru:'Цель (сумма)', uk:'Ціль (сума)', en:'Goal (amount)', de:'Ziel (Betrag)', fr:'Objectif (montant)', es:'Meta (importe)', 'es-MX':'Meta (monto)', it:'Obiettivo (importo)', pt:'Meta (valor)', ar:'الهدف (المبلغ)', hi:'लक्ष्य (राशि)', ja:'目標額', ky:'Максат (сумма)', 'zh-Hant':'目標（金額）' },
  pl_start: { bg:'Налични сега', ru:'Есть сейчас', uk:'Є зараз', en:'Current savings', de:'Aktuell gespart', fr:'Épargne actuelle', es:'Ahorro actual', 'es-MX':'Ahorro actual', it:'Risparmi attuali', pt:'Poupança atual', ar:'المدخرات الحالية', hi:'वर्तमान बचत', ja:'現在の貯蓄', ky:'Азыркы топтолгон', 'zh-Hant':'目前儲蓄' },
  pl_monthly_in: { bg:'Месечна вноска', ru:'Ежемесячный взнос', uk:'Щомісячний внесок', en:'Monthly deposit', de:'Monatliche Einzahlung', fr:'Versement mensuel', es:'Aporte mensual', 'es-MX':'Aporte mensual', it:'Versamento mensile', pt:'Depósito mensal', ar:'الإيداع الشهري', hi:'मासिक जमा', ja:'毎月の積立', ky:'Айлык салым', 'zh-Hant':'每月存入' },
  pl_save_rate: { bg:'Годишна доходност (%)', ru:'Годовая доходность (%)', uk:'Річна дохідність (%)', en:'Annual return (%)', de:'Jahresrendite (%)', fr:'Rendement annuel (%)', es:'Rentabilidad anual (%)', 'es-MX':'Rendimiento anual (%)', it:'Rendimento annuo (%)', pt:'Rendimento anual (%)', ar:'العائد السنوي (%)', hi:'वार्षिक प्रतिफल (%)', ja:'年利回り（%）', ky:'Жылдык кирешелүүлүк (%)', 'zh-Hant':'年報酬率（%）' },
  pl_reach_in: { bg:'Ще стигнеш целта за', ru:'Цель будет достигнута через', uk:'Ціль буде досягнута через', en:'You reach the goal in', de:'Ziel erreicht in', fr:'Objectif atteint dans', es:'Alcanzas la meta en', 'es-MX':'Alcanzas la meta en', it:'Raggiungi l’obiettivo in', pt:'Atinge a meta em', ar:'تصل إلى الهدف خلال', hi:'लक्ष्य पूरा होगा', ja:'目標達成まで', ky:'Максатка жетесиң', 'zh-Hant':'達成目標需時' },
  pl_reach_date: { bg:'Дата', ru:'Дата', uk:'Дата', en:'Date', de:'Datum', fr:'Date', es:'Fecha', 'es-MX':'Fecha', it:'Data', pt:'Data', ar:'التاريخ', hi:'तारीख़', ja:'達成日', ky:'Дата', 'zh-Hant':'日期' },
  pl_final: { bg:'Натрупано тогава', ru:'Накоплено к тому времени', uk:'Накопичено на той час', en:'Balance at that time', de:'Guthaben dann', fr:'Solde à cette date', es:'Saldo en ese momento', 'es-MX':'Saldo en ese momento', it:'Saldo a quella data', pt:'Saldo nessa altura', ar:'الرصيد حينها', hi:'तब की राशि', ja:'その時点の残高', ky:'Ошол кездеги калдык', 'zh-Hant':'屆時餘額' },
  pl_never: { bg:'Целта не е достижима с тези вноски (над 100 години). Увеличи вноската.', ru:'Цель недостижима с такими взносами (более 100 лет). Увеличьте взнос.', uk:'Ціль недосяжна з такими внесками (понад 100 років). Збільште внесок.', en:'The goal is not reachable with these deposits (over 100 years). Increase the deposit.', de:'Ziel mit diesen Einzahlungen nicht erreichbar (über 100 Jahre). Erhöhe die Einzahlung.', fr:'Objectif inatteignable avec ces versements (plus de 100 ans). Augmentez le versement.', es:'La meta no es alcanzable con estos aportes (más de 100 años). Aumenta el aporte.', 'es-MX':'La meta no es alcanzable con estos aportes (más de 100 años). Aumenta el aporte.', it:'Obiettivo non raggiungibile con questi versamenti (oltre 100 anni). Aumenta il versamento.', pt:'A meta não é atingível com estes depósitos (mais de 100 anos). Aumente o depósito.', ar:'الهدف غير قابل للتحقيق بهذه الإيداعات (أكثر من 100 سنة). زد الإيداع.', hi:'इन जमाओं से लक्ष्य संभव नहीं (100 वर्ष से अधिक)। जमा बढ़ाएँ।', ja:'この積立では達成できません（100年超）。積立額を増やしてください。', ky:'Бул салымдар менен максатка жетүү мүмкүн эмес (100 жылдан ашык). Салымды көбөйт.', 'zh-Hant':'以此存入額無法達成（超過 100 年）。請提高存入額。' },
  pl_growth: { bg:'Растеж по години', ru:'Рост по годам', uk:'Зростання за роками', en:'Growth by year', de:'Wachstum pro Jahr', fr:'Croissance par année', es:'Crecimiento por año', 'es-MX':'Crecimiento por año', it:'Crescita per anno', pt:'Crescimento por ano', ar:'النمو حسب السنة', hi:'वर्ष अनुसार वृद्धि', ja:'年ごとの推移', ky:'Жылдар боюнча өсүү', 'zh-Hant':'逐年成長' },
  pl_col_year: { bg:'Година', ru:'Год', uk:'Рік', en:'Year', de:'Jahr', fr:'Année', es:'Año', 'es-MX':'Año', it:'Anno', pt:'Ano', ar:'السنة', hi:'वर्ष', ja:'年', ky:'Жыл', 'zh-Hant':'年' },
  pl_col_dep: { bg:'Внесено', ru:'Внесено', uk:'Внесено', en:'Deposited', de:'Eingezahlt', fr:'Versé', es:'Aportado', 'es-MX':'Aportado', it:'Versato', pt:'Depositado', ar:'المودَع', hi:'जमा', ja:'積立累計', ky:'Салынды', 'zh-Hant':'累計存入' },
  pl_col_gain: { bg:'Доход', ru:'Доход', uk:'Дохід', en:'Gain', de:'Ertrag', fr:'Gain', es:'Ganancia', 'es-MX':'Ganancia', it:'Guadagno', pt:'Ganho', ar:'الربح', hi:'लाभ', ja:'運用益', ky:'Киреше', 'zh-Hant':'收益' },
  pl_col_total: { bg:'Общо', ru:'Итого', uk:'Разом', en:'Total', de:'Gesamt', fr:'Total', es:'Total', 'es-MX':'Total', it:'Totale', pt:'Total', ar:'الإجمالي', hi:'कुल', ja:'合計', ky:'Жалпы', 'zh-Hant':'合計' },
  pl_debt_name: { bg:'Дълг (име)', ru:'Долг (название)', uk:'Борг (назва)', en:'Debt (name)', de:'Schuld (Name)', fr:'Dette (nom)', es:'Deuda (nombre)', 'es-MX':'Deuda (nombre)', it:'Debito (nome)', pt:'Dívida (nome)', ar:'الدين (الاسم)', hi:'क़र्ज़ (नाम)', ja:'借金（名前）', ky:'Карыз (аты)', 'zh-Hant':'債務（名稱）' },
  pl_debt_bal: { bg:'Остатък', ru:'Остаток', uk:'Залишок', en:'Balance', de:'Restschuld', fr:'Solde', es:'Saldo', 'es-MX':'Saldo', it:'Residuo', pt:'Saldo', ar:'المتبقي', hi:'शेष', ja:'残高', ky:'Калдык', 'zh-Hant':'餘額' },
  pl_debt_min: { bg:'Минимална вноска', ru:'Минимальный платёж', uk:'Мінімальний платіж', en:'Minimum payment', de:'Mindestrate', fr:'Paiement minimum', es:'Pago mínimo', 'es-MX':'Pago mínimo', it:'Rata minima', pt:'Pagamento mínimo', ar:'الحد الأدنى للدفع', hi:'न्यूनतम भुगतान', ja:'最低返済額', ky:'Минималдуу төлөм', 'zh-Hant':'最低還款' },
  pl_add_debt: { bg:'+ Добави дълг', ru:'+ Добавить долг', uk:'+ Додати борг', en:'+ Add debt', de:'+ Schuld hinzufügen', fr:'+ Ajouter une dette', es:'+ Añadir deuda', 'es-MX':'+ Agregar deuda', it:'+ Aggiungi debito', pt:'+ Adicionar dívida', ar:'+ إضافة دين', hi:'+ क़र्ज़ जोड़ें', ja:'+ 借金を追加', ky:'+ Карыз кошуу', 'zh-Hant':'+ 新增債務' },
  pl_no_debts: { bg:'Няма дългове. Добави поне един (остатък, лихва, минимална вноска).', ru:'Долгов нет. Добавьте хотя бы один (остаток, ставка, минимальный платёж).', uk:'Боргів немає. Додайте хоча б один (залишок, ставка, мінімальний платіж).', en:'No debts. Add at least one (balance, rate, minimum payment).', de:'Keine Schulden. Füge mindestens eine hinzu (Restschuld, Zins, Mindestrate).', fr:'Aucune dette. Ajoutez-en au moins une (solde, taux, paiement minimum).', es:'Sin deudas. Añade al menos una (saldo, tasa, pago mínimo).', 'es-MX':'Sin deudas. Agrega al menos una (saldo, tasa, pago mínimo).', it:'Nessun debito. Aggiungine almeno uno (residuo, tasso, rata minima).', pt:'Sem dívidas. Adicione pelo menos uma (saldo, taxa, pagamento mínimo).', ar:'لا ديون. أضف واحدًا على الأقل (المتبقي، المعدل، الحد الأدنى).', hi:'कोई क़र्ज़ नहीं। कम से कम एक जोड़ें (शेष, दर, न्यूनतम भुगतान)।', ja:'借金がありません。少なくとも1件追加（残高・金利・最低返済額）。', ky:'Карыз жок. Жок дегенде бирди кош (калдык, чен, мин. төлөм).', 'zh-Hant':'尚無債務。請至少新增一筆（餘額、利率、最低還款）。' },
  pl_budget: { bg:'Месечен бюджет за дългове (общо)', ru:'Месячный бюджет на долги (всего)', uk:'Місячний бюджет на борги (разом)', en:'Monthly debt budget (total)', de:'Monatsbudget für Schulden (gesamt)', fr:'Budget mensuel pour les dettes (total)', es:'Presupuesto mensual para deudas (total)', 'es-MX':'Presupuesto mensual para deudas (total)', it:'Budget mensile per i debiti (totale)', pt:'Orçamento mensal para dívidas (total)', ar:'الميزانية الشهرية للديون (الإجمالي)', hi:'क़र्ज़ हेतु मासिक बजट (कुल)', ja:'毎月の返済予算（合計）', ky:'Карыздарга айлык бюджет (жалпы)', 'zh-Hant':'每月還債預算（總計）' },
  pl_method: { bg:'Метод', ru:'Метод', uk:'Метод', en:'Method', de:'Methode', fr:'Méthode', es:'Método', 'es-MX':'Método', it:'Metodo', pt:'Método', ar:'الطريقة', hi:'तरीक़ा', ja:'方式', ky:'Ыкма', 'zh-Hant':'方法' },
  pl_snowball: { bg:'Снежна топка (първо най-малкия)', ru:'Снежный ком (сначала самый маленький)', uk:'Снігова куля (спочатку найменший)', en:'Snowball (smallest first)', de:'Schneeball (kleinste zuerst)', fr:'Boule de neige (plus petite d’abord)', es:'Bola de nieve (la menor primero)', 'es-MX':'Bola de nieve (la menor primero)', it:'Palla di neve (prima il più piccolo)', pt:'Bola de neve (a menor primeiro)', ar:'كرة الثلج (الأصغر أولًا)', hi:'स्नोबॉल (सबसे छोटा पहले)', ja:'スノーボール（少額から）', ky:'Кар тоголок (эң кичинеси биринчи)', 'zh-Hant':'雪球法（最小者優先）' },
  pl_avalanche: { bg:'Лавина (първо най-високата лихва)', ru:'Лавина (сначала самая высокая ставка)', uk:'Лавина (спочатку найвища ставка)', en:'Avalanche (highest rate first)', de:'Lawine (höchster Zins zuerst)', fr:'Avalanche (taux le plus élevé d’abord)', es:'Avalancha (mayor tasa primero)', 'es-MX':'Avalancha (mayor tasa primero)', it:'Valanga (prima il tasso più alto)', pt:'Avalanche (taxa mais alta primeiro)', ar:'الانهيار (الأعلى فائدة أولًا)', hi:'एवलांच (सबसे ऊँची दर पहले)', ja:'アバランチ（高金利から）', ky:'Көчкү (эң жогорку чен биринчи)', 'zh-Hant':'雪崩法（最高利率優先）' },
  pl_order: { bg:'Ред на изплащане', ru:'Порядок погашения', uk:'Порядок погашення', en:'Payoff order', de:'Tilgungsreihenfolge', fr:'Ordre de remboursement', es:'Orden de pago', 'es-MX':'Orden de pago', it:'Ordine di estinzione', pt:'Ordem de pagamento', ar:'ترتيب السداد', hi:'चुकाने का क्रम', ja:'返済順', ky:'Төлөө тартиби', 'zh-Hant':'還款順序' },
  pl_paid_off_m: { bg:'изплатен на месец {0}', ru:'погашен на месяце {0}', uk:'погашено на місяці {0}', en:'paid off in month {0}', de:'getilgt in Monat {0}', fr:'remboursée au mois {0}', es:'pagada en el mes {0}', 'es-MX':'pagada en el mes {0}', it:'estinto al mese {0}', pt:'liquidada no mês {0}', ar:'يُسدَّد في الشهر {0}', hi:'महीने {0} में चुकता', ja:'{0} か月目に完済', ky:'{0}-айда төлөнөт', 'zh-Hant':'第 {0} 個月還清' },
  pl_debt_free: { bg:'Без дългове след', ru:'Без долгов через', uk:'Без боргів через', en:'Debt-free in', de:'Schuldenfrei in', fr:'Sans dettes dans', es:'Sin deudas en', 'es-MX':'Sin deudas en', it:'Senza debiti in', pt:'Sem dívidas em', ar:'بلا ديون خلال', hi:'क़र्ज़-मुक्त', ja:'完済まで', ky:'Карызсыз болосуң', 'zh-Hant':'無債務需時' },
  pl_compare: { bg:'Сравнение на методите', ru:'Сравнение методов', uk:'Порівняння методів', en:'Method comparison', de:'Methodenvergleich', fr:'Comparaison des méthodes', es:'Comparación de métodos', 'es-MX':'Comparación de métodos', it:'Confronto dei metodi', pt:'Comparação de métodos', ar:'مقارنة الطرق', hi:'तरीक़ों की तुलना', ja:'方式の比較', ky:'Ыкмаларды салыштыруу', 'zh-Hant':'方法比較' },
  pl_cmp_line: { bg:'{0}: {1} мес., лихва {2}', ru:'{0}: {1} мес., проценты {2}', uk:'{0}: {1} міс., відсотки {2}', en:'{0}: {1} months, interest {2}', de:'{0}: {1} Monate, Zinsen {2}', fr:'{0} : {1} mois, intérêts {2}', es:'{0}: {1} meses, interés {2}', 'es-MX':'{0}: {1} meses, interés {2}', it:'{0}: {1} mesi, interessi {2}', pt:'{0}: {1} meses, juros {2}', ar:'{0}: {1} شهرًا، فائدة {2}', hi:'{0}: {1} महीने, ब्याज {2}', ja:'{0}：{1} か月、利息 {2}', ky:'{0}: {1} ай, пайыз {2}', 'zh-Hant':'{0}：{1} 個月，利息 {2}' },
  pl_budget_low: { bg:'⚠ Бюджетът е под сбора на минималните вноски ({0}) — дълговете ще растат.', ru:'⚠ Бюджет меньше суммы минимальных платежей ({0}) — долги будут расти.', uk:'⚠ Бюджет менший за суму мінімальних платежів ({0}) — борги зростатимуть.', en:'⚠ Budget is below the sum of minimum payments ({0}) — debts will grow.', de:'⚠ Budget liegt unter der Summe der Mindestraten ({0}) — Schulden wachsen.', fr:'⚠ Budget inférieur à la somme des paiements minimums ({0}) — les dettes vont croître.', es:'⚠ El presupuesto es menor que la suma de pagos mínimos ({0}) — las deudas crecerán.', 'es-MX':'⚠ El presupuesto es menor que la suma de pagos mínimos ({0}) — las deudas crecerán.', it:'⚠ Budget inferiore alla somma delle rate minime ({0}) — i debiti cresceranno.', pt:'⚠ Orçamento abaixo da soma dos pagamentos mínimos ({0}) — as dívidas vão crescer.', ar:'⚠ الميزانية أقل من مجموع الحد الأدنى ({0}) — ستنمو الديون.', hi:'⚠ बजट न्यूनतम भुगतानों के योग ({0}) से कम है — क़र्ज़ बढ़ेगा।', ja:'⚠ 予算が最低返済額の合計（{0}）未満 — 借金が増えます。', ky:'⚠ Бюджет мин. төлөмдөрдүн суммасынан ({0}) аз — карыздар өсөт.', 'zh-Hant':'⚠ 預算低於最低還款總和（{0}）— 債務將增加。' },
  pl_debt_never: { bg:'С този бюджет дълговете не се изплащат за 50 години. Увеличи бюджета.', ru:'С таким бюджетом долги не погасятся за 50 лет. Увеличьте бюджет.', uk:'З таким бюджетом борги не погасяться за 50 років. Збільште бюджет.', en:'With this budget the debts are not paid off within 50 years. Increase the budget.', de:'Mit diesem Budget sind die Schulden in 50 Jahren nicht getilgt. Erhöhe das Budget.', fr:'Avec ce budget, les dettes ne sont pas remboursées en 50 ans. Augmentez le budget.', es:'Con este presupuesto las deudas no se pagan en 50 años. Aumenta el presupuesto.', 'es-MX':'Con este presupuesto las deudas no se pagan en 50 años. Aumenta el presupuesto.', it:'Con questo budget i debiti non si estinguono in 50 anni. Aumenta il budget.', pt:'Com este orçamento as dívidas não se pagam em 50 anos. Aumente o orçamento.', ar:'بهذه الميزانية لا تُسدَّد الديون خلال 50 سنة. زد الميزانية.', hi:'इस बजट से 50 वर्ष में क़र्ज़ नहीं चुकता। बजट बढ़ाएँ।', ja:'この予算では50年以内に完済できません。予算を増やしてください。', ky:'Бул бюджет менен карыздар 50 жылда төлөнбөйт. Бюджетти көбөйт.', 'zh-Hant':'以此預算 50 年內無法還清。請提高預算。' },
  pl_delete: { bg:'Изтрий', ru:'Удалить', uk:'Видалити', en:'Delete', de:'Löschen', fr:'Supprimer', es:'Eliminar', 'es-MX':'Eliminar', it:'Elimina', pt:'Eliminar', ar:'حذف', hi:'हटाएँ', ja:'削除', ky:'Өчүрүү', 'zh-Hant':'刪除' }
});

export const title = t('pl_title');

const LS_KEY = 'st_planner_v1';
function load() { try { const d = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (d && typeof d === 'object') return Object.assign({ debts: [], budget: 0 }, d); } catch (_) {} return { debts: [], budget: 0 }; }
function save(d) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch (_) {} }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
function money(n) { try { return (isFinite(n) ? n : 0).toLocaleString(getLang(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } catch (_) { return (isFinite(n) ? n : 0).toFixed(2); } }
const yrs = (m) => (m / 12).toFixed(1).replace(/\.0$/, '');
const monthsTxt = (m) => tf('pl_months_fmt', m, yrs(m));

// Погасителен план: анюитетна вноска + надплащане. Връща { pay, rows, totInt, months }.
function amortize(P, annual, nMonths, extra) {
  const r = annual / 100 / 12;
  const pay = r > 0 ? P * r / (1 - Math.pow(1 + r, -nMonths)) : P / nMonths;
  const rows = []; let bal = P, totInt = 0, k = 0;
  while (bal > 0.005 && k < 1200) {
    k++;
    const i = bal * r; const due = Math.min(bal + i, pay + (extra || 0)); const princ = due - i;
    bal -= princ; totInt += i;
    rows.push({ n: k, pay: due, int: i, princ, bal: Math.max(0, bal) });
  }
  return { pay, rows, totInt, months: k };
}

// Дългове: симулация по месеци. method = 'snowball' | 'avalanche'.
function simulateDebts(debts, budget, method) {
  const ds = debts.map((d) => ({ name: d.name, bal: d.bal, rate: d.rate, min: d.min, paidM: 0 }));
  const order = ds.slice().sort(method === 'snowball' ? (a, b) => a.bal - b.bal : (a, b) => b.rate - a.rate);
  let month = 0, totInt = 0;
  const open = () => ds.some((d) => d.bal > 0.005);
  while (open() && month < 600) {
    month++;
    let avail = budget;
    for (const d of ds) if (d.bal > 0.005) { const i = d.bal * d.rate / 1200; d.bal += i; totInt += i; }
    for (const d of ds) if (d.bal > 0.005) { const p = Math.min(d.min, d.bal, Math.max(0, avail)); d.bal -= p; avail -= p; }
    for (const d of order) { if (avail <= 0) break; if (d.bal > 0.005) { const p = Math.min(avail, d.bal); d.bal -= p; avail -= p; } }
    for (const d of ds) if (d.bal <= 0.005 && !d.paidM) d.paidM = month;
  }
  return { months: month, totInt, done: !open(), order: order.map((d) => ({ name: d.name, paidM: d.paidM })) };
}

const CSS = `<style>
.pl-tbl{width:100%;border-collapse:collapse;font-size:.84em;margin-top:8px}
.pl-tbl th,.pl-tbl td{padding:5px 4px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
.pl-tbl th{color:var(--text-dim);font-weight:600}
.pl-tbl th:first-child,.pl-tbl td:first-child{text-align:left}
.pl-scroll{overflow-x:auto}
.pl-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed var(--line);font-size:.92em}
.pl-row:last-child{border-bottom:none}
.pl-row .g{flex:1;min-width:0}
.pl-row .g small{display:block;color:var(--text-dim);font-size:.85em}
.pl-x{background:var(--bg-3);border:1px solid var(--line);color:var(--text-dim);width:34px;height:34px;border-radius:8px;cursor:pointer;flex-shrink:0}
h4.pl-h{margin:16px 0 6px;font-size:.95em}
.pl-warn{color:var(--warn);font-size:.88em;margin-top:8px;font-weight:600}
.pl-good{color:#56d364}
</style>`;

export function render(root) {
  const D = load();
  root.innerHTML = CSS + `
    <div class="tabs">
      <button class="tab active" data-tab="loan">${t('pl_tab_loan')}</button>
      <button class="tab" data-tab="save">${t('pl_tab_save')}</button>
      <button class="tab" data-tab="debt">${t('pl_tab_debt')}</button>
    </div>

    <div class="tool-card" data-panel="loan">
      <label>${t('pl_amount')}</label><input type="number" id="plAmt" value="100000" min="0" step="any" />
      <div class="row">
        <div><label>${t('pl_rate')}</label><input type="number" id="plRate" value="5" step="0.01" /></div>
        <div><label>${t('pl_years')}</label><input type="number" id="plYears" value="20" step="0.5" min="0.1" /></div>
      </div>
      <label>${t('pl_extra')}</label><input type="number" id="plExtra" value="0" min="0" step="any" />
      <button class="btn" id="plLoanBtn">${t('pl_calc')}</button>
      <div class="out-block" id="plLoanOut" style="display:none"></div>
      <div id="plLoanExtra"></div>
      <h4 class="pl-h" id="plSchedH" style="display:none">${t('pl_schedule')}</h4>
      <div class="pl-scroll" id="plSched"></div>
      <button class="btn sec" id="plSchedAll" style="display:none">${t('pl_show_all')}</button>
    </div>

    <div class="tool-card" data-panel="save" style="display:none">
      <label>${t('pl_goal')}</label><input type="number" id="plGoal" value="10000" min="0" step="any" />
      <div class="row">
        <div><label>${t('pl_start')}</label><input type="number" id="plStart" value="1000" min="0" step="any" /></div>
        <div><label>${t('pl_monthly_in')}</label><input type="number" id="plDep" value="200" min="0" step="any" /></div>
      </div>
      <label>${t('pl_save_rate')}</label><input type="number" id="plSRate" value="3" step="0.01" />
      <button class="btn" id="plSaveBtn">${t('pl_calc')}</button>
      <div class="status" id="plSaveStatus"></div>
      <div class="out-block" id="plSaveOut" style="display:none"></div>
      <h4 class="pl-h" id="plGrowH" style="display:none">${t('pl_growth')}</h4>
      <div class="pl-scroll" id="plGrow"></div>
    </div>

    <div class="tool-card" data-panel="debt" style="display:none">
      <div id="plDebts"></div>
      <label>${t('pl_debt_name')}</label><input id="plDName" maxlength="40" />
      <div class="row">
        <div><label>${t('pl_debt_bal')}</label><input type="number" id="plDBal" min="0" step="any" /></div>
        <div><label>${t('pl_rate')}</label><input type="number" id="plDRate" min="0" step="0.01" /></div>
        <div><label>${t('pl_debt_min')}</label><input type="number" id="plDMin" min="0" step="any" /></div>
      </div>
      <button class="btn sec" id="plAddDebt">${t('pl_add_debt')}</button>
      <label>${t('pl_budget')}</label><input type="number" id="plBudget" min="0" step="any" value="${D.budget || ''}" />
      <label>${t('pl_method')}</label>
      <select id="plMethod"><option value="snowball">${t('pl_snowball')}</option><option value="avalanche">${t('pl_avalanche')}</option></select>
      <button class="btn" id="plDebtBtn">${t('pl_calc')}</button>
      <div id="plDebtWarn"></div>
      <div class="out-block" id="plDebtOut" style="display:none"></div>
      <div id="plDebtOrder"></div>
      <div class="out-block" id="plDebtCmp" style="display:none"></div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);
  root.querySelectorAll('.tab').forEach((tb) => {
    tb.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      tb.classList.add('active');
      root.querySelectorAll('[data-panel]').forEach((p) => { p.style.display = p.dataset.panel === tb.dataset.tab ? 'block' : 'none'; });
    });
  });

  // ── Кредит / ипотека ──
  let schedRows = [], schedAll = false;
  function drawSched() {
    const rows = schedAll ? schedRows : schedRows.slice(0, 12);
    $('#plSched').innerHTML = `<table class="pl-tbl"><thead><tr><th>${t('pl_col_n')}</th><th>${t('pl_col_pay')}</th><th>${t('pl_col_int')}</th><th>${t('pl_col_princ')}</th><th>${t('pl_col_bal')}</th></tr></thead><tbody>` +
      rows.map((r) => `<tr><td>${r.n}</td><td>${money(r.pay)}</td><td>${money(r.int)}</td><td>${money(r.princ)}</td><td>${money(r.bal)}</td></tr>`).join('') + '</tbody></table>';
    const b = $('#plSchedAll'); b.style.display = schedRows.length > 12 ? 'block' : 'none'; b.textContent = schedAll ? t('pl_show_less') : t('pl_show_all');
  }
  $('#plSchedAll').addEventListener('click', () => { schedAll = !schedAll; drawSched(); });
  $('#plLoanBtn').addEventListener('click', () => {
    const P = Math.max(0, num($('#plAmt').value)), rate = Math.max(0, num($('#plRate').value));
    const n = Math.max(1, Math.round(num($('#plYears').value) * 12)), extra = Math.max(0, num($('#plExtra').value));
    const base = amortize(P, rate, n, 0);
    const o = $('#plLoanOut'); o.style.display = 'block';
    o.innerHTML = `<div class="line"><span>${t('pl_monthly')}</span><span>${money(base.pay)}</span></div>` +
      `<div class="line"><span>${t('pl_tot_int')}</span><span>${money(base.totInt)}</span></div>` +
      `<div class="line"><span>${t('pl_payoff')}</span><span>${monthsTxt(base.months)}</span></div>` +
      `<div class="line"><span>${t('pl_tot_pay')}</span><span>${money(P + base.totInt)}</span></div>`;
    let withX = base;
    if (extra > 0 && P > 0) {
      withX = amortize(P, rate, n, extra);
      $('#plLoanExtra').innerHTML = `<div class="out-block"><div class="line"><span><b>${tf('pl_with_extra', money(extra))}</b></span><span>${money(base.pay + extra)}</span></div>` +
        `<div class="line"><span>${t('pl_payoff')}</span><span>${monthsTxt(withX.months)}</span></div>` +
        `<div class="line"><span>${t('pl_saved_time')}</span><span>${monthsTxt(base.months - withX.months)}</span></div>` +
        `<div class="line"><span>${t('pl_saved_int')}</span><span class="pl-good">${money(base.totInt - withX.totInt)}</span></div></div>`;
    } else $('#plLoanExtra').innerHTML = '';
    schedRows = withX.rows; schedAll = false; $('#plSchedH').style.display = 'block'; drawSched();
  });

  // ── Спестяване ──
  $('#plSaveBtn').addEventListener('click', () => {
    const goal = Math.max(0, num($('#plGoal').value)), start = Math.max(0, num($('#plStart').value));
    const dep = Math.max(0, num($('#plDep').value)), r = Math.max(0, num($('#plSRate').value)) / 100 / 12;
    const st = $('#plSaveStatus'), o = $('#plSaveOut');
    let bal = start, m = 0, deposited = start; const years = [];
    while (bal < goal && m < 1200) { m++; bal = bal * (1 + r) + dep; deposited += dep; if (m % 12 === 0) years.push({ y: m / 12, dep: deposited, bal }); }
    if (bal < goal) { st.className = 'status show err'; st.textContent = t('pl_never'); o.style.display = 'none'; $('#plGrowH').style.display = 'none'; $('#plGrow').innerHTML = ''; return; }
    st.className = 'status';
    if (m % 12 !== 0) years.push({ y: +(m / 12).toFixed(1), dep: deposited, bal });
    const when = new Date(); when.setMonth(when.getMonth() + m);
    let dateTxt; try { dateTxt = when.toLocaleDateString(getLang(), { month: 'long', year: 'numeric' }); } catch (_) { dateTxt = when.getFullYear() + '-' + String(when.getMonth() + 1).padStart(2, '0'); }
    o.style.display = 'block';
    o.innerHTML = `<div class="line"><span>${t('pl_reach_in')}</span><span>${m === 0 ? monthsTxt(0) : monthsTxt(m)}</span></div>` +
      `<div class="line"><span>${t('pl_reach_date')}</span><span>${esc(dateTxt)}</span></div>` +
      `<div class="line"><span>${t('pl_col_gain')}</span><span>${money(bal - deposited)}</span></div>` +
      `<div class="line"><span>${t('pl_final')}</span><span>${money(bal)}</span></div>`;
    $('#plGrowH').style.display = years.length ? 'block' : 'none';
    $('#plGrow').innerHTML = years.length ? `<table class="pl-tbl"><thead><tr><th>${t('pl_col_year')}</th><th>${t('pl_col_dep')}</th><th>${t('pl_col_gain')}</th><th>${t('pl_col_total')}</th></tr></thead><tbody>` +
      years.map((y) => `<tr><td>${y.y}</td><td>${money(y.dep)}</td><td>${money(y.bal - y.dep)}</td><td>${money(y.bal)}</td></tr>`).join('') + '</tbody></table>' : '';
  });

  // ── Дългове ──
  function drawDebts() {
    $('#plDebts').innerHTML = D.debts.length ? D.debts.map((d) => `<div class="pl-row"><div class="g">${esc(d.name)}<small>${d.rate}% · ${t('pl_debt_min')}: ${money(d.min)}</small></div><span><b>${money(d.bal)}</b></span><button class="pl-x" data-id="${d.id}" title="${esc(t('pl_delete'))}">✕</button></div>`).join('') : `<p class="hint">${t('pl_no_debts')}</p>`;
  }
  $('#plDebts').addEventListener('click', (e) => { const b = e.target.closest('.pl-x'); if (!b) return; D.debts = D.debts.filter((d) => d.id !== b.dataset.id); save(D); drawDebts(); });
  $('#plAddDebt').addEventListener('click', () => {
    const name = $('#plDName').value.trim(), bal = num($('#plDBal').value), rate = Math.max(0, num($('#plDRate').value)), min = Math.max(0, num($('#plDMin').value));
    if (!name) { $('#plDName').focus(); return; }
    if (!(bal > 0)) { $('#plDBal').focus(); return; }
    D.debts.push({ id: uid(), name, bal, rate, min }); save(D);
    $('#plDName').value = ''; $('#plDBal').value = ''; $('#plDRate').value = ''; $('#plDMin').value = ''; drawDebts();
  });
  $('#plDebtBtn').addEventListener('click', () => {
    const budget = Math.max(0, num($('#plBudget').value)); D.budget = budget; save(D);
    const warn = $('#plDebtWarn'), o = $('#plDebtOut'), cmp = $('#plDebtCmp');
    if (!D.debts.length) { warn.innerHTML = `<p class="hint">${t('pl_no_debts')}</p>`; o.style.display = 'none'; cmp.style.display = 'none'; $('#plDebtOrder').innerHTML = ''; return; }
    const mins = D.debts.reduce((a, d) => a + d.min, 0);
    warn.innerHTML = budget < mins ? `<div class="pl-warn">${tf('pl_budget_low', money(mins))}</div>` : '';
    const method = $('#plMethod').value;
    const res = simulateDebts(D.debts, budget, method), alt = simulateDebts(D.debts, budget, method === 'snowball' ? 'avalanche' : 'snowball');
    if (!res.done) { warn.innerHTML += `<div class="pl-warn">${t('pl_debt_never')}</div>`; o.style.display = 'none'; cmp.style.display = 'none'; $('#plDebtOrder').innerHTML = ''; return; }
    o.style.display = 'block';
    o.innerHTML = `<div class="line"><span>${t('pl_tot_int')}</span><span>${money(res.totInt)}</span></div><div class="line"><span>${t('pl_debt_free')}</span><span>${monthsTxt(res.months)}</span></div>`;
    $('#plDebtOrder').innerHTML = `<h4 class="pl-h">${t('pl_order')}</h4>` + res.order.map((d, i) => `<div class="pl-row"><div class="g">${i + 1}. ${esc(d.name)}<small>${tf('pl_paid_off_m', d.paidM)}</small></div></div>`).join('');
    const nameOf = (mth) => t(mth === 'snowball' ? 'pl_snowball' : 'pl_avalanche');
    cmp.style.display = 'block';
    cmp.innerHTML = `<div class="line"><span>${t('pl_compare')}</span><span></span></div>` +
      `<div class="line"><span>${tf('pl_cmp_line', nameOf(method), res.months, money(res.totInt))}</span><span></span></div>` +
      `<div class="line"><span>${alt.done ? tf('pl_cmp_line', nameOf(method === 'snowball' ? 'avalanche' : 'snowball'), alt.months, money(alt.totInt)) : ''}</span><span></span></div>`;
  });
  drawDebts();
}
