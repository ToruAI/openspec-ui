//! Which requests the server answers, and who may change its sources.
//!
//! openspec-ui has no login by design, so the browser is the attack surface:
//!
//! - **DNS rebinding.** A website the user visits can point its own name at
//!   this server and then talk to it "same-origin". The browser still sends
//!   the attacker's name as `Host`, so only Hosts this server knows are
//!   answered: loopback names and addresses, any IP literal, and names given
//!   with `--allowed-host`. An IP literal cannot be rebound (there is no name
//!   to repoint), which is what keeps phone and Docker access working without
//!   configuration. The machine's own host name is deliberately not trusted:
//!   on a network that assigns it (DHCP), that network controls the name.
//! - **Cross-site writes.** State-changing requests that carry an `Origin`
//!   must come from a page of this server: an Origin whose host is a name
//!   the Host check accepts (loopback, allow-list) or, for an IP
//!   address, exactly the address the request was sent to; on the same port
//!   unless the name is allow-listed. Exact origins in `CORS_ALLOWED_ORIGINS`
//!   are also accepted. Requests without `Origin` (curl, scripts) pass.
//! - **Repointing the server.** Changing the source list makes the server
//!   read other folders, so `PUT /api/config/sources` is only accepted from a
//!   client on this machine (see [`ClientAddr`]).

use axum::{
    extract::connect_info::Connected,
    http::{header, HeaderMap, Method},
    serve::IncomingStream,
};
use std::net::{IpAddr, SocketAddr};
use tokio::net::TcpListener;

/// Host and port of a `Host` header, an `Origin` or an allow-list entry.
/// The host is lower-case, without IPv6 brackets or a trailing dot.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Authority {
    pub host: String,
    pub port: Option<u16>,
}

impl Authority {
    /// `None` for anything that is not a plain `host[:port]`; only letters,
    /// digits, `.`, `-`, `_` and (inside brackets) `:` and `%` are accepted,
    /// so a parsed host is safe to echo back.
    pub fn parse(text: &str) -> Option<Authority> {
        let text = text.trim();
        let (host, port) = if let Some(rest) = text.strip_prefix('[') {
            let (inside, after) = rest.split_once(']')?;
            if !inside.chars().all(|c| c.is_ascii_hexdigit() || matches!(c, ':' | '.' | '%')) {
                return None;
            }
            (inside, after)
        } else {
            // `after` is "" or ":port"
            let host_end = text.find(':').unwrap_or(text.len());
            (&text[..host_end], &text[host_end..])
        };
        let port = match port {
            "" => None,
            p => Some(p.strip_prefix(':')?.parse::<u16>().ok()?),
        };
        let host = host.strip_suffix('.').unwrap_or(host).to_ascii_lowercase();
        let plain = |c: char| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_');
        if host.is_empty() || (!text.starts_with('[') && !host.chars().all(plain)) {
            return None;
        }
        Some(Authority { host, port })
    }

    fn ip(&self) -> Option<IpAddr> {
        self.host.parse().ok()
    }
}

fn is_loopback_name(host: &str) -> bool {
    host == "localhost"
        || host.ends_with(".localhost")
        || host.parse::<IpAddr>().is_ok_and(|ip| ip.to_canonical().is_loopback())
}

/// Turn `--allowed-host` values into authorities. Accepts `name`,
/// `name:port` and, forgivingly, `https://name/`.
pub fn parse_allowed_hosts(values: &[String]) -> Result<Vec<Authority>, String> {
    values
        .iter()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
        .map(|v| {
            let bare = v.split_once("://").map_or(v, |(_, rest)| rest).trim_end_matches('/');
            Authority::parse(bare).ok_or_else(|| {
                format!("--allowed-host takes a host name such as board.example.com or my-pc:3000, got \"{v}\"")
            })
        })
        .collect()
}

pub struct Guard {
    /// Hosts from `--allowed-host` / `OPENSPEC_UI_ALLOWED_HOSTS`.
    pub allowed_hosts: Vec<Authority>,
    /// Exact origins from `CORS_ALLOWED_ORIGINS`, also allowed to write.
    pub allowed_origins: Vec<String>,
}

impl Guard {
    fn allow_listed(&self, a: &Authority) -> bool {
        self.allowed_hosts
            .iter()
            .any(|e| e.host == a.host && (e.port.is_none() || e.port == a.port))
    }

    /// A name (not just any IP) this server answers to.
    fn known_name(&self, a: &Authority) -> bool {
        is_loopback_name(&a.host) || self.allow_listed(a)
    }

    fn host_ok(&self, a: &Authority) -> bool {
        self.known_name(a) || a.ip().is_some()
    }

