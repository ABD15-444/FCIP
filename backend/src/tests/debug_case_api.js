const db = require('../config/db');
const jwt = require('jsonwebtoken');
const http = require('http');

async function test() {
  const compUser = await db.query("SELECT * FROM users WHERE role = 'compliance_officer' LIMIT 1");
  const token = jwt.sign(
    { id: compUser.rows[0].id, email: compUser.rows[0].email, role: compUser.rows[0].role },
    process.env.JWT_SECRET || 'fcip_development_jwt_secret_key_2026',
    { expiresIn: '1h' }
  );

  function get(path) {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 5000,
        path: path,
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      });
      req.end();
    });
  }

  const r1 = await get('/api/cases');
  console.log('GET /api/cases ->', r1.status);
  try {
    const json = JSON.parse(r1.body);
    console.log('Success:', json.success, 'Count:', json.count);
    if (json.cases && json.cases.length > 0) {
      console.log('First case:', json.cases[0].id, json.cases[0].title);
      const r2 = await get('/api/cases/' + json.cases[0].id);
      console.log('GET /api/cases/' + json.cases[0].id + ' ->', r2.status);
      console.log('Case Detail Body:', r2.body.substring(0, 300));
    }
  } catch (e) {
    console.log('Error parsing response:', r1.body);
  }

  process.exit(0);
}
test();
