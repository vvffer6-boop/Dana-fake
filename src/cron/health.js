export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Cron endpoint alive',
    uptime: process.uptime ? process.uptime() : 0
  });
}