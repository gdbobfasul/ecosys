// Version: 1.0020
// Личен бюджет — обогатяване по Huawei 4.3 (09.09.2026). Четири под-таба:
//   • Пликове — категории с месечен лимит, разходи по дата, лента на запълване и предупреждение
//     (над 80 % / превишен лимит);
//   • Абонаменти — повтарящи се разходи/приходи (седмично/месечно/годишно) с календар на
//     следващите 30 дни и месечен сбор; „✓ Платено" мести датата напред;
//   • Отчети — по категория за месеца и по месеци (последните 6) с графика на платно + износ CSV;
//   • Нетна стойност — активи − пасиви с месечни моментни снимки и линия на промяната.
// ВСИЧКО се пази САМО на устройството (localStorage). Без мрежа, без акаунт.
import { esc, downloadBlob } from '../core/ui.js';
import { t, tf, register, getLang } from '../core/i18n.js';

register({
  bd_title: { bg:'Личен бюджет', ru:'Личный бюджет', uk:'Особистий бюджет', en:'Personal budget', de:'Persönliches Budget', fr:'Budget personnel', es:'Presupuesto personal', 'es-MX':'Presupuesto personal', it:'Bilancio personale', pt:'Orçamento pessoal', ar:'الميزانية الشخصية', hi:'व्यक्तिगत बजट', ja:'家計簿', ky:'Жеке бюджет', 'zh-Hant':'個人預算' },
  bd_tab_env: { bg:'Пликове', ru:'Конверты', uk:'Конверти', en:'Envelopes', de:'Umschläge', fr:'Enveloppes', es:'Sobres', 'es-MX':'Sobres', it:'Buste', pt:'Envelopes', ar:'المظاريف', hi:'लिफ़ाफ़े', ja:'封筒', ky:'Конверттер', 'zh-Hant':'信封' },
  bd_tab_subs: { bg:'Абонаменти', ru:'Подписки', uk:'Підписки', en:'Recurring', de:'Abos', fr:'Récurrents', es:'Recurrentes', 'es-MX':'Recurrentes', it:'Ricorrenti', pt:'Recorrentes', ar:'المتكررة', hi:'आवर्ती', ja:'定期', ky:'Кайталануучу', 'zh-Hant':'定期' },
  bd_tab_rep: { bg:'Отчети', ru:'Отчёты', uk:'Звіти', en:'Reports', de:'Berichte', fr:'Rapports', es:'Informes', 'es-MX':'Reportes', it:'Report', pt:'Relatórios', ar:'التقارير', hi:'रिपोर्ट', ja:'レポート', ky:'Отчёттор', 'zh-Hant':'報表' },
  bd_tab_nw: { bg:'Нетна стойност', ru:'Чистая стоимость', uk:'Чиста вартість', en:'Net worth', de:'Nettovermögen', fr:'Valeur nette', es:'Patrimonio neto', 'es-MX':'Patrimonio neto', it:'Patrimonio netto', pt:'Património líquido', ar:'صافي الثروة', hi:'शुद्ध संपत्ति', ja:'純資産', ky:'Таза баалуулук', 'zh-Hant':'淨資產' },
  bd_month: { bg:'Месец', ru:'Месяц', uk:'Місяць', en:'Month', de:'Monat', fr:'Mois', es:'Mes', 'es-MX':'Mes', it:'Mese', pt:'Mês', ar:'الشهر', hi:'महीना', ja:'月', ky:'Ай', 'zh-Hant':'月份' },
  bd_currency: { bg:'Валута (надпис)', ru:'Валюта (подпись)', uk:'Валюта (підпис)', en:'Currency (label)', de:'Währung (Kürzel)', fr:'Devise (libellé)', es:'Moneda (etiqueta)', 'es-MX':'Moneda (etiqueta)', it:'Valuta (sigla)', pt:'Moeda (rótulo)', ar:'العملة (رمز)', hi:'मुद्रा (लेबल)', ja:'通貨（表示）', ky:'Валюта (жазуу)', 'zh-Hant':'貨幣（標籤）' },
  bd_local_note: { bg:'Всичко се пази само на устройството — без акаунт, без облак.', ru:'Всё хранится только на устройстве — без аккаунта, без облака.', uk:'Усе зберігається лише на пристрої — без акаунта, без хмари.', en:'Everything is stored only on your device — no account, no cloud.', de:'Alles wird nur auf dem Gerät gespeichert — kein Konto, keine Cloud.', fr:'Tout est stocké uniquement sur l’appareil — sans compte, sans cloud.', es:'Todo se guarda solo en el dispositivo — sin cuenta, sin nube.', 'es-MX':'Todo se guarda solo en el dispositivo — sin cuenta, sin nube.', it:'Tutto resta solo sul dispositivo — senza account, senza cloud.', pt:'Tudo fica só no dispositivo — sem conta, sem nuvem.', ar:'كل شيء يُحفظ على جهازك فقط — بلا حساب وبلا سحابة.', hi:'सब कुछ केवल डिवाइस पर रहता है — न खाता, न क्लाउड।', ja:'すべて端末内にのみ保存 — アカウント・クラウド不要。', ky:'Баары түзмөктө гана сакталат — аккаунтсуз, булутсуз.', 'zh-Hant':'一切僅儲存於裝置 — 無帳號、無雲端。' },
  bd_cat_name: { bg:'Плик (категория)', ru:'Конверт (категория)', uk:'Конверт (категорія)', en:'Envelope (category)', de:'Umschlag (Kategorie)', fr:'Enveloppe (catégorie)', es:'Sobre (categoría)', 'es-MX':'Sobre (categoría)', it:'Busta (categoria)', pt:'Envelope (categoria)', ar:'المظروف (الفئة)', hi:'लिफ़ाफ़ा (श्रेणी)', ja:'封筒（カテゴリ）', ky:'Конверт (категория)', 'zh-Hant':'信封（類別）' },
  bd_cat_limit: { bg:'Месечен лимит', ru:'Месячный лимит', uk:'Місячний ліміт', en:'Monthly limit', de:'Monatslimit', fr:'Limite mensuelle', es:'Límite mensual', 'es-MX':'Límite mensual', it:'Limite mensile', pt:'Limite mensal', ar:'الحد الشهري', hi:'मासिक सीमा', ja:'月の上限', ky:'Айлык лимит', 'zh-Hant':'每月上限' },
  bd_add_cat: { bg:'+ Добави плик', ru:'+ Добавить конверт', uk:'+ Додати конверт', en:'+ Add envelope', de:'+ Umschlag hinzufügen', fr:'+ Ajouter une enveloppe', es:'+ Añadir sobre', 'es-MX':'+ Agregar sobre', it:'+ Aggiungi busta', pt:'+ Adicionar envelope', ar:'+ إضافة مظروف', hi:'+ लिफ़ाफ़ा जोड़ें', ja:'+ 封筒を追加', ky:'+ Конверт кошуу', 'zh-Hant':'+ 新增信封' },
  bd_no_cats: { bg:'Няма пликове. Добави категория с месечен лимит (напр. Храна 400).', ru:'Конвертов нет. Добавьте категорию с месячным лимитом (напр. Еда 400).', uk:'Конвертів немає. Додайте категорію з місячним лімітом (напр. Їжа 400).', en:'No envelopes yet. Add a category with a monthly limit (e.g. Food 400).', de:'Noch keine Umschläge. Füge eine Kategorie mit Monatslimit hinzu (z. B. Essen 400).', fr:'Aucune enveloppe. Ajoutez une catégorie avec une limite mensuelle (ex. Alimentation 400).', es:'Sin sobres. Añade una categoría con límite mensual (p. ej. Comida 400).', 'es-MX':'Sin sobres. Agrega una categoría con límite mensual (p. ej. Comida 400).', it:'Nessuna busta. Aggiungi una categoria con limite mensile (es. Cibo 400).', pt:'Sem envelopes. Adicione uma categoria com limite mensal (ex. Comida 400).', ar:'لا مظاريف بعد. أضف فئة بحد شهري (مثال: طعام 400).', hi:'अभी कोई लिफ़ाफ़ा नहीं। मासिक सीमा वाली श्रेणी जोड़ें (जैसे भोजन 400)।', ja:'封筒がありません。月の上限付きカテゴリを追加（例：食費 400）。', ky:'Конверт жок. Айлык лимити бар категория кош (мис. Тамак 400).', 'zh-Hant':'尚無信封。新增有每月上限的類別（例如 食物 400）。' },
  bd_spent_of: { bg:'изхарчени {0} от {1}', ru:'потрачено {0} из {1}', uk:'витрачено {0} з {1}', en:'spent {0} of {1}', de:'{0} von {1} ausgegeben', fr:'{0} dépensés sur {1}', es:'gastado {0} de {1}', 'es-MX':'gastado {0} de {1}', it:'spesi {0} su {1}', pt:'gasto {0} de {1}', ar:'أُنفق {0} من {1}', hi:'{1} में से {0} खर्च', ja:'{1} 中 {0} 使用', ky:'{1} ичинен {0} жумшалды', 'zh-Hant':'已花 {0}／{1}' },
  bd_left: { bg:'остават {0}', ru:'осталось {0}', uk:'залишилось {0}', en:'{0} left', de:'{0} übrig', fr:'reste {0}', es:'quedan {0}', 'es-MX':'quedan {0}', it:'restano {0}', pt:'restam {0}', ar:'المتبقي {0}', hi:'{0} शेष', ja:'残り {0}', ky:'{0} калды', 'zh-Hant':'剩餘 {0}' },
  bd_over: { bg:'превишение с {0}', ru:'перерасход {0}', uk:'перевитрата {0}', en:'over by {0}', de:'{0} überzogen', fr:'dépassement de {0}', es:'excedido en {0}', 'es-MX':'excedido en {0}', it:'sforato di {0}', pt:'excedido em {0}', ar:'تجاوز بمقدار {0}', hi:'{0} अधिक', ja:'{0} 超過', ky:'{0} ашып кетти', 'zh-Hant':'超出 {0}' },
  bd_warn80: { bg:'⚠ Близо до лимита (над 80 %)', ru:'⚠ Близко к лимиту (более 80 %)', uk:'⚠ Близько до ліміту (понад 80 %)', en:'⚠ Close to the limit (over 80%)', de:'⚠ Nahe am Limit (über 80 %)', fr:'⚠ Proche de la limite (plus de 80 %)', es:'⚠ Cerca del límite (más del 80 %)', 'es-MX':'⚠ Cerca del límite (más del 80 %)', it:'⚠ Vicino al limite (oltre l’80 %)', pt:'⚠ Perto do limite (mais de 80 %)', ar:'⚠ قريب من الحد (أكثر من 80%)', hi:'⚠ सीमा के करीब (80% से अधिक)', ja:'⚠ 上限に接近（80% 超）', ky:'⚠ Лимитке жакын (80 % дан ашык)', 'zh-Hant':'⚠ 接近上限（超過 80%）' },
  bd_warn_over: { bg:'⛔ Лимитът е превишен!', ru:'⛔ Лимит превышен!', uk:'⛔ Ліміт перевищено!', en:'⛔ Limit exceeded!', de:'⛔ Limit überschritten!', fr:'⛔ Limite dépassée !', es:'⛔ ¡Límite superado!', 'es-MX':'⛔ ¡Límite superado!', it:'⛔ Limite superato!', pt:'⛔ Limite excedido!', ar:'⛔ تم تجاوز الحد!', hi:'⛔ सीमा पार हो गई!', ja:'⛔ 上限を超えました！', ky:'⛔ Лимит ашып кетти!', 'zh-Hant':'⛔ 已超出上限！' },
  bd_tx_date: { bg:'Дата', ru:'Дата', uk:'Дата', en:'Date', de:'Datum', fr:'Date', es:'Fecha', 'es-MX':'Fecha', it:'Data', pt:'Data', ar:'التاريخ', hi:'तारीख़', ja:'日付', ky:'Дата', 'zh-Hant':'日期' },
  bd_tx_amount: { bg:'Сума', ru:'Сумма', uk:'Сума', en:'Amount', de:'Betrag', fr:'Montant', es:'Importe', 'es-MX':'Monto', it:'Importo', pt:'Valor', ar:'المبلغ', hi:'राशि', ja:'金額', ky:'Сумма', 'zh-Hant':'金額' },
  bd_tx_note: { bg:'Бележка (по избор)', ru:'Заметка (необязательно)', uk:'Нотатка (необов’язково)', en:'Note (optional)', de:'Notiz (optional)', fr:'Note (facultatif)', es:'Nota (opcional)', 'es-MX':'Nota (opcional)', it:'Nota (facoltativa)', pt:'Nota (opcional)', ar:'ملاحظة (اختياري)', hi:'नोट (वैकल्पिक)', ja:'メモ（任意）', ky:'Эскертүү (милдеттүү эмес)', 'zh-Hant':'備註（選填）' },
  bd_add_tx: { bg:'+ Запиши разход', ru:'+ Записать расход', uk:'+ Записати витрату', en:'+ Record expense', de:'+ Ausgabe erfassen', fr:'+ Enregistrer une dépense', es:'+ Registrar gasto', 'es-MX':'+ Registrar gasto', it:'+ Registra spesa', pt:'+ Registar despesa', ar:'+ تسجيل مصروف', hi:'+ खर्च दर्ज करें', ja:'+ 支出を記録', ky:'+ Чыгым жазуу', 'zh-Hant':'+ 記錄支出' },
  bd_tx_list: { bg:'Разходи за месеца', ru:'Расходы за месяц', uk:'Витрати за місяць', en:'Expenses this month', de:'Ausgaben im Monat', fr:'Dépenses du mois', es:'Gastos del mes', 'es-MX':'Gastos del mes', it:'Spese del mese', pt:'Despesas do mês', ar:'مصروفات الشهر', hi:'इस महीने के खर्च', ja:'今月の支出', ky:'Айдын чыгымдары', 'zh-Hant':'本月支出' },
  bd_no_tx: { bg:'Няма разходи за този месец.', ru:'Расходов за этот месяц нет.', uk:'Витрат за цей місяць немає.', en:'No expenses for this month.', de:'Keine Ausgaben in diesem Monat.', fr:'Aucune dépense ce mois-ci.', es:'Sin gastos este mes.', 'es-MX':'Sin gastos este mes.', it:'Nessuna spesa questo mese.', pt:'Sem despesas neste mês.', ar:'لا مصروفات لهذا الشهر.', hi:'इस महीने कोई खर्च नहीं।', ja:'今月の支出はありません。', ky:'Бул айда чыгым жок.', 'zh-Hant':'本月尚無支出。' },
  bd_delete: { bg:'Изтрий', ru:'Удалить', uk:'Видалити', en:'Delete', de:'Löschen', fr:'Supprimer', es:'Eliminar', 'es-MX':'Eliminar', it:'Elimina', pt:'Eliminar', ar:'حذف', hi:'हटाएँ', ja:'削除', ky:'Өчүрүү', 'zh-Hant':'刪除' },
  bd_total_limit: { bg:'Общ лимит', ru:'Общий лимит', uk:'Загальний ліміт', en:'Total limit', de:'Gesamtlimit', fr:'Limite totale', es:'Límite total', 'es-MX':'Límite total', it:'Limite totale', pt:'Limite total', ar:'الحد الإجمالي', hi:'कुल सीमा', ja:'上限合計', ky:'Жалпы лимит', 'zh-Hant':'總上限' },
  bd_total_spent: { bg:'Общо изхарчено', ru:'Всего потрачено', uk:'Усього витрачено', en:'Total spent', de:'Gesamt ausgegeben', fr:'Total dépensé', es:'Total gastado', 'es-MX':'Total gastado', it:'Totale speso', pt:'Total gasto', ar:'إجمالي المنفق', hi:'कुल खर्च', ja:'支出合計', ky:'Жалпы жумшалды', 'zh-Hant':'總支出' },
  bd_sub_name: { bg:'Име (напр. Netflix, наем)', ru:'Название (напр. Netflix, аренда)', uk:'Назва (напр. Netflix, оренда)', en:'Name (e.g. Netflix, rent)', de:'Name (z. B. Netflix, Miete)', fr:'Nom (ex. Netflix, loyer)', es:'Nombre (p. ej. Netflix, alquiler)', 'es-MX':'Nombre (p. ej. Netflix, renta)', it:'Nome (es. Netflix, affitto)', pt:'Nome (ex. Netflix, renda)', ar:'الاسم (مثال: Netflix، الإيجار)', hi:'नाम (जैसे Netflix, किराया)', ja:'名前（例：Netflix、家賃）', ky:'Аты (мис. Netflix, ижара)', 'zh-Hant':'名稱（例如 Netflix、房租）' },
  bd_sub_period: { bg:'Период', ru:'Период', uk:'Період', en:'Period', de:'Zeitraum', fr:'Période', es:'Periodo', 'es-MX':'Periodo', it:'Periodo', pt:'Período', ar:'الفترة', hi:'अवधि', ja:'周期', ky:'Мезгил', 'zh-Hant':'週期' },
  bd_per_w: { bg:'Седмично', ru:'Еженедельно', uk:'Щотижня', en:'Weekly', de:'Wöchentlich', fr:'Hebdomadaire', es:'Semanal', 'es-MX':'Semanal', it:'Settimanale', pt:'Semanal', ar:'أسبوعي', hi:'साप्ताहिक', ja:'毎週', ky:'Жума сайын', 'zh-Hant':'每週' },
  bd_per_m: { bg:'Месечно', ru:'Ежемесячно', uk:'Щомісяця', en:'Monthly', de:'Monatlich', fr:'Mensuel', es:'Mensual', 'es-MX':'Mensual', it:'Mensile', pt:'Mensal', ar:'شهري', hi:'मासिक', ja:'毎月', ky:'Ай сайын', 'zh-Hant':'每月' },
  bd_per_y: { bg:'Годишно', ru:'Ежегодно', uk:'Щороку', en:'Yearly', de:'Jährlich', fr:'Annuel', es:'Anual', 'es-MX':'Anual', it:'Annuale', pt:'Anual', ar:'سنوي', hi:'वार्षिक', ja:'毎年', ky:'Жыл сайын', 'zh-Hant':'每年' },
  bd_sub_next: { bg:'Следващо плащане', ru:'Следующий платёж', uk:'Наступний платіж', en:'Next payment', de:'Nächste Zahlung', fr:'Prochain paiement', es:'Próximo pago', 'es-MX':'Próximo pago', it:'Prossimo pagamento', pt:'Próximo pagamento', ar:'الدفعة التالية', hi:'अगला भुगतान', ja:'次回支払い', ky:'Кийинки төлөм', 'zh-Hant':'下次付款' },
  bd_sub_kind: { bg:'Вид', ru:'Тип', uk:'Тип', en:'Type', de:'Art', fr:'Type', es:'Tipo', 'es-MX':'Tipo', it:'Tipo', pt:'Tipo', ar:'النوع', hi:'प्रकार', ja:'種類', ky:'Түрү', 'zh-Hant':'類型' },
  bd_kind_exp: { bg:'Разход', ru:'Расход', uk:'Витрата', en:'Expense', de:'Ausgabe', fr:'Dépense', es:'Gasto', 'es-MX':'Gasto', it:'Spesa', pt:'Despesa', ar:'مصروف', hi:'खर्च', ja:'支出', ky:'Чыгым', 'zh-Hant':'支出' },
  bd_kind_inc: { bg:'Приход', ru:'Доход', uk:'Дохід', en:'Income', de:'Einnahme', fr:'Revenu', es:'Ingreso', 'es-MX':'Ingreso', it:'Entrata', pt:'Receita', ar:'دخل', hi:'आय', ja:'収入', ky:'Киреше', 'zh-Hant':'收入' },
  bd_add_sub: { bg:'+ Добави', ru:'+ Добавить', uk:'+ Додати', en:'+ Add', de:'+ Hinzufügen', fr:'+ Ajouter', es:'+ Añadir', 'es-MX':'+ Agregar', it:'+ Aggiungi', pt:'+ Adicionar', ar:'+ إضافة', hi:'+ जोड़ें', ja:'+ 追加', ky:'+ Кошуу', 'zh-Hant':'+ 新增' },
  bd_no_subs: { bg:'Няма повтарящи се плащания.', ru:'Повторяющихся платежей нет.', uk:'Повторюваних платежів немає.', en:'No recurring payments.', de:'Keine wiederkehrenden Zahlungen.', fr:'Aucun paiement récurrent.', es:'Sin pagos recurrentes.', 'es-MX':'Sin pagos recurrentes.', it:'Nessun pagamento ricorrente.', pt:'Sem pagamentos recorrentes.', ar:'لا مدفوعات متكررة.', hi:'कोई आवर्ती भुगतान नहीं।', ja:'定期支払いはありません。', ky:'Кайталануучу төлөм жок.', 'zh-Hant':'尚無定期付款。' },
  bd_sub_monthly_total: { bg:'На месец: разходи {0} · приходи {1}', ru:'В месяц: расходы {0} · доходы {1}', uk:'На місяць: витрати {0} · доходи {1}', en:'Per month: expenses {0} · income {1}', de:'Pro Monat: Ausgaben {0} · Einnahmen {1}', fr:'Par mois : dépenses {0} · revenus {1}', es:'Al mes: gastos {0} · ingresos {1}', 'es-MX':'Al mes: gastos {0} · ingresos {1}', it:'Al mese: spese {0} · entrate {1}', pt:'Por mês: despesas {0} · receitas {1}', ar:'شهريًا: مصروفات {0} · دخل {1}', hi:'प्रति माह: खर्च {0} · आय {1}', ja:'月あたり：支出 {0} · 収入 {1}', ky:'Айына: чыгым {0} · киреше {1}', 'zh-Hant':'每月：支出 {0} · 收入 {1}' },
  bd_upcoming: { bg:'Календар — следващите 30 дни', ru:'Календарь — ближайшие 30 дней', uk:'Календар — наступні 30 днів', en:'Calendar — next 30 days', de:'Kalender — nächste 30 Tage', fr:'Calendrier — 30 prochains jours', es:'Calendario — próximos 30 días', 'es-MX':'Calendario — próximos 30 días', it:'Calendario — prossimi 30 giorni', pt:'Calendário — próximos 30 dias', ar:'التقويم — الثلاثون يومًا القادمة', hi:'कैलेंडर — अगले 30 दिन', ja:'カレンダー — 今後30日', ky:'Календарь — кийинки 30 күн', 'zh-Hant':'日曆 — 未來 30 天' },
  bd_no_upcoming: { bg:'Нищо в следващите 30 дни.', ru:'В ближайшие 30 дней ничего нет.', uk:'У наступні 30 днів нічого немає.', en:'Nothing in the next 30 days.', de:'Nichts in den nächsten 30 Tagen.', fr:'Rien dans les 30 prochains jours.', es:'Nada en los próximos 30 días.', 'es-MX':'Nada en los próximos 30 días.', it:'Niente nei prossimi 30 giorni.', pt:'Nada nos próximos 30 dias.', ar:'لا شيء خلال الثلاثين يومًا القادمة.', hi:'अगले 30 दिनों में कुछ नहीं।', ja:'今後30日間に予定はありません。', ky:'Кийинки 30 күндө эч нерсе жок.', 'zh-Hant':'未來 30 天沒有項目。' },
  bd_days_in: { bg:'след {0} дни', ru:'через {0} дн.', uk:'через {0} дн.', en:'in {0} days', de:'in {0} Tagen', fr:'dans {0} jours', es:'en {0} días', 'es-MX':'en {0} días', it:'tra {0} giorni', pt:'em {0} dias', ar:'بعد {0} يومًا', hi:'{0} दिनों में', ja:'{0} 日後', ky:'{0} күндөн кийин', 'zh-Hant':'{0} 天後' },
  bd_today: { bg:'днес', ru:'сегодня', uk:'сьогодні', en:'today', de:'heute', fr:'aujourd’hui', es:'hoy', 'es-MX':'hoy', it:'oggi', pt:'hoje', ar:'اليوم', hi:'आज', ja:'今日', ky:'бүгүн', 'zh-Hant':'今天' },
  bd_overdue: { bg:'просрочено', ru:'просрочено', uk:'прострочено', en:'overdue', de:'überfällig', fr:'en retard', es:'vencido', 'es-MX':'vencido', it:'scaduto', pt:'em atraso', ar:'متأخر', hi:'अतिदेय', ja:'期限超過', ky:'мөөнөтү өткөн', 'zh-Hant':'逾期' },
  bd_paid: { bg:'Платено → следващата дата', ru:'Оплачено → следующая дата', uk:'Оплачено → наступна дата', en:'Paid → next date', de:'Bezahlt → nächstes Datum', fr:'Payé → date suivante', es:'Pagado → siguiente fecha', 'es-MX':'Pagado → siguiente fecha', it:'Pagato → data successiva', pt:'Pago → próxima data', ar:'مدفوع → التاريخ التالي', hi:'भुगतान हुआ → अगली तारीख़', ja:'支払済 → 次回日付へ', ky:'Төлөндү → кийинки дата', 'zh-Hant':'已付 → 下一日期' },
  bd_rep_bycat: { bg:'По категория за месеца', ru:'По категориям за месяц', uk:'За категоріями за місяць', en:'By category this month', de:'Nach Kategorie im Monat', fr:'Par catégorie ce mois', es:'Por categoría este mes', 'es-MX':'Por categoría este mes', it:'Per categoria questo mese', pt:'Por categoria neste mês', ar:'حسب الفئة لهذا الشهر', hi:'इस महीने श्रेणी अनुसार', ja:'今月のカテゴリ別', ky:'Бул айда категория боюнча', 'zh-Hant':'本月依類別' },
  bd_rep_bymonth: { bg:'По месеци (последните 6)', ru:'По месяцам (последние 6)', uk:'За місяцями (останні 6)', en:'By month (last 6)', de:'Nach Monat (letzte 6)', fr:'Par mois (6 derniers)', es:'Por mes (últimos 6)', 'es-MX':'Por mes (últimos 6)', it:'Per mese (ultimi 6)', pt:'Por mês (últimos 6)', ar:'حسب الشهر (آخر 6)', hi:'महीने अनुसार (पिछले 6)', ja:'月別（直近6か月）', ky:'Айлар боюнча (акыркы 6)', 'zh-Hant':'依月份（最近 6 個月）' },
  bd_export_csv: { bg:'⬇ Изнеси всички разходи (CSV)', ru:'⬇ Экспорт всех расходов (CSV)', uk:'⬇ Експорт усіх витрат (CSV)', en:'⬇ Export all expenses (CSV)', de:'⬇ Alle Ausgaben exportieren (CSV)', fr:'⬇ Exporter toutes les dépenses (CSV)', es:'⬇ Exportar todos los gastos (CSV)', 'es-MX':'⬇ Exportar todos los gastos (CSV)', it:'⬇ Esporta tutte le spese (CSV)', pt:'⬇ Exportar todas as despesas (CSV)', ar:'⬇ تصدير كل المصروفات (CSV)', hi:'⬇ सभी खर्च निर्यात करें (CSV)', ja:'⬇ 全支出を書き出し（CSV）', ky:'⬇ Бардык чыгымдарды чыгаруу (CSV)', 'zh-Hant':'⬇ 匯出全部支出（CSV）' },
  bd_no_data: { bg:'Няма данни за отчет — запиши разходи в „Пликове".', ru:'Нет данных для отчёта — запишите расходы в «Конвертах».', uk:'Немає даних для звіту — запишіть витрати в «Конвертах».', en:'No data to report — record expenses under “Envelopes”.', de:'Keine Daten — erfasse Ausgaben unter „Umschläge“.', fr:'Aucune donnée — enregistrez des dépenses dans « Enveloppes ».', es:'Sin datos — registra gastos en «Sobres».', 'es-MX':'Sin datos — registra gastos en «Sobres».', it:'Nessun dato — registra spese in «Buste».', pt:'Sem dados — registe despesas em «Envelopes».', ar:'لا بيانات — سجّل مصروفات في «المظاريف».', hi:'कोई डेटा नहीं — “लिफ़ाफ़े” में खर्च दर्ज करें।', ja:'データなし — 「封筒」で支出を記録してください。', ky:'Маалымат жок — «Конверттер» бөлүмүнө чыгым жаз.', 'zh-Hant':'沒有資料 — 請在「信封」記錄支出。' },
  bd_assets: { bg:'Активи (какво имам)', ru:'Активы (что у меня есть)', uk:'Активи (що я маю)', en:'Assets (what I own)', de:'Vermögen (was ich besitze)', fr:'Actifs (ce que je possède)', es:'Activos (lo que tengo)', 'es-MX':'Activos (lo que tengo)', it:'Attività (cosa possiedo)', pt:'Ativos (o que tenho)', ar:'الأصول (ما أملكه)', hi:'संपत्तियाँ (जो मेरे पास है)', ja:'資産（持っているもの）', ky:'Активдер (эмнем бар)', 'zh-Hant':'資產（我擁有的）' },
  bd_liab: { bg:'Пасиви (какво дължа)', ru:'Пассивы (что я должен)', uk:'Пасиви (що я винен)', en:'Liabilities (what I owe)', de:'Verbindlichkeiten (was ich schulde)', fr:'Passifs (ce que je dois)', es:'Pasivos (lo que debo)', 'es-MX':'Pasivos (lo que debo)', it:'Passività (cosa devo)', pt:'Passivos (o que devo)', ar:'الالتزامات (ما أدين به)', hi:'देनदारियाँ (जो मुझ पर बकाया है)', ja:'負債（借りているもの）', ky:'Пассивдер (карызым)', 'zh-Hant':'負債（我欠的）' },
  bd_item_name: { bg:'Име', ru:'Название', uk:'Назва', en:'Name', de:'Name', fr:'Nom', es:'Nombre', 'es-MX':'Nombre', it:'Nome', pt:'Nome', ar:'الاسم', hi:'नाम', ja:'名前', ky:'Аты', 'zh-Hant':'名稱' },
  bd_item_val: { bg:'Стойност', ru:'Стоимость', uk:'Вартість', en:'Value', de:'Wert', fr:'Valeur', es:'Valor', 'es-MX':'Valor', it:'Valore', pt:'Valor', ar:'القيمة', hi:'मूल्य', ja:'金額', ky:'Баасы', 'zh-Hant':'價值' },
  bd_add_asset: { bg:'+ Актив', ru:'+ Актив', uk:'+ Актив', en:'+ Asset', de:'+ Vermögenswert', fr:'+ Actif', es:'+ Activo', 'es-MX':'+ Activo', it:'+ Attività', pt:'+ Ativo', ar:'+ أصل', hi:'+ संपत्ति', ja:'+ 資産', ky:'+ Актив', 'zh-Hant':'+ 資產' },
  bd_add_liab: { bg:'+ Пасив', ru:'+ Пассив', uk:'+ Пасив', en:'+ Liability', de:'+ Verbindlichkeit', fr:'+ Passif', es:'+ Pasivo', 'es-MX':'+ Pasivo', it:'+ Passività', pt:'+ Passivo', ar:'+ التزام', hi:'+ देनदारी', ja:'+ 負債', ky:'+ Пассив', 'zh-Hant':'+ 負債' },
  bd_networth: { bg:'Нетна стойност', ru:'Чистая стоимость', uk:'Чиста вартість', en:'Net worth', de:'Nettovermögen', fr:'Valeur nette', es:'Patrimonio neto', 'es-MX':'Patrimonio neto', it:'Patrimonio netto', pt:'Património líquido', ar:'صافي الثروة', hi:'शुद्ध संपत्ति', ja:'純資産', ky:'Таза баалуулук', 'zh-Hant':'淨資產' },
  bd_snapshot: { bg:'📌 Запази снимка за този месец', ru:'📌 Сохранить снимок за этот месяц', uk:'📌 Зберегти знімок за цей місяць', en:'📌 Save snapshot for this month', de:'📌 Momentaufnahme für diesen Monat speichern', fr:'📌 Enregistrer l’instantané du mois', es:'📌 Guardar instantánea de este mes', 'es-MX':'📌 Guardar instantánea de este mes', it:'📌 Salva istantanea del mese', pt:'📌 Guardar registo deste mês', ar:'📌 حفظ لقطة لهذا الشهر', hi:'📌 इस महीने का स्नैपशॉट सहेजें', ja:'📌 今月のスナップショットを保存', ky:'📌 Бул айдын сүрөтүн сактоо', 'zh-Hant':'📌 儲存本月快照' },
  bd_history: { bg:'История по месеци', ru:'История по месяцам', uk:'Історія за місяцями', en:'History by month', de:'Verlauf nach Monat', fr:'Historique par mois', es:'Historial por mes', 'es-MX':'Historial por mes', it:'Storico per mese', pt:'Histórico por mês', ar:'السجل حسب الشهر', hi:'महीने अनुसार इतिहास', ja:'月別の履歴', ky:'Айлар боюнча тарых', 'zh-Hant':'每月歷史' },
  bd_no_snap: { bg:'Няма записи. Запази първата снимка.', ru:'Записей нет. Сохраните первый снимок.', uk:'Записів немає. Збережіть перший знімок.', en:'No records yet. Save the first snapshot.', de:'Noch keine Einträge. Speichere die erste Momentaufnahme.', fr:'Aucun enregistrement. Enregistrez le premier instantané.', es:'Sin registros. Guarda la primera instantánea.', 'es-MX':'Sin registros. Guarda la primera instantánea.', it:'Nessun record. Salva la prima istantanea.', pt:'Sem registos. Guarde o primeiro.', ar:'لا سجلات بعد. احفظ أول لقطة.', hi:'अभी कोई रिकॉर्ड नहीं। पहला स्नैपशॉट सहेजें।', ja:'記録なし。最初のスナップショットを保存してください。', ky:'Жазуу жок. Биринчи сүрөттү сакта.', 'zh-Hant':'尚無記錄。請儲存第一個快照。' }
});

