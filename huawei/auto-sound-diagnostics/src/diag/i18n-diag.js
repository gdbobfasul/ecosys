// Version: 1.0021
// i18n-diag.js — текстове за Auto Sound Diagnostics на ВСИЧКИТЕ 15 езика на екосистемата (bg ru uk en de fr
// es it pt ar hi ja ky zh-Hant; es-MX пада на es — еднакъв текст). Резултатите (имена на състояния/съвети) се
// превеждат динамично в analyze.translate. getLang() от core. Резервен ред: точен език → основен (es-MX→es) → en.
import { getLang } from '../core/i18n.js';

const S = {
  tagline: {
    bg: 'Чуй колата → запиши звука → възможна причина',
    ru: 'Послушай машину → запиши звук → возможная причина',
    uk: 'Послухай авто → запиши звук → можлива причина',
    en: 'Listen to the car → record the sound → possible cause',
    de: 'Auto anhören → Geräusch aufnehmen → mögliche Ursache',
    fr: 'Écoute la voiture → enregistre le bruit → cause possible',
    es: 'Escucha el coche → graba el sonido → causa posible',
    it: 'Ascolta l\'auto → registra il suono → causa possibile',
    pt: 'Ouve o carro → grava o som → causa possível',
    ar: 'استمع إلى السيارة ← سجّل الصوت ← السبب المحتمل',
    hi: 'कार सुनें → आवाज़ रिकॉर्ड करें → संभावित कारण',
    ja: '車の音を聞く → 録音する → 考えられる原因',
    ky: 'Унааны ук → үндү жаз → мүмкүн болгон себеп',
    'zh-Hant': '聆聽車輛 → 錄下聲音 → 可能原因'
  },
  title: { bg: 'Auto Sound Diagnostics', en: 'Auto Sound Diagnostics' },
  where_label: {
    bg: 'Откъде идва звукът?', ru: 'Откуда идёт звук?', uk: 'Звідки йде звук?', en: 'Where is the sound from?', de: 'Woher kommt das Geräusch?',
    fr: 'D\'où vient le bruit ?', es: '¿De dónde viene el sonido?', it: 'Da dove viene il suono?', pt: 'De onde vem o som?', ar: 'من أين يأتي الصوت؟',
    hi: 'आवाज़ कहाँ से आ रही है?', ja: '音はどこから？', ky: 'Үн кайдан чыгат?', 'zh-Hant': '聲音來自哪裡？'
  },
  when_label: {
    bg: 'Кога се чува?', ru: 'Когда слышно?', uk: 'Коли чути?', en: 'When do you hear it?', de: 'Wann hörst du es?', fr: 'Quand l\'entends-tu ?',
    es: '¿Cuándo se oye?', it: 'Quando si sente?', pt: 'Quando se ouve?', ar: 'متى تسمعه؟', hi: 'यह कब सुनाई देती है?', ja: 'いつ聞こえる？', ky: 'Качан угулат?', 'zh-Hant': '什麼時候聽到？'
  },
  record_btn: {
    bg: '🎙️ Запиши и анализирай', ru: '🎙️ Записать и анализировать', uk: '🎙️ Записати й проаналізувати', en: '🎙️ Record & analyze', de: '🎙️ Aufnehmen & analysieren',
    fr: '🎙️ Enregistrer et analyser', es: '🎙️ Grabar y analizar', it: '🎙️ Registra e analizza', pt: '🎙️ Gravar e analisar', ar: '🎙️ سجّل وحلّل',
    hi: '🎙️ रिकॉर्ड करें और विश्लेषण करें', ja: '🎙️ 録音して分析', ky: '🎙️ Жазып, талда', 'zh-Hant': '🎙️ 錄音並分析'
  },
  recording: {
    bg: 'Слушам… дръж телефона близо до звука', ru: 'Слушаю… держи телефон ближе к звуку', uk: 'Слухаю… тримай телефон ближче до звуку',
    en: 'Listening… hold the phone near the sound', de: 'Ich höre zu… halte das Telefon nah an das Geräusch', fr: 'J\'écoute… tiens le téléphone près du bruit',
    es: 'Escuchando… acerca el teléfono al sonido', it: 'In ascolto… tieni il telefono vicino al suono', pt: 'A ouvir… mantém o telemóvel perto do som',
    ar: 'أستمع… قرّب الهاتف من مصدر الصوت', hi: 'सुन रहा हूँ… फ़ोन को आवाज़ के पास रखें', ja: '聞いています… 電話を音の近くに', ky: 'Угуп жатам… телефонду үнгө жакын карма', 'zh-Hant': '正在聆聽… 請將手機靠近聲源'
  },
  analyzing: {
    bg: 'Анализирам звука…', ru: 'Анализирую звук…', uk: 'Аналізую звук…', en: 'Analyzing the sound…', de: 'Geräusch wird analysiert…', fr: 'Analyse du bruit…',
    es: 'Analizando el sonido…', it: 'Analisi del suono…', pt: 'A analisar o som…', ar: 'جارٍ تحليل الصوت…', hi: 'आवाज़ का विश्लेषण हो रहा है…', ja: '音を分析中…', ky: 'Үн талданууда…', 'zh-Hant': '正在分析聲音…'
  },
  res_title: {
    bg: 'Възможни причини', ru: 'Возможные причины', uk: 'Можливі причини', en: 'Possible causes', de: 'Mögliche Ursachen', fr: 'Causes possibles', es: 'Causas posibles',
    it: 'Cause possibili', pt: 'Causas possíveis', ar: 'الأسباب المحتملة', hi: 'संभावित कारण', ja: '考えられる原因', ky: 'Мүмкүн болгон себептер', 'zh-Hant': '可能原因'
  },
  res_cause: {
    bg: 'Какво чувам', ru: 'Что слышно', uk: 'Що чути', en: 'What I hear', de: 'Was ich höre', fr: 'Ce que j\'entends', es: 'Lo que oigo', it: 'Cosa sento', pt: 'O que ouço',
    ar: 'ما أسمعه', hi: 'मैं क्या सुनता हूँ', ja: '聞こえた音', ky: 'Эмне угулат', 'zh-Hant': '聽到的聲音'
  },
  res_advice: {
    bg: 'Какво да направиш', ru: 'Что делать', uk: 'Що робити', en: 'What to do', de: 'Was zu tun ist', fr: 'Que faire', es: 'Qué hacer', it: 'Cosa fare', pt: 'O que fazer',
    ar: 'ماذا تفعل', hi: 'क्या करें', ja: 'どうすればよいか', ky: 'Эмне кылуу керек', 'zh-Hant': '該怎麼做'
  },
  confidence: {
    bg: 'Близост', ru: 'Близость', uk: 'Збіг', en: 'Match', de: 'Übereinstimmung', fr: 'Correspondance', es: 'Coincidencia', it: 'Corrispondenza', pt: 'Correspondência',
    ar: 'التطابق', hi: 'मिलान', ja: '一致度', ky: 'Дал келүү', 'zh-Hant': '符合度'
  },
  again_btn: {
    bg: '↺ Нов запис', ru: '↺ Новая запись', uk: '↺ Новий запис', en: '↺ New recording', de: '↺ Neue Aufnahme', fr: '↺ Nouvel enregistrement', es: '↺ Nueva grabación',
    it: '↺ Nuova registrazione', pt: '↺ Nova gravação', ar: '↺ تسجيل جديد', hi: '↺ नई रिकॉर्डिंग', ja: '↺ 新しい録音', ky: '↺ Жаңы жазуу', 'zh-Hant': '↺ 重新錄音'
  },
  no_mic: {
    bg: 'Няма достъп до микрофона. Разреши микрофона за приложението и опитай пак.',
    ru: 'Нет доступа к микрофону. Разреши микрофон для приложения и попробуй снова.',
    uk: 'Немає доступу до мікрофона. Дозволь мікрофон для застосунку і спробуй ще раз.',
    en: 'No microphone access. Allow the microphone for the app and try again.',
    de: 'Kein Mikrofonzugriff. Erlaube der App das Mikrofon und versuche es erneut.',
    fr: 'Pas d\'accès au microphone. Autorise le microphone pour l\'application et réessaie.',
    es: 'Sin acceso al micrófono. Permite el micrófono para la aplicación e inténtalo de nuevo.',
    it: 'Nessun accesso al microfono. Consenti il microfono all\'app e riprova.',
    pt: 'Sem acesso ao microfone. Permite o microfone para a aplicação e tenta de novo.',
    ar: 'لا يوجد وصول إلى الميكروفون. اسمح للتطبيق باستخدام الميكروفون وحاول مرة أخرى.',
    hi: 'माइक्रोफ़ोन तक पहुँच नहीं है। ऐप के लिए माइक्रोफ़ोन की अनुमति दें और फिर से प्रयास करें।',
    ja: 'マイクにアクセスできません。アプリにマイクを許可して、もう一度お試しください。',
    ky: 'Микрофонго кирүү жок. Колдонмого микрофонго уруксат берип, кайра аракет кыл.',
    'zh-Hant': '無法存取麥克風。請允許應用程式使用麥克風後再試一次。'
  },
  tip: {
    bg: 'Съвет: запиши 4–5 секунди възможно най-близо до източника, в момента, когато звукът се чува най-силно.',
    ru: 'Совет: запиши 4–5 секунд как можно ближе к источнику, когда звук слышен сильнее всего.',
    uk: 'Порада: запиши 4–5 секунд якомога ближче до джерела, коли звук чути найгучніше.',
    en: 'Tip: record 4–5 seconds as close to the source as possible, when the sound is loudest.',
    de: 'Tipp: nimm 4–5 Sekunden so nah wie möglich an der Quelle auf, wenn das Geräusch am lautesten ist.',
    fr: 'Conseil : enregistre 4–5 secondes aussi près que possible de la source, quand le bruit est le plus fort.',
    es: 'Consejo: graba 4–5 segundos lo más cerca posible de la fuente, cuando el sonido sea más fuerte.',
    it: 'Consiglio: registra 4–5 secondi il più vicino possibile alla fonte, quando il suono è più forte.',
    pt: 'Dica: grava 4–5 segundos o mais perto possível da fonte, quando o som for mais forte.',
    ar: 'نصيحة: سجّل 4–5 ثوانٍ بأقرب ما يمكن من المصدر، عندما يكون الصوت في أعلى مستوياته.',
    hi: 'सुझाव: जब आवाज़ सबसे तेज़ हो, तब स्रोत के जितना पास हो सके 4–5 सेकंड रिकॉर्ड करें।',
    ja: 'ヒント：音が最も大きいときに、音源にできるだけ近づけて 4〜5 秒録音してください。',
    ky: 'Кеңеш: үн эң катуу угулган учурда булакка мүмкүн болушунча жакын 4–5 секунд жаз.',
    'zh-Hant': '提示：在聲音最大時，盡量靠近聲源錄 4–5 秒。'
  },
  urgency_info: {
    bg: 'ℹ️ За сведение', ru: 'ℹ️ К сведению', uk: 'ℹ️ До відома', en: 'ℹ️ For info', de: 'ℹ️ Zur Information', fr: 'ℹ️ Pour information', es: 'ℹ️ Para información',
    it: 'ℹ️ Per informazione', pt: 'ℹ️ Para informação', ar: 'ℹ️ للعلم', hi: 'ℹ️ जानकारी के लिए', ja: 'ℹ️ 参考情報', ky: 'ℹ️ Маалымат үчүн', 'zh-Hant': 'ℹ️ 僅供參考'
  },
  urgency_soon: {
    bg: '🟠 Провери скоро', ru: '🟠 Проверь скоро', uk: '🟠 Перевір незабаром', en: '🟠 Check soon', de: '🟠 Bald prüfen', fr: '🟠 À vérifier bientôt', es: '🟠 Revisar pronto',
    it: '🟠 Controlla presto', pt: '🟠 Verificar em breve', ar: '🟠 افحص قريبًا', hi: '🟠 जल्द जाँच करें', ja: '🟠 早めに点検', ky: '🟠 Жакында текшер', 'zh-Hant': '🟠 盡快檢查'
  },
  urgency_urgent: {
    bg: '🔴 Спешно — провери веднага', ru: '🔴 Срочно — проверь немедленно', uk: '🔴 Терміново — перевір негайно', en: '🔴 Urgent — check now', de: '🔴 Dringend — sofort prüfen',
    fr: '🔴 Urgent — vérifie maintenant', es: '🔴 Urgente — revisa ahora', it: '🔴 Urgente — controlla subito', pt: '🔴 Urgente — verifica já', ar: '🔴 عاجل — افحص الآن',
    hi: '🔴 अत्यावश्यक — अभी जाँच करें', ja: '🔴 緊急 — 今すぐ点検', ky: '🔴 Шашылыш — азыр текшер', 'zh-Hant': '🔴 緊急 — 立即檢查'
  },
  // Екран за съгласие (безопасност + отговорност)
  disc_title: {
    bg: '🔧 Важно — прочети', ru: '🔧 Важно — прочти', uk: '🔧 Важливо — прочитай', en: '🔧 Important — read', de: '🔧 Wichtig — bitte lesen', fr: '🔧 Important — à lire',
    es: '🔧 Importante — lee esto', it: '🔧 Importante — leggi', pt: '🔧 Importante — lê', ar: '🔧 مهم — اقرأ', hi: '🔧 महत्वपूर्ण — पढ़ें', ja: '🔧 重要 — お読みください', ky: '🔧 Маанилүү — оку', 'zh-Hant': '🔧 重要 — 請閱讀'
  },
  disc_body: {
    bg: 'Това приложение НЕ поставя точна диагноза и НЕ е замяна на автомонтьор. Анализът на звука е чисто ориентировъчен и може да греши. Не използвай приложението, докато шофираш — записвай на спряла и обезопасена кола. За реален проблем се обърни към квалифициран специалист. Използваш информацията на своя отговорност.',
    ru: 'Это приложение НЕ ставит точный диагноз и НЕ заменяет автомеханика. Анализ звука ориентировочный и может ошибаться. Не используй приложение за рулём — записывай на остановленной и безопасной машине. При реальной проблеме обратись к специалисту. Используешь информацию на свой риск.',
    uk: 'Цей застосунок НЕ ставить точний діагноз і НЕ замінює автомеханіка. Аналіз звуку лише орієнтовний і може помилятися. Не користуйся застосунком за кермом — записуй на зупиненому й безпечно припаркованому авто. У разі реальної проблеми звернися до фахівця. Використовуєш інформацію на власний ризик.',
    en: 'This app does NOT provide an exact diagnosis and is NOT a replacement for a mechanic. The sound analysis is only a rough guide and can be wrong. Do not use it while driving — record with the car stopped and safe. For a real problem consult a qualified specialist. You use the information at your own risk.',
    de: 'Diese App stellt KEINE genaue Diagnose und ersetzt KEINEN Mechaniker. Die Geräuschanalyse ist nur ein grober Anhaltspunkt und kann falsch sein. Nicht während der Fahrt benutzen — nimm bei stehendem, gesichertem Auto auf. Bei einem echten Problem wende dich an eine Fachwerkstatt. Du nutzt die Informationen auf eigene Verantwortung.',
    fr: 'Cette application ne fournit PAS de diagnostic exact et ne remplace PAS un mécanicien. L\'analyse du bruit n\'est qu\'une indication approximative et peut se tromper. Ne l\'utilise pas en conduisant — enregistre avec la voiture arrêtée et en sécurité. Pour un vrai problème, consulte un spécialiste qualifié. Tu utilises ces informations à tes propres risques.',
    es: 'Esta aplicación NO ofrece un diagnóstico exacto y NO sustituye a un mecánico. El análisis del sonido es solo orientativo y puede equivocarse. No la uses mientras conduces — graba con el coche parado y seguro. Ante un problema real, consulta a un especialista cualificado. Usas la información bajo tu propia responsabilidad.',
    it: 'Questa app NON fornisce una diagnosi esatta e NON sostituisce un meccanico. L\'analisi del suono è solo indicativa e può sbagliare. Non usarla mentre guidi — registra con l\'auto ferma e in sicurezza. Per un problema reale rivolgiti a uno specialista qualificato. Usi le informazioni a tuo rischio.',
    pt: 'Esta aplicação NÃO faz um diagnóstico exato e NÃO substitui um mecânico. A análise do som é apenas indicativa e pode errar. Não a uses enquanto conduzes — grava com o carro parado e em segurança. Para um problema real, consulta um especialista qualificado. Usas a informação por tua conta e risco.',
    ar: 'هذا التطبيق لا يقدّم تشخيصًا دقيقًا ولا يحل محل الميكانيكي. تحليل الصوت مجرد دليل تقريبي وقد يكون خاطئًا. لا تستخدمه أثناء القيادة — سجّل والسيارة متوقفة وفي مكان آمن. عند وجود مشكلة حقيقية استشر مختصًا مؤهلاً. أنت تستخدم هذه المعلومات على مسؤوليتك الخاصة.',
    hi: 'यह ऐप सटीक निदान नहीं देता और मैकेनिक का विकल्प नहीं है। आवाज़ का विश्लेषण केवल एक मोटा संकेत है और गलत हो सकता है। गाड़ी चलाते समय इसका उपयोग न करें — कार को रोककर और सुरक्षित रखकर रिकॉर्ड करें। वास्तविक समस्या के लिए किसी योग्य विशेषज्ञ से संपर्क करें। जानकारी का उपयोग आप अपनी ज़िम्मेदारी पर करते हैं।',
    ja: 'このアプリは正確な診断を行うものではなく、整備士の代わりにはなりません。音の分析はあくまで目安であり、間違うことがあります。運転中は使用しないでください — 車を安全に停止させてから録音してください。実際の不具合は資格のある専門家に相談してください。情報の利用は自己責任でお願いします。',
    ky: 'Бул колдонмо так диагноз койбойт жана автомеханикти алмаштырбайт. Үн талдоосу болжолдуу гана жана ката болушу мүмкүн. Айдап баратканда колдонбо — токтоп, коопсуз турган унаада жаз. Чыныгы көйгөй болсо квалификациялуу адиске кайрыл. Маалыматты өз жоопкерчилигиңде колдоносуң.',
    'zh-Hant': '本應用程式不提供精確診斷，也不能取代技師。聲音分析僅供大致參考，可能有誤。請勿在駕駛時使用 — 請在車輛停妥且安全時錄音。若有實際問題，請諮詢合格的專業人員。您自行承擔使用資訊的風險。'
  },
  disc_agree: {
    bg: 'Разбрах — ориентировъчно, на своя отговорност', ru: 'Понятно — ориентировочно, на свой риск', uk: 'Зрозуміло — орієнтовно, на власний ризик',
    en: 'I understand — a rough guide, at my own risk', de: 'Verstanden — nur ein Anhaltspunkt, auf eigene Verantwortung', fr: 'Compris — indication approximative, à mes risques',
    es: 'Entendido — orientativo, bajo mi responsabilidad', it: 'Ho capito — indicativo, a mio rischio', pt: 'Entendi — indicativo, por minha conta e risco',
    ar: 'فهمت — دليل تقريبي، على مسؤوليتي', hi: 'समझ गया — मोटा संकेत, मेरी अपनी ज़िम्मेदारी पर', ja: '理解しました — 目安として、自己責任で', ky: 'Түшүндүм — болжолдуу, өз жоопкерчилигимде', 'zh-Hant': '我了解 — 僅供參考，風險自負'
  },
  cont: {
    bg: 'Продължи', ru: 'Продолжить', uk: 'Продовжити', en: 'Continue', de: 'Weiter', fr: 'Continuer', es: 'Continuar', it: 'Continua', pt: 'Continuar',
    ar: 'متابعة', hi: 'जारी रखें', ja: '続ける', ky: 'Улантуу', 'zh-Hant': '繼續'
  }
};

