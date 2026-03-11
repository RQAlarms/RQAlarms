import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Alarm, User } from '../types';

// Fix for default marker icon in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DriverLocation {
  driverId: number;
  driverName: string;
  lat: number;
  lng: number;
  lastUpdated: number;
  status?: 'available' | 'busy';
  activeAlarm?: Alarm;
}

interface Props {
  locations: Record<number, DriverLocation>;
  alarms: Alarm[];
  drivers: User[];
}

const createCustomIcon = (status: 'available' | 'busy' | 'dispatched', name: string) => {
  const colorClass = status === 'dispatched' ? 'bg-amber-500' : status === 'busy' ? 'bg-red-500' : 'bg-emerald-500';
  const html = `
    <div class="flex flex-col items-center justify-center -mt-4 -ml-4">
      <div class="w-8 h-8 ${colorClass} rounded-full border-2 border-white shadow-md flex items-center justify-center text-white">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
      </div>
      <div class="mt-1 px-2 py-0.5 bg-white rounded shadow-sm text-[10px] font-bold text-slate-800 whitespace-nowrap border border-slate-200">
        ${name} • ${status === 'dispatched' ? 'Dispatched' : status === 'busy' ? 'Busy' : 'Available'}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-driver-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createAlarmIcon = (priority: string) => {
  let colorClass = 'bg-blue-500';
  if (priority === 'critical') colorClass = 'bg-red-500';
  else if (priority === 'high') colorClass = 'bg-amber-500';
  else if (priority === 'low') colorClass = 'bg-slate-500';

  const html = `
    <div class="flex flex-col items-center justify-center -mt-4 -ml-4">
      <div class="w-8 h-8 ${colorClass} rounded-full border-2 border-white shadow-md flex items-center justify-center text-white animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-alarm-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

function DriverMarker({ driver }: { key?: number | string, driver: DriverLocation & { status: 'available' | 'busy', activeAlarm?: Alarm } }) {
  const map = useMap();

  return (
    <Marker 
      position={[driver.lat, driver.lng]}
      icon={createCustomIcon(driver.activeAlarm ? 'dispatched' : driver.status, driver.driverName)}
      eventHandlers={{
        click: () => {
          map.flyTo([driver.lat, driver.lng], Math.max(map.getZoom(), 14), {
            duration: 1.5
          });
        }
      }}
    >
      <Popup>
        <div className="font-semibold text-slate-900">{driver.driverName}</div>
        <div className="text-xs text-slate-500 mt-1">
          Status: <span className={driver.status === 'busy' ? (driver.activeAlarm ? 'text-amber-600 font-medium' : 'text-red-600 font-medium') : 'text-emerald-600 font-medium'}>
            {driver.status === 'busy' ? (driver.activeAlarm ? 'Dispatched' : 'Busy') : 'Available'}
          </span>
        </div>
        {driver.activeAlarm && (
          <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-100 text-xs">
            <div className="font-semibold text-amber-900">{driver.activeAlarm.client_name}</div>
            <div className="text-amber-700 mt-0.5">{driver.activeAlarm.address}</div>
          </div>
        )}
        <div className="text-[10px] text-slate-400 mt-2">
          Last updated: {new Date(driver.lastUpdated).toLocaleTimeString()}
        </div>
      </Popup>
    </Marker>
  );
}

function AlarmMarker({ alarm }: { key?: number | string, alarm: Alarm }) {
  const map = useMap();
  if (!alarm.lat || !alarm.lng) return null;

  return (
    <Marker 
      position={[alarm.lat, alarm.lng]}
      icon={createAlarmIcon(alarm.priority)}
      eventHandlers={{
        click: () => {
          map.flyTo([alarm.lat!, alarm.lng!], Math.max(map.getZoom(), 14), {
            duration: 1.5
          });
        }
      }}
    >
      <Popup>
        <div className="font-semibold text-slate-900">{alarm.client_name}</div>
        <div className="text-xs text-slate-500 mt-1">
          Priority: <span className="font-medium uppercase">{alarm.priority}</span>
        </div>
        <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-100 text-xs">
          <div className="font-medium text-slate-800">{alarm.address}</div>
          <div className="text-slate-500 mt-1">Type: {alarm.alarm_type}</div>
          <div className="text-slate-500 mt-0.5">Status: {alarm.status}</div>
        </div>
      </Popup>
    </Marker>
  );
}

function MapBounds({ drivers, alarms }: { drivers: DriverLocation[], alarms: Alarm[] }) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([]);
    let hasPoints = false;

    drivers.forEach(driver => {
      bounds.extend([driver.lat, driver.lng]);
      hasPoints = true;
    });

    alarms.forEach(alarm => {
      if (alarm.lat && alarm.lng) {
        bounds.extend([alarm.lat, alarm.lng]);
        hasPoints = true;
      }
    });

    if (hasPoints) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [drivers, alarms, map]);

  return null;
}

