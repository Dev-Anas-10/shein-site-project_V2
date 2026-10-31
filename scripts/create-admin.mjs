import { randomUUID } from 'node:crypto';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ max: 2, application_name: 'shein-admin-setup' });
let client;

async function readPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!stdin.isTTY) throw new Error('Set ADMIN_PASSWORD when running without an interactive terminal.');

  stdout.write('Admin password (12+ characters): ');
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (buffer) => {
      const char = buffer.toString('utf8');
      if (char === '\u0003') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off('data', onData);
        stdout.write('\n');
        reject(new Error('Cancelled.'));
      } else if (char === '\r' || char === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off('data', onData);
        stdout.write('\n');
        resolve(value);
      } else if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1);
      } else if (char >= ' ') {
        value += char;
      }
    };
    stdin.on('data', onData);
  });
}

try {
  const prompts = readline.createInterface({ input: stdin, output: stdout });
  const name = (process.env.ADMIN_NAME || await prompts.question('Admin name: ')).trim();
  const email = (process.env.ADMIN_EMAIL || await prompts.question('Admin email: ')).trim().toLowerCase();
  prompts.close();

  if (!name || !email.includes('@')) throw new Error('A name and valid email address are required.');
  const password = await readPassword();
  if (password.length < 12) throw new Error('Use an admin password with at least 12 characters.');
  const passwordHash = await bcrypt.hash(password, 12);

  client = await pool.connect();
  await client.query('BEGIN');
  const result = await client.query('SELECT state FROM public.app_state WHERE id = 1 FOR UPDATE');
  if (!result.rowCount) throw new Error('PostgreSQL state is missing. Run npm run db:bootstrap first.');

  const state = result.rows[0].state;
  state.users = Array.isArray(state.users) ? state.users : [];
  const existing = state.users.find((user) => user.email?.toLowerCase() === email);
  const now = new Date().toISOString();
  if (existing) {
    existing.name = name;
    existing.email = email;
    existing.password = passwordHash;
    existing.role = 'admin';
    existing.lastLoginAt = now;
  } else {
    state.users.push({
      id: `admin-${randomUUID()}`,
      name,
      email,
      password: passwordHash,
      role: 'admin',
      phone: '',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      createdAt: now,
    });
  }

  await client.query('UPDATE public.app_state SET state = $1::jsonb, updated_at = NOW() WHERE id = 1', [JSON.stringify(state)]);
  await client.query('COMMIT');
  console.log(`Admin account is ready for ${email}.`);
} catch (error) {
  await client?.query('ROLLBACK').catch(() => {});
  console.error('Could not create the admin account:', error.message);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
