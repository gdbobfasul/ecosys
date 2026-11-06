'use strict';
// Надеждно въвеждане на Unicode текст (вкл. КИРИЛИЦА) на Windows чрез SendInput + KEYEVENTF_UNICODE.
// Заобикаля подредбата на клавиатурата ИЗЦЯЛО: какъвто символ подадеш, такъв се въвежда на отдалечената
// машина — без нужда да се превключва език/подредба там. Причина: libnut.typeString (през nut.js) чупи
// не-ASCII (обхожда UTF-8 байтове, не символи), затова не ползваме него за текста.
// Реализация: един ПОСТОЯНЕН процес на powershell.exe (наличен на всеки Windows, без външни зависимости),
// който чете base64(UTF-16LE) редове от stdin и праща всеки символ като Unicode клавишно събитие.
const { spawn } = require('child_process');

let ps = null, dead = false;

const PS_SCRIPT = `
$ErrorActionPreference='SilentlyContinue'
$OutputEncoding=[System.Text.Encoding]::UTF8
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class UniType {
  [StructLayout(LayoutKind.Sequential)]
  public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)]
  public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)]
  public struct HARDWAREINPUT { public uint uMsg; public ushort wParamL; public ushort wParamH; }
  [StructLayout(LayoutKind.Explicit)]
  public struct InputUnion {
    [FieldOffset(0)] public MOUSEINPUT mi;
    [FieldOffset(0)] public KEYBDINPUT ki;
    [FieldOffset(0)] public HARDWAREINPUT hi;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT { public uint type; public InputUnion u; }
  [DllImport("user32.dll", SetLastError=true)]
  public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  const uint INPUT_KEYBOARD=1; const uint INPUT_MOUSE=0; const uint KEYEVENTF_KEYUP=2; const uint KEYEVENTF_UNICODE=4;
  const uint MOUSEEVENTF_WHEEL=0x0800;
  public static void Send(string s) {
    if (string.IsNullOrEmpty(s)) return;
    foreach (char c in s) {
      INPUT[] inp = new INPUT[2];
      inp[0].type=INPUT_KEYBOARD; inp[0].u.ki.wScan=(ushort)c; inp[0].u.ki.dwFlags=KEYEVENTF_UNICODE;
      inp[1].type=INPUT_KEYBOARD; inp[1].u.ki.wScan=(ushort)c; inp[1].u.ki.dwFlags=KEYEVENTF_UNICODE|KEYEVENTF_KEYUP;
      SendInput((uint)inp.Length, inp, Marshal.SizeOf(typeof(INPUT)));
    }
  }
  // Колелце на мишката: amount>0 = нагоре (разгъва историята на конзолата), <0 = надолу. 120 = едно деление.
  public static void Wheel(int amount) {
    INPUT[] inp = new INPUT[1];
    inp[0].type=INPUT_MOUSE; inp[0].u.mi.dwFlags=MOUSEEVENTF_WHEEL; inp[0].u.mi.mouseData=unchecked((uint)amount);
    SendInput((uint)inp.Length, inp, Marshal.SizeOf(typeof(INPUT)));
  }
}
"@
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  if ($line -eq '') { continue }
  try {
    if ($line.StartsWith('#W')) {
      $amt = [int]$line.Substring(2)
      [UniType]::Wheel($amt)
    } else {
      $bytes = [Convert]::FromBase64String($line)
      $txt = [System.Text.Encoding]::Unicode.GetString($bytes)
      [UniType]::Send($txt)
    }
  } catch {}
}
`;

function start() {
  if (ps || dead || process.platform !== 'win32') return;
  try {
    ps = spawn('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_SCRIPT],
      { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
    ps.on('error', () => { dead = true; ps = null; });
    ps.on('exit', () => { ps = null; });
  } catch (_) { dead = true; ps = null; }
}

// Връща true при успешно подаване (значи викащият НЕ ползва резервния път през nut.js).
function typeText(text) {
  if (!text || process.platform !== 'win32') return false;
  if (!ps) start();
  if (!ps || !ps.stdin || !ps.stdin.writable) return false;
  try {
    const b64 = Buffer.from(String(text), 'utf16le').toString('base64');
    ps.stdin.write(b64 + '\n');
    return true;
  } catch (_) { return false; }
}

// Колелце на мишката през SendInput (надеждно за конзоли/истории). notches>0 = нагоре (разгъва историята).
function wheel(notches) {
  if (process.platform !== 'win32') return false;
  if (!ps) start();
  if (!ps || !ps.stdin || !ps.stdin.writable) return false;
  try { ps.stdin.write('#W' + Math.round(Number(notches) * 120) + '\n'); return true; } catch (_) { return false; }
}

function stop() { try { if (ps && ps.stdin) ps.stdin.end(); } catch (_) {} ps = null; }

module.exports = { typeText, wheel, start, stop };
