//! Binding the server: host parsing, port fallback, "already running?" reuse,
//! the startup banner and opening the browser.

use crate::cli::{CHANGELOG_URL, PORT_ATTEMPTS, VERSION};
use serde::{Deserialize, Serialize};
use std::{
    io,
    net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, UdpSocket},
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    time::timeout,
};

pub const APP_NAME: &str = "openspec-ui";

/// What a running server reports about itself: the `--json` line and
/// `GET /api/info` share this shape.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Info {
    pub name: String,
    pub version: String,
    /// URL to open on this machine.
    pub url: String,
    pub host: String,
    pub port: u16,
    pub pid: u32,
    /// `"file"` or `"discovered"`.
    pub mode: String,
    pub config_path: Option<String>,
    pub roots: Vec<String>,
    pub sources: Vec<InfoSource>,
    pub changelog: String,
    /// Address a phone on the same network can open; only when the server
    /// listens on every interface (`--host 0.0.0.0`) outside a container.
    #[serde(default)]
    pub lan_url: Option<String>,
    /// Set on the CLI output when an existing server was reused.
    #[serde(default)]
    pub reused: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InfoSource {
    pub name: String,
    pub path: String,
    pub valid: bool,
}

/// What makes two servers "the same board": same version, same address,
/// same sources definition.
#[derive(Debug, Clone, PartialEq)]
pub struct Scope {
    pub host: String,
    pub mode: String,
    pub config_path: Option<String>,
    pub roots: Vec<String>,
}

impl Scope {
    pub fn matches(&self, info: &Info) -> bool {
        info.name == APP_NAME
            && info.version == VERSION
            && info.host == self.host
            && info.mode == self.mode
            && info.config_path == self.config_path
            && info.roots == self.roots
    }
}

pub fn parse_host(host: &str) -> Result<IpAddr, String> {
    match host.trim() {
        "localhost" => Ok(IpAddr::V4(Ipv4Addr::LOCALHOST)),
        h => h.trim_matches(['[', ']']).parse().map_err(|_| {
            format!("--host must be an IP address such as 127.0.0.1 or 0.0.0.0, got \"{host}\"")
        }),
    }
}

/// URL that works from this machine for a server bound to `ip:port`.
pub fn local_url(ip: IpAddr, port: u16) -> String {
    match ip {
        IpAddr::V4(v4) if v4.is_unspecified() => format!("http://127.0.0.1:{port}"),
        IpAddr::V6(v6) if v6.is_unspecified() => format!("http://[::1]:{port}"),
        IpAddr::V4(v4) => format!("http://{v4}:{port}"),
        IpAddr::V6(v6) => format!("http://[{v6}]:{port}"),
    }
}

/// Addresses to check for an existing listener before binding `ip:port`.
fn probe_addrs(ip: IpAddr, port: u16) -> Vec<SocketAddr> {
    if ip.is_loopback() || ip.is_unspecified() {
        vec![
            SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port),
            SocketAddr::new(IpAddr::V6(Ipv6Addr::LOCALHOST), port),
        ]
    } else {
        vec![SocketAddr::new(ip, port)]
    }
}

/// Something accepts connections on this port. Binding alone is not enough
/// on macOS: with SO_REUSEADDR a 127.0.0.1 bind succeeds next to a process
/// holding the wildcard address, and would silently shadow it.
async fn listener_at(addr: SocketAddr) -> bool {
    matches!(
        timeout(Duration::from_millis(300), TcpStream::connect(addr)).await,
        Ok(Ok(_))
    )
}

/// Ask whatever listens on `addr` whether it is an openspec-ui.
pub async fn probe_info(addr: SocketAddr) -> Option<Info> {
    let fetch = async {
        let mut stream = TcpStream::connect(addr).await.ok()?;
        let req = format!("GET /api/info HTTP/1.0\r\nHost: {addr}\r\nAccept: application/json\r\n\r\n");
        stream.write_all(req.as_bytes()).await.ok()?;
        let mut buf = Vec::new();
        stream.take(256 * 1024).read_to_end(&mut buf).await.ok()?;
        let text = String::from_utf8_lossy(&buf);
        let (head, body) = text.split_once("\r\n\r\n")?;
        if !head.starts_with("HTTP/1.") || !head.contains(" 200 ") {
            return None;
        }
        serde_json::from_str::<Info>(body).ok()
    };
    timeout(Duration::from_millis(800), fetch).await.ok().flatten()
}