export const title = t('bd_title');

// ── Хранилище (само localStorage) ────────────────────────────────────────────────
const LS_KEY = 'st_budget_v1';
const EMPTY = () => ({ cur: '', cats: [], tx: [], subs: [], assets: [], liab: [], nw: [] });
function load() { try { const d = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (d && typeof d === 'object') return Object.assign(EMPTY(), d); } catch (_) {} return EMPTY(); }
function save(d) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch (_) {} }

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayISO = () => isoDate(new Date());
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
function money(n, cur) {
  let s; try { s = (isFinite(n) ? n : 0).toLocaleString(getLang(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } catch (_) { s = (isFinite(n) ? n : 0).toFixed(2); }
  return cur ? s + ' ' + cur : s;
}
function monthLabel(ym) { // 'YYYY-MM' → локализирано „септ. 2026"
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
  try { return new Date(y, m - 1, 1).toLocaleDateString(getLang(), { month: 'short', year: 'numeric' }); } catch (_) { return ym; }
}
function addPeriod(iso, per) { // следваща дата по период (w/m/y)
  const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  if (per === 'w') dt.setDate(dt.getDate() + 7); else if (per === 'y') dt.setFullYear(dt.getFullYear() + 1); else dt.setMonth(dt.getMonth() + 1);
  return isoDate(dt);
}
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const monthlyEq = (amt, per) => per === 'w' ? amt * 52 / 12 : per === 'y' ? amt / 12 : amt;

// ── Графики на платно (без библиотеки) ───────────────────────────────────────────
function cssVar(name, fb) { try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; } catch (_) { return fb; } }
function prepCanvas(cv, H) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 300;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
  ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center';
  return { ctx, W, H };
}
const shortNum = (v) => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(0) + 'k' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : (Math.round(v * 100) / 100).toString();
const shortLbl = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
// Стълбове: items = [{ label, val, color? }]
function drawBars(cv, items) {
  const { ctx, W, H } = prepCanvas(cv, 190);
  const padL = 6, padB = 30, padT = 18, n = items.length;
  const max = Math.max(1, ...items.map((i) => Math.abs(i.val)));
  const bw = (W - padL * 2) / n;
  const text = cssVar('--text', '#e6edf3'), dim = cssVar('--text-dim', '#8b949e'), acc = cssVar('--accent', '#c8102e');
  ctx.strokeStyle = cssVar('--line', '#30363d'); ctx.beginPath(); ctx.moveTo(padL, H - padB + .5); ctx.lineTo(W - padL, H - padB + .5); ctx.stroke();
  items.forEach((it, i) => {
    const h = (H - padB - padT) * Math.abs(it.val) / max;
    const x = padL + i * bw + bw * .15, w = bw * .7;
    ctx.fillStyle = it.color || acc; ctx.fillRect(x, H - padB - h, w, h);
    ctx.fillStyle = text; ctx.fillText(shortLbl(it.label, bw > 70 ? 12 : 7), x + w / 2, H - padB + 14);
    ctx.fillStyle = dim; ctx.fillText(shortNum(it.val), x + w / 2, H - padB - h - 4);
  });
}
// Линия: pts = [{ label, val }] (нетна стойност по месеци; може и отрицателна)
function drawLine(cv, pts) {
  const { ctx, W, H } = prepCanvas(cv, 190);
  const padL = 8, padR = 8, padB = 26, padT = 16;
  const vals = pts.map((p) => p.val); const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const span = (hi - lo) || 1;
  const x = (i) => pts.length === 1 ? W / 2 : padL + (W - padL - padR) * i / (pts.length - 1);
  const y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / span);
  const acc = cssVar('--accent-2', '#e8536a'), dim = cssVar('--text-dim', '#8b949e'), text = cssVar('--text', '#e6edf3');
  ctx.strokeStyle = cssVar('--line', '#30363d'); ctx.beginPath(); ctx.moveTo(padL, y(0) + .5); ctx.lineTo(W - padR, y(0) + .5); ctx.stroke(); // нулева линия
  ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.beginPath();
  pts.forEach((p, i) => { i ? ctx.lineTo(x(i), y(p.val)) : ctx.moveTo(x(i), y(p.val)); }); ctx.stroke();
  pts.forEach((p, i) => {
    ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(x(i), y(p.val), 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dim; ctx.fillText(shortNum(p.val), x(i), y(p.val) - 8);
    if (pts.length <= 8 || i % Math.ceil(pts.length / 8) === 0) { ctx.fillStyle = text; ctx.fillText(p.label, x(i), H - padB + 14); }
  });
}