// Опции „къде" и „кога" — стойност + етикет.
const WHERE_LBL = {
  engine: { bg: 'Двигател', ru: 'Двигатель', uk: 'Двигун', en: 'Engine', de: 'Motor', fr: 'Moteur', es: 'Motor', it: 'Motore', pt: 'Motor', ar: 'المحرك', hi: 'इंजन', ja: 'エンジン', ky: 'Кыймылдаткыч', 'zh-Hant': '引擎' },
  wheels: { bg: 'Колела/ходова', ru: 'Колёса/ходовая', uk: 'Колеса/ходова', en: 'Wheels/running gear', de: 'Räder/Fahrwerk', fr: 'Roues/train roulant', es: 'Ruedas/tren de rodaje', it: 'Ruote/telaio', pt: 'Rodas/chassis', ar: 'العجلات/معدات التشغيل', hi: 'पहिए/रनिंग गियर', ja: '車輪・足回り', ky: 'Дөңгөлөктөр/жүрүү бөлүгү', 'zh-Hant': '車輪／行走裝置' },
  brakes: { bg: 'Спирачки', ru: 'Тормоза', uk: 'Гальма', en: 'Brakes', de: 'Bremsen', fr: 'Freins', es: 'Frenos', it: 'Freni', pt: 'Travões', ar: 'الفرامل', hi: 'ब्रेक', ja: 'ブレーキ', ky: 'Тормоздор', 'zh-Hant': '煞車' },
  suspension: { bg: 'Окачване', ru: 'Подвеска', uk: 'Підвіска', en: 'Suspension', de: 'Federung', fr: 'Suspension', es: 'Suspensión', it: 'Sospensioni', pt: 'Suspensão', ar: 'نظام التعليق', hi: 'सस्पेंशन', ja: 'サスペンション', ky: 'Подвеска', 'zh-Hant': '懸吊' },
  exhaust: { bg: 'Ауспух', ru: 'Выхлоп', uk: 'Вихлоп', en: 'Exhaust', de: 'Auspuff', fr: 'Échappement', es: 'Escape', it: 'Scarico', pt: 'Escape', ar: 'العادم', hi: 'एग्ज़ॉस्ट', ja: 'マフラー', ky: 'Түтүн чыгаргыч', 'zh-Hant': '排氣管' },
  cabin: { bg: 'В купето', ru: 'В салоне', uk: 'У салоні', en: 'In the cabin', de: 'Im Innenraum', fr: 'Dans l\'habitacle', es: 'En el habitáculo', it: 'Nell\'abitacolo', pt: 'No habitáculo', ar: 'داخل المقصورة', hi: 'केबिन में', ja: '車内', ky: 'Салондо', 'zh-Hant': '車內' }
};
const WHEN_LBL = {
  idle: { bg: 'На празен ход', ru: 'На холостом ходу', uk: 'На холостому ходу', en: 'At idle', de: 'Im Leerlauf', fr: 'Au ralenti', es: 'Al ralentí', it: 'Al minimo', pt: 'Ao ralenti', ar: 'عند التباطؤ', hi: 'निष्क्रिय (आइडल) पर', ja: 'アイドリング時', ky: 'Бош жүрүштө', 'zh-Hant': '怠速時' },
  accelerating: { bg: 'При ускорение', ru: 'При ускорении', uk: 'Під час розгону', en: 'When accelerating', de: 'Beim Beschleunigen', fr: 'À l\'accélération', es: 'Al acelerar', it: 'In accelerazione', pt: 'Ao acelerar', ar: 'عند التسارع', hi: 'तेज़ करते समय', ja: '加速時', ky: 'Ылдамдаганда', 'zh-Hant': '加速時' },
  braking: { bg: 'При спиране', ru: 'При торможении', uk: 'Під час гальмування', en: 'When braking', de: 'Beim Bremsen', fr: 'Au freinage', es: 'Al frenar', it: 'In frenata', pt: 'Ao travar', ar: 'عند الكبح', hi: 'ब्रेक लगाते समय', ja: 'ブレーキ時', ky: 'Тормоз басканда', 'zh-Hant': '煞車時' },
  turning: { bg: 'При завой', ru: 'При повороте', uk: 'На повороті', en: 'When turning', de: 'Beim Abbiegen', fr: 'En virage', es: 'Al girar', it: 'In curva', pt: 'Ao virar', ar: 'عند الانعطاف', hi: 'मोड़ते समय', ja: '曲がるとき', ky: 'Бурулганда', 'zh-Hant': '轉彎時' },
  coldstart: { bg: 'Студен старт', ru: 'Холодный старт', uk: 'Холодний запуск', en: 'Cold start', de: 'Kaltstart', fr: 'Démarrage à froid', es: 'Arranque en frío', it: 'Avviamento a freddo', pt: 'Arranque a frio', ar: 'التشغيل على البارد', hi: 'ठंडी शुरुआत (कोल्ड स्टार्ट)', ja: '冷間始動時', ky: 'Муздак от алдыруу', 'zh-Hant': '冷車啟動' },
  bumps: { bg: 'По неравности', ru: 'На неровностях', uk: 'На нерівностях', en: 'Over bumps', de: 'Auf Unebenheiten', fr: 'Sur les bosses', es: 'En baches', it: 'Sui dossi', pt: 'Em lombas', ar: 'فوق المطبات', hi: 'गड्ढों पर', ja: '段差を越えるとき', ky: 'Тегиз эмес жолдо', 'zh-Hant': '經過顛簸路面時' }
};

function pick(o) { if (!o) return ''; const l = getLang(); return o[l] || o[String(l).split('-')[0]] || o.en || o.bg; }
export function T(key) { const o = S[key]; if (!o) return key; return pick(o); }
export function whereLabel(v) { const o = WHERE_LBL[v]; if (!o) return v; return pick(o); }
export function whenLabel(v) { const o = WHEN_LBL[v]; if (!o) return v; return pick(o); }
export function urgencyLabel(u) { return u === 'urgent' ? T('urgency_urgent') : u === 'soon' ? T('urgency_soon') : T('urgency_info'); }