pub enum Bound {
    Listening { listener: TcpListener, skipped: Vec<u16> },
    /// An openspec-ui for the same scope already runs here. Its `url`,
    /// `port` and `changelog` are ours (the address we probed), never what it
    /// claimed, and `lan_url` is cleared for the caller to compute. `pid` and
    /// `sources` are as reported, for display only.
    Reused(Info),
}

fn bind_error(e: &io::Error, ip: IpAddr, port: u16, requested_by: Option<&str>) -> String {
    match e.kind() {
        io::ErrorKind::AddrInUse => match requested_by {
            Some(origin) => format!(
                "Port {port} is already in use (requested by {origin}). Pick another port, or drop that setting to let openspec-ui choose a free one."
            ),
            None => format!("Port {port} is already in use. Pick another one with --port."),
        },
        io::ErrorKind::PermissionDenied => format!(
            "Not allowed to listen on port {port} (ports below 1024 usually need admin rights). Try --port 3000."
        ),
        io::ErrorKind::AddrNotAvailable => format!(
            "Cannot listen on {ip}: this machine has no such address. Use 127.0.0.1 (this machine only) or 0.0.0.0 (all networks)."
        ),
        _ => format!("Cannot listen on {}: {e}", SocketAddr::new(ip, port)),
    }
}

/// Bind `ip:port`. A port the user asked for (`requested_by` names where:
/// "--port / PORT" or the config file) is used or fails with a readable
/// error; otherwise up to [`PORT_ATTEMPTS`] following ports are tried. A port
/// held by an openspec-ui with the same scope is reused instead of skipped.
pub async fn bind(
    ip: IpAddr,
    port: u16,
    requested_by: Option<&str>,
    scope: &Scope,
) -> Result<Bound, String> {
    let explicit = requested_by.is_some();
    let candidates: Vec<u16> = if explicit || port == 0 {
        vec![port]
    } else {
        (port..=port.saturating_add(PORT_ATTEMPTS - 1)).collect()
    };
    let mut skipped = Vec::new();

    for p in candidates.iter().copied() {
        if p != 0 {
            let mut occupied = None;
            for addr in probe_addrs(ip, p) {
                if listener_at(addr).await {
                    occupied = Some(addr);
                    break;
                }
            }
            if let Some(addr) = occupied {
                if let Some(info) = probe_info(addr).await {
                    if scope.matches(&info) {
                        // Whatever holds the port wrote this JSON; only the
                        // address we connected to is ours to print and open.
                        return Ok(Bound::Reused(Info {
                            url: local_url(ip, p),
                            port: p,
                            lan_url: None,
                            changelog: CHANGELOG_URL.to_string(),
                            ..info
                        }));
                    }
                    tracing::info!("port {p} is used by another openspec-ui ({:?})", info.roots);
                }
                if explicit {
                    return Err(bind_error(&io::ErrorKind::AddrInUse.into(), ip, p, requested_by));
                }
                skipped.push(p);
                continue;
            }
        }
        match TcpListener::bind(SocketAddr::new(ip, p)).await {
            Ok(listener) => return Ok(Bound::Listening { listener, skipped }),
            Err(e) if e.kind() == io::ErrorKind::AddrInUse && !explicit => skipped.push(p),
            Err(e) => return Err(bind_error(&e, ip, p, requested_by)),
        }
    }

    let first = candidates.first().copied().unwrap_or(port);
    let last = candidates.last().copied().unwrap_or(port);
    Err(format!(
        "Ports {first}-{last} are all in use. Choose a free one with --port (or --port 0 for any)."
    ))
}

/// The machine's address on the local network, for the "open on your phone" hint.
pub fn lan_ip() -> Option<IpAddr> {
    // Connecting a UDP socket sends nothing; it only selects a route.
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("192.0.2.1:80").ok()?;
    let ip = socket.local_addr().ok()?.ip();
    (!ip.is_loopback() && !ip.is_unspecified()).then_some(ip)
}

/// Open the browser only for a person at an interactive local terminal.
pub fn should_open_browser(
    no_open: bool,
    json: bool,
    stdout_is_tty: bool,
    env: impl Fn(&str) -> Option<String>,
    in_container: bool,
) -> bool {
    let set = |k: &str| env(k).is_some_and(|v| !v.is_empty());
    if no_open || json || !stdout_is_tty || in_container {
        return false;
    }
    if set("CI") || set("SSH_CONNECTION") || set("SSH_CLIENT") || set("SSH_TTY") {
        return false;
    }
    if cfg!(target_os = "linux") && !set("DISPLAY") && !set("WAYLAND_DISPLAY") {
        return false;
    }
    true
}

