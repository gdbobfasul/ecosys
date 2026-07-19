// Version: 1.0015
// Authenticator — ЦЕЛИЯТ KCY Toolkit Authenticator, вграден като инструмент.
// Зарежда се готовият билд на приложението от public/authenticator/ (копие на неговия
// dist) в iframe с ?embedded=1 → там се пропускат интро/реклами/правен екран/долна лента,
// защото обвивката (KCY Toolkit) вече ги има. Сейфът е в СЪЩИЯ localStorage (същия origin) —
// самостоятелният апп и инструментът виждат ЕДИН И СЪЩ шифрован сейф на устройството.
import { t, register } from '../core/i18n.js';

register({
  auth_note: { bg:'Пълният Authenticator (2FA кодове, пароли, портфейли, колекция) — същият сейф като самостоятелното приложение.', ru:'Полный Authenticator (2FA-коды, пароли, кошельки, коллекция) — то же хранилище, что и в отдельном приложении.', uk:'Повний Authenticator (2FA-коди, паролі, гаманці, колекція) — те саме сховище, що й в окремому застосунку.', en:'The full Authenticator (2FA codes, passwords, wallets, collection) — the same vault as the standalone app.', de:'Der volle Authenticator (2FA-Codes, Passwörter, Wallets, Sammlung) — derselbe Tresor wie in der eigenständigen App.', fr:'L’Authenticator complet (codes 2FA, mots de passe, portefeuilles, collection) — le même coffre que l’app autonome.', es:'El Authenticator completo (códigos 2FA, contraseñas, carteras, colección) — la misma bóveda que la app independiente.', 'es-MX':'El Authenticator completo (códigos 2FA, contraseñas, carteras, colección) — la misma bóveda que la app independiente.', it:'L’Authenticator completo (codici 2FA, password, portafogli, collezione) — la stessa cassaforte dell’app autonoma.', pt:'O Authenticator completo (códigos 2FA, senhas, carteiras, coleção) — o mesmo cofre do app independente.', ar:'‏Authenticator الكامل (رموز 2FA وكلمات المرور والمحافظ والمجموعة) — نفس الخزنة كما في التطبيق المستقل.', hi:'पूरा Authenticator (2FA कोड, पासवर्ड, वॉलेट, संग्रह) — स्वतंत्र ऐप जैसा ही वॉल्ट।', ja:'フル機能の Authenticator（2FAコード・パスワード・ウォレット・コレクション）— 単体アプリと同じ保管庫。', ky:'Толук Authenticator (2FA коддор, сырсөздөр, капчыктар, коллекция) — өзүнчө колдонмодогудай эле сейф.', 'zh-Hant':'完整的 Authenticator（2FA 代碼、密碼、錢包、收藏）— 與獨立應用程式相同的保險庫。' }
});

export const title = 'Authenticator';

export function render(root) {
  root.innerHTML = `
    <div class="tool-card" style="padding:8px">
      <p class="hint" style="margin:4px 6px 8px">${t('auth_note')}</p>
      <iframe src="authenticator/index.html?embedded=1" allow="camera"
              style="width:100%;height:72vh;border:0;border-radius:12px;background:#0e151d"></iframe>
    </div>`;
}