    fn origin_ok(&self, origin: &str, host: Option<&Authority>) -> bool {
        if self.allowed_origins.iter().any(|o| o == origin) {
            return true;
        }
        let Some((scheme, rest)) = origin.split_once("://") else {
            return false; // "null" and other opaque origins
        };
        let default_port = match scheme.to_ascii_lowercase().as_str() {
            "http" => 80,
            "https" => 443,
            _ => return false,
        };
        let Some(mut o) = Authority::parse(rest) else {
            return false;
        };
        o.port = Some(o.port.unwrap_or(default_port));
        if self.allow_listed(&o) {
            return true;
        }
        // Otherwise the page must be this server as the request addressed it.
        let Some(host) = host else {
            return self.known_name(&o) && o.ip().is_none_or(|ip| ip.to_canonical().is_loopback());
        };
        let same_place = o.host == host.host && o.port == Some(host.port.unwrap_or(default_port));
        same_place && (self.known_name(&o) || o.ip().is_some())
    }

    /// Why the request is refused, if it is: a short text for the 403 body.
    pub fn verdict(&self, method: &Method, headers: &HeaderMap) -> Option<String> {
        let raw_host = headers.get(header::HOST).and_then(|v| v.to_str().ok()).unwrap_or("").trim();
        let host = if raw_host.is_empty() {
            None // HTTP/1.0 clients may omit it; browsers never do
        } else {
            match Authority::parse(raw_host) {
                Some(a) if self.host_ok(&a) => Some(a),
                Some(a) => return Some(host_refused(&a.host)),
                None => return Some(host_refused("")),
            }
        };
        if !matches!(*method, Method::GET | Method::HEAD | Method::OPTIONS) {
            if let Some(origin) = headers.get(header::ORIGIN).map(|v| v.to_str().unwrap_or("")) {
                if !self.origin_ok(origin.trim(), host.as_ref()) {
                    return Some(
                        "openspec-ui refused this change: it came from a page of another site.\n\
                         If you open openspec-ui under another name (a reverse proxy, for example), \
                         allow that name with --allowed-host NAME (or OPENSPEC_UI_ALLOWED_HOSTS=NAME).\n"
                            .to_string(),
                    );
                }
            }
        }
        None
    }
}

fn host_refused(host: &str) -> String {
    let (shown, flag) = if host.is_empty() {
        ("this address".to_string(), "NAME".to_string())
    } else {
        (format!("\"{host}\""), host.to_string())
    };
    format!(
        "openspec-ui does not answer to {shown}.\n\
         It answers to localhost and IP addresses, so that other websites cannot reach it \
         through DNS tricks.\n\
         To open it under this name (this computer's name, a reverse proxy, an alias), start it with \
         --allowed-host {flag} (or set OPENSPEC_UI_ALLOWED_HOSTS={flag}).\n"
    )
}

/// Where a connection comes from, and the local address it arrived on.
#[derive(Debug, Clone, Copy)]
pub struct ClientAddr {
    pub remote: SocketAddr,
    pub local: Option<SocketAddr>,
}

impl ClientAddr {
    /// The client runs on this machine: it connected from a loopback address,
    /// or from the very address it connected to. Behind a reverse proxy on
    /// the same machine every client looks local; inside a container the
    /// host's own browser does not (it arrives through the bridge).
    pub fn is_local(&self) -> bool {
        let remote = self.remote.ip().to_canonical();
        remote.is_loopback() || self.local.is_some_and(|l| l.ip().to_canonical() == remote)
    }
}