pub fn in_container() -> bool {
    std::path::Path::new("/.dockerenv").exists() || std::path::Path::new("/run/.containerenv").exists()
}

/// Program and arguments that open `url` in the default browser on `os`
/// (`std::env::consts::OS`). Never a shell: on Windows `cmd /C start` would
/// interpret `&`, `|` and `^` in the URL, so `rundll32` is used instead.
/// Only plain `http://` URLs are opened.
pub fn browser_command(os: &str, url: &str) -> Option<(&'static str, Vec<String>)> {
    if !url.starts_with("http://") || url.chars().any(|c| c.is_whitespace() || c.is_control() || c == '"') {
        return None;
    }
    Some(match os {
        "macos" => ("open", vec![url.to_string()]),
        "windows" => ("rundll32", vec!["url.dll,FileProtocolHandler".to_string(), url.to_string()]),
        _ => ("xdg-open", vec![url.to_string()]),
    })
}

pub fn open_browser(url: &str) {
    use std::process::{Command, Stdio};
    let Some((program, args)) = browser_command(std::env::consts::OS, url) else {
        tracing::debug!("not opening a browser for {url:?}");
        return;
    };
    let spawned = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
    if let Err(e) = spawned {
        tracing::debug!("could not open a browser: {e}");
    }
}

/// Shorten a path for humans: relative to `base` when inside it, else `~/...`.
pub fn display_path(path: &str, base: Option<&str>, home: Option<&str>) -> String {
    let under = |prefix: &str| {
        path.strip_prefix(prefix)
            .and_then(|rest| rest.strip_prefix(std::path::MAIN_SEPARATOR))
            .map(str::to_string)
    };
    if let Some(rest) = base.and_then(under) {
        return rest;
    }
    match home.and_then(under) {
        Some(rest) => format!("~{}{rest}", std::path::MAIN_SEPARATOR),
        None => path.to_string(),
    }
}

pub fn home_dir() -> Option<String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok()
        .filter(|h| !h.is_empty())
}

pub struct BannerContext<'a> {
    pub info: &'a Info,
    /// Source paths are shown relative to this folder (the single searched root).
    pub base: Option<String>,
    /// e.g. "found in /x (searched 14 folders in 3 ms)" or "from /x/openspec-ui.json".
    pub origin: String,
    pub skipped_ports: &'a [u16],
    pub lan_url: Option<String>,
    pub empty_hint: bool,
    pub notes: Vec<String>,
}

