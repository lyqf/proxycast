import ReactDOM from "react-dom/client";
import { RootRouter } from "./RootRouter";
import "./index.css";

// Initialize Tauri mock for web mode
import "./lib/tauri-mock/index";

// Initialize i18n configuration
import "./i18n/config";

ReactDOM.createRoot(document.getElementById("root")!).render(<RootRouter />);
