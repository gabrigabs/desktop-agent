use std::process::{Child, Command, Stdio};

#[allow(dead_code)]
pub struct SidecarHandle {
    child: Option<Child>,
    name: String,
}

#[allow(dead_code)]
impl SidecarHandle {
    pub fn spawn(name: &str, binary_path: &str) -> Result<Self, String> {
        let child = Command::new(binary_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Failed to spawn {} sidecar: {}", name, e))?;

        Ok(Self {
            child: Some(child),
            name: name.to_string(),
        })
    }

    pub fn kill(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for SidecarHandle {
    fn drop(&mut self) {
        self.kill();
    }
}
