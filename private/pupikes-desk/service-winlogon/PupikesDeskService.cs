// PupikesDeskService — нативна Windows услуга за достъп до ЗАЩИТЕНИЯ работен плот (login/заключен екран).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// ЗАЩО: Electron приложението се пуска чак СЛЕД вход и НЕ може да стигне secure desktop (Winlogon, сесия 0).
// За да се види и управлява login екранът ОТДАЛЕЧЕНО (както прави AnyDesk), трябва услуга като SYSTEM,
// която пуска агент в активната конзолна сесия и се закача за ТЕКУЩИЯ входен работен плот (OpenInputDesktop) —
// това е единственият път до защитения екран.
//
// ЕТАП 1 (този файл): услугата пуска агента като SYSTEM в активната сесия; агентът се закача за входния
// десктоп (вкл. Winlogon) и заснема екрана в кадри → доказва, че secure desktop се ХВАЩА. Запис във
// C:\ProgramData\PupikesDesk\frame.bmp (за проверка на самата машина).
// ЕТАП 2 (следва): кадрите + въвеждане на мишка/клавиатура през сигналния сървър → истинска връзка.
// ЕТАП 3: бутон/чекбокс в Pupikes-Desk, който инсталира/пуска услугата (с еднократно UAC повишение).
//
// Компилира се с ВГРАДЕНИЯ csc (без инсталации):
//   C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe  (виж build.cmd)
//
// Използване (изисква администратор):
//   PupikesDeskService.exe --install      // регистрира услугата (auto-start, LocalSystem)
//   PupikesDeskService.exe --uninstall    // маха услугата
//   PupikesDeskService.exe --console      // пуска в конзолен режим за тест (без да е услуга)
//   PupikesDeskService.exe --agent        // ВЪТРЕШНО: самата услуга го пуска в активната сесия
using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Net.WebSockets;
using System.Runtime.InteropServices;
using System.ServiceProcess;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace PupikesDesk
{
    public static class Native
    {
        // ── сесии / процеси ──
        [DllImport("kernel32.dll")] public static extern uint WTSGetActiveConsoleSessionId();

        // ── токени (за да пуснем агента като SYSTEM в активната сесия) ──
        [DllImport("advapi32.dll", SetLastError = true)]
        public static extern bool OpenProcessToken(IntPtr ProcessHandle, uint DesiredAccess, out IntPtr TokenHandle);
        [DllImport("advapi32.dll", SetLastError = true)]
        public static extern bool DuplicateTokenEx(IntPtr hExistingToken, uint dwDesiredAccess, IntPtr lpTokenAttributes,
            int ImpersonationLevel, int TokenType, out IntPtr phNewToken);
        [DllImport("advapi32.dll", SetLastError = true)]
        public static extern bool SetTokenInformation(IntPtr TokenHandle, int TokenInformationClass, ref uint TokenInformation, uint TokenInformationLength);
        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        public static extern bool CreateProcessAsUser(IntPtr hToken, string lpApplicationName, string lpCommandLine,
            IntPtr lpProcessAttributes, IntPtr lpThreadAttributes, bool bInheritHandles, uint dwCreationFlags,
            IntPtr lpEnvironment, string lpCurrentDirectory, ref STARTUPINFO lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation);
        [DllImport("kernel32.dll", SetLastError = true)] public static extern bool CloseHandle(IntPtr h);

        // ── работни плотове (вкл. secure desktop) ──
        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
        [DllImport("user32.dll", SetLastError = true)] public static extern bool SetThreadDesktop(IntPtr hDesktop);
        [DllImport("user32.dll", SetLastError = true)] public static extern bool CloseDesktop(IntPtr hDesktop);
        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool GetUserObjectInformation(IntPtr hObj, int nIndex, byte[] pvInfo, uint nLength, out uint lpnLengthNeeded);

        // ── заснемане (GDI) ──
        [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
        [DllImport("user32.dll")] public static extern int GetSystemMetrics(int nIndex);
        [DllImport("gdi32.dll")] public static extern IntPtr CreateCompatibleDC(IntPtr hdc);
        [DllImport("gdi32.dll")] public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int w, int h);
        [DllImport("gdi32.dll")] public static extern IntPtr SelectObject(IntPtr hdc, IntPtr h);
        [DllImport("gdi32.dll")] public static extern bool BitBlt(IntPtr hdcDest, int x, int y, int w, int h, IntPtr hdcSrc, int sx, int sy, uint rop);
        [DllImport("gdi32.dll")] public static extern int GetDIBits(IntPtr hdc, IntPtr hbmp, uint start, uint lines, byte[] bits, ref BITMAPINFO bmi, uint usage);
        [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr h);
        [DllImport("gdi32.dll")] public static extern bool DeleteDC(IntPtr hdc);

        // ── въвеждане (мишка/клавиатура) на закачения десктоп ──
        [DllImport("user32.dll", SetLastError = true)] public static extern uint SendInput(uint n, INPUT[] inputs, int cb);
        [DllImport("user32.dll")] public static extern short VkKeyScan(char ch);

        [StructLayout(LayoutKind.Sequential)]
        public struct INPUT { public int type; public INPUTUNION u; }
        [StructLayout(LayoutKind.Explicit)]
        public struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
        [StructLayout(LayoutKind.Sequential)]
        public struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }
        [StructLayout(LayoutKind.Sequential)]
        public struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }

        public const int INPUT_MOUSE = 0, INPUT_KEYBOARD = 1;
        public const uint MOUSEEVENTF_MOVE = 0x0001, MOUSEEVENTF_ABSOLUTE = 0x8000, MOUSEEVENTF_VIRTUALDESK = 0x4000,
            MOUSEEVENTF_LEFTDOWN = 0x0002, MOUSEEVENTF_LEFTUP = 0x0004, MOUSEEVENTF_RIGHTDOWN = 0x0008, MOUSEEVENTF_RIGHTUP = 0x0010;
        public const uint KEYEVENTF_KEYUP = 0x0002, KEYEVENTF_UNICODE = 0x0004;

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct STARTUPINFO { public int cb; public string r1; public string lpDesktop; public string r2;
            public int x, y, xs, ys, xcc, ycc, fa, fb; public int flags; public short sw, r3; public IntPtr r4, hi, ho, he; }
        [StructLayout(LayoutKind.Sequential)]
        public struct PROCESS_INFORMATION { public IntPtr hProcess, hThread; public int pid, tid; }
        [StructLayout(LayoutKind.Sequential)]
        public struct BITMAPINFOHEADER { public uint biSize; public int biWidth, biHeight; public short biPlanes, biBitCount;
            public uint biCompression, biSizeImage; public int biXPels, biYPels; public uint biClrUsed, biClrImportant; }
        [StructLayout(LayoutKind.Sequential)]
        public struct BITMAPINFO { public BITMAPINFOHEADER h; public uint colors; }

        public const uint SRCCOPY = 0x00CC0020;
        public const int SM_XVIRTUAL = 76, SM_YVIRTUAL = 77, SM_CXVIRTUAL = 78, SM_CYVIRTUAL = 79;
        public const uint MAXIMUM_ALLOWED = 0x02000000, GENERIC_ALL = 0x10000000;
        public const uint TOKEN_DUP = 0x0002, TOKEN_QUERY = 0x0008, TOKEN_ASSIGN_PRIMARY = 0x0001,
            TOKEN_ADJUST_DEFAULT = 0x0080, TOKEN_ADJUST_SESSIONID = 0x0100, TOKEN_ALL = 0xF01FF;
    }

    // ── УСЛУГАТА (върви в сесия 0 като LocalSystem) ──
    public class DeskService : ServiceBase
    {
        private Thread _worker; private volatile bool _run;
        public DeskService() { ServiceName = "PupikesDeskSecure"; }
        protected override void OnStart(string[] args) { _run = true; _worker = new Thread(Loop) { IsBackground = true }; _worker.Start(); }
        protected override void OnStop() { _run = false; }

        // Следи активната сесия + входния десктоп; пуска агента като SYSTEM там и го пресъздава при смяна.
        private void Loop()
        {
            int lastSession = -1; Process agent = null;
            while (_run)
            {
                try
                {
                    int sess = (int)Native.WTSGetActiveConsoleSessionId();
                    bool agentDead = agent == null || agent.HasExited;
                    if (sess >= 0 && (sess != lastSession || agentDead))
                    {
                        if (agent != null && !agent.HasExited) { try { agent.Kill(); } catch { } }
                        agent = LaunchAgentInSession(sess);
                        lastSession = sess;
                        Log("Агент пуснат в сесия " + sess + (agent != null ? (" (pid " + SafePid(agent) + ")") : " — НЕУСПЕХ"));
                    }
                }
                catch (Exception ex) { Log("Loop грешка: " + ex.Message); }
                Thread.Sleep(2000);
            }
            if (agent != null && !agent.HasExited) { try { agent.Kill(); } catch { } }
        }

        private static int SafePid(Process p) { try { return p.Id; } catch { return -1; } }

        // Пуска THIS .exe с --agent като SYSTEM в дадената сесия, ползвайки токена на winlogon.exe от нея.
        private Process LaunchAgentInSession(int session)
        {
            IntPtr hWinlogon = IntPtr.Zero, hTok = IntPtr.Zero, hDup = IntPtr.Zero;
            try
            {
                Process wl = null;
                foreach (var p in Process.GetProcessesByName("winlogon"))
                { try { if (p.SessionId == session) { wl = p; break; } } catch { } }
                if (wl == null) { Log("Няма winlogon.exe в сесия " + session); return null; }

                if (!Native.OpenProcessToken(wl.Handle, Native.TOKEN_DUP | Native.TOKEN_QUERY, out hTok))
                { Log("OpenProcessToken неуспех: " + Marshal.GetLastWin32Error()); return null; }

                // 2 = SecurityImpersonation, 1 = TokenPrimary
                if (!Native.DuplicateTokenEx(hTok, Native.TOKEN_ALL, IntPtr.Zero, 2, 1, out hDup))
                { Log("DuplicateTokenEx неуспех: " + Marshal.GetLastWin32Error()); return null; }

                uint s = (uint)session;
                Native.SetTokenInformation(hDup, 12 /*TokenSessionId*/, ref s, sizeof(uint)); // към активната сесия

                var si = new Native.STARTUPINFO();
                si.cb = Marshal.SizeOf(si);
                si.lpDesktop = "winsta0\\default"; // стартов десктоп; агентът после се закача за ВХОДНИЯ (вкл. Winlogon)
                Native.PROCESS_INFORMATION pi;
                string exe = Process.GetCurrentProcess().MainModule.FileName;
                const uint CREATE_NO_WINDOW = 0x08000000, CREATE_UNICODE_ENV = 0x00000400;
                bool ok = Native.CreateProcessAsUser(hDup, exe, "\"" + exe + "\" --agent", IntPtr.Zero, IntPtr.Zero,
                    false, CREATE_NO_WINDOW | CREATE_UNICODE_ENV, IntPtr.Zero, null, ref si, out pi);
                if (!ok) { Log("CreateProcessAsUser неуспех: " + Marshal.GetLastWin32Error()); return null; }
                Native.CloseHandle(pi.hThread);
                try { return Process.GetProcessById(pi.pid); } catch { return null; }
            }
            catch (Exception ex) { Log("LaunchAgent грешка: " + ex.Message); return null; }
            finally { if (hTok != IntPtr.Zero) Native.CloseHandle(hTok); if (hDup != IntPtr.Zero) Native.CloseHandle(hDup); }
        }

        public static void Log(string m)
        {
            try
            {
                string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "PupikesDesk");
                Directory.CreateDirectory(dir);
                File.AppendAllText(Path.Combine(dir, "service.log"), DateTime.Now.ToString("HH:mm:ss") + "  " + m + Environment.NewLine);
            }
            catch { }
        }
    }

    // Общ конфиг (приложението го записва в C:\ProgramData\PupikesDesk\config.json).
    public class Cfg { public string id = "", viewPassword = "", fullPassword = "", signal = ""; }

    // ── АГЕНТЪТ (върви в активната сесия като SYSTEM; закача се за ВХОДНИЯ десктоп, вкл. secure) ──
    // ЕТАП 2: свързва се към сигналния сървър под номера на машината, стрийм на JPEG кадри към контролера
    // и приема мишка/клавиатура → SendInput на закачения десктоп (вкл. login/заключен екран).
    public static class Agent
    {
        static Cfg cfg;
        static ClientWebSocket ws;
        static readonly object sendLock = new object();
        static volatile string controllerId = null;            // кой Pupikes-Desk гледа сега (идва при secure-attach)
        static readonly ConcurrentQueue<Dictionary<string, object>> inQ = new ConcurrentQueue<Dictionary<string, object>>();
        static readonly JavaScriptSerializer JS = new JavaScriptSerializer();
        static int vx, vy, vw, vh;                              // правоъгълник на виртуалния екран (за мащаба на входа)
        static DateTime lastConnTry = DateTime.MinValue;
        static Thread rxThread;

        public static void Run()
        {
            DeskService.Log("Агент старт (сесия " + Process.GetCurrentProcess().SessionId + ")");
            JS.MaxJsonLength = 64 * 1024 * 1024;
            string lastDesk = "";
            while (true)
            {
                try
                {
                    IntPtr hDesk = Native.OpenInputDesktop(0, false, Native.GENERIC_ALL);
                    if (hDesk != IntPtr.Zero)
                    {
                        Native.SetThreadDesktop(hDesk);          // закачаме се за входния десктоп (вкл. Winlogon)
                        string name = DesktopName(hDesk);
                        if (name != lastDesk) { DeskService.Log("Входен десктоп: " + name); lastDesk = name; }
                        bool secure = !string.Equals(name, "Default", StringComparison.OrdinalIgnoreCase);

                        if (secure)
                        {
                            EnsureConfig();
                            EnsureConnected();
                            if (controllerId != null) { CaptureAndSend(); DrainInput(); }
                            else WriteDebugBmpThrottled();      // без контролер: пази frame.bmp (проверка/етап 1)
                        }
                        else
                        {
                            // Потребителят е влязъл (Default) — освобождаваме номера за Electron приложението.
                            Disconnect();
                        }
                        Native.CloseDesktop(hDesk);
                    }
                }
                catch (Exception ex) { DeskService.Log("Агент грешка: " + ex.Message); }
                Thread.Sleep(controllerId != null ? 250 : 600);  // ~4 кадъра/сек при гледане; иначе по-рядко
            }
        }

        static void EnsureConfig()
        {
            if (cfg != null) return;
            try
            {
                string f = Path.Combine(ProgramData(), "config.json");
                if (!File.Exists(f)) return;
                var d = JS.Deserialize<Dictionary<string, object>>(File.ReadAllText(f));
                cfg = new Cfg {
                    id = Str(d, "id"), viewPassword = Str(d, "viewPassword"),
                    fullPassword = Str(d, "fullPassword"), signal = Str(d, "signal")
                };
                if (cfg.id == "" || cfg.signal == "") { cfg = null; return; }
                DeskService.Log("Конфиг зареден: номер " + cfg.id + ", сигнал " + cfg.signal);
            }
            catch (Exception ex) { DeskService.Log("Конфиг грешка: " + ex.Message); cfg = null; }
        }

        static void EnsureConnected()
        {
            if (cfg == null) return;
            if (ws != null && ws.State == WebSocketState.Open) return;
            if ((DateTime.UtcNow - lastConnTry).TotalSeconds < 5) return;   // без спам при провал
            lastConnTry = DateTime.UtcNow;
            try
            {
                Disconnect();
                ws = new ClientWebSocket();
                ws.ConnectAsync(new Uri(cfg.signal), CancellationToken.None).GetAwaiter().GetResult();
                Send(new Dictionary<string, object> { { "type", "hello" }, { "id", cfg.id } });
                rxThread = new Thread(ReceiveLoop) { IsBackground = true };
                rxThread.Start(ws);
                DeskService.Log("Свързан към сигнала като " + cfg.id);
            }
            catch (Exception ex) { DeskService.Log("Връзка неуспех: " + ex.Message); try { if (ws != null) ws.Abort(); } catch { } ws = null; }
        }

        static void Disconnect()
        {
            controllerId = null;
            var w = ws; ws = null;
            if (w != null) { try { w.Abort(); } catch { } try { w.Dispose(); } catch { } }
        }

        static void Send(Dictionary<string, object> obj)
        {
            var w = ws; if (w == null || w.State != WebSocketState.Open) return;
            string json = JS.Serialize(obj);
            var bytes = Encoding.UTF8.GetBytes(json);
            lock (sendLock)
            { try { w.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None).GetAwaiter().GetResult(); } catch { } }
        }

        static void ReceiveLoop(object o)
        {
            var w = (ClientWebSocket)o;
            var buf = new byte[65536];
            var sb = new StringBuilder();
            try
            {
                while (w.State == WebSocketState.Open)
                {
                    var r = w.ReceiveAsync(new ArraySegment<byte>(buf), CancellationToken.None).GetAwaiter().GetResult();
                    if (r.MessageType == WebSocketMessageType.Close) break;
                    sb.Append(Encoding.UTF8.GetString(buf, 0, r.Count));
                    if (!r.EndOfMessage) continue;
                    string msg = sb.ToString(); sb.Clear();
                    HandleMessage(msg);
                }
            }
            catch (Exception ex) { DeskService.Log("RX край: " + ex.Message); }
        }

        static void HandleMessage(string msg)
        {
            Dictionary<string, object> m;
            try { m = JS.Deserialize<Dictionary<string, object>>(msg); } catch { return; }
            string type = Str(m, "type");
            if (type == "error") { DeskService.Log("Сигнал грешка: " + Str(m, "error")); return; }
            if (type == "bye") { controllerId = null; return; }
            if (type != "signal") return;
            string from = Str(m, "from");
            var data = m.ContainsKey("data") ? m["data"] as Dictionary<string, object> : null;
            if (data == null) return;
            string kind = Str(data, "kind");
            if (kind == "secure-attach")
            {
                if (Str(data, "pass") == cfg.fullPassword) { controllerId = from; DeskService.Log("Контролер закачен: " + from); Send(Sig(from, new Dictionary<string, object> { { "kind", "secure-ok" } })); }
                else { Send(Sig(from, new Dictionary<string, object> { { "kind", "secure-deny" } })); DeskService.Log("Грешна парола от " + from); }
            }
            else if (kind == "secure-bye") { if (from == controllerId) controllerId = null; }
            else if (kind == "input") { if (from == controllerId) inQ.Enqueue(data); }
        }

        static Dictionary<string, object> Sig(string to, Dictionary<string, object> data)
        { return new Dictionary<string, object> { { "type", "signal" }, { "to", to }, { "data", data } }; }

        // ── ЗАСНЕМАНЕ → JPEG → сигнал към контролера ──
        static void CaptureAndSend()
        {
            using (var bmp = Grab())
            {
                if (bmp == null) return;
                int maxW = 1366;                                  // смаляваме за по-малък кадър
                Bitmap use = bmp;
                if (bmp.Width > maxW)
                {
                    int nw = maxW, nh = (int)((long)bmp.Height * maxW / bmp.Width);
                    use = new Bitmap(bmp, nw, nh);
                }
                try
                {
                    byte[] jpeg = ToJpeg(use, 45L);
                    string b64 = Convert.ToBase64String(jpeg);
                    Send(Sig(controllerId, new Dictionary<string, object> {
                        { "kind", "frame" }, { "w", use.Width }, { "h", use.Height }, { "jpeg", b64 }
                    }));
                }
                finally { if (use != bmp) use.Dispose(); }
            }
        }

        // Хваща целия виртуален екран на закачения десктоп като Bitmap.
        static Bitmap Grab()
        {
            IntPtr screen = Native.GetDC(IntPtr.Zero);
            if (screen == IntPtr.Zero) return null;
            IntPtr mem = Native.CreateCompatibleDC(screen);
            vx = Native.GetSystemMetrics(Native.SM_XVIRTUAL); vy = Native.GetSystemMetrics(Native.SM_YVIRTUAL);
            vw = Native.GetSystemMetrics(Native.SM_CXVIRTUAL); vh = Native.GetSystemMetrics(Native.SM_CYVIRTUAL);
            if (vw <= 0 || vh <= 0) { vw = Native.GetSystemMetrics(0); vh = Native.GetSystemMetrics(1); vx = 0; vy = 0; }
            IntPtr hbmp = Native.CreateCompatibleBitmap(screen, vw, vh);
            IntPtr old = Native.SelectObject(mem, hbmp);
            Bitmap result = null;
            try
            {
                if (Native.BitBlt(mem, 0, 0, vw, vh, screen, vx, vy, Native.SRCCOPY))
                    result = Image.FromHbitmap(hbmp);
            }
            catch { }
            finally
            {
                Native.SelectObject(mem, old); Native.DeleteObject(hbmp);
                Native.DeleteDC(mem); Native.ReleaseDC(IntPtr.Zero, screen);
            }
            return result;
        }

        static byte[] ToJpeg(Bitmap bmp, long quality)
        {
            var enc = GetEncoder(ImageFormat.Jpeg);
            var ps = new EncoderParameters(1);
            ps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);
            using (var ms = new MemoryStream()) { bmp.Save(ms, enc, ps); return ms.ToArray(); }
        }
        static ImageCodecInfo GetEncoder(ImageFormat fmt)
        { foreach (var c in ImageCodecInfo.GetImageEncoders()) if (c.FormatID == fmt.Guid) return c; return null; }

        // ── ИНЖЕКТИРАНЕ НА ВХОД (мишка/клавиатура) на закачения десктоп ──
        static void DrainInput()
        {
            Dictionary<string, object> ev;
            while (inQ.TryDequeue(out ev))
            {
                try
                {
                    string t = Str(ev, "t");
                    if (t == "m" || t == "md" || t == "mu" || t == "click")
                    {
                        if (ev.ContainsKey("x")) MoveAbs(Dbl(ev, "x"), Dbl(ev, "y"));
                        int b = (int)Dbl(ev, "b");
                        if (t == "md") MouseBtn(b, true);
                        else if (t == "mu") MouseBtn(b, false);
                        else if (t == "click") { MouseBtn(b, true); MouseBtn(b, false); }
                    }
                    else if (t == "type") { TypeText(Str(ev, "text")); }
                    else if (t == "key") { KeyVk((ushort)Dbl(ev, "vk"), true); KeyVk((ushort)Dbl(ev, "vk"), false); }
                }
                catch (Exception ex) { DeskService.Log("Вход грешка: " + ex.Message); }
            }
        }

        static void MoveAbs(double nx, double ny)
        {
            // нормализирани 0..1 → 0..65535 по целия виртуален екран (VIRTUALDESK)
            int ax = (int)Math.Round(Clamp01(nx) * 65535.0), ay = (int)Math.Round(Clamp01(ny) * 65535.0);
            var inp = new Native.INPUT[1];
            inp[0].type = Native.INPUT_MOUSE;
            inp[0].u.mi = new Native.MOUSEINPUT { dx = ax, dy = ay, dwFlags = Native.MOUSEEVENTF_MOVE | Native.MOUSEEVENTF_ABSOLUTE | Native.MOUSEEVENTF_VIRTUALDESK };
            Native.SendInput(1, inp, Marshal.SizeOf(typeof(Native.INPUT)));
        }
        static void MouseBtn(int b, bool down)
        {
            uint f = b == 2 ? (down ? Native.MOUSEEVENTF_RIGHTDOWN : Native.MOUSEEVENTF_RIGHTUP)
                            : (down ? Native.MOUSEEVENTF_LEFTDOWN : Native.MOUSEEVENTF_LEFTUP);
            var inp = new Native.INPUT[1];
            inp[0].type = Native.INPUT_MOUSE;
            inp[0].u.mi = new Native.MOUSEINPUT { dwFlags = f };
            Native.SendInput(1, inp, Marshal.SizeOf(typeof(Native.INPUT)));
        }
        static void TypeText(string s)
        {
            if (string.IsNullOrEmpty(s)) return;
            foreach (char ch in s) { UniKey(ch, true); UniKey(ch, false); }
        }
        static void UniKey(char ch, bool down)
        {
            var inp = new Native.INPUT[1];
            inp[0].type = Native.INPUT_KEYBOARD;
            inp[0].u.ki = new Native.KEYBDINPUT { wVk = 0, wScan = ch, dwFlags = Native.KEYEVENTF_UNICODE | (down ? 0 : Native.KEYEVENTF_KEYUP) };
            Native.SendInput(1, inp, Marshal.SizeOf(typeof(Native.INPUT)));
        }
        static void KeyVk(ushort vk, bool down)
        {
            var inp = new Native.INPUT[1];
            inp[0].type = Native.INPUT_KEYBOARD;
            inp[0].u.ki = new Native.KEYBDINPUT { wVk = vk, dwFlags = down ? 0 : Native.KEYEVENTF_KEYUP };
            Native.SendInput(1, inp, Marshal.SizeOf(typeof(Native.INPUT)));
        }

        // ── помощни ──
        static double Clamp01(double v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
        static string Str(Dictionary<string, object> d, string k) { object v; return (d != null && d.TryGetValue(k, out v) && v != null) ? v.ToString() : ""; }
        static double Dbl(Dictionary<string, object> d, string k) { object v; if (d != null && d.TryGetValue(k, out v) && v != null) { double r; if (double.TryParse(v.ToString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out r)) return r; } return 0; }
        static string ProgramData() { string b = Environment.GetEnvironmentVariable("ProgramData") ?? "C:\\ProgramData"; string d = Path.Combine(b, "PupikesDesk"); Directory.CreateDirectory(d); return d; }

        static DateTime lastBmp = DateTime.MinValue;
        static void WriteDebugBmpThrottled()
        {
            if ((DateTime.UtcNow - lastBmp).TotalSeconds < 2) return;
            lastBmp = DateTime.UtcNow;
            try { using (var b = Grab()) { if (b != null) b.Save(Path.Combine(ProgramData(), "frame.bmp"), ImageFormat.Bmp); } } catch { }
        }

        static string DesktopName(IntPtr h)
        {
            try { var buf = new byte[256]; uint need;
                if (Native.GetUserObjectInformation(h, 2 /*UOI_NAME*/, buf, (uint)buf.Length, out need))
                    return Encoding.Unicode.GetString(buf, 0, (int)Math.Max(0, need - 2));
            } catch { } return "?";
        }
    }

    public static class Program
    {
        [STAThread]
        public static int Main(string[] args)
        {
            string a = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            switch (a)
            {
                case "--install":   return Sc("create PupikesDeskSecure binPath= \"" + Exe() + "\" start= auto obj= LocalSystem DisplayName= \"Pupikes-Desk Secure Access\"");
                case "--uninstall": Sc("stop PupikesDeskSecure"); return Sc("delete PupikesDeskSecure");
                case "--agent":     Agent.Run(); return 0;
                case "--console":   new DeskServiceConsole().RunConsole(); return 0;
                default:
                    ServiceBase.Run(new ServiceBase[] { new DeskService() });
                    return 0;
            }
        }

        private static string Exe() { return Process.GetCurrentProcess().MainModule.FileName; }

        // Пуска `sc.exe` с подадените аргументи (изисква администратор). Връща exit кода.
        private static int Sc(string arguments)
        {
            try
            {
                var psi = new ProcessStartInfo("sc.exe", arguments) { UseShellExecute = false, CreateNoWindow = true };
                var p = Process.Start(psi); p.WaitForExit(); return p.ExitCode;
            }
            catch (Exception ex) { Console.WriteLine("sc грешка: " + ex.Message); return 1; }
        }
    }

    // Конзолен режим за тест без инсталиране на услуга (пуска агента директно; НЕ стига secure desktop,
    // защото не е SYSTEM — но проверява заснемането на текущия десктоп).
    public class DeskServiceConsole
    {
        public void RunConsole()
        {
            Console.WriteLine("Конзолен тест: заснемам текущия десктоп в ProgramData\\PupikesDesk\\frame.bmp (Ctrl+C за изход).");
            Agent.Run();
        }
    }
}
