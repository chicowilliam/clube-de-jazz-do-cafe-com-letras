export default {
  async scheduled() {
    const response = await fetch('https://clubedejazzdocafe.com/api/youtube?feed=statistics', {
      method: 'POST',
    });
    if (!response.ok) throw new Error(`YouTube statistics refresh failed (HTTP ${response.status})`);
    await response.body?.cancel();
  },
};
