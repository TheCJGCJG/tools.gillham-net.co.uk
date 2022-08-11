import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import './App.css'
import 'bootstrap/dist/css/bootstrap.min.css';
import HomePage from './pages/home'
import GpxParser from './pages/gpx-parser'

function App () {
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="gpx-parser" element={<GpxParser />} />
      <Route path="users" element={<GpxParser />} />
    </Routes>
  </BrowserRouter>
  );
}

export default App;