/// Human banner. Line 1 is a stable, parseable contract:
/// `openspec-ui <version> running at <url>`.
pub fn banner(ctx: &BannerContext) -> String {
    let info = ctx.info;
    let mut out = format!("{APP_NAME} {} running at {}\n", info.version, info.url);
    if info.reused {
        out.push_str(&format!(
            "  Already running for these projects (pid {}), so that server is reused.\n",
            info.pid
        ));
        return out;
    }
    if !ctx.skipped_ports.is_empty() {
        let list: Vec<String> = ctx.skipped_ports.iter().map(u16::to_string).collect();
        out.push_str(&format!("  (port {} busy, using {})\n", list.join(", "), info.port));
    }
    if let Some(lan) = &ctx.lan_url {
        out.push_str(&format!("  On your network: {lan}\n"));
    }
    out.push('\n');

    let n = info.sources.len();
    if n == 0 {
        out.push_str(&format!("  No OpenSpec projects {}.\n", ctx.origin));
        if ctx.empty_hint {
            out.push_str("  Point it at your code:  openspec-ui ~/code\n");
            out.push_str("  Or start one here:      openspec init\n");
        }
    } else {
        let label = if n == 1 { "project" } else { "projects" };
        out.push_str(&format!("  {n} {label} {}:\n", ctx.origin));
        let width = info.sources.iter().map(|s| s.name.chars().count()).max().unwrap_or(0);
        let home = home_dir();
        for s in &info.sources {
            let missing = if s.valid { "" } else { "   (not found)" };
            let path = display_path(&s.path, ctx.base.as_deref(), home.as_deref());
            out.push_str(&format!("    {:width$}  {path}{missing}\n", s.name));
        }
    }
    out.push('\n');
    for note in &ctx.notes {
        out.push_str(&format!("  {note}\n"));
    }
    out.push_str(&format!("  Press Ctrl+C to stop. Changelog: {CHANGELOG_URL}\n"));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scope() -> Scope {
        Scope {
            host: "127.0.0.1".into(),
            mode: "discovered".into(),
            config_path: None,
            roots: vec!["/r".into()],
        }
    }

    fn info_for(scope: &Scope, port: u16) -> Info {
        Info {
            name: APP_NAME.into(),
            version: VERSION.into(),
            url: format!("http://127.0.0.1:{port}"),
            host: scope.host.clone(),
            port,
            pid: 1,
            mode: scope.mode.clone(),
            config_path: scope.config_path.clone(),
            roots: scope.roots.clone(),
            sources: vec![],
            changelog: CHANGELOG_URL.into(),
            lan_url: None,
            reused: false,
        }
    }

    #[test]
    fn info_carries_the_phone_url_and_reads_servers_without_it() {
        let scope = Scope { host: "0.0.0.0".into(), mode: "discovered".into(), config_path: None, roots: vec![] };
        let info = Info { lan_url: Some("http://192.168.1.20:3000".into()), ..info_for(&scope, 3000) };
        let json = serde_json::to_value(&info).unwrap();
        assert_eq!(json["lanUrl"], "http://192.168.1.20:3000");

        // A server from before lanUrl existed still parses (reuse detection).
        let mut older = json.clone();
        older.as_object_mut().unwrap().remove("lanUrl");
        let parsed: Info = serde_json::from_value(older).unwrap();
        assert_eq!(parsed.lan_url, None);
    }

    /// Minimal HTTP server answering /api/info with `info`.
    async fn fake_openspec_ui(info: Info) -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let body = serde_json::to_string(&Info { port, ..info }).unwrap();
        tokio::spawn(async move {
            loop {
                let Ok((mut s, _)) = listener.accept().await else { return };
                let body = body.clone();
                tokio::spawn(async move {
                    let mut buf = [0u8; 1024];
                    let _ = s.read(&mut buf).await;
                    let resp = format!("HTTP/1.0 200 OK\r\nContent-Type: application/json\r\n\r\n{body}");
                    let _ = s.write_all(resp.as_bytes()).await;
                });
            }
        });
        port
    }

    #[tokio::test]
    async fn explicit_port_in_use_is_a_readable_error() {
        let squatter = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = squatter.local_addr().unwrap().port();
        let err = bind(IpAddr::V4(Ipv4Addr::LOCALHOST), port, Some("--port"), &scope())
            .await
            .err()
            .expect("must fail");
        assert!(err.contains(&format!("Port {port} is already in use (requested by --port)")), "{err}");
    }

    #[tokio::test]
    async fn default_port_in_use_moves_to_the_next_free_one() {
        // Find two consecutive free ports, occupy the first.
        let (squatter, port) = loop {
            let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let p = l.local_addr().unwrap().port();
            if p < u16::MAX - PORT_ATTEMPTS && std::net::TcpListener::bind(("127.0.0.1", p + 1)).is_ok() {
                break (l, p);
            }
        };
        match bind(IpAddr::V4(Ipv4Addr::LOCALHOST), port, None, &scope()).await.unwrap() {
            Bound::Listening { listener, skipped } => {
                assert!(listener.local_addr().unwrap().port() > port);
                assert_eq!(skipped.first(), Some(&port));
            }
            Bound::Reused(_) => panic!("nothing to reuse"),
        }
        drop(squatter);
    }

    #[tokio::test]
    async fn wildcard_holder_is_detected_on_loopback() {
        // Someone holds 0.0.0.0:p; a 127.0.0.1:p bind may succeed on macOS,
        // but we must still treat the port as taken.
        let squatter = std::net::TcpListener::bind("0.0.0.0:0").unwrap();
        let port = squatter.local_addr().unwrap().port();
        let err = bind(IpAddr::V4(Ipv4Addr::LOCALHOST), port, Some("--port"), &scope()).await.err();
        assert!(err.is_some());
    }

    #[tokio::test]
    async fn a_reused_server_cannot_choose_the_url_we_print_or_open() {
        let s = scope();
        let liar = Info {
            url: "http://evil.example/phish & calc.exe".into(),
            lan_url: Some("http://evil.example/".into()),
            changelog: "http://evil.example/changelog".into(),
            ..info_for(&s, 0)
        };
        let port = fake_openspec_ui(liar).await;
        match bind(IpAddr::V4(Ipv4Addr::LOCALHOST), port, None, &s).await.unwrap() {
            Bound::Reused(info) => {
                assert_eq!(info.url, format!("http://127.0.0.1:{port}"));
                assert_eq!(info.port, port);
                assert_eq!(info.lan_url, None);
                assert_eq!(info.changelog, CHANGELOG_URL);
            }
            Bound::Listening { .. } => panic!("should reuse"),
        }
    }

    #[test]
    fn browser_is_opened_without_a_shell() {
        let url = "http://127.0.0.1:3000";
        let (program, args) = browser_command("windows", url).unwrap();
        assert_eq!(program, "rundll32");
        assert_eq!(args, vec!["url.dll,FileProtocolHandler", url]);
        assert_eq!(browser_command("macos", url).unwrap().0, "open");
        assert_eq!(browser_command("linux", url).unwrap().0, "xdg-open");
        for bad in ["https://x\" & calc", "file:///etc/passwd", "http://x/ & calc", "javascript:alert(1)", "http://x/\"&calc"] {
            assert!(browser_command("windows", bad).is_none(), "{bad}");
        }
    }

    #[tokio::test]
    async fn same_scope_server_is_reused_other_scope_is_skipped() {
        let s = scope();
        let port = fake_openspec_ui(info_for(&s, 0)).await;
        match bind(IpAddr::V4(Ipv4Addr::LOCALHOST), port, None, &s).await.unwrap() {
            Bound::Reused(info) => assert_eq!(info.port, port),
            Bound::Listening { .. } => panic!("should reuse"),
        }

        let mut other = s.clone();
        other.roots = vec!["/elsewhere".into()];
        match bind(IpAddr::V4(Ipv4Addr::LOCALHOST), port, None, &other).await.unwrap() {
            Bound::Listening { listener, .. } => assert_ne!(listener.local_addr().unwrap().port(), port),
            Bound::Reused(_) => panic!("different roots must not be reused"),
        }
    }

    #[test]
    fn hosts() {
        assert_eq!(parse_host("localhost").unwrap(), IpAddr::V4(Ipv4Addr::LOCALHOST));
        assert_eq!(parse_host("0.0.0.0").unwrap(), IpAddr::V4(Ipv4Addr::UNSPECIFIED));
        assert_eq!(parse_host("[::1]").unwrap(), IpAddr::V6(Ipv6Addr::LOCALHOST));
        assert!(parse_host("my-laptop").is_err());
        assert_eq!(local_url(IpAddr::V4(Ipv4Addr::UNSPECIFIED), 3000), "http://127.0.0.1:3000");
    }

    #[test]
    fn browser_only_for_interactive_local_sessions() {
        let none = |_: &str| None::<String>;
        let ok_env: fn(&str) -> Option<String> = |k| (k == "DISPLAY").then(|| ":0".to_string());
        assert!(should_open_browser(false, false, true, ok_env, false));
        assert!(!should_open_browser(true, false, true, none, false), "--no-open");
        assert!(!should_open_browser(false, true, true, none, false), "--json");
        assert!(!should_open_browser(false, false, false, none, false), "not a tty");
        assert!(!should_open_browser(false, false, true, none, true), "container");
        let ci = |k: &str| (k == "CI").then(|| "true".to_string());
        assert!(!should_open_browser(false, false, true, ci, false), "CI");
        let ssh = |k: &str| (k == "SSH_CONNECTION").then(|| "1.2.3.4 5 6.7.8.9 22".to_string());
        assert!(!should_open_browser(false, false, true, ssh, false), "ssh");
    }

    #[test]
    fn paths_are_shortened_for_humans() {
        let sep = std::path::MAIN_SEPARATOR;
        let p = format!("{sep}h{sep}code{sep}api{sep}openspec");
        let base = format!("{sep}h{sep}code");
        let home = format!("{sep}h");
        assert_eq!(display_path(&p, Some(&base), Some(&home)), format!("api{sep}openspec"));
        assert_eq!(display_path(&p, None, Some(&home)), format!("~{sep}code{sep}api{sep}openspec"));
        assert_eq!(display_path(&p, None, None), p);
        // a sibling with a common prefix is not "inside"
        assert_eq!(display_path(&p, Some(&format!("{sep}h{sep}co")), None), p);
    }

    #[test]
    fn banner_first_line_is_stable() {
        let s = scope();
        let info = info_for(&s, 3001);
        let text = banner(&BannerContext {
            info: &info,
            base: None,
            origin: "found in /r".into(),
            skipped_ports: &[3000],
            lan_url: None,
            empty_hint: true,
            notes: vec![],
        });
        let first = text.lines().next().unwrap();
        assert_eq!(first, format!("openspec-ui {VERSION} running at http://127.0.0.1:3001"));
        assert!(text.contains("port 3000 busy"));
        assert!(text.contains("openspec-ui ~/code"));
    }
}
