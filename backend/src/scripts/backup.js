const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const backupDir = path.join(__dirname, '../../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `fcip_db_pre_demo_backup_${timestamp}.sql`);
const latestFile = path.join(backupDir, 'fcip_db_pre_demo_backup_latest.sql');

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || '5432';
const user = process.env.DB_USER || 'postgres';
const password = process.env.DB_PASSWORD || '12345';
const database = process.env.DB_NAME || 'fcip_db';

console.log(`Starting PostgreSQL backup of '${database}' at ${host}:${port}...`);

try {
  process.env.PGPASSWORD = password;
  const cmd = `pg_dump -h ${host} -p ${port} -U ${user} -F p -b -v -f "${backupFile}" ${database}`;
  execSync(cmd, { stdio: 'inherit' });
  fs.copyFileSync(backupFile, latestFile);
  console.log(`✓ Backup successfully created at: ${backupFile}`);
  console.log(`✓ Copied to: ${latestFile}`);
} catch (error) {
  console.error('Failed to create database backup via pg_dump:', error.message);
  process.exit(1);
}
