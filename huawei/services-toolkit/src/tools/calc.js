// Калкулатори — заем, ДДС, лихва, проценти.
import { t, tf, register } from '../core/i18n.js';

register({
  calc_title: { bg:'Калкулатори', ru:'Калькуляторы', uk:'Калькулятори', en:'Calculators', de:'Rechner', fr:'Calculatrices', es:'Calculadoras', 'es-MX':'Calculadoras', it:'Calcolatrici', pt:'Calculadoras', ar:'حاسبات', hi:'कैलकुलेटर', ja:'計算ツール', ky:'Эсептегичтер', 'zh-Hant':'計算機' },
  calc_tab_loan: { bg:'Заем', ru:'Кредит', uk:'Кредит', en:'Loan', de:'Kredit', fr:'Prêt', es:'Préstamo', 'es-MX':'Préstamo', it:'Prestito', pt:'Empréstimo', ar:'قرض', hi:'ऋण', ja:'ローン', ky:'Насыя', 'zh-Hant':'貸款' },
  calc_tab_vat: { bg:'ДДС', ru:'НДС', uk:'ПДВ', en:'VAT', de:'MwSt.', fr:'TVA', es:'IVA', 'es-MX':'IVA', it:'IVA', pt:'IVA', ar:'ضريبة', hi:'वैट', ja:'付加価値税', ky:'КНС', 'zh-Hant':'增值稅' },
  calc_tab_interest: { bg:'Лихва', ru:'Проценты', uk:'Відсотки', en:'Interest', de:'Zinsen', fr:'Intérêts', es:'Interés', 'es-MX':'Interés', it:'Interessi', pt:'Juros', ar:'فائدة', hi:'ब्याज', ja:'利息', ky:'Пайыз', 'zh-Hant':'利息' },
  calc_tab_pct: { bg:'Проценти', ru:'Проценты', uk:'Відсотки', en:'Percentages', de:'Prozente', fr:'Pourcentages', es:'Porcentajes', 'es-MX':'Porcentajes', it:'Percentuali', pt:'Percentagens', ar:'نسب مئوية', hi:'प्रतिशत', ja:'割合', ky:'Пайыздар', 'zh-Hant':'百分比' },

  calc_calc_btn: { bg:'Изчисли', ru:'Рассчитать', uk:'Розрахувати', en:'Calculate', de:'Berechnen', fr:'Calculer', es:'Calcular', 'es-MX':'Calcular', it:'Calcola', pt:'Calcular', ar:'احسب', hi:'गणना करें', ja:'計算', ky:'Эсепте', 'zh-Hant':'計算' },

  calc_loan_amount: { bg:'Сума на заема', ru:'Сумма кредита', uk:'Сума кредиту', en:'Loan amount', de:'Kreditsumme', fr:'Montant du prêt', es:'Importe del préstamo', 'es-MX':'Monto del préstamo', it:'Importo del prestito', pt:'Valor do empréstimo', ar:'مبلغ القرض', hi:'ऋण राशि', ja:'ローン金額', ky:'Насыянын суммасы', 'zh-Hant':'貸款金額' },
  calc_annual_rate: { bg:'Годишен лихвен процент (%)', ru:'Годовая процентная ставка (%)', uk:'Річна відсоткова ставка (%)', en:'Annual interest rate (%)', de:'Jährlicher Zinssatz (%)', fr:'Taux d’intérêt annuel (%)', es:'Tasa de interés anual (%)', 'es-MX':'Tasa de interés anual (%)', it:'Tasso d’interesse annuo (%)', pt:'Taxa de juros anual (%)', ar:'معدل الفائدة السنوي (%)', hi:'वार्षिक ब्याज दर (%)', ja:'年利 (%)', ky:'Жылдык пайыздык чен (%)', 'zh-Hant':'年利率 (%)' },
  calc_term_months: { bg:'Срок (месеци)', ru:'Срок (месяцев)', uk:'Термін (місяців)', en:'Term (months)', de:'Laufzeit (Monate)', fr:'Durée (mois)', es:'Plazo (meses)', 'es-MX':'Plazo (meses)', it:'Durata (mesi)', pt:'Prazo (meses)', ar:'المدة (أشهر)', hi:'अवधि (महीने)', ja:'期間（月）', ky:'Мөөнөтү (айлар)', 'zh-Hant':'期限（月）' },
  calc_loan_monthly: { bg:'Месечна вноска', ru:'Ежемесячный платёж', uk:'Щомісячний платіж', en:'Monthly payment', de:'Monatliche Rate', fr:'Mensualité', es:'Cuota mensual', 'es-MX':'Pago mensual', it:'Rata mensile', pt:'Pagamento mensal', ar:'القسط الشهري', hi:'मासिक भुगतान', ja:'毎月の支払い', ky:'Айлык төлөм', 'zh-Hant':'每月還款' },
  calc_loan_totinterest: { bg:'Обща лихва', ru:'Общая сумма процентов', uk:'Загальна сума відсотків', en:'Total interest', de:'Gesamtzinsen', fr:'Intérêts totaux', es:'Interés total', 'es-MX':'Interés total', it:'Interessi totali', pt:'Juros totais', ar:'إجمالي الفائدة', hi:'कुल ब्याज', ja:'利息合計', ky:'Жалпы пайыз', 'zh-Hant':'總利息' },
  calc_loan_totpay: { bg:'Общо за връщане', ru:'Всего к возврату', uk:'Усього до повернення', en:'Total to repay', de:'Gesamtrückzahlung', fr:'Total à rembourser', es:'Total a devolver', 'es-MX':'Total a pagar', it:'Totale da rimborsare', pt:'Total a pagar', ar:'الإجمالي المستحق', hi:'कुल वापसी', ja:'返済総額', ky:'Кайтарууга баары', 'zh-Hant':'總還款額' },

  calc_vat_country: { bg:'Държава (ставка ДДС)', ru:'Страна (ставка НДС)', uk:'Країна (ставка ПДВ)', en:'Country (VAT rate)', de:'Land (MwSt.-Satz)', fr:'Pays (taux de TVA)', es:'País (tasa de IVA)', 'es-MX':'País (tasa de IVA)', it:'Paese (aliquota IVA)', pt:'País (taxa de IVA)', ar:'الدولة (نسبة الضريبة)', hi:'देश (वैट दर)', ja:'国（付加価値税率）', ky:'Өлкө (КНС чени)', 'zh-Hant':'國家（增值稅率）' },
  calc_vat_c_bg: { bg:'България — 20%', ru:'Болгария — 20%', uk:'Болгарія — 20%', en:'Bulgaria — 20%', de:'Bulgarien — 20%', fr:'Bulgarie — 20%', es:'Bulgaria — 20%', 'es-MX':'Bulgaria — 20%', it:'Bulgaria — 20%', pt:'Bulgária — 20%', ar:'بلغاريا — 20%', hi:'बुल्गारिया — 20%', ja:'ブルガリア — 20%', ky:'Болгария — 20%', 'zh-Hant':'保加利亞 — 20%' },
  calc_vat_c_de: { bg:'Германия — 19%', ru:'Германия — 19%', uk:'Німеччина — 19%', en:'Germany — 19%', de:'Deutschland — 19%', fr:'Allemagne — 19%', es:'Alemania — 19%', 'es-MX':'Alemania — 19%', it:'Germania — 19%', pt:'Alemanha — 19%', ar:'ألمانيا — 19%', hi:'जर्मनी — 19%', ja:'ドイツ — 19%', ky:'Германия — 19%', 'zh-Hant':'德國 — 19%' },
  calc_vat_c_nl: { bg:'Нидерландия — 21%', ru:'Нидерланды — 21%', uk:'Нідерланди — 21%', en:'Netherlands — 21%', de:'Niederlande — 21%', fr:'Pays-Bas — 21%', es:'Países Bajos — 21%', 'es-MX':'Países Bajos — 21%', it:'Paesi Bassi — 21%', pt:'Países Baixos — 21%', ar:'هولندا — 21%', hi:'नीदरलैंड — 21%', ja:'オランダ — 21%', ky:'Нидерланды — 21%', 'zh-Hant':'荷蘭 — 21%' },
  calc_vat_c_it: { bg:'Италия — 22%', ru:'Италия — 22%', uk:'Італія — 22%', en:'Italy — 22%', de:'Italien — 22%', fr:'Italie — 22%', es:'Italia — 22%', 'es-MX':'Italia — 22%', it:'Italia — 22%', pt:'Itália — 22%', ar:'إيطاليا — 22%', hi:'इटली — 22%', ja:'イタリア — 22%', ky:'Италия — 22%', 'zh-Hant':'義大利 — 22%' },
  calc_vat_c_es: { bg:'Испания — 21%', ru:'Испания — 21%', uk:'Іспанія — 21%', en:'Spain — 21%', de:'Spanien — 21%', fr:'Espagne — 21%', es:'España — 21%', 'es-MX':'España — 21%', it:'Spagna — 21%', pt:'Espanha — 21%', ar:'إسبانيا — 21%', hi:'स्पेन — 21%', ja:'スペイン — 21%', ky:'Испания — 21%', 'zh-Hant':'西班牙 — 21%' },
  calc_vat_c_at: { bg:'Австрия — 20%', ru:'Австрия — 20%', uk:'Австрія — 20%', en:'Austria — 20%', de:'Österreich — 20%', fr:'Autriche — 20%', es:'Austria — 20%', 'es-MX':'Austria — 20%', it:'Austria — 20%', pt:'Áustria — 20%', ar:'النمسا — 20%', hi:'ऑस्ट्रिया — 20%', ja:'オーストリア — 20%', ky:'Австрия — 20%', 'zh-Hant':'奧地利 — 20%' },
  calc_vat_c_gr: { bg:'Гърция — 24%', ru:'Греция — 24%', uk:'Греція — 24%', en:'Greece — 24%', de:'Griechenland — 24%', fr:'Grèce — 24%', es:'Grecia — 24%', 'es-MX':'Grecia — 24%', it:'Grecia — 24%', pt:'Grécia — 24%', ar:'اليونان — 24%', hi:'ग्रीस — 24%', ja:'ギリシャ — 24%', ky:'Грекия — 24%', 'zh-Hant':'希臘 — 24%' },
  calc_vat_c_se: { bg:'Швеция — 25%', ru:'Швеция — 25%', uk:'Швеція — 25%', en:'Sweden — 25%', de:'Schweden — 25%', fr:'Suède — 25%', es:'Suecia — 25%', 'es-MX':'Suecia — 25%', it:'Svezia — 25%', pt:'Suécia — 25%', ar:'السويد — 25%', hi:'स्वीडन — 25%', ja:'スウェーデン — 25%', ky:'Швеция — 25%', 'zh-Hant':'瑞典 — 25%' },
  calc_vat_c_other: { bg:'Друга / ръчно', ru:'Другая / вручную', uk:'Інша / вручну', en:'Other / manual', de:'Andere / manuell', fr:'Autre / manuel', es:'Otro / manual', 'es-MX':'Otro / manual', it:'Altro / manuale', pt:'Outro / manual', ar:'أخرى / يدوي', hi:'अन्य / मैनुअल', ja:'その他 / 手動', ky:'Башка / кол менен', 'zh-Hant':'其他／手動' },
  calc_vat_rate: { bg:'ДДС ставка (%)', ru:'Ставка НДС (%)', uk:'Ставка ПДВ (%)', en:'VAT rate (%)', de:'MwSt.-Satz (%)', fr:'Taux de TVA (%)', es:'Tasa de IVA (%)', 'es-MX':'Tasa de IVA (%)', it:'Aliquota IVA (%)', pt:'Taxa de IVA (%)', ar:'نسبة الضريبة (%)', hi:'वैट दर (%)', ja:'付加価値税率 (%)', ky:'КНС чени (%)', 'zh-Hant':'增值稅率 (%)' },
  calc_amount: { bg:'Сума', ru:'Сумма', uk:'Сума', en:'Amount', de:'Betrag', fr:'Montant', es:'Importe', 'es-MX':'Monto', it:'Importo', pt:'Valor', ar:'المبلغ', hi:'राशि', ja:'金額', ky:'Сумма', 'zh-Hant':'金額' },
  calc_vat_amount_is: { bg:'Сумата е:', ru:'Сумма:', uk:'Сума:', en:'The amount is:', de:'Der Betrag ist:', fr:'Le montant est :', es:'El importe es:', 'es-MX':'El monto es:', it:'L’importo è:', pt:'O valor é:', ar:'المبلغ هو:', hi:'राशि है:', ja:'金額は:', ky:'Сумма:', 'zh-Hant':'金額為：' },
  calc_vat_mode_net: { bg:'Без ДДС (добави ДДС)', ru:'Без НДС (добавить НДС)', uk:'Без ПДВ (додати ПДВ)', en:'Without VAT (add VAT)', de:'Ohne MwSt. (MwSt. hinzufügen)', fr:'Hors TVA (ajouter la TVA)', es:'Sin IVA (añadir IVA)', 'es-MX':'Sin IVA (agregar IVA)', it:'Senza IVA (aggiungi IVA)', pt:'Sem IVA (adicionar IVA)', ar:'بدون ضريبة (إضافة الضريبة)', hi:'वैट बिना (वैट जोड़ें)', ja:'税抜き（税を加算）', ky:'КНСсиз (КНС кош)', 'zh-Hant':'未稅（加上增值稅）' },
  calc_vat_mode_gross: { bg:'С ДДС (извади ДДС)', ru:'С НДС (выделить НДС)', uk:'З ПДВ (виділити ПДВ)', en:'With VAT (extract VAT)', de:'Mit MwSt. (MwSt. herausrechnen)', fr:'TTC (extraire la TVA)', es:'Con IVA (extraer IVA)', 'es-MX':'Con IVA (extraer IVA)', it:'Con IVA (estrai IVA)', pt:'Com IVA (extrair IVA)', ar:'شامل الضريبة (استخراج الضريبة)', hi:'वैट सहित (वैट निकालें)', ja:'税込み（税を抽出）', ky:'КНС менен (КНС бөл)', 'zh-Hant':'含稅（拆出增值稅）' },
  calc_vat_net: { bg:'Без ДДС', ru:'Без НДС', uk:'Без ПДВ', en:'Net (without VAT)', de:'Netto (ohne MwSt.)', fr:'Hors TVA', es:'Sin IVA', 'es-MX':'Sin IVA', it:'Senza IVA', pt:'Sem IVA', ar:'بدون ضريبة', hi:'वैट बिना', ja:'税抜き', ky:'КНСсиз', 'zh-Hant':'未稅' },
  calc_vat_vat: { bg:'ДДС', ru:'НДС', uk:'ПДВ', en:'VAT', de:'MwSt.', fr:'TVA', es:'IVA', 'es-MX':'IVA', it:'IVA', pt:'IVA', ar:'الضريبة', hi:'वैट', ja:'付加価値税', ky:'КНС', 'zh-Hant':'增值稅' },
  calc_vat_gross: { bg:'С ДДС', ru:'С НДС', uk:'З ПДВ', en:'Gross (with VAT)', de:'Brutto (mit MwSt.)', fr:'TTC', es:'Con IVA', 'es-MX':'Con IVA', it:'Con IVA', pt:'Com IVA', ar:'شامل الضريبة', hi:'वैट सहित', ja:'税込み', ky:'КНС менен', 'zh-Hant':'含稅' },

  calc_int_principal: { bg:'Главница', ru:'Основная сумма', uk:'Основна сума', en:'Principal', de:'Kapital', fr:'Capital', es:'Capital', 'es-MX':'Capital', it:'Capitale', pt:'Capital', ar:'المبلغ الأساسي', hi:'मूलधन', ja:'元金', ky:'Негизги сумма', 'zh-Hant':'本金' },
  calc_term_years: { bg:'Срок (години)', ru:'Срок (лет)', uk:'Термін (років)', en:'Term (years)', de:'Laufzeit (Jahre)', fr:'Durée (années)', es:'Plazo (años)', 'es-MX':'Plazo (años)', it:'Durata (anni)', pt:'Prazo (anos)', ar:'المدة (سنوات)', hi:'अवधि (वर्ष)', ja:'期間（年）', ky:'Мөөнөтү (жылдар)', 'zh-Hant':'期限（年）' },
  calc_int_type: { bg:'Вид лихва', ru:'Тип процентов', uk:'Тип відсотків', en:'Interest type', de:'Zinsart', fr:'Type d’intérêt', es:'Tipo de interés', 'es-MX':'Tipo de interés', it:'Tipo di interesse', pt:'Tipo de juros', ar:'نوع الفائدة', hi:'ब्याज प्रकार', ja:'利息の種類', ky:'Пайыздын түрү', 'zh-Hant':'利息類型' },
  calc_int_compound: { bg:'Сложна (капитализира се годишно)', ru:'Сложные (капитализация ежегодно)', uk:'Складні (капіталізація щороку)', en:'Compound (compounded yearly)', de:'Zinseszins (jährlich)', fr:'Composé (capitalisé annuellement)', es:'Compuesto (capitaliza anualmente)', 'es-MX':'Compuesto (capitaliza anualmente)', it:'Composto (capitalizzato annualmente)', pt:'Composto (capitaliza anualmente)', ar:'مركّبة (سنويًا)', hi:'चक्रवृद्धि (वार्षिक)', ja:'複利（年複利）', ky:'Татаал (жыл сайын кошулат)', 'zh-Hant':'複利（每年計）' },
  calc_int_simple: { bg:'Проста', ru:'Простые', uk:'Прості', en:'Simple', de:'Einfach', fr:'Simple', es:'Simple', 'es-MX':'Simple', it:'Semplice', pt:'Simples', ar:'بسيطة', hi:'साधारण', ja:'単利', ky:'Жөнөкөй', 'zh-Hant':'單利' },
  calc_int_accrued: { bg:'Натрупана лихва', ru:'Накопленные проценты', uk:'Накопичені відсотки', en:'Accrued interest', de:'Aufgelaufene Zinsen', fr:'Intérêts cumulés', es:'Interés acumulado', 'es-MX':'Interés acumulado', it:'Interessi maturati', pt:'Juros acumulados', ar:'الفائدة المتراكمة', hi:'अर्जित ब्याज', ja:'発生利息', ky:'Топтолгон пайыз', 'zh-Hant':'累計利息' },
  calc_int_final: { bg:'Крайна сума', ru:'Итоговая сумма', uk:'Підсумкова сума', en:'Final amount', de:'Endbetrag', fr:'Montant final', es:'Importe final', 'es-MX':'Monto final', it:'Importo finale', pt:'Valor final', ar:'المبلغ النهائي', hi:'अंतिम राशि', ja:'最終金額', ky:'Акыркы сумма', 'zh-Hant':'最終金額' },

  calc_pct_calc: { bg:'Изчисление', ru:'Расчёт', uk:'Розрахунок', en:'Calculation', de:'Berechnung', fr:'Calcul', es:'Cálculo', 'es-MX':'Cálculo', it:'Calcolo', pt:'Cálculo', ar:'الحساب', hi:'गणना', ja:'計算', ky:'Эсептөө', 'zh-Hant':'計算' },
  calc_pct_of: { bg:'X% от Y', ru:'X% от Y', uk:'X% від Y', en:'X% of Y', de:'X% von Y', fr:'X% de Y', es:'X% de Y', 'es-MX':'X% de Y', it:'X% di Y', pt:'X% de Y', ar:'X% من Y', hi:'Y का X%', ja:'YのX%', ky:'Y дин X%', 'zh-Hant':'Y 的 X%' },
  calc_pct_iswhat: { bg:'X е колко % от Y', ru:'X — сколько % от Y', uk:'X — скільки % від Y', en:'X is what % of Y', de:'X ist wie viel % von Y', fr:'X est quel % de Y', es:'X es qué % de Y', 'es-MX':'X es qué % de Y', it:'X è che % di Y', pt:'X é quanto % de Y', ar:'X كم % من Y', hi:'X, Y का कितने % है', ja:'XはYの何%', ky:'X — Y дин канча %', 'zh-Hant':'X 是 Y 的百分之幾' },
  calc_pct_change: { bg:'Промяна от X до Y (%)', ru:'Изменение от X до Y (%)', uk:'Зміна від X до Y (%)', en:'Change from X to Y (%)', de:'Änderung von X zu Y (%)', fr:'Variation de X à Y (%)', es:'Cambio de X a Y (%)', 'es-MX':'Cambio de X a Y (%)', it:'Variazione da X a Y (%)', pt:'Variação de X para Y (%)', ar:'التغيّر من X إلى Y (%)', hi:'X से Y तक परिवर्तन (%)', ja:'XからYへの変化 (%)', ky:'X тен Y ге өзгөрүү (%)', 'zh-Hant':'從 X 到 Y 的變化 (%)' },
  calc_pct_l_percentX: { bg:'Процент X', ru:'Процент X', uk:'Відсоток X', en:'Percent X', de:'Prozent X', fr:'Pourcentage X', es:'Porcentaje X', 'es-MX':'Porcentaje X', it:'Percentuale X', pt:'Percentagem X', ar:'النسبة X', hi:'प्रतिशत X', ja:'割合 X', ky:'Пайыз X', 'zh-Hant':'百分比 X' },
  calc_pct_l_valueY: { bg:'Стойност Y', ru:'Значение Y', uk:'Значення Y', en:'Value Y', de:'Wert Y', fr:'Valeur Y', es:'Valor Y', 'es-MX':'Valor Y', it:'Valore Y', pt:'Valor Y', ar:'القيمة Y', hi:'मान Y', ja:'値 Y', ky:'Маани Y', 'zh-Hant':'值 Y' },
  calc_pct_l_valueX: { bg:'Стойност X', ru:'Значение X', uk:'Значення X', en:'Value X', de:'Wert X', fr:'Valeur X', es:'Valor X', 'es-MX':'Valor X', it:'Valore X', pt:'Valor X', ar:'القيمة X', hi:'मान X', ja:'値 X', ky:'Маани X', 'zh-Hant':'值 X' },
  calc_pct_l_totalY: { bg:'Обща стойност Y', ru:'Общее значение Y', uk:'Загальне значення Y', en:'Total value Y', de:'Gesamtwert Y', fr:'Valeur totale Y', es:'Valor total Y', 'es-MX':'Valor total Y', it:'Valore totale Y', pt:'Valor total Y', ar:'القيمة الإجمالية Y', hi:'कुल मान Y', ja:'合計値 Y', ky:'Жалпы маани Y', 'zh-Hant':'總值 Y' },
  calc_pct_l_startX: { bg:'Начална X', ru:'Начальное X', uk:'Початкове X', en:'Start X', de:'Anfang X', fr:'Début X', es:'Inicial X', 'es-MX':'Inicial X', it:'Iniziale X', pt:'Inicial X', ar:'البداية X', hi:'प्रारंभिक X', ja:'開始 X', ky:'Башталгыч X', 'zh-Hant':'起始 X' },
  calc_pct_l_endY: { bg:'Крайна Y', ru:'Конечное Y', uk:'Кінцеве Y', en:'End Y', de:'Ende Y', fr:'Fin Y', es:'Final Y', 'es-MX':'Final Y', it:'Finale Y', pt:'Final Y', ar:'النهاية Y', hi:'अंतिम Y', ja:'終了 Y', ky:'Акыркы Y', 'zh-Hant':'結束 Y' },
  calc_pct_r_of: { bg:'{0}% от {1} =', ru:'{0}% от {1} =', uk:'{0}% від {1} =', en:'{0}% of {1} =', de:'{0}% von {1} =', fr:'{0}% de {1} =', es:'{0}% de {1} =', 'es-MX':'{0}% de {1} =', it:'{0}% di {1} =', pt:'{0}% de {1} =', ar:'{0}% من {1} =', hi:'{1} का {0}% =', ja:'{1} の {0}% =', ky:'{1} дин {0}% =', 'zh-Hant':'{1} 的 {0}% =' },
  calc_pct_r_iswhat: { bg:'{0} от {1} е', ru:'{0} от {1} —', uk:'{0} від {1} —', en:'{0} of {1} is', de:'{0} von {1} ist', fr:'{0} sur {1} est', es:'{0} de {1} es', 'es-MX':'{0} de {1} es', it:'{0} di {1} è', pt:'{0} de {1} é', ar:'{0} من {1} هو', hi:'{1} का {0} है', ja:'{1} の {0} は', ky:'{1} дин {0} —', 'zh-Hant':'{1} 的 {0} 是' },
  calc_pct_r_change: { bg:'Промяна {0} → {1} =', ru:'Изменение {0} → {1} =', uk:'Зміна {0} → {1} =', en:'Change {0} → {1} =', de:'Änderung {0} → {1} =', fr:'Variation {0} → {1} =', es:'Cambio {0} → {1} =', 'es-MX':'Cambio {0} → {1} =', it:'Variazione {0} → {1} =', pt:'Variação {0} → {1} =', ar:'التغيّر {0} → {1} =', hi:'परिवर्तन {0} → {1} =', ja:'変化 {0} → {1} =', ky:'Өзгөрүү {0} → {1} =', 'zh-Hant':'變化 {0} → {1} =' }
});

