// Doodle Aquarium - Windows host.
// Runs a tiny local web server for the aquarium page, a tray icon, and the
// live-wallpaper manager (puts a Microsoft Edge app window behind the desktop
// icons and forwards desktop clicks to it). Built with the C# compiler that
// ships with Windows (.NET Framework 4.x), so no installs are needed.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: System.Reflection.AssemblyTitle("Doodle Aquarium")]
[assembly: System.Reflection.AssemblyProduct("Doodle Aquarium")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]

namespace DoodleAquarium
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            Native.MakeDpiAware();
            bool background = Array.IndexOf(args, "--background") >= 0;

            bool created;
            Mutex mutex = new Mutex(true, "DoodleAquarium.SingleInstance.v1", out created);
            if (!created)
            {
                // Already running: ask the running copy to show the editor.
                // We were just launched by the user, so we may hand our right to
                // come to the front over to the window it opens.
                try { Native.AllowSetForegroundWindow(-1); } catch { }
                try
                {
                    int port = int.Parse(File.ReadAllText(Paths.PortFile).Trim());
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/open-editor");
                    req.Method = "POST";
                    req.Headers.Add("X-Aquarium", "1");
                    req.ContentLength = 0;
                    req.Timeout = 4000;
                    req.GetResponse().Close();
                }
                catch { }
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            AquariumApp app = new AquariumApp(background);
            Application.Run(app);
            GC.KeepAlive(mutex);
        }
    }

    static class Paths
    {
        public static readonly string AppDir = Path.GetDirectoryName(Application.ExecutablePath);
        public static readonly string WebDir = Path.GetFullPath(Path.Combine(AppDir, "web"));
        public static readonly string DataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DoodleAquarium");
        public static readonly string LocalDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DoodleAquarium");
        public static readonly string StateFile = Path.Combine(DataDir, "aquarium.json");
        public static readonly string ProfilesDir = Path.Combine(DataDir, "profiles");
        public static readonly string SettingsFile = Path.Combine(DataDir, "settings.txt");
        public static readonly string PortFile = Path.Combine(LocalDir, "port.txt");
        public static readonly string EditorProfile = Path.Combine(LocalDir, "EdgeEditor");
        public static readonly string WallpaperProfile = Path.Combine(LocalDir, "EdgeWallpaper");
        public static readonly string LogFile = Path.Combine(LocalDir, "log.txt");

        public static void Ensure()
        {
            Directory.CreateDirectory(DataDir);
            Directory.CreateDirectory(ProfilesDir);
            Directory.CreateDirectory(LocalDir);
        }
    }

    static class Log
    {
        static readonly object lk = new object();
        public static void Write(string msg)
        {
            try
            {
                lock (lk)
                {
                    FileInfo fi = new FileInfo(Paths.LogFile);
                    if (fi.Exists && fi.Length > 512 * 1024) fi.Delete();
                    File.AppendAllText(Paths.LogFile, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + msg + "\r\n");
                }
            }
            catch { }
        }
    }

    // Tiny key=value settings file.
    class Settings
    {
        Dictionary<string, string> values = new Dictionary<string, string>();

        public Settings()
        {
            try
            {
                if (File.Exists(Paths.SettingsFile))
                    foreach (string line in File.ReadAllLines(Paths.SettingsFile))
                    {
                        int i = line.IndexOf('=');
                        if (i > 0) values[line.Substring(0, i).Trim()] = line.Substring(i + 1).Trim();
                    }
            }
            catch { }
        }

        public bool GetBool(string key, bool def)
        {
            string v;
            if (values.TryGetValue(key, out v)) return v == "1" || v == "true";
            return def;
        }

        public void SetBool(string key, bool val)
        {
            values[key] = val ? "1" : "0";
            try
            {
                StringBuilder sb = new StringBuilder();
                foreach (KeyValuePair<string, string> kv in values) sb.Append(kv.Key).Append('=').Append(kv.Value).Append("\r\n");
                File.WriteAllText(Paths.SettingsFile, sb.ToString());
            }
            catch { }
        }
    }

    class AquariumApp : ApplicationContext
    {
        public readonly Control Ui;           // used to hop onto the UI thread
        public readonly Settings Settings = new Settings();
        public readonly WebServer Server;
        public readonly WallpaperManager Wallpaper;
        public string EdgePath;

        NotifyIcon tray;
        ToolStripMenuItem wallpaperItem, autostartItem;
        Process editorProc;

        IntPtr mouseHook = IntPtr.Zero;
        Native.LowLevelMouseProc hookProc;    // keep delegate alive
        bool cursorOverDesktop;
        int lastMoveTick;
        System.Windows.Forms.Timer coverTimer;
        bool covered;

        public AquariumApp(bool background)
        {
            Paths.Ensure();
            Ui = new Control();
            IntPtr forceHandle = Ui.Handle;

            EdgePath = FindEdge();
            Server = new WebServer(this);
            Server.Start();
            try { File.WriteAllText(Paths.PortFile, Server.Port.ToString()); } catch { }
            Log.Write("Started on port " + Server.Port + ", edge=" + EdgePath);

            Wallpaper = new WallpaperManager(this);
            BuildTray();

            hookProc = MouseHookCallback;
            mouseHook = Native.SetWindowsHookEx(14 /*WH_MOUSE_LL*/, hookProc, Native.GetModuleHandle(null), 0);

            coverTimer = new System.Windows.Forms.Timer();
            coverTimer.Interval = 1000;
            coverTimer.Tick += delegate { CheckCovered(); };
            coverTimer.Start();

            if (Settings.GetBool("wallpaper", false)) Wallpaper.Start();
            if (!background) OpenEditor();
            else if (!Settings.GetBool("wallpaper", false))
                tray.ShowBalloonTip(3000, "Doodle Aquarium", "Your aquarium is waiting in the tray. Double-click the fish to open it.", ToolTipIcon.Info);
        }

        static string FindEdge()
        {
            string[] keys = {
                @"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
                @"HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
                @"HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" };
            foreach (string k in keys)
            {
                try
                {
                    string p = Registry.GetValue(k, "", null) as string;
                    if (!string.IsNullOrEmpty(p) && File.Exists(p)) return p;
                }
                catch { }
            }
            string[] guesses = {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe") };
            foreach (string g in guesses) if (File.Exists(g)) return g;
            return null;
        }

        public string BaseUrl { get { return "http://127.0.0.1:" + Server.Port + "/"; } }

        public void RunOnUi(Action a)
        {
            try { Ui.BeginInvoke(a); } catch { }
        }

        // ---------------- tray ----------------

        void BuildTray()
        {
            tray = new NotifyIcon();
            try { tray.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); }
            catch { tray.Icon = SystemIcons.Application; }
            tray.Text = "Doodle Aquarium";

            ContextMenuStrip menu = new ContextMenuStrip();
            ToolStripMenuItem open = new ToolStripMenuItem("Open my aquarium");
            open.Font = new Font(open.Font, FontStyle.Bold);
            open.Click += delegate { OpenEditor(); };
            menu.Items.Add(open);

            ToolStripMenuItem feed = new ToolStripMenuItem("Feed the fish");
            feed.Click += delegate { Server.Broadcast("{\"t\":\"feed\"}"); };
            menu.Items.Add(feed);

            menu.Items.Add(new ToolStripSeparator());

            wallpaperItem = new ToolStripMenuItem("Live wallpaper");
            wallpaperItem.Click += delegate { if (Wallpaper.Enabled) StopWallpaper(); else StartWallpaper(); };
            menu.Items.Add(wallpaperItem);

            autostartItem = new ToolStripMenuItem("Start when Windows starts");
            autostartItem.Click += delegate { SetAutostart(!GetAutostart()); };
            menu.Items.Add(autostartItem);

            menu.Items.Add(new ToolStripSeparator());
            ToolStripMenuItem exit = new ToolStripMenuItem("Exit Doodle Aquarium");
            exit.Click += delegate { ExitApp(); };
            menu.Items.Add(exit);

            menu.Opening += delegate
            {
                wallpaperItem.Checked = Wallpaper.Enabled;
                autostartItem.Checked = GetAutostart();
            };

            tray.ContextMenuStrip = menu;
            tray.DoubleClick += delegate { OpenEditor(); };
            tray.Visible = true;
        }

        public void StartWallpaper()
        {
            Settings.SetBool("wallpaper", true);
            Wallpaper.Start();
        }

        public void StopWallpaper()
        {
            Settings.SetBool("wallpaper", false);
            Wallpaper.Stop();
        }

        const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";

        public bool GetAutostart()
        {
            try
            {
                using (RegistryKey k = Registry.CurrentUser.OpenSubKey(RunKey))
                    return k != null && k.GetValue("DoodleAquarium") != null;
            }
            catch { return false; }
        }

        public void SetAutostart(bool on)
        {
            try
            {
                using (RegistryKey k = Registry.CurrentUser.CreateSubKey(RunKey))
                {
                    if (on) k.SetValue("DoodleAquarium", "\"" + Application.ExecutablePath + "\" --background");
                    else k.DeleteValue("DoodleAquarium", false);
                }
            }
            catch (Exception ex) { Log.Write("autostart: " + ex.Message); }
        }

        public void OpenEditor()
        {
            if (EdgePath == null)
            {
                MessageBox.Show("Doodle Aquarium needs Microsoft Edge, which normally comes with Windows 11. It could not be found.", "Doodle Aquarium");
                return;
            }
            IntPtr existing = Native.FindTopWindowWithTitle("Doodle Aquarium - Editor");
            if (existing != IntPtr.Zero)
            {
                if (Native.IsIconic(existing)) Native.ShowWindow(existing, 9 /*SW_RESTORE*/);
                Native.SetForegroundWindow(existing);
                return;
            }
            string args = "--app=\"" + BaseUrl + "?mode=editor\"" +
                " --user-data-dir=\"" + Paths.EditorProfile + "\"" +
                " --no-first-run --no-default-browser-check --disable-sync --start-maximized" +
                " --disable-features=Translate,msEdgeSidebarV2,msHubApps,msImplicitSignin";
            try { editorProc = Process.Start(new ProcessStartInfo(EdgePath, args) { UseShellExecute = false }); }
            catch (Exception ex) { Log.Write("editor: " + ex.Message); return; }

            // Bring the new window to the front once it shows up.
            int tries = 0;
            System.Windows.Forms.Timer t = new System.Windows.Forms.Timer();
            t.Interval = 250;
            t.Tick += delegate
            {
                IntPtr w = Native.FindTopWindowWithTitle("Doodle Aquarium - Editor");
                if (w != IntPtr.Zero || ++tries > 60)
                {
                    t.Stop();
                    t.Dispose();
                    if (w != IntPtr.Zero) Native.SetForegroundWindow(w);
                }
            };
            t.Start();
        }

        public void ExitApp()
        {
            try { Wallpaper.Stop(); } catch { }
            if (mouseHook != IntPtr.Zero) Native.UnhookWindowsHookEx(mouseHook);
            tray.Visible = false;
            tray.Dispose();
            Server.Stop();
            ExitThread();
        }

        // ---------------- desktop mouse ----------------

        IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            try
            {
                if (nCode >= 0 && Wallpaper.Attached)
                {
                    int msg = wParam.ToInt32();
                    if (msg == 0x200 || msg == 0x201) // WM_MOUSEMOVE, WM_LBUTTONDOWN
                    {
                        Native.MSLLHOOKSTRUCT info = (Native.MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(Native.MSLLHOOKSTRUCT));
                        Rectangle b = Wallpaper.Bounds;
                        bool inside = b.Contains(info.pt.X, info.pt.Y) && IsDesktopAt(info.pt);
                        if (inside)
                        {
                            double nx = (info.pt.X - b.X) / (double)b.Width;
                            double ny = (info.pt.Y - b.Y) / (double)b.Height;
                            string coords = "\"x\":" + nx.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture) +
                                            ",\"y\":" + ny.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture);
                            if (msg == 0x201)
                                Server.Broadcast("{\"t\":\"click\"," + coords + "}");
                            else if (Environment.TickCount - lastMoveTick > 40)
                            {
                                lastMoveTick = Environment.TickCount;
                                Server.Broadcast("{\"t\":\"move\"," + coords + "}");
                            }
                            cursorOverDesktop = true;
                        }
                        else if (cursorOverDesktop)
                        {
                            cursorOverDesktop = false;
                            Server.Broadcast("{\"t\":\"leave\"}");
                        }
                    }
                }
            }
            catch { }
            return Native.CallNextHookEx(mouseHook, nCode, wParam, lParam);
        }

        static bool IsDesktopAt(Native.POINT pt)
        {
            IntPtr w = Native.WindowFromPoint(pt);
            if (w == IntPtr.Zero) return false;
            IntPtr root = Native.GetAncestor(w, 2 /*GA_ROOT*/);
            string cls = Native.ClassOf(root);
            return cls == "WorkerW" || cls == "Progman";
        }

        // Pause the wallpaper animation while a maximized / full-screen window hides it.
        void CheckCovered()
        {
            if (!Wallpaper.Attached) { covered = false; return; }
            bool now = false;
            IntPtr fg = Native.GetForegroundWindow();
            if (fg != IntPtr.Zero)
            {
                string cls = Native.ClassOf(fg);
                if (cls != "WorkerW" && cls != "Progman" && cls != "Shell_TrayWnd" && !Native.IsIconic(fg) && Native.IsWindowVisible(fg))
                {
                    Native.RECT r;
                    Rectangle b = Wallpaper.Bounds;
                    if (Native.GetWindowRect(fg, out r))
                    {
                        bool full = r.Left <= b.Left && r.Top <= b.Top && r.Right >= b.Right && r.Bottom >= b.Bottom;
                        bool maxed = Native.IsZoomed(fg) && b.Contains((r.Left + r.Right) / 2, (r.Top + r.Bottom) / 2);
                        now = full || maxed;
                    }
                }
            }
            if (now != covered)
            {
                covered = now;
                Server.Broadcast(covered ? "{\"t\":\"pause\"}" : "{\"t\":\"resume\"}");
            }
        }

        public bool Covered { get { return covered; } }
    }

    // ------------------------------------------------------------------
    // Live wallpaper: an Edge app window re-parented behind the desktop icons.
    // ------------------------------------------------------------------
    class WallpaperManager
    {
        public const string WindowTitle = "DoodleAquariumWallpaper";
        AquariumApp app;
        Process proc;
        IntPtr hwnd = IntPtr.Zero;
        IntPtr host = IntPtr.Zero;
        DateTime launchedAt;
        int failures;
        System.Windows.Forms.Timer timer;
        public bool Enabled;
        public Rectangle Bounds;
        int chromeTop, chromeLeft, chromeRight, chromeBottom;

        public WallpaperManager(AquariumApp app)
        {
            this.app = app;
            Bounds = Screen.PrimaryScreen.Bounds;
            timer = new System.Windows.Forms.Timer();
            timer.Interval = 500;
            timer.Tick += delegate { Watch(); };
            Microsoft.Win32.SystemEvents.DisplaySettingsChanged += delegate { app.RunOnUi(delegate { Position(); }); };
        }

        public bool Attached { get { return hwnd != IntPtr.Zero && host != IntPtr.Zero; } }

        public void Start()
        {
            if (app.EdgePath == null) return;
            Enabled = true;
            failures = 0;
            if (proc == null || proc.HasExited) Launch();
            timer.Start();
        }

        public void Stop()
        {
            Enabled = false;
            timer.Stop();
            IntPtr h = hwnd;
            hwnd = IntPtr.Zero;
            host = IntPtr.Zero;
            if (h != IntPtr.Zero && Native.IsWindow(h)) Native.PostMessage(h, 0x0010 /*WM_CLOSE*/, IntPtr.Zero, IntPtr.Zero);
            if (proc != null)
            {
                try { if (!proc.WaitForExit(2000)) proc.Kill(); } catch { }
                proc = null;
            }
            Native.RefreshWallpaper();
        }

        void Launch()
        {
            try
            {
                if (proc != null && !proc.HasExited) proc.Kill();
            }
            catch { }
            // A wallpaper left over from an earlier run (e.g. after a crash) would
            // swallow our launch, so close it first.
            for (int i = 0; i < 3; i++)
            {
                IntPtr old = Native.FindTopWindowWithTitle(WindowTitle);
                if (old == IntPtr.Zero) break;
                uint pid;
                Native.GetWindowThreadProcessId(old, out pid);
                try { Process p = Process.GetProcessById((int)pid); p.Kill(); p.WaitForExit(3000); } catch { }
            }
            hwnd = IntPtr.Zero;
            host = IntPtr.Zero;
            chromeTop = chromeLeft = chromeRight = chromeBottom = 0;
            Bounds = Screen.PrimaryScreen.Bounds;
            string args = "--app=\"" + app.BaseUrl + "?mode=wallpaper\"" +
                " --user-data-dir=\"" + Paths.WallpaperProfile + "\"" +
                " --no-first-run --no-default-browser-check --disable-sync --disable-extensions" +
                " --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows" +
                " --disable-features=CalculateNativeWinOcclusion,Translate,msEdgeSidebarV2,msHubApps,msImplicitSignin" +
                " --disable-session-crashed-bubble --hide-crash-restore-bubble --autoplay-policy=no-user-gesture-required" +
                " --window-position=" + (Bounds.X - 20000) + "," + Bounds.Y +
                " --window-size=" + Bounds.Width + "," + Bounds.Height;
            try
            {
                proc = Process.Start(new ProcessStartInfo(app.EdgePath, args) { UseShellExecute = false });
                launchedAt = DateTime.Now;
                Log.Write("wallpaper launched pid=" + proc.Id);
            }
            catch (Exception ex) { Log.Write("wallpaper launch failed: " + ex.Message); }
        }

        void Watch()
        {
            if (!Enabled) return;
            if (hwnd == IntPtr.Zero)
            {
                IntPtr w = Native.FindTopWindowWithTitle(WindowTitle);
                if (w != IntPtr.Zero) { hwnd = w; Attach(); return; }
                bool dead = proc == null || proc.HasExited;
                if (dead || (DateTime.Now - launchedAt).TotalSeconds > 25)
                {
                    if (++failures > 5) { Log.Write("wallpaper gave up"); Enabled = false; timer.Stop(); return; }
                    Launch();
                }
                return;
            }
            // Explorer restarted or the window went away?
            if (!Native.IsWindow(hwnd) || (host != IntPtr.Zero && !Native.IsWindow(host)))
            {
                Log.Write("wallpaper window lost, relaunching");
                hwnd = IntPtr.Zero; host = IntPtr.Zero;
                Launch();
                return;
            }
            if (Native.GetAncestor(hwnd, 1 /*GA_PARENT*/) != host) Attach();
        }

        void Attach()
        {
            IntPtr defView;
            bool raised;
            IntPtr target = Native.GetWallpaperHost(out defView, out raised);
            if (target == IntPtr.Zero) { Log.Write("no wallpaper host found"); return; }

            long style = Native.GetWindowLongPtr(hwnd, -16).ToInt64();
            style &= ~(0x00C00000L | 0x00040000L | 0x00080000L | 0x00020000L | 0x00010000L); // caption, thickframe, sysmenu, min, max
            style |= 0x10000000L;  // WS_VISIBLE
            Native.SetWindowLongPtr(hwnd, -16, new IntPtr(style));
            long ex = Native.GetWindowLongPtr(hwnd, -20).ToInt64();
            ex |= 0x00000080L;     // WS_EX_TOOLWINDOW (keeps it out of the taskbar)
            ex &= ~0x00040000L;    // WS_EX_APPWINDOW
            Native.SetWindowLongPtr(hwnd, -20, new IntPtr(ex));

            Native.SetParent(hwnd, target);
            host = target;
            if (raised && defView != IntPtr.Zero)
            {
                // Windows 11 24H2+: our window lives inside Progman, just below the icon layer.
                Native.SetWindowPos(hwnd, defView, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
            }
            Position();
            Native.ShowWindow(hwnd, 4 /*SW_SHOWNOACTIVATE*/);
            Log.Write("wallpaper attached to " + Native.ClassOf(target) + (raised ? " (raised desktop)" : ""));
        }

        public void SetChrome(int top, int left, int right, int bottom)
        {
            chromeTop = Math.Max(0, Math.Min(top, 200));
            chromeLeft = Math.Max(0, Math.Min(left, 50));
            chromeRight = Math.Max(0, Math.Min(right, 50));
            chromeBottom = Math.Max(0, Math.Min(bottom, 50));
            Position();
        }

        public void Position()
        {
            Bounds = Screen.PrimaryScreen.Bounds;
            if (!Attached) return;
            Native.RECT hr;
            Native.GetWindowRect(host, out hr);
            int x = Bounds.X - hr.Left - chromeLeft;
            int y = Bounds.Y - hr.Top - chromeTop;
            int w = Bounds.Width + chromeLeft + chromeRight;
            int h = Bounds.Height + chromeTop + chromeBottom;
            Native.SetWindowPos(hwnd, IntPtr.Zero, x, y, w, h, 0x0004 /*NOZORDER*/ | 0x0010 /*NOACTIVATE*/ | 0x0020 /*FRAMECHANGED*/);
        }
    }

    // ------------------------------------------------------------------
    // Minimal HTTP server: static files, aquarium state, events (SSE).
    // ------------------------------------------------------------------
    class WebServer
    {
        AquariumApp app;
        TcpListener listener;
        Thread acceptThread, pumpThread;
        public int Port;
        volatile bool running;
        readonly List<Stream> sseClients = new List<Stream>();
        readonly Queue<string> outbox = new Queue<string>();
        readonly object lk = new object();

        public WebServer(AquariumApp app) { this.app = app; }

        public void Start()
        {
            for (int p = 47615; p < 47640; p++)
            {
                try
                {
                    listener = new TcpListener(IPAddress.Loopback, p);
                    listener.Start();
                    Port = p;
                    break;
                }
                catch (SocketException) { listener = null; }
            }
            if (listener == null) throw new Exception("No free port for Doodle Aquarium");
            running = true;
            acceptThread = new Thread(AcceptLoop) { IsBackground = true, Name = "accept" };
            acceptThread.Start();
            pumpThread = new Thread(Pump) { IsBackground = true, Name = "sse" };
            pumpThread.Start();
        }

        public void Stop()
        {
            running = false;
            try { listener.Stop(); } catch { }
            lock (lk) Monitor.PulseAll(lk);
        }

        public void Broadcast(string json)
        {
            lock (lk)
            {
                if (outbox.Count > 200) outbox.Dequeue();
                outbox.Enqueue(json);
                Monitor.Pulse(lk);
            }
        }

        void Pump()
        {
            int lastBeat = Environment.TickCount;
            while (running)
            {
                string msg = null;
                List<Stream> targets;
                lock (lk)
                {
                    if (outbox.Count == 0) Monitor.Wait(lk, 5000);
                    if (outbox.Count > 0) msg = outbox.Dequeue();
                    targets = new List<Stream>(sseClients);
                }
                byte[] data = null;
                if (msg != null) data = Encoding.UTF8.GetBytes("data: " + msg + "\n\n");
                else if (Environment.TickCount - lastBeat > 15000) { data = Encoding.UTF8.GetBytes(": ping\n\n"); lastBeat = Environment.TickCount; }
                if (data == null) continue;
                foreach (Stream s in targets)
                {
                    try { s.Write(data, 0, data.Length); s.Flush(); }
                    catch
                    {
                        lock (lk) sseClients.Remove(s);
                        try { s.Close(); } catch { }
                    }
                }
            }
        }

        void AcceptLoop()
        {
            while (running)
            {
                try
                {
                    TcpClient c = listener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(Handle, c);
                }
                catch { if (!running) return; }
            }
        }

        class Request
        {
            public string Method, Path, Query;
            public Dictionary<string, string> Headers = new Dictionary<string, string>();
            public byte[] Body = new byte[0];
            public string Param(string name)
            {
                if (string.IsNullOrEmpty(Query)) return null;
                foreach (string part in Query.Split('&'))
                {
                    int i = part.IndexOf('=');
                    string k = i < 0 ? part : part.Substring(0, i);
                    if (k == name) return i < 0 ? "" : Uri.UnescapeDataString(part.Substring(i + 1));
                }
                return null;
            }
        }

        static Request ReadRequest(Stream s)
        {
            MemoryStream head = new MemoryStream();
            byte[] buf = new byte[8192];
            int matched = 0;
            // Read header byte by byte-ish until CRLFCRLF (headers are small).
            int b;
            while ((b = s.ReadByte()) >= 0)
            {
                head.WriteByte((byte)b);
                if ((matched == 0 || matched == 2) && b == '\r') matched++;
                else if ((matched == 1 || matched == 3) && b == '\n') matched++;
                else matched = (b == '\r') ? 1 : 0;
                if (matched == 4) break;
                if (head.Length > 64 * 1024) return null;
            }
            if (matched != 4) return null;
            string text = Encoding.ASCII.GetString(head.ToArray());
            string[] lines = text.Split(new[] { "\r\n" }, StringSplitOptions.None);
            string[] first = lines[0].Split(' ');
            if (first.Length < 2) return null;
            Request r = new Request();
            r.Method = first[0].ToUpperInvariant();
            string target = first[1];
            int q = target.IndexOf('?');
            r.Path = q < 0 ? target : target.Substring(0, q);
            r.Query = q < 0 ? "" : target.Substring(q + 1);
            for (int i = 1; i < lines.Length; i++)
            {
                int c = lines[i].IndexOf(':');
                if (c > 0) r.Headers[lines[i].Substring(0, c).Trim().ToLowerInvariant()] = lines[i].Substring(c + 1).Trim();
            }
            string len;
            if (r.Headers.TryGetValue("content-length", out len))
            {
                int n = int.Parse(len);
                if (n < 0 || n > 64 * 1024 * 1024) return null;
                byte[] body = new byte[n];
                int read = 0;
                while (read < n)
                {
                    int got = s.Read(body, read, n - read);
                    if (got <= 0) return null;
                    read += got;
                }
                r.Body = body;
            }
            return r;
        }

        static void Respond(Stream s, int code, string type, byte[] body)
        {
            string status = code == 200 ? "OK" : code == 404 ? "Not Found" : code == 403 ? "Forbidden" : code == 400 ? "Bad Request" : "Error";
            string head = "HTTP/1.1 " + code + " " + status + "\r\n" +
                          "Content-Type: " + type + "\r\n" +
                          "Content-Length: " + body.Length + "\r\n" +
                          "Cache-Control: no-store\r\n" +
                          "X-Content-Type-Options: nosniff\r\n" +
                          "Connection: close\r\n\r\n";
            byte[] h = Encoding.ASCII.GetBytes(head);
            s.Write(h, 0, h.Length);
            s.Write(body, 0, body.Length);
            s.Flush();
        }

        static void RespondText(Stream s, int code, string type, string text)
        {
            Respond(s, code, type, Encoding.UTF8.GetBytes(text));
        }

        void Handle(object o)
        {
            TcpClient client = (TcpClient)o;
            bool keep = false;
            Stream s = null;
            try
            {
                client.NoDelay = true;
                s = client.GetStream();
                Request r = ReadRequest(s);
                if (r == null) return;

                // Only answer requests addressed to us (blocks DNS-rebinding tricks).
                string host;
                r.Headers.TryGetValue("host", out host);
                if (host == null || !(host.StartsWith("127.0.0.1:") || host.StartsWith("localhost:")))
                { RespondText(s, 403, "text/plain", "forbidden"); return; }

                if (r.Path.StartsWith("/api/"))
                {
                    keep = HandleApi(s, r);
                    return;
                }
                if (r.Method != "GET" && r.Method != "HEAD") { RespondText(s, 400, "text/plain", "bad"); return; }
                ServeFile(s, r.Path);
            }
            catch (Exception ex) { Log.Write("http: " + ex.Message); }
            finally
            {
                if (!keep)
                {
                    // Close politely: say "done sending", let the browser finish reading,
                    // then close. A hard close can cut off big replies.
                    try
                    {
                        client.Client.Shutdown(SocketShutdown.Send);
                        client.Client.ReceiveTimeout = 2000;
                        byte[] drain = new byte[4096];
                        while (client.Client.Receive(drain) > 0) { }
                    }
                    catch { }
                    try { if (s != null) s.Close(); } catch { }
                    try { client.Close(); } catch { }
                }
            }
        }

        bool HandleApi(Stream s, Request r)
        {
            if (r.Path == "/api/events" && r.Method == "GET")
            {
                byte[] h = Encoding.ASCII.GetBytes("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-store\r\nConnection: keep-alive\r\n\r\n: hello\n\n");
                s.Write(h, 0, h.Length);
                s.Flush();
                lock (lk) sseClients.Add(s);
                if (app.Covered) Broadcast("{\"t\":\"pause\"}");
                return true; // keep socket open
            }

            // Everything else needs our custom header: browsers will not send it
            // cross-site without a CORS preflight, which we never approve.
            string marker;
            r.Headers.TryGetValue("x-aquarium", out marker);
            if (marker != "1") { RespondText(s, 403, "text/plain", "forbidden"); return false; }

            switch (r.Path)
            {
                case "/api/state":
                    if (r.Method == "GET")
                    {
                        string json = File.Exists(Paths.StateFile) ? File.ReadAllText(Paths.StateFile, Encoding.UTF8) : "null";
                        RespondText(s, 200, "application/json", json);
                    }
                    else
                    {
                        string tmp = Paths.StateFile + ".tmp";
                        File.WriteAllBytes(tmp, r.Body);
                        if (File.Exists(Paths.StateFile))
                        {
                            try { File.Copy(Paths.StateFile, Paths.StateFile + ".bak", true); } catch { }
                            File.Delete(Paths.StateFile);
                        }
                        File.Move(tmp, Paths.StateFile);
                        Broadcast("{\"t\":\"state\"}");
                        RespondText(s, 200, "application/json", "{\"ok\":true}");
                    }
                    return false;

                case "/api/profiles":
                    {
                        // Each saved aquarium has <id>.json (the aquarium) and <id>.meta.json
                        // (name, picture, date) written by the page; we just glue the metas together.
                        StringBuilder sb = new StringBuilder("[");
                        bool first = true;
                        foreach (string f in Directory.GetFiles(Paths.ProfilesDir, "*.meta.json"))
                        {
                            string t = File.ReadAllText(f, Encoding.UTF8).Trim();
                            if (t.Length == 0 || t[0] != '{') continue;
                            if (!first) sb.Append(',');
                            sb.Append(t);
                            first = false;
                        }
                        sb.Append(']');
                        RespondText(s, 200, "application/json", sb.ToString());
                        return false;
                    }

                case "/api/profiles/get":
                    {
                        string id = ProfileId(r);
                        string file = id == null ? null : Path.Combine(Paths.ProfilesDir, id + ".json");
                        if (file == null || !File.Exists(file)) { RespondText(s, 404, "text/plain", "not found"); return false; }
                        RespondText(s, 200, "application/json", File.ReadAllText(file, Encoding.UTF8));
                        return false;
                    }

                case "/api/profiles/put":
                    {
                        string id = ProfileId(r);
                        string part = r.Param("part");
                        if (id == null || (part != "meta" && part != "state") || r.Body.Length == 0) { RespondText(s, 400, "text/plain", "bad"); return false; }
                        string file = Path.Combine(Paths.ProfilesDir, id + (part == "meta" ? ".meta.json" : ".json"));
                        string tmp = file + ".tmp";
                        File.WriteAllBytes(tmp, r.Body);
                        if (File.Exists(file)) File.Delete(file);
                        File.Move(tmp, file);
                        RespondText(s, 200, "application/json", "{\"ok\":true}");
                        return false;
                    }

                case "/api/profiles/delete":
                    {
                        string id = ProfileId(r);
                        if (id == null) { RespondText(s, 400, "text/plain", "bad"); return false; }
                        foreach (string ext in new[] { ".json", ".meta.json" })
                        {
                            string file = Path.Combine(Paths.ProfilesDir, id + ext);
                            if (File.Exists(file)) File.Delete(file);
                        }
                        RespondText(s, 200, "application/json", "{\"ok\":true}");
                        return false;
                    }

                case "/api/status":
                    RespondText(s, 200, "application/json",
                        "{\"host\":true,\"wallpaper\":" + (app.Wallpaper.Enabled ? "true" : "false") +
                        ",\"attached\":" + (app.Wallpaper.Attached ? "true" : "false") +
                        ",\"autostart\":" + (app.GetAutostart() ? "true" : "false") + "}");
                    return false;

                case "/api/wallpaper/start":
                    app.RunOnUi(delegate { app.StartWallpaper(); });
                    RespondText(s, 200, "application/json", "{\"ok\":true}");
                    return false;

                case "/api/wallpaper/stop":
                    app.RunOnUi(delegate { app.StopWallpaper(); });
                    RespondText(s, 200, "application/json", "{\"ok\":true}");
                    return false;

                case "/api/wallpaper/chrome":
                    {
                        int top = ParseInt(r.Param("top")), left = ParseInt(r.Param("left")), right = ParseInt(r.Param("right")), bottom = ParseInt(r.Param("bottom"));
                        app.RunOnUi(delegate { app.Wallpaper.SetChrome(top, left, right, bottom); });
                        RespondText(s, 200, "application/json", "{\"ok\":true}");
                        return false;
                    }

                case "/api/autostart":
                    {
                        bool on = r.Param("on") == "1";
                        app.SetAutostart(on);
                        RespondText(s, 200, "application/json", "{\"ok\":true}");
                        return false;
                    }

                case "/api/feed":
                    Broadcast("{\"t\":\"feed\"}");
                    RespondText(s, 200, "application/json", "{\"ok\":true}");
                    return false;

                case "/api/open-editor":
                    app.RunOnUi(delegate { app.OpenEditor(); });
                    RespondText(s, 200, "application/json", "{\"ok\":true}");
                    return false;
            }
            RespondText(s, 404, "text/plain", "not found");
            return false;
        }

        // Only short letters/digits ids, so nobody can reach other files.
        static string ProfileId(Request r)
        {
            string id = r.Param("id");
            if (string.IsNullOrEmpty(id) || id.Length > 40) return null;
            foreach (char c in id) if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'))) return null;
            return id;
        }

        static int ParseInt(string v)
        {
            int n;
            return int.TryParse(v, out n) ? n : 0;
        }

        void ServeFile(Stream s, string urlPath)
        {
            string rel = Uri.UnescapeDataString(urlPath).TrimStart('/');
            if (rel == "") rel = "index.html";
            string full;
            try { full = Path.GetFullPath(Path.Combine(Paths.WebDir, rel.Replace('/', '\\'))); }
            catch { RespondText(s, 400, "text/plain", "bad path"); return; }
            if (!full.StartsWith(Paths.WebDir + "\\", StringComparison.OrdinalIgnoreCase) || !File.Exists(full))
            { RespondText(s, 404, "text/plain", "not found"); return; }
            Respond(s, 200, ContentType(full), File.ReadAllBytes(full));
        }

        static string ContentType(string path)
        {
            switch (Path.GetExtension(path).ToLowerInvariant())
            {
                case ".html": return "text/html; charset=utf-8";
                case ".js": return "text/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".json": return "application/json";
                case ".png": return "image/png";
                case ".jpg": case ".jpeg": return "image/jpeg";
                case ".svg": return "image/svg+xml";
                case ".ico": return "image/x-icon";
                case ".woff2": return "font/woff2";
                default: return "application/octet-stream";
            }
        }
    }

    // ------------------------------------------------------------------
    static class Native
    {
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string cls, string name);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string name);
        [DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr h, uint msg, IntPtr w, IntPtr l, uint flags, uint timeout, out IntPtr result);
        public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
        [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
        [DllImport("user32.dll")] public static extern IntPtr SetParent(IntPtr child, IntPtr parent);
        [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
        [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
        [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
        [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
        [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr64(IntPtr h, int i);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] static extern int GetWindowLong32(IntPtr h, int i);
        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] static extern IntPtr SetWindowLongPtr64(IntPtr h, int i, IntPtr v);
        [DllImport("user32.dll", EntryPoint = "SetWindowLongW")] static extern int SetWindowLong32(IntPtr h, int i, int v);
        [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
        [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder sb, int max);
        [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
        [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
        [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
        [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
        [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int pid);
        [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
        [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
        public delegate IntPtr LowLevelMouseProc(int code, IntPtr w, IntPtr l);
        [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr SetWindowsHookEx(int id, LowLevelMouseProc fn, IntPtr mod, uint tid);
        [DllImport("user32.dll")] public static extern bool UnhookWindowsHookEx(IntPtr h);
        [DllImport("user32.dll")] public static extern IntPtr CallNextHookEx(IntPtr h, int code, IntPtr w, IntPtr l);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr GetModuleHandle(string name);
        [StructLayout(LayoutKind.Sequential)] public struct MSLLHOOKSTRUCT { public POINT pt; public uint mouseData, flags, time; public IntPtr extra; }
        [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SystemParametersInfoW")] static extern bool SpiGet(uint a, uint p, StringBuilder sb, uint f);
        [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SystemParametersInfoW")] static extern bool SpiSet(uint a, uint p, string s, uint f);
        [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr v);
        [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

        public static void MakeDpiAware()
        {
            try { if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return; } catch { }
            try { SetProcessDPIAware(); } catch { }
        }

        public static IntPtr GetWindowLongPtr(IntPtr h, int i)
        {
            return IntPtr.Size == 8 ? GetWindowLongPtr64(h, i) : new IntPtr(GetWindowLong32(h, i));
        }

        public static IntPtr SetWindowLongPtr(IntPtr h, int i, IntPtr v)
        {
            return IntPtr.Size == 8 ? SetWindowLongPtr64(h, i, v) : new IntPtr(SetWindowLong32(h, i, v.ToInt32()));
        }

        public static string ClassOf(IntPtr h)
        {
            StringBuilder sb = new StringBuilder(256);
            GetClassName(h, sb, sb.Capacity);
            return sb.ToString();
        }

        public static IntPtr FindTopWindowWithTitle(string titlePart)
        {
            IntPtr found = IntPtr.Zero;
            EnumWindows(delegate (IntPtr h, IntPtr l)
            {
                StringBuilder sb = new StringBuilder(512);
                GetWindowText(h, sb, sb.Capacity);
                if (sb.ToString().IndexOf(titlePart, StringComparison.Ordinal) >= 0 && ClassOf(h).StartsWith("Chrome_WidgetWin"))
                {
                    found = h;
                    return false;
                }
                return true;
            }, IntPtr.Zero);
            return found;
        }

        // Finds the window that sits between the desktop picture and the icons.
        public static IntPtr GetWallpaperHost(out IntPtr defView, out bool raised)
        {
            raised = false;
            defView = IntPtr.Zero;
            IntPtr progman = FindWindow("Progman", null);
            if (progman == IntPtr.Zero) return IntPtr.Zero;
            IntPtr res;
            SendMessageTimeout(progman, 0x052C, new IntPtr(0xD), new IntPtr(0x1), 0, 1000, out res);
            SendMessageTimeout(progman, 0x052C, IntPtr.Zero, IntPtr.Zero, 0, 1000, out res);

            // Windows 11 24H2 and later: the icon layer and WorkerW are children of Progman.
            IntPtr dv = FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null);
            IntPtr childWorker = FindWindowEx(progman, IntPtr.Zero, "WorkerW", null);
            if (dv != IntPtr.Zero && childWorker != IntPtr.Zero)
            {
                raised = true;
                defView = dv;
                return progman;
            }

            // Classic layout: a top-level WorkerW right after the one holding the icons.
            IntPtr worker = IntPtr.Zero;
            EnumWindows(delegate (IntPtr top, IntPtr l)
            {
                IntPtr p = FindWindowEx(top, IntPtr.Zero, "SHELLDLL_DefView", null);
                if (p != IntPtr.Zero)
                {
                    worker = FindWindowEx(IntPtr.Zero, top, "WorkerW", null);
                    return false;
                }
                return true;
            }, IntPtr.Zero);
            if (worker != IntPtr.Zero) return worker;
            return progman;
        }

        // Makes Windows repaint the normal wallpaper after we leave.
        public static void RefreshWallpaper()
        {
            try
            {
                StringBuilder sb = new StringBuilder(1024);
                if (SpiGet(0x0073 /*SPI_GETDESKWALLPAPER*/, (uint)sb.Capacity, sb, 0))
                    SpiSet(0x0014 /*SPI_SETDESKWALLPAPER*/, 0, sb.ToString(), 0x02 /*SPIF_SENDCHANGE*/);
            }
            catch { }
        }
    }
}