impl Connected<IncomingStream<'_, TcpListener>> for ClientAddr {
    fn connect_info(stream: IncomingStream<'_, TcpListener>) -> Self {
        ClientAddr { remote: *stream.remote_addr(), local: stream.io().local_addr().ok() }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn headers(host: &str, origin: Option<&str>) -> HeaderMap {
        let mut h = HeaderMap::new();
        h.insert(header::HOST, HeaderValue::from_str(host).unwrap());
        if let Some(o) = origin {
            h.insert(header::ORIGIN, HeaderValue::from_str(o).unwrap());
        }
        h
    }

    fn guard(allowed: &[&str]) -> Guard {
        Guard {
            allowed_hosts: parse_allowed_hosts(&allowed.iter().map(|s| s.to_string()).collect::<Vec<_>>()).unwrap(),
            allowed_origins: vec![],
        }
    }

    fn get(g: &Guard, host: &str) -> bool {
        g.verdict(&Method::GET, &headers(host, None)).is_none()
    }

    fn post(g: &Guard, host: &str, origin: &str) -> bool {
        g.verdict(&Method::POST, &headers(host, Some(origin))).is_none()
    }

    #[test]
    fn authorities_parse_strictly() {
        let a = |s: &str| Authority::parse(s);
        assert_eq!(a("LocalHost.:3000"), Some(Authority { host: "localhost".into(), port: Some(3000) }));
        assert_eq!(a("[::1]:3000").unwrap().host, "::1");
        assert_eq!(a("192.168.1.5").unwrap().port, None);
        for bad in ["", "a b", "evil.example:x", "<script>", "[::1", "[zz]:1", "a:1:2", "a/b"] {
            assert_eq!(a(bad), None, "{bad}");
        }
    }

    #[test]
    fn rebinding_names_are_refused_in_every_bind_mode() {
        // The review's case: --host 0.0.0.0 used to answer any Host.
        let g = guard(&[]);
        for host in [
            "rebind.attacker.example:3000",
            "my-laptop.local:3000", // the machine's own name is not trusted either
            "my-laptop.lan:3000",
            "localhost.evil.example:3000",
        ] {
            assert!(!get(&g, host), "{host}");
        }
        let reason = g.verdict(&Method::GET, &headers("board.example.com", None)).unwrap();
        assert!(reason.contains("--allowed-host board.example.com"), "{reason}");
        assert!(reason.contains("OPENSPEC_UI_ALLOWED_HOSTS"), "{reason}");
    }

    #[test]
    fn loopback_ip_literals_and_allow_list_are_answered() {
        let g = guard(&["board.example.com", "nas.lan:8443"]);
        for host in [
            "127.0.0.1:3000",
            "localhost:3000",
            "app.localhost:3000",
            "[::1]:3000",
            "192.168.1.5:3000",
            "10.0.0.7",
            "[fe80::1]:3000",
            "board.example.com",
            "board.example.com:443",
            "nas.lan:8443",
        ] {
            assert!(get(&g, host), "{host}");
        }
        assert!(!get(&g, "nas.lan:9000"), "allow-list entry with a port is exact");
        assert!(g.verdict(&Method::GET, &HeaderMap::new()).is_none(), "HTTP/1.0 without Host");
    }

    #[test]
    fn writes_need_an_origin_of_this_server() {
        let g = guard(&[]);
        assert!(post(&g, "127.0.0.1:3000", "http://127.0.0.1:3000"));
        assert!(post(&g, "localhost:5173", "http://localhost:5173"), "vite dev proxy keeps Host");
        assert!(post(&g, "192.168.1.5:3000", "http://192.168.1.5:3000"), "phone on the LAN");
        // curl and scripts send no Origin
        assert!(g.verdict(&Method::POST, &headers("127.0.0.1:3000", None)).is_none());

        // An IP literal Host does not make every IP-literal Origin acceptable.
        assert!(!post(&g, "192.168.1.5:3000", "http://203.0.113.9"));
        assert!(!post(&g, "192.168.1.5:3000", "http://203.0.113.9:3000"));
        assert!(!post(&g, "127.0.0.1:3000", "https://evil.example"));
        // Another local port is another site (unchanged from before).
        assert!(!post(&g, "127.0.0.1:3000", "http://localhost:5173"));
        assert!(!post(&g, "127.0.0.1:3000", "null"));
        assert!(!post(&g, "127.0.0.1:3000", "file://"));
        // Rebinding: Host and Origin agree, but the name is unknown.
        assert!(!post(&g, "rebind.attacker.example:3000", "http://rebind.attacker.example:3000"));
        // Reads stay open (CORS keeps the response from other sites).
        assert!(g.verdict(&Method::GET, &headers("127.0.0.1:3000", Some("https://evil.example"))).is_none());
    }

    #[test]
    fn allow_listed_names_and_cors_origins_may_write() {
        let mut g = guard(&["board.example.com"]);
        // A proxy that rewrites Host to the backend address keeps the Origin.
        assert!(post(&g, "127.0.0.1:3000", "https://board.example.com"));
        assert!(post(&g, "board.example.com", "https://board.example.com"));
        assert!(!post(&g, "board.example.com", "https://other.example.com"));
        g.allowed_origins = vec!["http://localhost:5173".into()];
        assert!(post(&g, "127.0.0.1:3000", "http://localhost:5173"));
    }

    #[test]
    fn allowed_hosts_accept_names_ports_and_urls() {
        let parsed = parse_allowed_hosts(&["Board.Example.com, x".into(), "https://nas.lan:8443/".into()]);
        assert!(parsed.is_err(), "a comma inside one value is not split here (clap splits the env)");
        let parsed = parse_allowed_hosts(&["Board.Example.com".into(), "https://nas.lan:8443/".into(), " ".into()]).unwrap();
        assert_eq!(
            parsed,
            vec![
                Authority { host: "board.example.com".into(), port: None },
                Authority { host: "nas.lan".into(), port: Some(8443) }
            ]
        );
        assert!(parse_allowed_hosts(&["evil example".into()]).is_err());
    }

    #[test]
    fn only_clients_on_this_machine_are_local() {
        let addr = |s: &str| s.parse::<SocketAddr>().unwrap();
        let client = |remote: &str, local: &str| ClientAddr { remote: addr(remote), local: Some(addr(local)) };
        assert!(client("127.0.0.1:50000", "127.0.0.1:3000").is_local());
        assert!(client("[::1]:50000", "[::1]:3000").is_local());
        assert!(client("[::ffff:127.0.0.1]:50000", "[::]:3000").is_local());
        assert!(client("192.168.1.5:50000", "192.168.1.5:3000").is_local(), "own LAN address");
        assert!(!client("192.168.1.20:50000", "192.168.1.5:3000").is_local(), "phone");
        assert!(!client("172.17.0.1:50000", "172.17.0.2:3000").is_local(), "Docker bridge");
    }
}