export const title = t('calc_title');

function money(n) {
  return (isFinite(n) ? n : 0).toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function render(root) {
  root.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-tab="loan">${t('calc_tab_loan')}</button>
      <button class="tab" data-tab="vat">${t('calc_tab_vat')}</button>
      <button class="tab" data-tab="interest">${t('calc_tab_interest')}</button>
      <button class="tab" data-tab="pct">${t('calc_tab_pct')}</button>
    </div>

    <div class="tool-card" data-panel="loan">
      <label>${t('calc_loan_amount')}</label><input type="number" id="lAmount" value="10000" />
      <label>${t('calc_annual_rate')}</label><input type="number" id="lRate" value="8" step="0.01" />
      <label>${t('calc_term_months')}</label><input type="number" id="lMonths" value="60" />
      <button class="btn" id="loanBtn">${t('calc_calc_btn')}</button>
      <div class="out-block" id="loanOut" style="display:none"></div>
    </div>

    <div class="tool-card" data-panel="vat" style="display:none">
      <label>${t('calc_vat_country')}</label>
      <select id="vCountry">
        <option value="20">${t('calc_vat_c_bg')}</option>
        <option value="19">${t('calc_vat_c_de')}</option>
        <option value="21">${t('calc_vat_c_nl')}</option>
        <option value="22">${t('calc_vat_c_it')}</option>
        <option value="21">${t('calc_vat_c_es')}</option>
        <option value="20">${t('calc_vat_c_at')}</option>
        <option value="24">${t('calc_vat_c_gr')}</option>
        <option value="25">${t('calc_vat_c_se')}</option>
        <option value="0">${t('calc_vat_c_other')}</option>
      </select>
      <label>${t('calc_vat_rate')}</label><input type="number" id="vRate" value="20" step="0.1" />
      <label>${t('calc_amount')}</label><input type="number" id="vAmount" value="100" />
      <label>${t('calc_vat_amount_is')}</label>
      <select id="vMode">
        <option value="net">${t('calc_vat_mode_net')}</option>
        <option value="gross">${t('calc_vat_mode_gross')}</option>
      </select>
      <button class="btn" id="vatBtn">${t('calc_calc_btn')}</button>
      <div class="out-block" id="vatOut" style="display:none"></div>
    </div>

    <div class="tool-card" data-panel="interest" style="display:none">
      <label>${t('calc_int_principal')}</label><input type="number" id="iPrincipal" value="5000" />
      <label>${t('calc_annual_rate')}</label><input type="number" id="iRate" value="5" step="0.01" />
      <label>${t('calc_term_years')}</label><input type="number" id="iYears" value="3" step="0.1" />
      <label>${t('calc_int_type')}</label>
      <select id="iType">
        <option value="compound">${t('calc_int_compound')}</option>
        <option value="simple">${t('calc_int_simple')}</option>
      </select>
      <button class="btn" id="intBtn">${t('calc_calc_btn')}</button>
      <div class="out-block" id="intOut" style="display:none"></div>
    </div>

    <div class="tool-card" data-panel="pct" style="display:none">
      <label>${t('calc_pct_calc')}</label>
      <select id="pMode">
        <option value="of">${t('calc_pct_of')}</option>
        <option value="iswhat">${t('calc_pct_iswhat')}</option>
        <option value="change">${t('calc_pct_change')}</option>
      </select>
      <label id="pL1">${t('calc_pct_l_percentX')}</label><input type="number" id="pX" value="15" />
      <label id="pL2">${t('calc_pct_l_valueY')}</label><input type="number" id="pY" value="200" />
      <button class="btn" id="pctBtn">${t('calc_calc_btn')}</button>
      <div class="out-block" id="pctOut" style="display:none"></div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);

  root.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      root.querySelectorAll('[data-panel]').forEach((p) => {
        p.style.display = p.dataset.panel === t.dataset.tab ? 'block' : 'none';
      });
    });
  });

  // Заем
  $('#loanBtn').addEventListener('click', () => {
    const P = parseFloat($('#lAmount').value) || 0;
    const r = (parseFloat($('#lRate').value) || 0) / 100 / 12;
    const n = parseInt($('#lMonths').value, 10) || 1;
    const m = r > 0 ? P * r / (1 - Math.pow(1 + r, -n)) : P / n;
    const total = m * n, interest = total - P;
    const o = $('#loanOut'); o.style.display = 'block';
    o.innerHTML =
      `<div class="line"><span>${t('calc_loan_monthly')}</span><span>${money(m)}</span></div>` +
      `<div class="line"><span>${t('calc_loan_totinterest')}</span><span>${money(interest)}</span></div>` +
      `<div class="line"><span>${t('calc_loan_totpay')}</span><span>${money(total)}</span></div>`;
  });

  // ДДС
  $('#vCountry').addEventListener('change', () => {
    const v = $('#vCountry').value;
    if (v !== '0') $('#vRate').value = v;
  });
  $('#vatBtn').addEventListener('click', () => {
    const rate = (parseFloat($('#vRate').value) || 0) / 100;
    const amt = parseFloat($('#vAmount').value) || 0;
    const mode = $('#vMode').value;
    let net, vat, gross;
    if (mode === 'net') { net = amt; vat = amt * rate; gross = net + vat; }
    else { gross = amt; net = amt / (1 + rate); vat = gross - net; }
    const o = $('#vatOut'); o.style.display = 'block';
    o.innerHTML =
      `<div class="line"><span>${t('calc_vat_net')}</span><span>${money(net)}</span></div>` +
      `<div class="line"><span>${t('calc_vat_vat')}</span><span>${money(vat)}</span></div>` +
      `<div class="line"><span>${t('calc_vat_gross')}</span><span>${money(gross)}</span></div>`;
  });

  // Лихва
  $('#intBtn').addEventListener('click', () => {
    const P = parseFloat($('#iPrincipal').value) || 0;
    const r = (parseFloat($('#iRate').value) || 0) / 100;
    const y = parseFloat($('#iYears').value) || 0;
    const type = $('#iType').value;
    const total = type === 'compound' ? P * Math.pow(1 + r, y) : P * (1 + r * y);
    const interest = total - P;
    const o = $('#intOut'); o.style.display = 'block';
    o.innerHTML =
      `<div class="line"><span>${t('calc_int_principal')}</span><span>${money(P)}</span></div>` +
      `<div class="line"><span>${t('calc_int_accrued')}</span><span>${money(interest)}</span></div>` +
      `<div class="line"><span>${t('calc_int_final')}</span><span>${money(total)}</span></div>`;
  });

  // Проценти
  function pctLabels() {
    const m = $('#pMode').value;
    if (m === 'of') { $('#pL1').textContent = t('calc_pct_l_percentX'); $('#pL2').textContent = t('calc_pct_l_valueY'); }
    else if (m === 'iswhat') { $('#pL1').textContent = t('calc_pct_l_valueX'); $('#pL2').textContent = t('calc_pct_l_totalY'); }
    else { $('#pL1').textContent = t('calc_pct_l_startX'); $('#pL2').textContent = t('calc_pct_l_endY'); }
  }
  $('#pMode').addEventListener('change', pctLabels);
  $('#pctBtn').addEventListener('click', () => {
    const X = parseFloat($('#pX').value) || 0;
    const Y = parseFloat($('#pY').value) || 0;
    const m = $('#pMode').value;
    const o = $('#pctOut'); o.style.display = 'block';
    let label, val;
    if (m === 'of') { val = money(X / 100 * Y); label = tf('calc_pct_r_of', X, Y); }
    else if (m === 'iswhat') { val = (Y !== 0 ? (X / Y * 100) : 0).toFixed(2) + '%'; label = tf('calc_pct_r_iswhat', X, Y); }
    else { val = (X !== 0 ? ((Y - X) / X * 100) : 0).toFixed(2) + '%'; label = tf('calc_pct_r_change', X, Y); }
    o.innerHTML = `<div class="line"><span>${label}</span><span>${val}</span></div>`;
  });
  pctLabels();
}
