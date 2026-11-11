//! Command line interface and the precedence rules behind it.

use crate::discovery::DEFAULT_DEPTH;
use clap::{builder::BoolishValueParser, ArgAction, Parser};
use std::path::{Path, PathBuf};

pub const VERSION: &str = env!("OPENSPEC_UI_VERSION");
pub const DEFAULT_PORT: u16 = 3000;
/// How many ports after the default to try when it is taken.
pub const PORT_ATTEMPTS: u16 = 20;
pub const CONFIG_FILE_NAME: &str = "openspec-ui.json";
pub const CHANGELOG_URL: &str = "https://github.com/ToruAI/openspec-ui/blob/main/CHANGELOG.md";

const AFTER_HELP: &str = "\
Examples:
  openspec-ui                    Board for the OpenSpec projects in this folder
  openspec-ui ~/code             Search ~/code for repos with an openspec/ folder
  openspec-ui ./api ./web        Exactly these two repos
  openspec-ui --host 0.0.0.0     Also reachable from your phone on the same network
  openspec-ui --host 0.0.0.0 --allowed-host board.example.com
                                 ... and behind a reverse proxy under that name
  openspec-ui --json             For scripts: print one JSON line with the URL

Where the list of projects comes from (first match wins):
  1. --config FILE
  2. PATH arguments, searched for repos with openspec/
  3. $OPENSPEC_UI_CONFIG
  4. ./openspec-ui.json in the current folder
  5. the current folder, searched like a PATH
  Edits in the Settings dialog are saved only when a config file is in use
  (1, 3, 4). Otherwise they last until you stop the server; openspec-ui never
  creates a config file on its own. Sources can be edited only from a browser
  on this computer; other devices see them read-only.

For scripts and coding agents:
  The first line on stdout is always \"openspec-ui <version> running at <url>\",
  or, with --json, a single JSON object (url, port, version, pid, sources, ...).
  If openspec-ui is already running for the same folders, it is reused: the
  command prints that URL (\"reused\": true) and exits 0 instead of starting
  a second server. GET /api/info on a running server returns the same JSON.";

#[derive(Parser, Debug)]
#[command(
    name = "openspec-ui",
    version = VERSION,
    about = "A live kanban board for the OpenSpec changes and specs in your repos.",
    after_help = AFTER_HELP
)]
pub struct Args {
    /// Folders to search for OpenSpec projects. A repo with an openspec/
    /// folder is shown as is; any other folder is searched below.
    /// [default: the current folder]
    #[arg(value_name = "PATH")]
    pub paths: Vec<PathBuf>,

    /// Read projects from a JSON config file instead of searching folders
    #[arg(short, long, value_name = "FILE", conflicts_with = "paths")]
    pub config: Option<PathBuf>,

    /// Port to listen on. Without it, 3000 is used, or the next free port
    /// if 3000 is taken
    #[arg(short, long, env = "PORT", value_name = "PORT")]
    pub port: Option<u16>,

    /// Address to listen on. The default keeps the board on this machine;
    /// use 0.0.0.0 to reach it from other devices (and in Docker)
    #[arg(long, env = "OPENSPEC_UI_HOST", default_value = "127.0.0.1", value_name = "ADDR")]
    pub host: String,

    /// Also answer to this host name (repeatable; the variable takes a comma-
    /// separated list): this computer's name, a reverse proxy's. localhost and
    /// IP addresses always work
    #[arg(
        long = "allowed-host",
        env = "OPENSPEC_UI_ALLOWED_HOSTS",
        value_delimiter = ',',
        value_name = "HOST"
    )]
    pub allowed_hosts: Vec<String>,

    /// How many folder levels below each PATH to look for repos
    #[arg(long, default_value_t = DEFAULT_DEPTH, value_name = "N")]
    pub depth: usize,

    /// Do not open the browser (it only opens in an interactive terminal anyway)
    #[arg(
        long,
        env = "OPENSPEC_UI_NO_OPEN",
        action = ArgAction::SetTrue,
        value_parser = BoolishValueParser::new()
    )]
    pub no_open: bool,

    /// Print a single JSON line instead of the banner; never opens the browser
    #[arg(long)]
    pub json: bool,

    /// Show detailed logs on stderr (-vv for debug). RUST_LOG overrides this
    #[arg(short, long, action = ArgAction::Count)]
    pub verbose: u8,
}

/// Where the sources come from, after applying precedence.
#[derive(Debug, Clone, PartialEq)]
pub enum SourceChoice {
    ConfigFile { path: PathBuf, origin: ConfigOrigin },
    Discover { roots: Vec<PathBuf> },
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ConfigOrigin {
    Flag,
    Env,
    CurrentDir,
}

impl ConfigOrigin {
    pub fn describe(self) -> &'static str {
        match self {
            ConfigOrigin::Flag => "--config",
            ConfigOrigin::Env => "$OPENSPEC_UI_CONFIG",
            ConfigOrigin::CurrentDir => "./openspec-ui.json",
        }
    }
}

