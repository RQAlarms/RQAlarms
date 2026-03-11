import { useState, useEffect } from 'react';
import { User, Vehicle, Alarm } from '../types';
import { Car, MapPin, Clock, CheckCircle2, AlertCircle, Bell, X } from 'lucide-react';
import FeedbackForm from './FeedbackForm';
import { io } from 'socket.io-client';
import { requestNotificationPermission, showPushNotification } from '../utils/notifications';
import DriverAlarmMap from './DriverAlarmMap';

interface DriverDashboardProps {
  user: User;
}

export default function DriverDashboard({ user }: DriverDashboardProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [notifications, setNotifications] = useState<{id: number, message: string}[]>([]);
  const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
  const [driverStatus, setDriverStatus] = useState<'available' | 'busy'>(user.status || 'available');

  useEffect(() => {
    fetch('/api/vehicles')
      .then(res => res.json())
      .then(setVehicles);

    const storedVehicle = localStorage.getItem('rq_vehicle');
    if (storedVehicle) {
      setSelectedVehicle(JSON.parse(storedVehicle));
    }
  }, []);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (user.id) {
      fetchAlarms();
      
      const socket = io();
      socket.emit('join', `driver_${user.id}`);

      socket.on('new_alarm', (alarm: Alarm) => {
        setAlarms(prev => [alarm, ...prev]);
        const newNotif = {
          id: Date.now(),
          message: `New dispatch: ${alarm.client_name} at ${alarm.address}`
        };
        setNotifications(prev => [...prev, newNotif]);
        
        showPushNotification('New Dispatch', newNotif.message, 'newDispatch');
        
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
        }, 8000);
      });

      socket.on('alarm_cancelled', (alarmId: number) => {
        setAlarms(prev => prev.filter(a => a.id !== alarmId));
        if (activeAlarm?.id === alarmId) {
          setActiveAlarm(null);
        }
        const newNotif = {
          id: Date.now(),
          message: `An alarm has been cancelled by the control room.`
        };
        setNotifications(prev => [...prev, newNotif]);
        
        showPushNotification('Alarm Cancelled', newNotif.message, 'statusUpdates');
        
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
        }, 5000);
      });

      socket.on('driver_status_updated', (data: { status: 'available' | 'busy' }) => {
        setDriverStatus(data.status);
      });

      let watchId: number;
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const newLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
            setDriverLocation(newLoc);
            socket.emit('driver_location_update', {
              driverId: user.id,
              driverName: user.username,
              ...newLoc
            });
          },
          (error) => console.error('Error getting location:', error),
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
      }

      return () => {
        if (watchId) navigator.geolocation.clearWatch(watchId);
        socket.disconnect();
      };
    }
  }, [user.id, activeAlarm]);

  const fetchAlarms = async () => {
    const res = await fetch(`/api/alarms/driver/${user.id}`);
    if (res.ok) {
      setAlarms(await res.json());
    }
  };

  const handleVehicleSelect = (vehicleId: string) => {
    const v = vehicles.find(v => v.id === parseInt(vehicleId));
    if (v) {
      setSelectedVehicle(v);
      localStorage.setItem('rq_vehicle', JSON.stringify(v));
    }
  };

  const handleFeedbackSubmit = () => {
    setActiveAlarm(null);
    setShowConfirmation(true);
    fetchAlarms();
    setTimeout(() => setShowConfirmation(false), 3000);
  };

  if (!selectedVehicle) {
    return (
      <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mt-12">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mb-4">
            <Car size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Select Vehicle</h2>
          <p className="text-slate-500 text-sm mt-1 text-center">Please select your assigned vehicle for this shift.</p>
        </div>
        
        <div className="space-y-4">
          <select
            onChange={(e) => handleVehicleSelect(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 bg-slate-50"
            defaultValue=""
          >
            <option value="" disabled>Select a vehicle...</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.registration}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  if (activeAlarm) {
    return (
      <FeedbackForm 
        alarm={activeAlarm} 
        user={user} 
        vehicle={selectedVehicle} 
        onComplete={handleFeedbackSubmit}
        onCancel={() => setActiveAlarm(null)}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto relative">
      {/* Notifications Container */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
        {notifications.map(notif => (
          <div key={notif.id} className="bg-amber-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slideIn">
            <Bell size={18} />
            <span className="text-sm font-medium">{notif.message}</span>
            <button 
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
              className="ml-2 text-amber-100 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {showConfirmation && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-[bounce_1s_ease-in-out]">
          <CheckCircle2 size={20} />
          <span className="font-medium">Feedback submitted successfully!</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Active Shift</h2>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${driverStatus === 'busy' ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`}></span>
            {driverStatus === 'busy' ? 'Status: Busy (No new dispatches)' : 'Awaiting dispatch'}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
          <Car className="text-slate-400" size={20} />
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Current Vehicle</p>
            <p className="font-bold text-slate-800">{selectedVehicle.registration}</p>
          </div>
          <button 
            onClick={() => {
              setSelectedVehicle(null);
              localStorage.removeItem('rq_vehicle');
            }}
            className="ml-4 text-xs text-emerald-600 hover:text-emerald-700 font-medium underline"
          >
            Change
          </button>
        </div>
      </div>

      <DriverAlarmMap alarms={alarms} driverLocation={driverLocation} />

      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <AlertCircle className="text-amber-500" />
        Dispatched Alarms ({alarms.length})
      </h3>

      <div className="space-y-4">
        {alarms.map(alarm => (
          <div key={alarm.id} className="bg-white border-l-4 border-amber-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                    {alarm.alarm_type || 'Alarm'}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-xl">{alarm.client_name}</h4>
                <p className="text-slate-600 flex items-center gap-1.5 mt-1.5">
                  <MapPin size={16} className="text-slate-400" />
                  {alarm.address}
                </p>
                {alarm.incident_details && (
                  <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900 block mb-1">Incident Details:</span>
                    {alarm.incident_details}
                  </div>
                )}
              </div>
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                <Clock size={12} />
                {new Date(alarm.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            <button
              onClick={() => setActiveAlarm(alarm)}
              className="w-full mt-4 bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} />
              Respond & Submit Feedback
            </button>
          </div>
        ))}

        {alarms.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-medium text-slate-700">No active alarms</h3>
            <p className="text-slate-500 mt-1">You're all caught up. Waiting for control room dispatch.</p>
          </div>
        )}
      </div>
    </div>
  );
}
