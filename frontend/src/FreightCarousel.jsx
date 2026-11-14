import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function FreightCarousel({ requests, renderCard }) {
  const [selectedId, setSelectedId] = useState(() => requests[0]?.id || null);
  const touch = useRef(null);
  const swiped = useRef(false);
  useEffect(() => {
    if (!requests.some(request => request.id === selectedId)) setSelectedId(requests[0]?.id || null);
  }, [requests, selectedId]);
  if (!requests.length) return null;
  const found = requests.findIndex(request => request.id === selectedId);
  const index = found < 0 ? 0 : found;
  const move = delta => {
    const next = Math.min(requests.length - 1, Math.max(0, index + delta));
    setSelectedId(requests[next].id);
  };
  return <div className="freight-carousel" role="region" aria-roledescription="carrossel" aria-label="Chamados disponíveis">
    <div className="freight-carousel-nav">
      <button type="button" aria-label="Chamado anterior" disabled={index === 0} onClick={() => move(-1)}><ArrowLeft size={20}/></button>
      <span role="status" aria-live="polite"><strong>{index + 1}</strong> de {requests.length} chamado{requests.length === 1 ? '' : 's'}</span>
      <button type="button" aria-label="Próximo chamado" disabled={index === requests.length - 1} onClick={() => move(1)}><ArrowRight size={20}/></button>
    </div>
    <div className="freight-carousel-stage" tabIndex={0} aria-label="Use as setas do teclado ou deslize para navegar"
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }}
      onTouchStart={event => {
        swiped.current = false;
        touch.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
      }}
      onTouchCancel={() => { touch.current = null; }}
      onTouchEnd={event => {
        const start = touch.current; touch.current = null;
        if (!start || !event.changedTouches[0]) return;
        const dx = event.changedTouches[0].clientX - start.x;
        const dy = event.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          swiped.current = true; move(dx < 0 ? 1 : -1);
        }
      }}
      onClickCapture={event => {
        if (swiped.current) { event.preventDefault(); event.stopPropagation(); swiped.current = false; }
      }}>
      {renderCard(requests[index], true)}
    </div>
    {requests.length > 1 && <p className="freight-carousel-hint">Deslize para o lado ou use as setas para ver outro chamado.</p>}
  </div>;
}
