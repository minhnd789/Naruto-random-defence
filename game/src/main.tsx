import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './meta.css';
import './progress.css';
import './arena.css';

// Không dùng StrictMode: nó mount hai lần và sẽ tạo hai canvas Pixi
createRoot(document.getElementById('root')!).render(<App />);
