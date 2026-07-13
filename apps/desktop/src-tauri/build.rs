fn main() {
    // Keep Tauri's build pipeline: it generates the runtime context, including
    // the ACL manifests used to resolve core and plugin permissions.
    tauri_build::build();

    println!("cargo:rerun-if-changed=native_shim.m");

    #[cfg(target_os = "macos")]
    cc::Build::new()
        .file("native_shim.m")
        .flag("-fobjc-arc")
        .flag("-fblocks")
        .compile("helix_native_shim");

    #[cfg(target_os = "macos")]
    for framework in [
        "ApplicationServices",
        "AppKit",
        "CoreGraphics",
        "CoreImage",
        "CoreMedia",
        "Foundation",
        "ImageIO",
        "ScreenCaptureKit",
        "Vision",
        "UserNotifications",
    ] {
        println!("cargo:rustc-link-lib=framework={framework}");
    }
}
