import React from 'react';
import { Wifi } from 'lucide-react';
import { Badge } from './Badge';

interface LatencyIndicatorProps {
  latency: number;
  isConnected: boolean;
}

export const LatencyIndicator: React.FC<LatencyIndicatorProps> = ({ latency, isConnected }) => {
  if (!isConnected) {
    return (
      <Badge variant="magenta" pulse>
        <Wifi size={13} />
        DISCONNECTED
      </Badge>
    );
  }

  const variant = latency < 35 ? 'lime' : latency < 80 ? 'amber' : 'magenta';

  return (
    <Badge variant={variant} pulse={latency > 100}>
      <Wifi size={13} />
      {latency > 0 ? `${latency} ms` : 'CONNECTED'}
    </Badge>
  );
};
