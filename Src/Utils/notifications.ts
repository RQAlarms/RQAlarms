export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

export const showPushNotification = async (title: string, body: string, type: 'newDispatch' | 'statusUpdates' | 'feedback' = 'statusUpdates') => {
  const stored = localStorage.getItem('rq_notification_prefs');
  let prefs = {
    soundEnabled: true,
    pushEnabled: true,
    alertTypes: {
      newDispatch: true,
      statusUpdates: true,
      feedback: true,
    }
  };
  
  if (stored) {
    try {
      prefs = { ...prefs, ...JSON.parse(stored) };
    } catch (e) {}
  }

  if (!prefs.pushEnabled) return;
  if (!prefs.alertTypes[type]) return;

  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  const options = {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200]
  };

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, options);
  } catch (e) {
    try {
      new Notification(title, options);
    } catch (err) {
      console.error('Failed to show notification', err);
    }
  }
  
  // Also play a sound
  if (prefs.soundEnabled) {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      await audio.play();
    } catch (e) {
      // Ignore audio play errors (e.g., user hasn't interacted with document)
    }
  }
};
