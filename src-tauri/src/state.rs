use std::sync::Mutex;

#[derive(Default)]
pub struct ComfyUiProcessState {
    pub child: Mutex<Option<std::process::Child>>,
}
