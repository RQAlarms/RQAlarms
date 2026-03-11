import React, { useState, useEffect } from 'react';
import { Vehicle, User, Alarm, Feedback } from '../types';
import { Plus, Car, ShieldCheck, Users, AlertTriangle, MapPin, Clock, CheckCircle2, X, UserPlus, Trash2, Bell, Map as MapIcon } from 'lucide-react';
import AddressAutocomplete from './AddressAutocomplete';
import { io } from 'socket.io-client';
import DriverMap from './DriverMap';
import { requestNotificationPermission, showPushNotification } from '../utils/notifications';

interface Props {
  user: User;
}

export default function AdminDashboard({ user }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [reports, setReports] = useState<Feedback[]>([]);
  const [activeTab, setActiveTab] = useState<'dispatch' | 'map' | 'reports' | 'vehicles' | 'users'>('map');
  const [notifications, setNotifications] = useState<{id: number, message: string}[]>([]);
  const [driverLocations, setDriverLocations] = useState<Record<number, any>>({});

  const [newVehicle, setNewVehicle] = useState('');
  const [newAlarm, setNewAlarm] = useState({ client_name: '', address: '', assigned_driver_id: '', alarm_type: 'Alarm', incident_details: '', priority: 'medium', lat: undefined as number | undefined, lng: undefined as number | undefined });
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'driver' });
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'dispatched' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    fetchData();

    const socket = io();
    socket.emit('join', 'control_room');

    socket.on('alarms_updated', () => {
      fetchData();
    });

    socket.on('alarm_status_updated', (data: { message: string }) => {
      const newNotif = {
        id: Date.now(),
        message: data.message
      };
      setNotifications(prev => [...prev, newNotif]);
      
      showPushNotification('Status Update', newNotif.message, 'statusUpdates');
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 5000);
    });

    socket.on('new_feedback', (data: { client_name: string, address: string }) => {
      const newNotif = {
        id: Date.now(),
        message: `New feedback submitted for ${data.client_name} at ${data.address}`
      };
      setNotifications(prev => [...prev, newNotif]);
      
      showPushNotification('Alarm Resolved', newNotif.message, 'feedback');
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 5000);
    });

    socket.on('driver_location_update', (data: { driverId: number, driverName: string, lat: number, lng: number }) => {
      setDriverLocations(prev => ({
        ...prev,
        [data.driverId]: {
          ...data,
          lastUpdated: Date.now()
        }
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchData = async () => {
    const [vehRes, drvRes, almRes, repRes, usersRes] = await Promise.all([
      fetch('/api/vehicles'),
      fetch('/api/drivers'),
      fetch('/api/alarms'),
      fetch('/api/reports'),
      fetch('/api/users')
    ]);
    setVehicles(await vehRes.json());
    setDrivers(await drvRes.json());
    setAlarms(await almRes.json());
    setReports(await repRes.json());
    setAllUsers(await usersRes.json());
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle) return;
    const res = await fetch('/api/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration: newVehicle })
    });
    if (res.ok) {
      setNewVehicle('');
      fetchData();
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    if (res.ok) {
      setNewUser({ username: '', password: '', role: 'driver' });
      fetchData();
    } else {
      alert('Failed to add user. Username might already exist.');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      fetchData();
    }
  };

  const handleDispatchAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlarm.client_name || !newAlarm.address) return;
    
    const res = await fetch('/api/alarms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAlarm)
    });
    if (res.ok) {
      setNewAlarm({ client_name: '', address: '', assigned_driver_id: '', alarm_type: 'Alarm', incident_details: '', priority: 'medium', lat: undefined, lng: undefined });
      fetchData();
    }
  };

  const handleAssignDriver = async (alarmId: number, driverId: string) => {
    const res = await fetch(`/api/alarms/${alarmId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_id: driverId })
    });
    if (res.ok) {
      fetchData();
    }
  };

  const handleUpdateDriverStatus = async (driverId: number, status: 'available' | 'busy') => {
    const res = await fetch(`/api/drivers/${driverId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      fetchData();
    }
  };

  const handleCancelAlarm = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this alarm?')) return;
    const res = await fetch(`/api/alarms/${id}/cancel`, {
      method: 'POST',
    });
    if (res.ok) {
      fetchData();
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Notifications Container */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
        {notifications.map(notif => (
          <div key={notif.id} className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slideIn">
            <Bell size={18} className="text-emerald-400" />
            <span className="text-sm font-medium">{notif.message}</span>
            <button 
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
              className="ml-2 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Control Room</h2>
          <p className="text-slate-500 mt-1">Manage dispatch, vehicles, and view reports.</p>
        </div>
        <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
          {['admin', 'control', 'supervisor'].includes(user.role) && (
            <button
              onClick={() => setActiveTab('dispatch')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'dispatch' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Dispatch
            </button>
          )}
          <button
            onClick={() => setActiveTab('map')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'map' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <MapIcon size={16} /> Map
          </button>
          {['admin', 'control', 'supervisor'].includes(user.role) && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'reports' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Reports
            </button>
          )}
          {['admin', 'control', 'supervisor', 'technician'].includes(user.role) && (
            <button
              onClick={() => setActiveTab('vehicles')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'vehicles' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Vehicles
            </button>
          )}
          {['admin', 'supervisor'].includes(user.role) && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Users
            </button>
          )}
        </div>
      </div>

      {activeTab === 'map' && (
        <DriverMap locations={driverLocations} alarms={alarms} drivers={drivers} />
      )}

      {activeTab === 'dispatch' && ['admin', 'control', 'supervisor'].includes(user.role) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">New Dispatch</h3>
                  <p className="text-sm text-slate-500">Create and assign a new alarm</p>
                </div>
              </div>
              <form onSubmit={handleDispatchAlarm} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Client Name</label>
                <input
                  type="text"
                  value={newAlarm.client_name}
                  onChange={(e) => setNewAlarm({ ...newAlarm, client_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50"
                  placeholder="e.g. Acme Corp"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Address</span>
                  <span className="text-xs text-emerald-600 flex items-center gap-1"><MapPin size={12}/> AI Search</span>
                </label>
                <AddressAutocomplete 
                  value={newAlarm.address}
                  onChange={(val, lat, lng) => setNewAlarm({ ...newAlarm, address: val, lat, lng })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Alarm Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Alarm', 'Panic', 'Drive By'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewAlarm({ ...newAlarm, alarm_type: type })}
                      className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${
                        newAlarm.alarm_type === type 
                          ? 'bg-slate-900 text-white border-slate-900' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority Level</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'low', color: 'bg-slate-100 text-slate-600' },
                    { id: 'medium', color: 'bg-blue-100 text-blue-600' },
                    { id: 'high', color: 'bg-amber-100 text-amber-600' },
                    { id: 'critical', color: 'bg-red-100 text-red-600' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setNewAlarm({ ...newAlarm, priority: p.id })}
                      className={`py-2 px-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all ${
                        newAlarm.priority === p.id 
                          ? `${p.color} border-current ring-1 ring-current` 
                          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {p.id}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Incident Details (Optional)</label>
                <textarea
                  value={newAlarm.incident_details}
                  onChange={(e) => setNewAlarm({ ...newAlarm, incident_details: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50 resize-none h-24"
                  placeholder="e.g. Suspect seen near back entrance..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign Driver (Optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users size={18} className="text-slate-400" />
                  </div>
                  <select
                    value={newAlarm.assigned_driver_id}
                    onChange={(e) => setNewAlarm({ ...newAlarm, assigned_driver_id: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50 appearance-none"
                  >
                    <option value="">None (Pending)</option>
                    {drivers.filter(d => {
                      const hasActiveAlarm = alarms.some(a => a.assigned_driver_id === d.id && a.status === 'dispatched');
                      return d.status !== 'busy' && !hasActiveAlarm;
                    }).map(d => (
                      <option key={d.id} value={d.id}>{d.username}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <ShieldCheck size={18} />
                  Dispatch Alarm Now
                </button>
              </div>
            </form>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Driver Status</h3>
                  <p className="text-sm text-slate-500">Manage driver availability</p>
                </div>
              </div>
              <div className="space-y-3">
                {drivers.map(driver => {
                  const hasActiveAlarm = alarms.some(a => a.assigned_driver_id === driver.id && a.status === 'dispatched');
                  const isBusy = driver.status === 'busy' || hasActiveAlarm;
                  
                  return (
                    <div key={driver.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="font-medium text-slate-800">{driver.username}</span>
                      <select
                        value={isBusy ? 'busy' : 'available'}
                        onChange={(e) => handleUpdateDriverStatus(driver.id, e.target.value as 'available' | 'busy')}
                        disabled={hasActiveAlarm}
                        className={`text-xs font-bold uppercase tracking-wider rounded-lg px-2 py-1.5 outline-none border ${
                          isBusy 
                            ? 'bg-red-50 text-red-700 border-red-200 focus:ring-red-500' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-500'
                        } ${hasActiveAlarm ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        <option value="available">Available</option>
                        <option value="busy">{hasActiveAlarm ? 'Dispatched' : 'Busy'}</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-slate-900">Dispatch Queue</h3>
                <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                  {alarms.length} Total
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                {['all', 'pending', 'dispatched', 'completed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      statusFilter === status 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-4 pb-2 font-semibold">Priority</th>
                    <th className="px-4 pb-2 font-semibold">Client & Address</th>
                    <th className="px-4 pb-2 font-semibold">Type & Driver</th>
                    <th className="px-4 pb-2 font-semibold">Status</th>
                    <th className="px-4 pb-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {alarms
                    .filter(a => statusFilter === 'all' || a.status === statusFilter)
                    .map(alarm => (
                    <tr key={alarm.id} className="group bg-white hover:bg-slate-50 transition-colors border border-slate-100 shadow-sm rounded-xl">
                      <td className="px-4 py-4 first:rounded-l-xl">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          alarm.priority === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                          alarm.priority === 'high' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          alarm.priority === 'medium' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          {alarm.priority || 'medium'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-900">{alarm.client_name}</div>
                        <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                          <MapPin size={10} className="shrink-0" />
                          <span className="truncate max-w-[180px]">{alarm.address}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                            {alarm.alarm_type || 'Alarm'}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                            <Users size={10} className="text-slate-500" />
                            {alarm.driver_name || 'Unassigned'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-tight ${
                          alarm.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                          alarm.status === 'cancelled' ? 'bg-slate-100 text-slate-500' :
                          alarm.status === 'pending' ? 'bg-red-100 text-red-700 animate-pulse' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {alarm.status === 'dispatched' ? 'Active' : alarm.status === 'completed' ? 'Resolved' : alarm.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right last:rounded-r-xl">
                        <div className="flex items-center justify-end gap-2">
                          {alarm.status === 'pending' && (
                            <select
                              onChange={(e) => handleAssignDriver(alarm.id, e.target.value)}
                              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-medium"
                              defaultValue=""
                            >
                              <option value="" disabled>Assign Driver</option>
                              {drivers.filter(d => {
                                const hasActiveAlarm = alarms.some(a => a.assigned_driver_id === d.id && a.status === 'dispatched');
                                return d.status !== 'busy' && !hasActiveAlarm;
                              }).map(d => (
                                <option key={d.id} value={d.id}>{d.username}</option>
                              ))}
                            </select>
                          )}
                          {(alarm.status === 'pending' || alarm.status === 'dispatched') && (
                            <button
                              onClick={() => handleCancelAlarm(alarm.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Cancel Alarm"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {alarms.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                          <ShieldCheck size={32} className="text-slate-300 mb-3" />
                          <p>No alarms currently in the system</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && ['admin', 'control', 'supervisor'].includes(user.role) && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Call Out Reports</h3>
          <div className="space-y-6">
            {reports.map(report => (
              <div key={report.id} className="border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">{report.client_name}</h4>
                    <p className="text-slate-600 text-sm mt-1">{report.address}</p>
                  </div>
                  <div className="flex flex-col items-end text-sm text-slate-500">
                    <span>{new Date(report.created_at).toLocaleString()}</span>
                    <div className="flex gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs font-medium text-slate-700">
                        <Users size={12} /> {report.driver_name}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs font-medium text-slate-700">
                        <Car size={12} /> {report.vehicle_registration}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Officer Feedback</h5>
                  <p className="text-slate-800 whitespace-pre-wrap text-sm">{report.feedback_text}</p>
                </div>

                {report.image_analysis && (
                  <div className="mt-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                    <h5 className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <ShieldCheck size={14} /> AI Image Analysis
                    </h5>
                    <p className="text-indigo-900 whitespace-pre-wrap text-sm">{report.image_analysis}</p>
                  </div>
                )}
              </div>
            ))}
            {reports.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                No reports available yet.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'vehicles' && ['admin', 'control', 'supervisor', 'technician'].includes(user.role) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <Car className="text-slate-700" />
              <h3 className="text-lg font-semibold text-slate-800">Add New Vehicle</h3>
            </div>
            <form onSubmit={handleAddVehicle} className="flex gap-3">
              <input
                type="text"
                value={newVehicle}
                onChange={(e) => setNewVehicle(e.target.value)}
                placeholder="Registration (e.g. RQ-003)"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
              <button
                type="submit"
                className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <Plus size={18} /> Add
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Fleet List</h3>
            <ul className="space-y-3">
              {vehicles.map(v => (
                <li key={v.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600">
                    <Car size={16} />
                  </div>
                  <span className="font-medium text-slate-800">{v.registration}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'users' && ['admin', 'supervisor'].includes(user.role) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <UserPlus className="text-slate-700" />
              <h3 className="text-lg font-semibold text-slate-800">Add New User</h3>
            </div>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                >
                  <option value="driver">Driver</option>
                  <option value="control">Control Room</option>
                  <option value="technician">Technician</option>
                  <option value="supervisor">Supervisor</option>
                  {user.role === 'admin' && <option value="admin">Admin</option>}
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Add User
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">User List</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-sm text-slate-500">
                    <th className="pb-3 font-medium">Username</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {allUsers.map(u => (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-4 font-medium text-slate-800">{u.username}</td>
                      <td className="py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                          u.role === 'supervisor' ? 'bg-indigo-100 text-indigo-700' :
                          u.role === 'technician' ? 'bg-orange-100 text-orange-700' :
                          u.role === 'control' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {u.id !== user.id && (user.role === 'admin' || (user.role === 'supervisor' && u.role !== 'admin')) && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
