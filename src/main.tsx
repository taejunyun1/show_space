import {lazy,Suspense} from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
const App=lazy(()=>import('./App'));
const SharedViewer=lazy(()=>import('./components/SharedViewer'));
const sharedRoute=location.pathname.startsWith('/s/');
const match=location.pathname.match(/^\/s\/([0-9a-f]{48})\/?$/);
createRoot(document.getElementById('root')!).render(<Suspense fallback={<div className="loading-canvas">화면을 불러오는 중…</div>}>{sharedRoute?<SharedViewer shareId={match?.[1]??null}/>:<App/>}</Suspense>);
