import { createRoot } from 'react-dom/client';
import Popup from './Popup';
import './popup.css';

const root = createRoot(document.getElementById('popup-root'));
root.render(<Popup />);