function useNow(intervalMs: number = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
  return now;
}

export default function DriverMap({ locations, alarms, drivers }: Props) {
  const [map, setMap] = useState<L.Map | null>(null);
  const now = useNow(1000);
  
  const driverList = Object.values(locations).map(driver => {
    const activeAlarm = alarms.find(a => a.assigned_driver_id === driver.driverId && a.status === 'dispatched');
    const dbDriver = drivers.find(d => d.id === driver.driverId);
    const status: 'available' | 'busy' = activeAlarm ? 'busy' : (dbDriver?.status || 'available');
    return { ...driver, status, activeAlarm };
  }).sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'available' ? -1 : 1;
    }
    return a.driverName.localeCompare(b.driverName);
  });
  
  // Default center (can be adjusted to a specific city)
  const defaultCenter: [number, number] = [-26.2041, 28.0473]; // Johannesburg as example
  const center = driverList.length > 0 ? [driverList[0].lat, driverList[0].lng] as [number, number] : defaultCenter;

  const activeAlarmsWithLocation = alarms.filter(a => (a.status === 'dispatched' || a.status === 'pending') && a.lat && a.lng);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[600px] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-900">Live Map</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Available
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span> Dispatched
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span> Active Alarm
          </div>
          <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ml-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {driverList.length} Drivers
          </span>
        </div>
      </div>
      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="w-64 flex flex-col gap-3 overflow-y-auto pr-2">
          {driverList.map(driver => (
            <div 
              key={driver.driverId} 
              className="p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
              onClick={() => {
                if (map) {
                  map.flyTo([driver.lat, driver.lng], Math.max(map.getZoom(), 14), { duration: 1.5 });
                }
              }}
            >
               <div className="font-semibold text-sm text-slate-900">{driver.driverName}</div>
               <div className="flex items-center gap-1.5 mt-1">
                 <span className={`w-2 h-2 rounded-full ${driver.status === 'busy' ? (driver.activeAlarm ? 'bg-amber-500' : 'bg-red-500') : 'bg-emerald-500'}`}></span>
                 <span className="text-xs text-slate-600 capitalize">{driver.status === 'busy' ? (driver.activeAlarm ? 'Dispatched' : 'Busy') : 'Available'}</span>
               </div>
               {driver.activeAlarm && (
                 <div className="mt-2 text-xs bg-white p-1.5 rounded border border-slate-100">
                   <div className="font-medium text-slate-800 truncate">{driver.activeAlarm.client_name}</div>
                   <div className="text-slate-500 truncate text-[10px]">{driver.activeAlarm.address}</div>
                 </div>
               )}
               <div className="text-[10px] text-slate-500 mt-2 flex items-center justify-between">
                 <span>Updated: {new Date(driver.lastUpdated).toLocaleTimeString()}</span>
                 {now - driver.lastUpdated < 5000 && (
                   <span className="text-emerald-600 font-medium animate-pulse">Just now</span>
                 )}
               </div>
            </div>
          ))}
          {driverList.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-4">No active drivers</div>
          )}
        </div>
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 relative z-0">
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} ref={setMap}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {driverList.map((driver) => (
              <React.Fragment key={driver.driverId}>
                <DriverMarker driver={driver} />
                {driver.activeAlarm && driver.activeAlarm.lat && driver.activeAlarm.lng && (
                  <Polyline 
                    positions={[
                      [driver.lat, driver.lng],
                      [driver.activeAlarm.lat, driver.activeAlarm.lng]
                    ]}
                    color="#f59e0b"
                    weight={3}
                    dashArray="5, 10"
                    opacity={0.8}
                  />
                )}
              </React.Fragment>
            ))}
            {activeAlarmsWithLocation.map((alarm) => (
              <AlarmMarker key={`alarm-${alarm.id}`} alarm={alarm} />
            ))}
            <MapBounds drivers={driverList} alarms={activeAlarmsWithLocation} />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
