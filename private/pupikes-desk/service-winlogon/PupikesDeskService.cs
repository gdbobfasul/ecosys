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
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.ServiceProcess;
using System.Threading;

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

    // ── АГЕНТЪТ (върви в активната сесия като SYSTEM; закача се за ВХОДНИЯ десктоп, вкл. secure) ──
    public static class Agent
    {
        public static void Run()
        {
            DeskService.Log("Агент старт (сесия " + Process.GetCurrentProcess().SessionId + ")");
            string lastDesk = "";
            while (true)
            {
                try
                {
                    IntPtr hDesk = Native.OpenInputDesktop(0, false, Native.GENERIC_ALL);
                    if (hDesk != IntPtr.Zero)
                    {
                        string name = DesktopName(hDesk);
                        if (name != lastDesk) { DeskService.Log("Входен десктоп: " + name); lastDesk = name; }
                        Native.SetThreadDesktop(hDesk);  // закачаме се за него (вкл. Winlogon = login екран)
                        CaptureToFile();
                        Native.CloseDesktop(hDesk);
                    }
                }
                catch (Exception ex) { DeskService.Log("Агент грешка: " + ex.Message); }
                Thread.Sleep(1000); // ЕТАП 1: ~1 кадър/сек за доказателство; ЕТАП 2 = поток в реално време
            }
        }

        private static string DesktopName(IntPtr h)
        {
            try { var buf = new byte[256]; uint need;
                if (Native.GetUserObjectInformation(h, 2 /*UOI_NAME*/, buf, (uint)buf.Length, out need))
                    return System.Text.Encoding.Unicode.GetString(buf, 0, (int)Math.Max(0, need - 2));
            } catch { } return "?";
        }

        // Заснема целия виртуален екран на текущия десктоп → BMP файл (доказателство за ЕТАП 1).
        private static void CaptureToFile()
        {
            IntPtr screen = Native.GetDC(IntPtr.Zero);
            if (screen == IntPtr.Zero) return;
            IntPtr mem = Native.CreateCompatibleDC(screen);
            int x = Native.GetSystemMetrics(Native.SM_XVIRTUAL), y = Native.GetSystemMetrics(Native.SM_YVIRTUAL);
            int w = Native.GetSystemMetrics(Native.SM_CXVIRTUAL), h = Native.GetSystemMetrics(Native.SM_CYVIRTUAL);
            if (w <= 0 || h <= 0) { w = Native.GetSystemMetrics(0); h = Native.GetSystemMetrics(1); x = 0; y = 0; }
            IntPtr bmp = Native.CreateCompatibleBitmap(screen, w, h);
            IntPtr old = Native.SelectObject(mem, bmp);
            try
            {
                Native.BitBlt(mem, 0, 0, w, h, screen, x, y, Native.SRCCOPY);
                WriteBmp(screen, bmp, w, h);
            }
            finally
            {
                Native.SelectObject(mem, old); Native.DeleteObject(bmp);
                Native.DeleteDC(mem); Native.ReleaseDC(IntPtr.Zero, screen);
            }
        }

        private static void WriteBmp(IntPtr hdc, IntPtr hbmp, int w, int h)
        {
            var bmi = new Native.BITMAPINFO();
            bmi.h.biSize = (uint)Marshal.SizeOf(typeof(Native.BITMAPINFOHEADER));
            bmi.h.biWidth = w; bmi.h.biHeight = -h; // top-down
            bmi.h.biPlanes = 1; bmi.h.biBitCount = 32; bmi.h.biCompression = 0;
            int stride = w * 4; var bits = new byte[stride * h];
            if (Native.GetDIBits(hdc, hbmp, 0, (uint)h, bits, ref bmi, 0) == 0) return;

            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "PupikesDesk");
            Directory.CreateDirectory(dir);
            string tmp = Path.Combine(dir, "frame.tmp"), fin = Path.Combine(dir, "frame.bmp");
            using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write))
            using (var bw = new BinaryWriter(fs))
            {
                int dataSize = bits.Length, fileSize = 54 + dataSize;
                bw.Write((byte)'B'); bw.Write((byte)'M'); bw.Write(fileSize); bw.Write(0); bw.Write(54);
                bw.Write((uint)40); bw.Write(w); bw.Write(h); bw.Write((short)1); bw.Write((short)32);
                bw.Write((uint)0); bw.Write((uint)dataSize); bw.Write(0); bw.Write(0); bw.Write((uint)0); bw.Write((uint)0);
                // данните са top-down (biHeight<0 по-горе), но за .bmp файла пишем bottom-up height>0:
                for (int row = h - 1; row >= 0; row--) bw.Write(bits, row * stride, stride);
            }
            try { if (File.Exists(fin)) File.Delete(fin); File.Move(tmp, fin); } catch { }
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
