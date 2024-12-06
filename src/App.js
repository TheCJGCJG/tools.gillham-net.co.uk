import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import './App.css'
import 'bootstrap/dist/css/bootstrap.min.css';
import HomePage from './pages/home'
import NavBar from './components/navbar'
import GpxParser from './pages/gpx-parser'
import MovingSpeedTest from './pages/moving-network-speed-test'

function App () {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="gpx-parser" element={<GpxParser />} />
        <Route path="moving-network-speed-test" element={<MovingSpeedTest />} />
        <Route path="users" element={<GpxParser />} />
      </Routes>
  </BrowserRouter>
  );
}

export default App;
