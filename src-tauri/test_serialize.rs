use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TauriMessageContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "thinking")]
    Thinking { text: String },
}

fn main() {
    let content = vec![
        TauriMessageContent::Text { text: "Hello".to_string() },
        TauriMessageContent::Thinking { text: "Thinking...".to_string() },
    ];
    
    let json = serde_json::to_string_pretty(&content).unwrap();
    println!("{}", json);
}
