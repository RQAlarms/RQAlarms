import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*' }
  });

  // Database setup
  const db = new Database('rq_alarms.db');

  io.on('connection', (socket) => {
    socket.on('join', (room) => {
      socket.join(room);
    });

    socket.on('driver_location_update', (data) => {
      io.to('control_room').emit('driver_location_update', data);
    });
  });

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    );
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration TEXT UNIQUE
    );
    CREATE TABLE IF NOT EXISTS alarms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT,
      address TEXT,
      status TEXT,
      assigned_driver_id INTEGER,
      alarm_type TEXT,
      incident_details TEXT,
      priority TEXT DEFAULT 'medium',
      lat REAL,
      lng REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alarm_id INTEGER,
      driver_id INTEGER,
      vehicle_id INTEGER,
      client_name TEXT,
      address TEXT,
      feedback_text TEXT,
      image_analysis TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.exec('ALTER TABLE alarms ADD COLUMN alarm_type TEXT');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE alarms ADD COLUMN incident_details TEXT');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec("ALTER TABLE alarms ADD COLUMN priority TEXT DEFAULT 'medium'");
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec("ALTER TABLE alarms ADD COLUMN lat REAL");
    db.exec("ALTER TABLE alarms ADD COLUMN lng REAL");
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'available'");
  } catch (e) {
    // Column already exists
  }

  // Insert default users if not exists
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)');
  insertUser.run('admin', 'admin', 'admin');
  insertUser.run('control', 'control', 'control');
  insertUser.run('driver1', 'driver1', 'driver');
  insertUser.run('driver2', 'driver2', 'driver');

  // Insert default vehicles
  const insertVehicle = db.prepare('INSERT OR IGNORE INTO vehicles (registration) VALUES (?)');
  insertVehicle.run('RQ-001');
  insertVehicle.run('RQ-002');

  app.use(express.json());

  // API Routes
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT id, username, role FROM users WHERE username = ? AND password = ?').get(username, password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  // User Management Routes
  app.get('/api/users', (req, res) => {
    const users = db.prepare('SELECT id, username, role, status FROM users').all();
    res.json(users);
  });

  app.post('/api/users', (req, res) => {
    const { username, password, role } = req.body;
    try {
      const info = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, password, role);
      res.json({ id: info.lastInsertRowid, username, role });
    } catch (e) {
      res.status(400).json({ error: 'Username already exists' });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/vehicles', (req, res) => {
    const vehicles = db.prepare('SELECT * FROM vehicles').all();
    res.json(vehicles);
  });

  app.post('/api/vehicles', (req, res) => {
    const { registration } = req.body;
    try {
      const info = db.prepare('INSERT INTO vehicles (registration) VALUES (?)').run(registration);
      res.json({ id: info.lastInsertRowid, registration });
    } catch (e) {
      res.status(400).json({ error: 'Vehicle already exists' });
    }
  });

  app.get('/api/drivers', (req, res) => {
    const drivers = db.prepare("SELECT id, username, role, status FROM users WHERE role = 'driver'").all();
    res.json(drivers);
  });

  app.put('/api/drivers/:id/status', express.json(), (req, res) => {
    const { status } = req.body;
    if (status !== 'available' && status !== 'busy') {
      return res.status(400).json({ error: 'Invalid status' });
    }
    db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, req.params.id);
    io.to('control_room').emit('driver_status_updated', { driverId: req.params.id, status });
    io.to(`driver_${req.params.id}`).emit('driver_status_updated', { status });
    res.json({ success: true });
  });

  app.get('/api/alarms', (req, res) => {
    const alarms = db.prepare(`
      SELECT a.*, u.username as driver_name 
      FROM alarms a 
      LEFT JOIN users u ON a.assigned_driver_id = u.id
      ORDER BY a.created_at DESC
    `).all();
    res.json(alarms);
  });

  app.post('/api/alarms', (req, res) => {
    const { client_name, address, assigned_driver_id, alarm_type, incident_details, priority, lat, lng } = req.body;
    const status = assigned_driver_id ? 'dispatched' : 'pending';
    const driverId = assigned_driver_id || null;
    
    const info = db.prepare("INSERT INTO alarms (client_name, address, status, assigned_driver_id, alarm_type, incident_details, priority, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(client_name, address, status, driverId, alarm_type || 'Alarm', incident_details || '', priority || 'medium', lat || null, lng || null);
    
    const newAlarm = db.prepare(`
      SELECT a.*, u.username as driver_name 
      FROM alarms a 
      LEFT JOIN users u ON a.assigned_driver_id = u.id
      WHERE a.id = ?
    `).get(info.lastInsertRowid);

    if (driverId) {
      io.to(`driver_${driverId}`).emit('new_alarm', newAlarm);
    }
    io.to('control_room').emit('alarm_status_updated', {
      message: `New alarm created for ${client_name} (${status})`
    });
    io.to('control_room').emit('alarms_updated');

    res.json({ id: info.lastInsertRowid });
  });

  app.post('/api/alarms/:id/assign', (req, res) => {
    const { driver_id } = req.body;
    db.prepare("UPDATE alarms SET status = 'dispatched', assigned_driver_id = ? WHERE id = ?").run(driver_id, req.params.id);
    
    const newAlarm = db.prepare(`
      SELECT a.*, u.username as driver_name 
      FROM alarms a 
      LEFT JOIN users u ON a.assigned_driver_id = u.id
      WHERE a.id = ?
    `).get(req.params.id);

    io.to(`driver_${driver_id}`).emit('new_alarm', newAlarm);
    io.to('control_room').emit('alarm_status_updated', {
      message: `Alarm for ${newAlarm.client_name} dispatched to ${newAlarm.driver_name}`
    });
    io.to('control_room').emit('alarms_updated');

    res.json({ success: true });
  });

  app.post('/api/alarms/:id/cancel', (req, res) => {
    const alarm = db.prepare("SELECT * FROM alarms WHERE id = ?").get(req.params.id) as any;
    db.prepare("UPDATE alarms SET status = 'cancelled' WHERE id = ?").run(req.params.id);
    
    if (alarm) {
      io.to(`driver_${alarm.assigned_driver_id}`).emit('alarm_cancelled', alarm.id);
      io.to('control_room').emit('alarm_status_updated', {
        message: `Alarm for ${alarm.client_name} was cancelled`
      });
    }
    io.to('control_room').emit('alarms_updated');

    res.json({ success: true });
  });

  app.get('/api/alarms/driver/:driverId', (req, res) => {
    const alarms = db.prepare("SELECT * FROM alarms WHERE assigned_driver_id = ? AND status = 'dispatched' ORDER BY created_at DESC")
      .all(req.params.driverId);
    res.json(alarms);
  });

  app.post('/api/feedbacks', (req, res) => {
    const { alarm_id, driver_id, vehicle_id, client_name, address, feedback_text, image_analysis } = req.body;
    
    const insertFeedback = db.prepare(`
      INSERT INTO feedbacks (alarm_id, driver_id, vehicle_id, client_name, address, feedback_text, image_analysis)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const updateAlarm = db.prepare("UPDATE alarms SET status = 'completed' WHERE id = ?");

    const transaction = db.transaction(() => {
      insertFeedback.run(alarm_id, driver_id, vehicle_id, client_name, address, feedback_text, image_analysis);
      updateAlarm.run(alarm_id);
    });
    
    transaction();
    
    io.to('control_room').emit('new_feedback', { client_name, address });
    io.to('control_room').emit('alarms_updated');

    res.json({ success: true });
  });

  app.get('/api/reports', (req, res) => {
    const reports = db.prepare(`
      SELECT f.*, u.username as driver_name, v.registration as vehicle_registration
      FROM feedbacks f
      LEFT JOIN users u ON f.driver_id = u.id
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      ORDER BY f.created_at DESC
    `).all();
    res.json(reports);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
