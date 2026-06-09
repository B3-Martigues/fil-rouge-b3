/**Composant principal de l'application, il gère le routage et l'affichage des notifications (toast)  */
import Router from "./app/Router";
import { ToastContainer } from "react-toastify";

function App() {
  return (
    <>
      <Router />

      <ToastContainer position="top-right" autoClose={3000} theme="light" />
    </>
  );
}

export default App;