/// Apply the documented precedence: --config, PATHs, $OPENSPEC_UI_CONFIG,
/// ./openspec-ui.json, then the current folder.
pub fn choose_sources(
    flag_config: Option<&Path>,
    paths: &[PathBuf],
    env_config: Option<&str>,
    cwd: &Path,
) -> SourceChoice {
    if let Some(path) = flag_config {
        return SourceChoice::ConfigFile {
            path: path.to_path_buf(),
            origin: ConfigOrigin::Flag,
        };
    }
    if !paths.is_empty() {
        return SourceChoice::Discover {
            roots: paths.to_vec(),
        };
    }
    if let Some(env) = env_config.map(str::trim).filter(|s| !s.is_empty()) {
        return SourceChoice::ConfigFile {
            path: PathBuf::from(env),
            origin: ConfigOrigin::Env,
        };
    }
    let local = cwd.join(CONFIG_FILE_NAME);
    if local.is_file() {
        return SourceChoice::ConfigFile {
            path: PathBuf::from(CONFIG_FILE_NAME),
            origin: ConfigOrigin::CurrentDir,
        };
    }
    SourceChoice::Discover {
        roots: vec![cwd.to_path_buf()],
    }
}

/// Where an explicitly requested port came from.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PortOrigin {
    FlagOrEnv,
    ConfigFile,
}

/// The port to try first, and who asked for it (`None` = the default, which
/// may move to the next free port; an explicit port is never silently
/// replaced). Precedence: --port / $PORT, then the config file's "port",
/// then 3000. Port 0 lets the OS pick.
pub fn choose_port(cli_or_env: Option<u16>, config_file: Option<u16>) -> (u16, Option<PortOrigin>) {
    match (cli_or_env, config_file) {
        (Some(p), _) => (p, Some(PortOrigin::FlagOrEnv)),
        (None, Some(p)) => (p, Some(PortOrigin::ConfigFile)),
        (None, None) => (DEFAULT_PORT, None),
    }
}

/// Default log filter for a verbosity level; RUST_LOG wins when set.
pub fn log_filter(verbose: u8) -> &'static str {
    match verbose {
        0 => "warn",
        1 => "openspec_ui=info,warn",
        _ => "openspec_ui=debug,tower_http=debug,info",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::CommandFactory;

    #[test]
    fn cli_definition_is_valid() {
        Args::command().debug_assert();
    }

    #[test]
    fn no_open_accepts_the_usual_env_spellings() {
        // Only this test touches OPENSPEC_UI_NO_OPEN.
        for (value, expected) in [("1", true), ("true", true), ("yes", true), ("0", false), ("false", false)] {
            std::env::set_var("OPENSPEC_UI_NO_OPEN", value);
            let args = Args::try_parse_from(["openspec-ui"]).unwrap();
            assert_eq!(args.no_open, expected, "OPENSPEC_UI_NO_OPEN={value}");
        }
        std::env::remove_var("OPENSPEC_UI_NO_OPEN");
        assert!(Args::try_parse_from(["openspec-ui", "--no-open"]).unwrap().no_open);
        assert!(!Args::try_parse_from(["openspec-ui"]).unwrap().no_open);
    }

    #[test]
    fn allowed_hosts_from_flags_and_env() {
        // Only this test touches OPENSPEC_UI_ALLOWED_HOSTS.
        let args = Args::try_parse_from(["openspec-ui", "--allowed-host", "a.example", "--allowed-host", "b.lan:8443"]).unwrap();
        assert_eq!(args.allowed_hosts, vec!["a.example", "b.lan:8443"]);
        std::env::set_var("OPENSPEC_UI_ALLOWED_HOSTS", "a.example,b.lan");
        let args = Args::try_parse_from(["openspec-ui"]).unwrap();
        std::env::remove_var("OPENSPEC_UI_ALLOWED_HOSTS");
        assert_eq!(args.allowed_hosts, vec!["a.example", "b.lan"]);
    }

    #[test]
    fn config_flag_and_paths_conflict() {
        let r = Args::try_parse_from(["openspec-ui", "--config", "x.json", "./repo"]);
        assert!(r.is_err());
    }

    #[test]
    fn precedence_flag_beats_everything() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join(CONFIG_FILE_NAME), "{}").unwrap();
        let c = choose_sources(Some(Path::new("a.json")), &[], Some("b.json"), tmp.path());
        assert_eq!(
            c,
            SourceChoice::ConfigFile { path: "a.json".into(), origin: ConfigOrigin::Flag }
        );
    }

    #[test]
    fn precedence_paths_beat_env_and_local_file() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join(CONFIG_FILE_NAME), "{}").unwrap();
        let c = choose_sources(None, &["/r".into()], Some("b.json"), tmp.path());
        assert_eq!(c, SourceChoice::Discover { roots: vec!["/r".into()] });
    }

    #[test]
    fn precedence_env_beats_local_file() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join(CONFIG_FILE_NAME), "{}").unwrap();
        let c = choose_sources(None, &[], Some("b.json"), tmp.path());
        assert_eq!(
            c,
            SourceChoice::ConfigFile { path: "b.json".into(), origin: ConfigOrigin::Env }
        );
        // an empty env var is ignored
        let c = choose_sources(None, &[], Some("  "), tmp.path());
        assert!(matches!(c, SourceChoice::ConfigFile { origin: ConfigOrigin::CurrentDir, .. }));
    }

    #[test]
    fn no_config_anywhere_scans_current_folder() {
        let tmp = tempfile::tempdir().unwrap();
        let c = choose_sources(None, &[], None, tmp.path());
        assert_eq!(c, SourceChoice::Discover { roots: vec![tmp.path().to_path_buf()] });
    }

    #[test]
    fn port_precedence() {
        assert_eq!(choose_port(Some(4000), Some(5000)), (4000, Some(PortOrigin::FlagOrEnv)));
        assert_eq!(choose_port(None, Some(5000)), (5000, Some(PortOrigin::ConfigFile)));
        assert_eq!(choose_port(None, None), (DEFAULT_PORT, None));
        assert_eq!(choose_port(Some(0), None), (0, Some(PortOrigin::FlagOrEnv)));
    }
}
