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
        public const uint CAPTUREBLT = 0x40000000;   // хваща и слоести/DWM-композирани прозорци (login екран)
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
            // .NET Framework по подразбиране НЕ ползва TLS 1.2 → wss връзката към сигнала гърми
            // („Could not create SSL/TLS secure channel"). Налагаме TLS 1.2 (+1.3, ако го има).
            try { System.Net.ServicePointManager.SecurityProtocol = (System.Net.SecurityProtocolType)3072; } catch { }
            try { System.Net.ServicePointManager.SecurityProtocol |= (System.Net.SecurityProtocolType)12288; } catch { }
            IntPtr curDesk = IntPtr.Zero; string curName = ""; long frames = 0;
            while (true)
            {
                try
                {
                    // Проверяваме КОЙ е входният десктоп. Закачаме се за него САМО при СМЯНА (напр. заключване →
                    // Winlogon). НЕ затваряме активния handle всеки път — това чупеше следващото заснемане
                    // (кадърът „замръзваше", макар входът да минаваше).
                    IntPtr inp = Native.OpenInputDesktop(0, false, Native.GENERIC_ALL);
                    if (inp != IntPtr.Zero)
                    {
                        string name = DesktopName(inp);
                        if (!string.Equals(name, curName, StringComparison.Ordinal))
                        {
                            bool ok = Native.SetThreadDesktop(inp);
                            DeskService.Log("Входен десктоп: " + name + (ok ? "" : " (SetThreadDesktop неуспех " + Marshal.GetLastWin32Error() + ")"));
                            IntPtr old = curDesk; curDesk = inp; curName = name;
                            if (old != IntPtr.Zero) { try { Native.CloseDesktop(old); } catch { } }
                        }
                        else { Native.CloseDesktop(inp); }   // същият десктоп → върни излишния handle, пази активния
                    }

                    bool secure = curName.Length > 0 && !string.Equals(curName, "Default", StringComparison.OrdinalIgnoreCase);
                    if (secure)
                    {
                        EnsureConfig();
                        EnsureConnected();
                        if (controllerId != null) {
                            CaptureAndSend(); DrainInput();
                            if ((++frames % 40) == 0) DeskService.Log("кадри изпратени: " + frames);
                            if (frames % 10 == 1) { try { Send(Sig(controllerId, new Dictionary<string, object> { { "kind", "secure-diag" }, { "text", "десктоп=" + curName + " · " + capMode } })); } catch { } }
                        }
                        else WriteDebugBmpThrottled();      // без контролер: пази frame.bmp (проверка)
                    }
                    else
                    {
                        // Потребителят е влязъл (Default) — освобождаваме номера за Electron приложението.
                        Disconnect();
                    }
                }
                catch (Exception ex) { DeskService.Log("Агент грешка: " + ex.Message); }
                Thread.Sleep(controllerId != null ? 200 : 600);  // ~5 кадъра/сек при гледане; иначе по-рядко
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

        // Хваща екрана: ПЪРВО през DXGI (надеждно за login/secure екрана), иначе GDI резерва.
        static string capMode = "(стартиране)";
        static Bitmap Grab()
        {
            try { var d = Dxgi.Capture(); if (d != null) { vx = 0; vy = 0; vw = d.Width; vh = d.Height; capMode = "DXGI: " + Dxgi.Status; return d; } } catch (Exception ex) { DeskService.Log("DXGI изключение: " + ex.Message); }
            capMode = "GDI резерва (login екранът ще е ЧЕРЕН) — DXGI: " + Dxgi.Status;
            return GrabGdi();
        }
        static Bitmap GrabGdi()
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
                if (Native.BitBlt(mem, 0, 0, vw, vh, screen, vx, vy, Native.SRCCOPY | Native.CAPTUREBLT))
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
            // GetUserObjectInformation е ANSI (A версия) → четем като ASCII и режем до първия нул-байт.
            try { var buf = new byte[256]; uint need;
                if (Native.GetUserObjectInformation(h, 2 /*UOI_NAME*/, buf, (uint)buf.Length, out need)) {
                    int n = (int)Math.Min(Math.Max(0, need), buf.Length);
                    string s = Encoding.ASCII.GetString(buf, 0, n);
                    int z = s.IndexOf('\0'); if (z >= 0) s = s.Substring(0, z);
                    return s.Trim();
                }
            } catch { } return "?";
        }
    }

    // ── DXGI Desktop Duplication: НАДЕЖДНОТО заснемане на композирания екран, вкл. login/secure ──
    // GDI BitBlt връща ЧЕРНО на login екрана (LogonUI се рисува през DWM/DirectX). DXGI дублирането
    // хваща реалния композиран кадър на монитора — точно каквото ползват AnyDesk/TeamViewer.
    // Викаме COM методите директно по индекс във vtable (без SharpDX — компилира се с вградения csc).
    public static class Dxgi
    {
        [DllImport("d3d11.dll")]
        static extern int D3D11CreateDevice(IntPtr adapter, uint driverType, IntPtr software, uint flags,
            IntPtr featureLevels, uint numFeatureLevels, uint sdkVersion, out IntPtr device, IntPtr featureLevel, out IntPtr context);
        [DllImport("dxgi.dll")]
        static extern int CreateDXGIFactory1(ref Guid riid, out IntPtr factory);

        [StructLayout(LayoutKind.Sequential)] struct SampleDesc { public uint Count, Quality; }
        [StructLayout(LayoutKind.Sequential)] struct Tex2DDesc { public uint Width, Height, MipLevels, ArraySize, Format; public SampleDesc Sample; public uint Usage, BindFlags, CPUAccessFlags, MiscFlags; }
        [StructLayout(LayoutKind.Sequential)] struct MappedSub { public IntPtr pData; public uint RowPitch, DepthPitch; }
        [StructLayout(LayoutKind.Sequential)] struct PtrPos { public int x, y; public int Visible; }
        [StructLayout(LayoutKind.Sequential)] struct FrameInfo {
            public long LastPresentTime, LastMouseUpdateTime; public uint AccumulatedFrames;
            public int RectsCoalesced, ProtectedContentMaskedOut; public PtrPos PointerPosition;
            public uint TotalMetadataBufferSize, PointerShapeBufferSize; }

        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int DGetAdapter(IntPtr s, out IntPtr a);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int DEnumAdapters1(IntPtr s, uint i, out IntPtr a);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int DEnumOutputs(IntPtr s, uint i, out IntPtr o);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int DDuplicateOutput(IntPtr s, IntPtr dev, out IntPtr d);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int DAcquire(IntPtr s, uint t, out FrameInfo fi, out IntPtr r);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int DRelease(IntPtr s);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int DCreateTex2D(IntPtr s, ref Tex2DDesc d, IntPtr init, out IntPtr tex);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate void DGetTexDesc(IntPtr s, out Tex2DDesc d);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate void DCopyRes(IntPtr s, IntPtr dst, IntPtr src);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int DMap(IntPtr s, IntPtr res, uint sub, uint type, uint flags, out MappedSub m);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate void DUnmap(IntPtr s, IntPtr res, uint sub);

        static T Vt<T>(IntPtr obj, int index) {
            IntPtr vtbl = Marshal.ReadIntPtr(obj);
            IntPtr fn = Marshal.ReadIntPtr(vtbl, index * IntPtr.Size);
            return (T)(object)Marshal.GetDelegateForFunctionPointer(fn, typeof(T));
        }

        static IntPtr dev, ctx, dupl, staging; static int sW, sH; static Bitmap last; static bool triedWarn;
        public static string Status = "(не стартиран)";   // за диагностика към контролера

        // Опитва ВСЯКА видеокарта × ВСЕКИ изход, докато DuplicateOutput успее (на лаптоп login екранът
        // може да е на друга карта/изход — честа причина за „черно").
        static bool Init() {
            Cleanup(false);
            var iidFactory1 = new Guid("770aae78-f26f-4dba-a829-253c83d1b387");
            IntPtr factory; int fhr = CreateDXGIFactory1(ref iidFactory1, out factory);
            if (fhr != 0 || factory == IntPtr.Zero) { Status = "CreateDXGIFactory1 hr=0x" + fhr.ToString("X"); DeskService.Log("DXGI: " + Status); return false; }
            var iidOut1 = new Guid("00cddea8-939b-4b83-a340-a685226666cc");
            int lastHr = 0; int adaptersTried = 0, outputsTried = 0;
            try {
                for (uint ai = 0; ai < 8; ai++) {
                    IntPtr adapter; if (Vt<DEnumAdapters1>(factory, 12)(factory, ai, out adapter) != 0) break;
                    adaptersTried++;
                    IntPtr d, c;
                    int dhr = D3D11CreateDevice(adapter, 0 /*UNKNOWN (с подаден адаптер)*/, IntPtr.Zero, 0, IntPtr.Zero, 0, 7, out d, IntPtr.Zero, out c);
                    if (dhr != 0 || d == IntPtr.Zero) { Marshal.Release(adapter); continue; }
                    for (uint oi = 0; oi < 8; oi++) {
                        IntPtr output; if (Vt<DEnumOutputs>(adapter, 7)(adapter, oi, out output) != 0) break;
                        outputsTried++;
                        IntPtr output1; int qhr = Marshal.QueryInterface(output, ref iidOut1, out output1); Marshal.Release(output);
                        if (qhr != 0) continue;
                        IntPtr dp; int ohr = Vt<DDuplicateOutput>(output1, 22)(output1, d, out dp); Marshal.Release(output1);
                        if (ohr == 0 && dp != IntPtr.Zero) {
                            dev = d; ctx = c; dupl = dp; Marshal.Release(adapter);
                            Status = "активно (карта " + ai + ", изход " + oi + ")"; DeskService.Log("DXGI: " + Status);
                            return true;
                        }
                        lastHr = ohr;
                    }
                    Marshal.Release(c); Marshal.Release(d); Marshal.Release(adapter);
                }
            } finally { Marshal.Release(factory); }
            Status = "няма дублируем изход (карти=" + adaptersTried + ", изходи=" + outputsTried + ", hr=0x" + lastHr.ToString("X") + ")";
            DeskService.Log("DXGI: " + Status);
            return false;
        }

        static void EnsureStaging(ref Tex2DDesc d) {
            if (staging != IntPtr.Zero && sW == (int)d.Width && sH == (int)d.Height) return;
            if (staging != IntPtr.Zero) { Marshal.Release(staging); staging = IntPtr.Zero; }
            var sd = d; sd.MipLevels = 1; sd.ArraySize = 1; sd.BindFlags = 0; sd.MiscFlags = 0;
            sd.Usage = 3; sd.CPUAccessFlags = 0x20000; sd.Sample.Count = 1; sd.Sample.Quality = 0;
            IntPtr tex; if (Vt<DCreateTex2D>(dev, 5)(dev, ref sd, IntPtr.Zero, out tex) == 0) { staging = tex; sW = (int)d.Width; sH = (int)d.Height; }
        }

        // Връща КОПИЕ на текущия кадър (или последния при таймаут), или null при провал → GDI резерва.
        public static Bitmap Capture() {
            if (dupl == IntPtr.Zero && !Init()) return null;
            IntPtr res = IntPtr.Zero; bool acquired = false;
            try {
                FrameInfo fi; int hr = Vt<DAcquire>(dupl, 8)(dupl, 200, out fi, out res);
                int WAIT = unchecked((int)0x887A0027), LOST = unchecked((int)0x887A0026);
                if (hr == WAIT) return Clone(last);
                if (hr == LOST) { Cleanup(false); return Clone(last); }
                if (hr != 0 || res == IntPtr.Zero) return Clone(last);
                acquired = true;
                var iidTex = new Guid("6f15aaf2-d208-4e89-9ab4-489535d34f9c");
                IntPtr tex; if (Marshal.QueryInterface(res, ref iidTex, out tex) != 0) return Clone(last);
                Tex2DDesc desc; Vt<DGetTexDesc>(tex, 10)(tex, out desc);
                EnsureStaging(ref desc);
                if (staging == IntPtr.Zero) { Marshal.Release(tex); return Clone(last); }
                Vt<DCopyRes>(ctx, 47)(ctx, staging, tex); Marshal.Release(tex);
                MappedSub map;
                if (Vt<DMap>(ctx, 14)(ctx, staging, 0, 1, 0, out map) != 0) return Clone(last);
                try {
                    using (var wrap = new Bitmap((int)desc.Width, (int)desc.Height, (int)map.RowPitch, PixelFormat.Format32bppRgb, map.pData)) {
                        var copy = new Bitmap(wrap);
                        if (last != null) last.Dispose(); last = copy;
                    }
                } catch (Exception ex) { DeskService.Log("DXGI map грешка: " + ex.Message); }
                finally { Vt<DUnmap>(ctx, 15)(ctx, staging, 0); }
                return Clone(last);
            }
            catch (Exception ex) { DeskService.Log("DXGI грешка: " + ex.Message); return Clone(last); }
            finally { if (acquired) { try { Vt<DRelease>(dupl, 14)(dupl); } catch { } } if (res != IntPtr.Zero) Marshal.Release(res); }
        }
        static Bitmap Clone(Bitmap b) { try { return b == null ? null : new Bitmap(b); } catch { return null; } }
        static void Cleanup(bool all) {
            if (dupl != IntPtr.Zero) { try { Marshal.Release(dupl); } catch { } dupl = IntPtr.Zero; }
            if (staging != IntPtr.Zero) { try { Marshal.Release(staging); } catch { } staging = IntPtr.Zero; sW = sH = 0; }
            if (ctx != IntPtr.Zero) { try { Marshal.Release(ctx); } catch { } ctx = IntPtr.Zero; }
            if (dev != IntPtr.Zero) { try { Marshal.Release(dev); } catch { } dev = IntPtr.Zero; }
            if (all && last != null) { last.Dispose(); last = null; }
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
