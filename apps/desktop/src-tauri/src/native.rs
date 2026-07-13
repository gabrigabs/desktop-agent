use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NativePermissionKind {
    ScreenRecording,
    Accessibility,
    Notifications,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NativePermissionState {
    Granted,
    Denied,
    NotDetermined,
    Restricted,
    Unavailable,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeError {
    pub code: &'static str,
    pub message: String,
    pub recoverable: bool,
}

impl NativeError {
    fn unavailable(message: impl Into<String>) -> Self {
        Self {
            code: "BRIDGE_UNAVAILABLE",
            message: message.into(),
            recoverable: true,
        }
    }
}

#[derive(Debug, Default)]
pub struct NativeState {
    pub captures: Mutex<HashMap<String, CaptureEntry>>,
}

#[derive(Debug, Clone)]
pub struct CaptureEntry {
    pub expires_at: Instant,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeCapturePreview {
    pub capture_id: String,
    pub display_id: u32,
    pub width: u32,
    pub height: u32,
    pub preview_data_url: String,
    pub expires_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeCaptureRequest {
    pub display_id: Option<u32>,
    pub exclude_helix: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeCaptureAnalysisRequest {
    pub capture_id: String,
    pub features: Vec<String>,
    pub crop: Option<NativeBoundingBox>,
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeNotificationInput {
    pub kind: String,
    pub title: Option<String>,
    pub body: Option<String>,
    pub include_preview: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeCaptureDiscardRequest {
    pub capture_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeBoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[tauri::command]
pub fn get_native_permission_state(
    kind: NativePermissionKind,
    state: State<'_, NativeState>,
) -> NativePermissionState {
    let result = permission_state(kind.clone());
    if matches!(kind, NativePermissionKind::ScreenRecording)
        && !matches!(result, NativePermissionState::Granted)
    {
        if let Ok(mut captures) = state.captures.lock() {
            captures.clear();
        }
    }
    result
}

#[tauri::command]
pub fn request_native_permission(
    kind: NativePermissionKind,
    state: State<'_, NativeState>,
) -> NativePermissionState {
    let result = request_permission(kind.clone());
    if matches!(kind, NativePermissionKind::ScreenRecording)
        && !matches!(result, NativePermissionState::Granted)
    {
        if let Ok(mut captures) = state.captures.lock() {
            captures.clear();
        }
    }
    result
}

#[tauri::command]
pub fn prepare_native_capture(
    request: Option<NativeCaptureRequest>,
    state: State<'_, NativeState>,
    app: AppHandle,
) -> Result<NativeCapturePreview, NativeError> {
    ensure_permission(NativePermissionKind::ScreenRecording)?;
    let request = request.unwrap_or(NativeCaptureRequest {
        display_id: None,
        exclude_helix: Some(true),
    });

    #[cfg(target_os = "macos")]
    {
        let display_id = request.display_id.unwrap_or_else(main_display_id);
        let helix_window = app.get_webview_window("main");
        let was_visible = helix_window
            .as_ref()
            .map(|window| window.is_visible().unwrap_or(false))
            .unwrap_or(false);
        if request.exclude_helix.unwrap_or(true) && was_visible {
            if let Some(window) = &helix_window {
                let _ = window.hide();
            }
        }
        let mut bytes = std::ptr::null_mut();
        let mut length = 0usize;
        let mut width = 0u32;
        let mut height = 0u32;
        let captured = unsafe {
            helix_capture_display(display_id, &mut bytes, &mut length, &mut width, &mut height)
        };
        if request.exclude_helix.unwrap_or(true) && was_visible {
            if let Some(window) = &helix_window {
                let _ = window.show();
            }
        }
        if !captured || bytes.is_null() || length == 0 {
            return Err(NativeError::new(
                "CAPTURE_CANCELLED",
                "Não foi possível capturar o display selecionado",
                true,
            ));
        }
        let image = unsafe { std::slice::from_raw_parts(bytes, length).to_vec() };
        unsafe { helix_free_bytes(bytes) };

        if (width as u64) * (height as u64) > 50_000_000 {
            return Err(NativeError::new(
                "INVALID_RESOURCE",
                "O display excede o limite de 50 megapixels",
                true,
            ));
        }

        let capture_id = uuid::Uuid::new_v4().to_string();
        let expires_at = Instant::now() + Duration::from_secs(120);
        let expires_at_iso = iso_after(Duration::from_secs(120));
        let preview_data_url = make_preview_data_url(&image);
        let mut captures = state
            .captures
            .lock()
            .map_err(|_| NativeError::bridge("capture state unavailable"))?;
        captures.retain(|_, entry| entry.expires_at > Instant::now());
        captures.clear();
        captures.insert(
            capture_id.clone(),
            CaptureEntry {
                expires_at,
                bytes: image,
            },
        );
        return Ok(NativeCapturePreview {
            capture_id,
            display_id,
            width,
            height,
            preview_data_url,
            expires_at: expires_at_iso,
        });
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (request, state, app);
        Err(NativeError::unavailable(
            "Native screen capture is only available on macOS",
        ))
    }
}

#[tauri::command]
pub fn analyze_native_capture(
    request: NativeCaptureAnalysisRequest,
    state: State<'_, NativeState>,
) -> Result<serde_json::Value, NativeError> {
    let entry = {
        let mut captures = state
            .captures
            .lock()
            .map_err(|_| NativeError::bridge("capture state unavailable"))?;
        captures.remove(&request.capture_id)
    }
    .ok_or_else(|| {
        NativeError::new(
            "CAPTURE_EXPIRED",
            "A captura já foi descartada ou expirou",
            true,
        )
    })?;
    if entry.expires_at <= Instant::now() {
        return Err(NativeError::new(
            "CAPTURE_EXPIRED",
            "A captura excedeu o TTL de 120 segundos",
            true,
        ));
    }
    validate_crop(request.crop.as_ref())?;
    analyze_bytes(
        &entry.bytes,
        &request.features,
        "capture",
        request.display_name.as_deref().unwrap_or("screen"),
        request.crop.as_ref(),
    )
}

#[tauri::command]
pub fn discard_native_capture(
    request: NativeCaptureDiscardRequest,
    state: State<'_, NativeState>,
) -> Result<(), NativeError> {
    state
        .captures
        .lock()
        .map_err(|_| NativeError::unavailable("Native capture state is unavailable"))?
        .remove(&request.capture_id);
    Ok(())
}

#[tauri::command]
pub fn analyze_native_image(request: serde_json::Value) -> Result<serde_json::Value, NativeError> {
    let path = request
        .get("path")
        .and_then(|value| value.as_str())
        .ok_or_else(|| NativeError::new("INVALID_RESOURCE", "Caminho da imagem ausente", true))?;
    let metadata = fs::metadata(path).map_err(|_| {
        NativeError::new(
            "INVALID_RESOURCE",
            "A imagem não existe ou não é acessível",
            true,
        )
    })?;
    if !metadata.is_file() || metadata.len() > 25 * 1024 * 1024 {
        return Err(NativeError::new(
            "INVALID_RESOURCE",
            "A imagem deve ser um arquivo regular de até 25 MB",
            true,
        ));
    }
    let bytes = fs::read(path)
        .map_err(|_| NativeError::new("INVALID_RESOURCE", "Não foi possível ler a imagem", true))?;
    let features = request
        .get("features")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::to_owned))
                .collect::<Vec<_>>()
        })
        .unwrap_or_else(|| vec!["text".to_string()]);
    let display_name = request
        .get("displayName")
        .and_then(|value| value.as_str())
        .unwrap_or(path);
    if let Some((width, height)) = image_dimensions(&bytes) {
        if width.saturating_mul(height) > 50_000_000 {
            return Err(NativeError::new(
                "INVALID_RESOURCE",
                "A imagem excede o limite de 50 megapixels",
                true,
            ));
        }
    }
    analyze_bytes(&bytes, &features, "file", display_name, None)
}

#[tauri::command]
pub fn snapshot_active_window() -> Result<serde_json::Value, NativeError> {
    ensure_permission(NativePermissionKind::Accessibility)?;
    #[cfg(target_os = "macos")]
    {
        let json = unsafe { helix_active_window_context() };
        if json.is_null() {
            return Err(NativeError::new(
                "INVALID_RESOURCE",
                "O app externo ativo não expôs uma janela focada",
                true,
            ));
        }
        let mut value = unsafe { c_string_to_json(json) }?;
        unsafe { helix_free_string(json) };
        sanitize_active_snapshot(&mut value);
        return Ok(value);
    }
    #[cfg(not(target_os = "macos"))]
    Err(NativeError::unavailable(
        "Accessibility is only available on macOS",
    ))
}

#[tauri::command]
#[cfg(target_os = "macos")]
pub fn get_native_system_context() -> Result<serde_json::Value, NativeError> {
    let json = unsafe { helix_system_context() };
    if json.is_null() {
        return Err(NativeError::new(
            "BRIDGE_UNAVAILABLE",
            "Não foi possível consultar o contexto do sistema",
            true,
        ));
    }
    let mut value = unsafe { c_string_to_json(json) }?;
    unsafe { helix_free_string(json) };
    if let Some(object) = value.as_object_mut() {
        object.insert(
            "architecture".to_string(),
            serde_json::Value::String(std::env::consts::ARCH.to_string()),
        );
    }
    Ok(value)
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn get_native_system_context() -> Result<serde_json::Value, NativeError> {
    Err(NativeError::unavailable(
        "Native system context is only available on macOS",
    ))
}

#[tauri::command]
pub fn send_native_notification(
    input: NativeNotificationInput,
    app: AppHandle,
) -> Result<(), NativeError> {
    if app
        .get_webview_window("main")
        .and_then(|window| window.is_focused().ok())
        .unwrap_or(false)
    {
        return Ok(());
    }
    if !matches!(notification_state(), NativePermissionState::Granted) {
        return Err(NativeError::new(
            "NOTIFICATION_DENIED",
            "Notificações nativas não estão autorizadas",
            true,
        ));
    }
    let title = sanitize_notification_text(input.title.as_deref().unwrap_or("Helix"), 80);
    let fallback = match input.kind.as_str() {
        "completed" => "A tarefa foi concluída.",
        "failed" => "A tarefa terminou com erro.",
        "approval" => "Uma tarefa aguarda aprovação.",
        _ => "A tarefa do Helix foi atualizada.",
    };
    let body_source = if input.include_preview.unwrap_or(false) {
        input.body.as_deref().unwrap_or(fallback)
    } else {
        fallback
    };
    let body = sanitize_notification_text(body_source, 240);

    #[cfg(target_os = "macos")]
    {
        let title_c = std::ffi::CString::new(title)
            .map_err(|_| NativeError::new("INVALID_RESOURCE", "Título inválido", true))?;
        let body_c = std::ffi::CString::new(body)
            .map_err(|_| NativeError::new("INVALID_RESOURCE", "Conteúdo inválido", true))?;
        let ok = unsafe { helix_send_notification(title_c.as_ptr(), body_c.as_ptr()) };
        if ok {
            return Ok(());
        }
        return Err(NativeError::new(
            "BRIDGE_UNAVAILABLE",
            "O macOS não aceitou a notificação",
            true,
        ));
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (title, body);
        Err(NativeError::unavailable(
            "Notifications are only available on macOS",
        ))
    }
}

fn permission_state(kind: NativePermissionKind) -> NativePermissionState {
    match kind {
        NativePermissionKind::ScreenRecording => screen_recording_state(),
        NativePermissionKind::Accessibility => accessibility_state(),
        NativePermissionKind::Notifications => notification_state(),
    }
}

fn request_permission(kind: NativePermissionKind) -> NativePermissionState {
    match kind {
        NativePermissionKind::ScreenRecording => request_screen_recording(),
        NativePermissionKind::Accessibility => request_accessibility(),
        NativePermissionKind::Notifications => request_notifications(),
    }
}

#[cfg(target_os = "macos")]
fn screen_recording_state() -> NativePermissionState {
    if unsafe { helix_screen_recording_preflight() } {
        NativePermissionState::Granted
    } else {
        NativePermissionState::Denied
    }
}

#[cfg(not(target_os = "macos"))]
fn screen_recording_state() -> NativePermissionState {
    NativePermissionState::Unavailable
}

#[cfg(target_os = "macos")]
fn request_screen_recording() -> NativePermissionState {
    if unsafe { helix_screen_recording_request() } {
        NativePermissionState::Granted
    } else {
        NativePermissionState::Denied
    }
}

#[cfg(not(target_os = "macos"))]
fn request_screen_recording() -> NativePermissionState {
    NativePermissionState::Unavailable
}

#[cfg(target_os = "macos")]
fn accessibility_state() -> NativePermissionState {
    if unsafe { helix_accessibility_trusted() } {
        NativePermissionState::Granted
    } else {
        NativePermissionState::Denied
    }
}

fn request_accessibility() -> NativePermissionState {
    #[cfg(target_os = "macos")]
    {
        if unsafe { helix_request_accessibility() } {
            NativePermissionState::Granted
        } else {
            accessibility_state()
        }
    }
    #[cfg(not(target_os = "macos"))]
    NativePermissionState::Unavailable
}

fn notification_state() -> NativePermissionState {
    #[cfg(target_os = "macos")]
    {
        return match unsafe { helix_notification_state() } {
            2 | 3 => NativePermissionState::Granted,
            1 => NativePermissionState::Denied,
            _ => NativePermissionState::NotDetermined,
        };
    }
    #[cfg(not(target_os = "macos"))]
    NativePermissionState::Unavailable
}

fn request_notifications() -> NativePermissionState {
    #[cfg(target_os = "macos")]
    {
        let requested = unsafe { helix_request_notifications() };
        if requested {
            NativePermissionState::Granted
        } else {
            notification_state()
        }
    }
    #[cfg(not(target_os = "macos"))]
    NativePermissionState::Unavailable
}

fn sanitize_notification_text(value: &str, max_chars: usize) -> String {
    value
        .chars()
        .filter(|character| !character.is_control())
        .take(max_chars)
        .collect::<String>()
        .trim()
        .to_string()
}

fn sanitize_active_snapshot(value: &mut serde_json::Value) {
    let Some(object) = value.as_object_mut() else {
        return;
    };
    let raw_content = object
        .get("content")
        .and_then(|content| content.as_str())
        .unwrap_or_default()
        .to_string();
    let (redacted, redactions) = redact_active_text(&raw_content);
    let truncated = redacted.chars().count() > 50_000;
    let content: String = redacted.chars().take(50_000).collect();
    object.insert("content".to_string(), serde_json::Value::String(content));
    object.insert("truncated".to_string(), serde_json::Value::Bool(truncated));
    object.insert(
        "redactedCount".to_string(),
        serde_json::Value::from(redactions),
    );
    object.insert("nodeCount".to_string(), serde_json::Value::from(1u32));
}

fn redact_active_text(value: &str) -> (String, usize) {
    let mut count = 0;
    let output = value
        .lines()
        .map(|line| {
            let lowercase = line.to_ascii_lowercase();
            let sensitive = [
                "password",
                "passcode",
                "api_key",
                "apikey",
                "access_token",
                "client_secret",
                "private_key",
            ]
            .iter()
            .any(|needle| lowercase.contains(needle));
            if !sensitive {
                return line.to_string();
            }
            count += 1;
            let separator = line.find('=').or_else(|| line.find(':'));
            match separator {
                Some(index) => format!("{} [REDACTED]", &line[..index + 1]),
                None => "[REDACTED]".to_string(),
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    (output, count)
}

fn ensure_permission(kind: NativePermissionKind) -> Result<(), NativeError> {
    if matches!(permission_state(kind), NativePermissionState::Granted) {
        Ok(())
    } else {
        Err(NativeError::new(
            "PERMISSION_DENIED",
            "A permissão nativa necessária não está concedida",
            true,
        ))
    }
}

impl NativeError {
    fn new(code: &'static str, message: impl Into<String>, recoverable: bool) -> Self {
        Self {
            code,
            message: message.into(),
            recoverable,
        }
    }
    fn bridge(message: impl Into<String>) -> Self {
        Self::new("BRIDGE_UNAVAILABLE", message, true)
    }
}

fn validate_crop(crop: Option<&NativeBoundingBox>) -> Result<(), NativeError> {
    if let Some(crop) = crop {
        let values = [crop.x, crop.y, crop.width, crop.height];
        if values
            .iter()
            .any(|value| !value.is_finite() || *value < 0.0 || *value > 1.0)
            || crop.width <= 0.0
            || crop.height <= 0.0
        {
            return Err(NativeError::new(
                "INVALID_RESOURCE",
                "Crop deve usar coordenadas normalizadas entre 0 e 1",
                true,
            ));
        }
    }
    Ok(())
}

fn analyze_bytes(
    bytes: &[u8],
    features: &[String],
    kind: &str,
    display_name: &str,
    crop: Option<&NativeBoundingBox>,
) -> Result<serde_json::Value, NativeError> {
    #[cfg(target_os = "macos")]
    {
        let feature_list = features.join(",");
        let feature_c = std::ffi::CString::new(feature_list)
            .map_err(|_| NativeError::new("VISION_FAILED", "Features inválidas", true))?;
        let crop_values = crop
            .map(|value| [value.x, value.y, value.width, value.height])
            .unwrap_or([-1.0; 4]);
        let json = unsafe {
            helix_analyze_image(
                bytes.as_ptr(),
                bytes.len(),
                feature_c.as_ptr(),
                crop_values[0],
                crop_values[1],
                crop_values[2],
                crop_values[3],
            )
        };
        if json.is_null() {
            return Err(NativeError::new(
                "VISION_FAILED",
                "Vision não conseguiu analisar a imagem",
                true,
            ));
        }
        let mut value = unsafe { c_string_to_json(json) }?;
        unsafe { helix_free_string(json) };
        if let Some(object) = value.as_object_mut() {
            object.insert(
                "source".to_string(),
                serde_json::json!({ "kind": kind, "displayName": display_name }),
            );
            object.insert("durationMs".to_string(), serde_json::Value::from(0));
        }
        return Ok(value);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (bytes, features, kind, display_name, crop);
        Err(NativeError::unavailable(
            "Vision is only available on macOS",
        ))
    }
}

#[cfg(target_os = "macos")]
fn make_preview_data_url(bytes: &[u8]) -> String {
    let mut preview_bytes = std::ptr::null_mut();
    let mut preview_length = 0usize;
    let preview_created = unsafe {
        helix_make_preview(
            bytes.as_ptr(),
            bytes.len(),
            640,
            &mut preview_bytes,
            &mut preview_length,
        )
    };
    if preview_created && !preview_bytes.is_null() && preview_length > 0 {
        let preview = unsafe { std::slice::from_raw_parts(preview_bytes, preview_length).to_vec() };
        unsafe { helix_free_bytes(preview_bytes) };
        return format!("data:image/png;base64,{}", base64_encode(&preview));
    }
    if !preview_bytes.is_null() {
        unsafe { helix_free_bytes(preview_bytes) };
    }
    String::new()
}

#[cfg(not(target_os = "macos"))]
fn make_preview_data_url(_bytes: &[u8]) -> String {
    String::new()
}

fn image_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    if bytes.len() >= 24 && bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Some((
            u32::from_be_bytes(bytes[16..20].try_into().ok()?),
            u32::from_be_bytes(bytes[20..24].try_into().ok()?),
        ));
    }
    if bytes.len() > 4 && bytes.starts_with(&[0xff, 0xd8]) {
        let mut index = 2;
        while index + 9 < bytes.len() {
            if bytes[index] != 0xff {
                index += 1;
                continue;
            }
            let marker = bytes[index + 1];
            index += 2;
            if marker == 0xd8 || marker == 0xd9 {
                continue;
            }
            let length = u16::from_be_bytes([bytes[index], bytes[index + 1]]) as usize;
            if index + length > bytes.len() || length < 2 {
                return None;
            }
            if matches!(marker, 0xc0..=0xc3 | 0xc5..=0xc7 | 0xc9..=0xcb | 0xcd..=0xcf) {
                return Some((
                    u16::from_be_bytes([bytes[index + 5], bytes[index + 6]]) as u32,
                    u16::from_be_bytes([bytes[index + 3], bytes[index + 4]]) as u32,
                ));
            }
            index += length;
        }
    }
    None
}

fn iso_after(duration: Duration) -> String {
    let timestamp = SystemTime::now()
        .checked_add(duration)
        .unwrap_or(SystemTime::now())
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}", timestamp)
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let a = chunk[0] as usize;
        let b = chunk.get(1).copied().unwrap_or(0) as usize;
        let c = chunk.get(2).copied().unwrap_or(0) as usize;
        output.push(TABLE[a >> 2] as char);
        output.push(TABLE[((a & 3) << 4) | (b >> 4)] as char);
        output.push(if chunk.len() > 1 {
            TABLE[((b & 15) << 2) | (c >> 6)] as char
        } else {
            '='
        });
        output.push(if chunk.len() > 2 {
            TABLE[c & 63] as char
        } else {
            '='
        });
    }
    output
}

#[cfg(target_os = "macos")]
fn main_display_id() -> u32 {
    unsafe { CGMainDisplayID() }
}

#[cfg(target_os = "macos")]
unsafe fn c_string_to_json(
    pointer: *const std::os::raw::c_char,
) -> Result<serde_json::Value, NativeError> {
    let value = std::ffi::CStr::from_ptr(pointer).to_str().map_err(|_| {
        NativeError::new(
            "BRIDGE_UNAVAILABLE",
            "Native bridge returned invalid UTF-8",
            true,
        )
    })?;
    serde_json::from_str(value).map_err(|_| {
        NativeError::new(
            "BRIDGE_UNAVAILABLE",
            "Native bridge returned invalid JSON",
            true,
        )
    })
}

#[cfg(target_os = "macos")]
extern "C" {
    fn helix_screen_recording_preflight() -> bool;
    fn helix_screen_recording_request() -> bool;
    fn helix_accessibility_trusted() -> bool;
    fn helix_request_accessibility() -> bool;
    fn helix_notification_state() -> i32;
    fn helix_request_notifications() -> bool;
    fn helix_send_notification(
        title: *const std::os::raw::c_char,
        body: *const std::os::raw::c_char,
    ) -> bool;
    fn helix_capture_display(
        display_id: u32,
        bytes: *mut *mut u8,
        length: *mut usize,
        width: *mut u32,
        height: *mut u32,
    ) -> bool;
    fn helix_make_preview(
        bytes: *const u8,
        length: usize,
        max_dimension: u32,
        preview_bytes: *mut *mut u8,
        preview_length: *mut usize,
    ) -> bool;
    fn helix_free_bytes(bytes: *mut u8);
    fn helix_free_string(value: *mut std::os::raw::c_char);
    fn helix_analyze_image(
        bytes: *const u8,
        length: usize,
        features: *const std::os::raw::c_char,
        crop_x: f64,
        crop_y: f64,
        crop_width: f64,
        crop_height: f64,
    ) -> *mut std::os::raw::c_char;
    fn helix_active_window_context() -> *mut std::os::raw::c_char;
    fn helix_start_app_tracking();
    fn helix_system_context() -> *mut std::os::raw::c_char;
    fn CGMainDisplayID() -> u32;
}

#[cfg(not(target_os = "macos"))]
fn accessibility_state() -> NativePermissionState {
    NativePermissionState::Unavailable
}

#[cfg(target_os = "macos")]
pub fn start_app_tracking() {
    unsafe {
        helix_start_app_tracking();
    }
}

#[cfg(not(target_os = "macos"))]
pub fn start_app_tracking() {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_capture_contract_uses_camel_case() {
        let preview = NativeCapturePreview {
            capture_id: "capture-123".into(),
            display_id: 7,
            width: 1440,
            height: 900,
            preview_data_url: "data:image/jpeg;base64,preview".into(),
            expires_at: "2026-07-13T12:00:00Z".into(),
        };
        let serialized = serde_json::to_value(preview).expect("preview should serialize");
        assert_eq!(serialized["captureId"], "capture-123");
        assert_eq!(serialized["displayId"], 7);
        assert!(serialized.get("capture_id").is_none());

        let request: NativeCaptureAnalysisRequest = serde_json::from_value(serde_json::json!({
            "captureId": "capture-123",
            "features": ["text"],
            "displayName": "Main display"
        }))
        .expect("analysis request should accept the frontend contract");
        assert_eq!(request.capture_id, "capture-123");
        assert_eq!(request.display_name.as_deref(), Some("Main display"));
    }

    #[test]
    fn encodes_preview_bytes_without_writing_a_file() {
        assert_eq!(base64_encode(b"Helix"), "SGVsaXg=");
    }

    #[test]
    fn converts_and_validates_normalized_crop() {
        assert!(validate_crop(Some(&NativeBoundingBox {
            x: 0.1,
            y: 0.2,
            width: 0.5,
            height: 0.4
        }))
        .is_ok());
        assert!(validate_crop(Some(&NativeBoundingBox {
            x: 0.8,
            y: 0.2,
            width: 0.5,
            height: 0.4
        }))
        .is_ok());
        assert!(validate_crop(Some(&NativeBoundingBox {
            x: -0.1,
            y: 0.2,
            width: 0.5,
            height: 0.4
        }))
        .is_err());
    }

    #[test]
    fn redacts_secret_like_active_window_lines() {
        let (value, count) = redact_active_text("username: gabriel\napi_key=secret-value");
        assert_eq!(count, 1);
        assert!(value.contains("[REDACTED]"));
        assert!(!value.contains("secret-value"));
    }
}
