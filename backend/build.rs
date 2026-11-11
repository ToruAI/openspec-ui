//! Stamps the running version into the binary.
//!
//! The repo-wide version lives in `../VERSION` (ToruAI versioning standard: the
//! number is stamped there on `main`). Cargo.toml carries its own copy only
//! because Cargo requires one; the binary reports `VERSION` so a stamp that
//! forgets Cargo.toml still ships the right number. If `VERSION` is missing
//! (e.g. a build context without the repo root) we fall back to Cargo.toml.

use std::{env, fs, path::Path};

fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    let manifest_dir = env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is set by cargo");
    let version_file = Path::new(&manifest_dir).join("..").join("VERSION");
    let pkg_version = env::var("CARGO_PKG_VERSION").expect("CARGO_PKG_VERSION is set by cargo");

    let version = match fs::read_to_string(&version_file) {
        Ok(content) => {
            println!("cargo:rerun-if-changed={}", version_file.display());
            let stamped = content.trim().to_string();
            if stamped.is_empty() {
                pkg_version
            } else {
                if stamped != pkg_version {
                    println!(
                        "cargo:warning=VERSION says {stamped} but Cargo.toml says {pkg_version}; the binary reports {stamped}"
                    );
                }
                stamped
            }
        }
        Err(_) => pkg_version,
    };

    println!("cargo:rustc-env=OPENSPEC_UI_VERSION={version}");

    // The frontend is embedded from ../frontend/dist. Without that folder the
    // crate does not compile, which breaks `cargo test` and `npm run dev` on a
    // fresh clone. Create it empty and say so; release builds are guarded by a
    // smoke test that checks the embedded UI is really there.
    let dist = Path::new(&manifest_dir).join("..").join("frontend").join("dist");
    if !dist.exists() && fs::create_dir_all(&dist).is_ok() {
        println!(
            "cargo:warning=frontend/dist was missing; built without the web UI. Run `npm run build` in frontend/ and rebuild to embed it"
        );
    }
}
