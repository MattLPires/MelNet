import { useEffect, useState, useCallback } from 'react';
import styles from './ModerationLog.module.css';
import { networkManager, ServerMessage } from '../network/NetworkManager';

export interface ModerationEvent {
  id: string;
  event: string;
  timestamp: string;
  details: string;
}

interface ModerationLogProps {
  roomId: string;
  isHost: boolean;
}

let modEventIdCounter = 0;
function nextModEventId(): string {
  return `mod-${++modEventIdCounter}`;
}

const ModerationLog: React.FC<ModerationLogProps> = ({ roomId, isHost }) => {
  const [events, setEvents] = useState<ModerationEvent[]>([]);
  const [expanded, setExpanded] = useState(false);

  const handleModerationEvent = useCallback(
    (msg: ServerMessage) => {
      const p = msg.payload as { roomId: string; event: string; timestamp: string; details: string };
      if (p.roomId !== roomId) return;
      setEvents((prev) => [
        ...prev,
        { id: nextModEventId(), event: p.event, timestamp: p.timestamp, details: p.details },
      ]);
    },
    [roomId],
  );

  useEffect(() => {
    networkManager.on('moderation-event', handleModerationEvent);
    return () => {
      networkManager.off('moderation-event', handleModerationEvent);
    };
  }, [handleModerationEvent]);

  if (!isHost) return null;

  const formatTime = (ts: string): string => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className={styles.container} data-testid="moderation-log">
      <button
        className={styles.toggleBtn}
        onClick={() => setExpanded((prev) => !prev)}
        data-testid="moderation-log-toggle"
        aria-expanded={expanded}
        aria-label="Log de Moderação"
      >
        <span className={styles.toggleIcon}>{expanded ? '▾' : '▸'}</span>
        Log de Moderação ({events.length})
      </button>
      {expanded && (
        <div className={styles.eventList} data-testid="moderation-event-list">
          {events.length === 0 ? (
            <div className={styles.emptyMessage}>Nenhum evento registrado.</div>
          ) : (
            events.map((evt) => (
              <div key={evt.id} className={styles.eventItem} data-testid="moderation-event-item">
                <span className={styles.eventTime}>{formatTime(evt.timestamp)}</span>
                <span className={styles.eventType}>{evt.event}</span>
                <span className={styles.eventDetails}>{evt.details}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ModerationLog;
