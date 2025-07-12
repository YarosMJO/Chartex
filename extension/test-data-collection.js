// Тестовий скрипт для перевірки збору та відправки даних
console.log('=== ТЕСТ ЗБОРУ ДАНИХ ===');

// Перевірити доступ до історії
chrome.history.search({
  text: '',
  startTime: Date.now() - 24 * 60 * 60 * 1000, // Останні 24 години
  maxResults: 10
}, (results) => {
  console.log('Результати пошуку історії:', results);
  
  if (results.length > 0) {
    console.log('Перший запис історії:', results[0]);
    
    // Тестувати обробку запису
    const testItem = results[0];
    console.log('Тестовий запис для обробки:', {
      url: testItem.url,
      title: testItem.title,
      lastVisitTime: testItem.lastVisitTime,
      visitCount: testItem.visitCount
    });
  } else {
    console.log('Історія браузера порожня');
  }
});

// Перевірити збережені дані
chrome.storage.local.get(['deviceId', 'encryptionKey', 'user'], (data) => {
  console.log('Збережені дані:', {
    hasDeviceId: !!data.deviceId,
    hasEncryptionKey: !!data.encryptionKey,
    hasUser: !!data.user,
    userEmail: data.user?.email
  });
});

// Перевірити статус збору
chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
  console.log('Статус збору даних:', response);
});

console.log('=== КІНЕЦЬ ТЕСТУ ==='); 