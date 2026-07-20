// Version: 1.0001
// biometric.js — отключване с пръстов отпечатък/лице (като Aegis).
// Използва два Capacitor плъгина, заредени ПРЕДПАЗЛИВО (динамичен import в try/catch):
//   • @aparajita/capacitor-biometric-auth  — самата биометрична проверка
//   • @aparajita/capacitor-secure-storage   — пази master паролата в Android Keystore
// Ако плъгините липсват (напр. в браузъра при разработка) → биометрията просто се
// скрива и приложението работи само с парола. НИКОГА не чупим заради липсващ плъгин.
const SECURE_KEY = 'kcyauth.master';

let _bio = null, _sec = null, _probed = false;

async function load() {
  if (_probed) return;
  _probed = true;
  try { _bio = (await import('@aparajita/capacitor-biometric-auth')).BiometricAuth; } catch (e) { _bio = null; }
  try { _sec = (await import('@aparajita/capacitor-secure-storage')).SecureStorage; } catch (e) { _sec = null; }
}

// Има ли налична биометрия НА ТОВА устройство (и двата плъгина + сензор).
export async function biometricAvailable() {
  await load();
  if (!_bio || !_sec) return false;
  try {
    const info = await _bio.checkBiometry();
    return !!(info && info.isAvailable);
  } catch (e) { return false; }
}

// Иска биометрична проверка. Връща true при успех.
export async function biometricVerify(reason) {
  await load();
  if (!_bio) return false;
  try {
    await _bio.authenticate({
      reason: reason || 'Отключи сейфа',
      cancelTitle: 'Отказ',
      allowDeviceCredential: true,
      androidTitle: 'Pupikes Authenticator'
    });
    return true;
  } catch (e) { return false; }
}

// Запазва master паролата в защитеното хранилище (при включване на биометрията).
export async function biometricStorePassword(password) {
  await load();
  if (!_sec) return false;
  try { await _sec.set(SECURE_KEY, password); return true; } catch (e) { return false; }
}

// Чете запазената парола (след успешна биометрична проверка).
export async function biometricGetPassword() {
  await load();
  if (!_sec) return null;
  try { const v = await _sec.get(SECURE_KEY); return (v && v.value != null) ? v.value : (typeof v === 'string' ? v : null); }
  catch (e) { return null; }
}

// Маха запазената парола (при изключване на биометрията / смяна на паролата).
export async function biometricClear() {
  await load();
  if (!_sec) return;
  try { await _sec.remove(SECURE_KEY); } catch (e) {}
}
