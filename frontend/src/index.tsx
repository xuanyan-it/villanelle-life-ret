/* i18n */
import "./includes/i18n";
import "./index.css";
/* Ant Design */
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import ReactDOM from "react-dom/client";
/* Redux */
import { Provider } from "react-redux";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import Terms from "./pages/Terms";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import store from "./store";
import { lightTheme } from "./theme";
const root = ReactDOM.createRoot(document.getElementById("root"));
const Router =
  import.meta.env.VITE_APP_ENV === "electron" ? HashRouter : BrowserRouter;
root.render(
  <Provider store={store}>
    <ConfigProvider
      locale={zhCN}
      theme={{
        ...lightTheme,
      }}
    >
      <Router>
        <Routes>
          <Route index path="/" element={<App />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </Router>
    </ConfigProvider>
  </Provider>
);
reportWebVitals();