const CSS = `<style>
.bd-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed var(--line);font-size:.92em}
.bd-row:last-child{border-bottom:none}
.bd-row .g{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.bd-row .g small{display:block;color:var(--text-dim);font-size:.85em}
.bd-row .v{white-space:nowrap;font-weight:600}
.bd-x{background:var(--bg-3);border:1px solid var(--line);color:var(--text-dim);width:34px;height:34px;border-radius:8px;cursor:pointer;flex-shrink:0;font-size:1em}
.bd-x.ok{color:#56d364}
.bd-env{padding:10px 0;border-bottom:1px dashed var(--line)}
.bd-env:last-child{border-bottom:none}
.bd-env .top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.bd-env .bar{margin-top:6px}
.bd-env .sub{font-size:.85em;color:var(--text-dim);margin-top:4px}
.bd-warn{color:var(--warn);font-size:.85em;margin-top:4px;font-weight:600}
.bd-over{color:var(--err);font-size:.85em;margin-top:4px;font-weight:600}
h4.bd-h{margin:16px 0 6px;font-size:.95em}
canvas.bd-cv{width:100%;display:block;margin-top:8px}
.bd-neg{color:var(--err)}.bd-pos{color:#56d364}
</style>`;

export function render(root) {
  let D = load();
  let month = todayISO().slice(0, 7);
  const persist = () => save(D);

  root.innerHTML = CSS + `
    <div class="tabs">
      <button class="tab active" data-tab="env">${t('bd_tab_env')}</button>
      <button class="tab" data-tab="subs">${t('bd_tab_subs')}</button>
      <button class="tab" data-tab="rep">${t('bd_tab_rep')}</button>
      <button class="tab" data-tab="nw">${t('bd_tab_nw')}</button>
    </div>

    <div class="tool-card">
      <div class="row">
        <div><label>${t('bd_month')}</label><input type="month" id="bdMonth" value="${month}" /></div>
        <div><label>${t('bd_currency')}</label><input id="bdCur" maxlength="8" placeholder="EUR" value="${esc(D.cur)}" /></div>
      </div>
      <p class="hint">${t('bd_local_note')}</p>
    </div>

    <div data-panel="env">
      <div class="tool-card">
        <div id="bdCats"></div>
        <div class="out-block" id="bdTotals"></div>
        <div class="row">
          <div><label>${t('bd_cat_name')}</label><input id="bdCatName" maxlength="40" /></div>
          <div><label>${t('bd_cat_limit')}</label><input type="number" id="bdCatLimit" min="0" step="any" /></div>
        </div>
        <button class="btn sec" id="bdAddCat">${t('bd_add_cat')}</button>
      </div>
      <div class="tool-card">
        <label>${t('bd_cat_name')}</label><select id="bdTxCat"></select>
        <div class="row">
          <div><label>${t('bd_tx_date')}</label><input type="date" id="bdTxDate" value="${todayISO()}" /></div>
          <div><label>${t('bd_tx_amount')}</label><input type="number" id="bdTxAmt" min="0" step="any" /></div>
        </div>
        <label>${t('bd_tx_note')}</label><input id="bdTxNote" maxlength="60" />
        <button class="btn" id="bdAddTx">${t('bd_add_tx')}</button>
        <h4 class="bd-h">${t('bd_tx_list')}</h4>
        <div id="bdTxList"></div>
      </div>
    </div>

    <div data-panel="subs" style="display:none">
      <div class="tool-card">
        <div id="bdSubs"></div>
        <div class="out-block" id="bdSubTot"></div>
        <label>${t('bd_sub_name')}</label><input id="bdSubName" maxlength="40" />
        <div class="row">
          <div><label>${t('bd_tx_amount')}</label><input type="number" id="bdSubAmt" min="0" step="any" /></div>
          <div><label>${t('bd_sub_kind')}</label><select id="bdSubKind"><option value="exp">${t('bd_kind_exp')}</option><option value="inc">${t('bd_kind_inc')}</option></select></div>
        </div>
        <div class="row">
          <div><label>${t('bd_sub_period')}</label><select id="bdSubPer"><option value="m">${t('bd_per_m')}</option><option value="w">${t('bd_per_w')}</option><option value="y">${t('bd_per_y')}</option></select></div>
          <div><label>${t('bd_sub_next')}</label><input type="date" id="bdSubNext" value="${todayISO()}" /></div>
        </div>
        <button class="btn" id="bdAddSub">${t('bd_add_sub')}</button>
      </div>
      <div class="tool-card">
        <h4 class="bd-h" style="margin-top:0">${t('bd_upcoming')}</h4>
        <div id="bdUpcoming"></div>
      </div>
    </div>

    <div data-panel="rep" style="display:none">
      <div class="tool-card">
        <h4 class="bd-h" style="margin-top:0">${t('bd_rep_bycat')}</h4>
        <canvas class="bd-cv" id="bdCvCat"></canvas>
        <div id="bdRepCat"></div>
      </div>
      <div class="tool-card">
        <h4 class="bd-h" style="margin-top:0">${t('bd_rep_bymonth')}</h4>
        <canvas class="bd-cv" id="bdCvMon"></canvas>
        <div id="bdRepMon"></div>
        <button class="btn sec" id="bdCsv">${t('bd_export_csv')}</button>
      </div>
    </div>

    <div data-panel="nw" style="display:none">
      <div class="tool-card">
        <h4 class="bd-h" style="margin-top:0">${t('bd_assets')}</h4>
        <div id="bdAssets"></div>
        <div class="row">
          <div><label>${t('bd_item_name')}</label><input id="bdAName" maxlength="40" /></div>
          <div><label>${t('bd_item_val')}</label><input type="number" id="bdAVal" step="any" /></div>
        </div>
        <button class="btn sec" id="bdAddA">${t('bd_add_asset')}</button>
      </div>
      <div class="tool-card">
        <h4 class="bd-h" style="margin-top:0">${t('bd_liab')}</h4>
        <div id="bdLiab"></div>
        <div class="row">
          <div><label>${t('bd_item_name')}</label><input id="bdLName" maxlength="40" /></div>
          <div><label>${t('bd_item_val')}</label><input type="number" id="bdLVal" step="any" /></div>
        </div>
        <button class="btn sec" id="bdAddL">${t('bd_add_liab')}</button>
      </div>
      <div class="tool-card">
        <div class="out-block" id="bdNwOut" style="margin-top:0"></div>
        <button class="btn" id="bdSnap">${t('bd_snapshot')}</button>
        <h4 class="bd-h">${t('bd_history')}</h4>
        <canvas class="bd-cv" id="bdCvNw"></canvas>
        <div id="bdNwHist"></div>
      </div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);
  const cur = () => D.cur;
  const catName = (id) => { const c = D.cats.find((x) => x.id === id); return c ? c.name : '—'; };
  const delBtn = (act, id, ok) => `<button class="bd-x${ok ? ' ok' : ''}" data-act="${act}" data-id="${id}" title="${esc(ok ? t('bd_paid') : t('bd_delete'))}">${ok ? '✓' : '✕'}</button>`;

  // ── Пликове ──
  function spentByCat(ym) {
    const m = {}; D.tx.forEach((x) => { if (x.d.slice(0, 7) === ym) m[x.cat] = (m[x.cat] || 0) + x.amt; }); return m;
  }
  function drawEnv() {
    const sp = spentByCat(month);
    const box = $('#bdCats');
    if (!D.cats.length) box.innerHTML = `<p class="hint">${t('bd_no_cats')}</p>`;
    else box.innerHTML = D.cats.map((c) => {
      const s = sp[c.id] || 0, pct = c.limit > 0 ? s / c.limit * 100 : (s > 0 ? 100 : 0);
      const color = pct >= 100 ? 'var(--err)' : pct >= 80 ? 'var(--warn)' : 'var(--accent)';
      const warn = pct >= 100 ? `<div class="bd-over">${t('bd_warn_over')}</div>` : pct >= 80 ? `<div class="bd-warn">${t('bd_warn80')}</div>` : '';
      const rest = c.limit - s;
      return `<div class="bd-env">
        <div class="top"><b>${esc(c.name)}</b><span>${Math.round(pct)}% ${delBtn('delcat', c.id)}</span></div>
        <div class="bar"><div style="width:${Math.min(100, pct)}%;background:${color}"></div></div>
        <div class="sub">${tf('bd_spent_of', money(s, cur()), money(c.limit, cur()))} · ${rest >= 0 ? tf('bd_left', money(rest, cur())) : tf('bd_over', money(-rest, cur()))}</div>${warn}</div>`;
    }).join('');
    const totL = D.cats.reduce((a, c) => a + c.limit, 0), totS = D.tx.filter((x) => x.d.slice(0, 7) === month).reduce((a, x) => a + x.amt, 0);
    $('#bdTotals').innerHTML = `<div class="line"><span>${t('bd_total_limit')}</span><span>${money(totL, cur())}</span></div><div class="line"><span>${t('bd_total_spent')}</span><span class="${totS > totL && totL > 0 ? 'bd-neg' : ''}">${money(totS, cur())}</span></div>`;
    const sel = $('#bdTxCat'); const prev = sel.value;
    sel.innerHTML = D.cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    if (prev && D.cats.some((c) => c.id === prev)) sel.value = prev;
    const list = D.tx.filter((x) => x.d.slice(0, 7) === month).sort((a, b) => b.d.localeCompare(a.d));
    $('#bdTxList').innerHTML = list.length ? list.map((x) => `<div class="bd-row"><div class="g">${esc(catName(x.cat))}<small>${x.d}${x.note ? ' · ' + esc(x.note) : ''}</small></div><span class="v">${money(x.amt, cur())}</span>${delBtn('deltx', x.id)}</div>`).join('') : `<p class="hint">${t('bd_no_tx')}</p>`;
  }
  $('#bdAddCat').addEventListener('click', () => {
    const name = $('#bdCatName').value.trim(), limit = num($('#bdCatLimit').value);
    if (!name) { $('#bdCatName').focus(); return; }
    D.cats.push({ id: uid(), name, limit: Math.max(0, limit) }); persist();
    $('#bdCatName').value = ''; $('#bdCatLimit').value = ''; drawEnv();
  });
  $('#bdAddTx').addEventListener('click', () => {
    const cat = $('#bdTxCat').value, amt = num($('#bdTxAmt').value), d = $('#bdTxDate').value || todayISO();
    if (!cat) { $('#bdCatName').focus(); return; }
    if (!(amt > 0)) { $('#bdTxAmt').focus(); return; }
    D.tx.push({ id: uid(), d, cat, amt, note: $('#bdTxNote').value.trim() }); persist();
    $('#bdTxAmt').value = ''; $('#bdTxNote').value = '';
    if (d.slice(0, 7) !== month) { month = d.slice(0, 7); $('#bdMonth').value = month; }
    drawEnv();
  });

  // ── Абонаменти ──
  function drawSubs() {
    const today = todayISO();
    const list = D.subs.slice().sort((a, b) => a.next.localeCompare(b.next));
    const when = (iso) => { const n = daysBetween(today, iso); return n < 0 ? t('bd_overdue') : n === 0 ? t('bd_today') : tf('bd_days_in', n); };
    const perTxt = { w: t('bd_per_w'), m: t('bd_per_m'), y: t('bd_per_y') };
    $('#bdSubs').innerHTML = list.length ? list.map((s) => `<div class="bd-row"><div class="g">${esc(s.name)}<small>${perTxt[s.per] || ''} · ${s.next} · ${when(s.next)}</small></div><span class="v ${s.kind === 'inc' ? 'bd-pos' : ''}">${s.kind === 'inc' ? '+' : '−'}${money(s.amt, cur())}</span>${delBtn('paidsub', s.id, true)}${delBtn('delsub', s.id)}</div>`).join('') : `<p class="hint">${t('bd_no_subs')}</p>`;
    const exp = D.subs.filter((s) => s.kind !== 'inc').reduce((a, s) => a + monthlyEq(s.amt, s.per), 0);
    const inc = D.subs.filter((s) => s.kind === 'inc').reduce((a, s) => a + monthlyEq(s.amt, s.per), 0);
    $('#bdSubTot').innerHTML = `<div class="line"><span>${tf('bd_sub_monthly_total', money(exp, cur()), money(inc, cur()))}</span><span class="${inc - exp < 0 ? 'bd-neg' : 'bd-pos'}">${money(inc - exp, cur())}</span></div>`;
    // календар: всички попадения в следващите 30 дни (седмичните може по няколко пъти)
    const occ = [];
    D.subs.forEach((s) => { let d = s.next, guard = 0; while (daysBetween(today, d) <= 30 && guard++ < 10) { if (daysBetween(today, d) >= 0) occ.push({ d, s }); d = addPeriod(d, s.per); } });
    occ.sort((a, b) => a.d.localeCompare(b.d));
    $('#bdUpcoming').innerHTML = occ.length ? occ.map((o) => `<div class="bd-row"><div class="g">${o.d} · ${esc(o.s.name)}<small>${when(o.d)}</small></div><span class="v ${o.s.kind === 'inc' ? 'bd-pos' : ''}">${o.s.kind === 'inc' ? '+' : '−'}${money(o.s.amt, cur())}</span></div>`).join('') : `<p class="hint">${t('bd_no_upcoming')}</p>`;
  }
  $('#bdAddSub').addEventListener('click', () => {
    const name = $('#bdSubName').value.trim(), amt = num($('#bdSubAmt').value);
    if (!name) { $('#bdSubName').focus(); return; }
    if (!(amt > 0)) { $('#bdSubAmt').focus(); return; }
    D.subs.push({ id: uid(), name, amt, kind: $('#bdSubKind').value, per: $('#bdSubPer').value, next: $('#bdSubNext').value || todayISO() }); persist();
    $('#bdSubName').value = ''; $('#bdSubAmt').value = ''; drawSubs();
  });

  // ── Отчети ──
  function drawRep() {
    const sp = spentByCat(month);
    const cats = D.cats.map((c) => ({ label: c.name, val: sp[c.id] || 0, lim: c.limit })).filter((x) => x.val > 0).sort((a, b) => b.val - a.val);
    const cvC = $('#bdCvCat'), cvM = $('#bdCvMon');
    if (cats.length) { drawBars(cvC, cats.slice(0, 8).map((x) => ({ label: x.label, val: x.val, color: x.lim > 0 && x.val > x.lim ? cssVar('--err', '#f85149') : null }))); cvC.style.display = 'block'; }
    else cvC.style.display = 'none';
    const totS = cats.reduce((a, x) => a + x.val, 0);
    $('#bdRepCat').innerHTML = cats.length ? cats.map((x) => `<div class="bd-row"><div class="g">${esc(x.label)}<small>${totS > 0 ? Math.round(x.val / totS * 100) : 0}%</small></div><span class="v ${x.lim > 0 && x.val > x.lim ? 'bd-neg' : ''}">${money(x.val, cur())}</span></div>`).join('') : `<p class="hint">${t('bd_no_data')}</p>`;
    // по месеци: последните 6 спрямо избрания
    const [y, m] = month.split('-').map((x) => parseInt(x, 10));
    const months = []; for (let i = 5; i >= 0; i--) { const d = new Date(y, m - 1 - i, 1); months.push(d.getFullYear() + '-' + pad(d.getMonth() + 1)); }
    const byM = months.map((ym) => ({ ym, label: monthLabel(ym), val: D.tx.filter((x) => x.d.slice(0, 7) === ym).reduce((a, x) => a + x.amt, 0) }));
    if (byM.some((x) => x.val > 0)) { drawBars(cvM, byM); cvM.style.display = 'block'; } else cvM.style.display = 'none';
    $('#bdRepMon').innerHTML = byM.map((x) => `<div class="bd-row"><div class="g">${esc(x.label)}</div><span class="v">${money(x.val, cur())}</span></div>`).join('');
  }
  $('#bdCsv').addEventListener('click', () => {
    const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const rows = [['date', 'category', 'amount', 'currency', 'note']].concat(D.tx.slice().sort((a, b) => a.d.localeCompare(b.d)).map((x) => [x.d, catName(x.cat), x.amt.toFixed(2), D.cur, x.note || '']));
    downloadBlob('﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n'), 'budget-expenses.csv', 'text/csv;charset=utf-8');
  });

  // ── Нетна стойност ──
  function drawNw() {
    const rowsOf = (arr, act) => arr.length ? arr.map((x) => `<div class="bd-row"><div class="g">${esc(x.name)}</div><span class="v">${money(x.val, cur())}</span>${delBtn(act, x.id)}</div>`).join('') : '';
    $('#bdAssets').innerHTML = rowsOf(D.assets, 'dela');
    $('#bdLiab').innerHTML = rowsOf(D.liab, 'dell');
    const a = D.assets.reduce((s, x) => s + x.val, 0), l = D.liab.reduce((s, x) => s + x.val, 0), nw = a - l;
    $('#bdNwOut').innerHTML = `<div class="line"><span>${t('bd_assets')}</span><span>${money(a, cur())}</span></div><div class="line"><span>${t('bd_liab')}</span><span>${money(l, cur())}</span></div><div class="line"><span>${t('bd_networth')}</span><span class="${nw < 0 ? 'bd-neg' : ''}">${money(nw, cur())}</span></div>`;
    const hist = D.nw.slice().sort((x, y) => x.m.localeCompare(y.m));
    const cv = $('#bdCvNw');
    if (hist.length) { drawLine(cv, hist.map((h) => ({ label: monthLabel(h.m), val: h.a - h.l }))); cv.style.display = 'block'; } else cv.style.display = 'none';
    $('#bdNwHist').innerHTML = hist.length ? hist.slice().reverse().map((h) => `<div class="bd-row"><div class="g">${esc(monthLabel(h.m))}<small>${money(h.a, cur())} − ${money(h.l, cur())}</small></div><span class="v ${h.a - h.l < 0 ? 'bd-neg' : ''}">${money(h.a - h.l, cur())}</span>${delBtn('delnw', h.m)}</div>`).join('') : `<p class="hint">${t('bd_no_snap')}</p>`;
  }
  const addItem = (arr, nameSel, valSel) => {
    const name = $(nameSel).value.trim(), val = num($(valSel).value);
    if (!name) { $(nameSel).focus(); return; }
    arr.push({ id: uid(), name, val: Math.max(0, val) }); persist(); $(nameSel).value = ''; $(valSel).value = ''; drawNw();
  };
  $('#bdAddA').addEventListener('click', () => addItem(D.assets, '#bdAName', '#bdAVal'));
  $('#bdAddL').addEventListener('click', () => addItem(D.liab, '#bdLName', '#bdLVal'));
  $('#bdSnap').addEventListener('click', () => {
    const a = D.assets.reduce((s, x) => s + x.val, 0), l = D.liab.reduce((s, x) => s + x.val, 0), m = todayISO().slice(0, 7);
    D.nw = D.nw.filter((h) => h.m !== m); D.nw.push({ m, a, l }); persist(); drawNw();
  });

  // ── Общи: изтриване/платено (делегирано), месец, валута, табове ──
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.bd-x'); if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    if (act === 'delcat') { D.cats = D.cats.filter((c) => c.id !== id); D.tx = D.tx.filter((x) => x.cat !== id); persist(); drawEnv(); }
    else if (act === 'deltx') { D.tx = D.tx.filter((x) => x.id !== id); persist(); drawEnv(); }
    else if (act === 'delsub') { D.subs = D.subs.filter((s) => s.id !== id); persist(); drawSubs(); }
    else if (act === 'paidsub') { const s = D.subs.find((x) => x.id === id); if (s) { s.next = addPeriod(s.next, s.per); persist(); drawSubs(); } }
    else if (act === 'dela') { D.assets = D.assets.filter((x) => x.id !== id); persist(); drawNw(); }
    else if (act === 'dell') { D.liab = D.liab.filter((x) => x.id !== id); persist(); drawNw(); }
    else if (act === 'delnw') { D.nw = D.nw.filter((h) => h.m !== id); persist(); drawNw(); }
  });
  $('#bdMonth').addEventListener('change', () => { const v = $('#bdMonth').value; if (/^\d{4}-\d{2}$/.test(v)) { month = v; drawEnv(); drawRep(); } });
  $('#bdCur').addEventListener('input', () => { D.cur = $('#bdCur').value.trim().slice(0, 8); persist(); drawAll(); });
  root.querySelectorAll('.tab').forEach((tb) => {
    tb.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      tb.classList.add('active');
      root.querySelectorAll('[data-panel]').forEach((p) => { p.style.display = p.dataset.panel === tb.dataset.tab ? 'block' : 'none'; });
      if (tb.dataset.tab === 'rep') drawRep(); if (tb.dataset.tab === 'nw') drawNw(); // платното иска видима ширина
    });
  });
  function drawAll() { drawEnv(); drawSubs(); drawRep(); drawNw(); }
  drawAll();
}
