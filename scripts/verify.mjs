#!/usr/bin/env node
// Verificación completa del proyecto con un solo comando (Windows, macOS o Linux):
//
//   node scripts/verify.mjs
//
// Levanta el entorno con Docker Compose y ejecuta, en orden: tipos, lint, formato y pruebas de la
// API; tipos y pruebas de la Lambda; build de la web; auditoría de dependencias; smoke test
// (web → API → Lambda → BD); prueba de la interfaz en un navegador real; pruebas e2e de la API; y
// validación de la infraestructura AWS. Termina con un resumen y código ≠ 0 si algo falla. El
// detalle de cada paso queda en .verify-logs/.
//
// Requisitos: Docker con Compose v2 y Node.js 22+. Opcionales (si faltan, el paso se omite):
// bash + curl para el smoke test (en Windows, Git Bash), Chrome, Edge o Chromium para la prueba de
// interfaz (BROWSER_PATH para otra ruta) y AWS SAM CLI para validar la plantilla.
//
// Las pruebas e2e y de interfaz crean datos en la base de datos local; `docker compose down -v`
// la reinicia.

import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = join(ROOT, '.verify-logs');
const IS_WINDOWS = process.platform === 'win32';

const OPTIONS = {
  '--no-build': 'no ejecuta `docker compose up -d --build`: usa el entorno ya levantado',
  '--reinstall': 'fuerza `npm ci` en cada paquete aunque sus dependencias estén al día',
  '--skip-ui': 'omite la prueba de la interfaz en el navegador',
};

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log('Uso: node scripts/verify.mjs [opciones]\n');
  for (const [flag, text] of Object.entries(OPTIONS)) console.log(`  ${flag.padEnd(13)} ${text}`);
  process.exit(0);
}
const unknown = argv.filter((arg) => !(arg in OPTIONS));
if (unknown.length > 0) {
  console.error(`Opción desconocida: ${unknown.join(' ')} (usa --help)`);
  process.exit(2);
}
const flags = new Set(argv);

// Mismo orden de prioridad que Docker Compose: variable de entorno → .env de la raíz → valor por
// defecto de docker-compose.yml.
const dotEnvPath = join(ROOT, '.env');
const dotEnv = existsSync(dotEnvPath) ? parseEnv(readFileSync(dotEnvPath, 'utf8')) : {};
const setting = (name, fallback) => process.env[name] || dotEnv[name] || fallback;

const BASE_URL = process.env.BASE_URL || `http://localhost:${setting('WEB_PORT', '8080')}`;
const ADMIN_PASSWORD = setting('SEED_ADMIN_PASSWORD', 'Admin123!');
const DATABASE_URL = `postgres://app:${encodeURIComponent(setting('POSTGRES_PASSWORD', 'app'))}@localhost:${setting('DB_PORT', '5432')}/portal`;

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

/** Ejecuta un comando con la shell del sistema; su salida va al registro del paso. */
function exec(command, { cwd = ROOT, env = {}, log } = {}) {
  return new Promise((done) => {
    log?.write(`$ ${command}\n`);
    const child = spawn(command, {
      cwd,
      env: { ...process.env, ...env },
      shell: true,
      windowsHide: true,
      stdio: ['ignore', log ? 'pipe' : 'ignore', log ? 'pipe' : 'ignore'],
    });
    if (log) {
      child.stdout.pipe(log, { end: false });
      child.stderr.pipe(log, { end: false });
    }
    child.on('error', (error) => {
      log?.write(`${error.message}\n`);
      done(127);
    });
    child.on('close', (code) => done(code ?? 1));
  });
}

const available = async (command) => (await exec(command)) === 0;

const ok = (note) => ({ status: 'ok', note });
const fail = (note) => ({ status: 'fail', note });
const skip = (note) => ({ status: 'skip', note });

/** Paso que consiste en un comando: OK si termina con código 0. */
const command =
  (cmd, options = {}) =>
  async (log) =>
    (await exec(cmd, { ...options, log })) === 0 ? ok() : fail();

const slug = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function printTail(path, lines = 25) {
  const tail = readFileSync(path, 'utf8')
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
    .trimEnd()
    .split(/\r?\n/)
    .slice(-lines);
  console.log(tail.map((line) => `      │ ${line}`).join('\n'));
}

const results = [];
const startedAt = Date.now();

/** Ejecuta un paso: en consola solo queda su resultado; el detalle, en .verify-logs/. */
async function step(name, action) {
  const logPath = join(LOG_DIR, `${String(results.length + 1).padStart(2, '0')}-${slug(name)}.log`);
  const log = createWriteStream(logPath);
  process.stdout.write(`  ${name} … `);
  const started = Date.now();
  let outcome;
  try {
    outcome = await action(log);
  } catch (error) {
    log.write(`${error?.stack ?? error}\n`);
    outcome = fail(error?.message);
  }
  await new Promise((done) => log.end(done));
  const seconds = Math.round((Date.now() - started) / 1000);
  const label = { ok: 'OK', fail: 'FALLO', skip: 'OMITIDO' }[outcome.status];
  console.log(`${label} (${seconds} s)${outcome.note ? ` · ${outcome.note}` : ''}`);
  if (outcome.status === 'fail') printTail(logPath);
  results.push({ name, ...outcome, log: relative(ROOT, logPath) });
  return outcome.status;
}

const section = (title) => console.log(`\n${title}`);

function finish() {
  const count = (status) => results.filter((result) => result.status === status).length;
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `\nResumen: ${count('ok')} OK · ${count('fail')} fallos · ${count('skip')} omitidos · ` +
      `${Math.floor(seconds / 60)} min ${seconds % 60} s`,
  );
  for (const result of results.filter((r) => r.status !== 'ok')) {
    const detail = result.status === 'fail' ? ` → ${result.log}` : '';
    console.log(`  ${result.status === 'fail' ? 'FALLO  ' : 'OMITIDO'}  ${result.name}${result.note ? ` · ${result.note}` : ''}${detail}`);
  }
  console.log(count('fail') > 0 ? '\nVerificación con fallos.' : '\nVerificación completa: todo en orden.');
  process.exit(count('fail') > 0 ? 1 : 0);
}

async function waitForHealth(log, timeoutSeconds = 180) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
      const body = await response.text();
      log.write(`${response.status} ${body}\n`);
      if (response.ok && body.includes('"db":"ok"')) return ok(BASE_URL);
    } catch (error) {
      log.write(`${error.message}\n`);
    }
    await new Promise((done) => setTimeout(done, 2000));
  }
  return fail(`${BASE_URL}/api/health no respondió en ${timeoutSeconds} s`);
}

/** npm ci si faltan las dependencias o el package-lock.json cambió desde la última instalación. */
function install(dir) {
  return async (log) => {
    const marker = join(ROOT, dir, 'node_modules', '.package-lock.json');
    const upToDate =
      !flags.has('--reinstall') &&
      existsSync(marker) &&
      statSync(join(ROOT, dir, 'package-lock.json')).mtimeMs <= statSync(marker).mtimeMs;
    return upToDate ? ok('ya instaladas') : command('npm ci --no-audit --no-fund', { cwd: join(ROOT, dir) })(log);
  };
}

/**
 * bash para smoke.sh y `bash -n`. En Windows solo se usa Git Bash: el bash.exe de System32 abre
 * WSL, que no tiene por qué tener curl ni ver los puertos de Docker Desktop.
 */
async function findBash() {
  if (!IS_WINDOWS) return (await available('bash --version')) ? 'bash' : null;
  const bases = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs'),
  ];
  const found = bases
    .filter(Boolean)
    .map((base) => join(base, 'Git', 'bin', 'bash.exe'))
    .find((path) => existsSync(path));
  return found ? `"${found}"` : null;
}

// ---------------------------------------------------------------------------------------------
// Pasos
// ---------------------------------------------------------------------------------------------

rmSync(LOG_DIR, { recursive: true, force: true });
mkdirSync(LOG_DIR, { recursive: true });
console.log(`Verificación completa del proyecto · ${BASE_URL}`);

section('Requisitos');
const nodeMajor = Number(process.versions.node.split('.')[0]);
const nodeStatus = await step('Node.js 22 o superior', async () =>
  nodeMajor >= 22 ? ok(`v${process.versions.node}`) : fail(`v${process.versions.node}`),
);
const dockerStatus = await step('Docker con Compose v2', command('docker compose version'));
if (nodeStatus !== 'ok' || dockerStatus !== 'ok') finish();

section('Entorno local');
if (!flags.has('--no-build')) {
  console.log('  (la primera vez descarga imágenes y compila: puede tardar varios minutos)');
  await step('docker compose up -d --build', command('docker compose up -d --build'));
}
const envReady = (await step('API y base de datos responden', waitForHealth)) === 'ok';

section('Dependencias de Node');
const packages = ['api', 'lambda/metrics', 'web', ...(flags.has('--skip-ui') ? [] : ['tests/ui'])];
for (const dir of packages) {
  await step(`npm ci · ${dir}`, install(dir));
}

section('API (NestJS)');
const api = { cwd: join(ROOT, 'api') };
await step('API · tipos', command('npx tsc --noEmit', api));
await step('API · lint', command('npx eslint "{src,test}/**/*.ts"', api));
await step('API · formato', command('npx prettier --check "src/**/*.ts" "test/**/*.ts"', api));
await step('API · pruebas unitarias', command('npx jest', api));
await step('API · auditoría de dependencias', command('npm audit --omit=dev --audit-level=high', api));

section('Lambda de métricas');
const lambda = { cwd: join(ROOT, 'lambda', 'metrics') };
await step('Lambda · tipos', command('npm run typecheck', lambda));
await step('Lambda · pruebas', command('npm test', lambda));
await step('Lambda · auditoría de dependencias', command('npm audit --omit=dev --audit-level=high', lambda));

section('Web (React)');
const web = { cwd: join(ROOT, 'web') };
await step('Web · tipos y build', command('npm run build', web));
await step('Web · auditoría de dependencias', command('npm audit --omit=dev --audit-level=high', web));

section('Integración (con el entorno levantado)');
const bash = await findBash();
const notReady = skip('el entorno no está levantado');
await step('Smoke test (web → API → Lambda → BD)', async (log) => {
  if (!envReady) return notReady;
  if (!bash) return skip('necesita bash + curl (en Windows, Git Bash)');
  return command(`${bash} scripts/smoke.sh`, { env: { BASE_URL, ADMIN_PASSWORD } })(log);
});
await step('Interfaz en navegador real', async (log) => {
  if (flags.has('--skip-ui')) return skip('--skip-ui');
  if (!envReady) return notReady;
  const code = await exec('node ui-check.mjs', {
    cwd: join(ROOT, 'tests', 'ui'),
    env: { BASE_URL, ADMIN_PASSWORD, SCREENSHOT_PATH: join(LOG_DIR, 'ui-check-error.png') },
    log,
  });
  if (code === 2) return skip('no se encontró Chrome, Edge ni Chromium (define BROWSER_PATH)');
  return code === 0 ? ok() : fail();
});
await step('API · pruebas e2e (contra la BD local)', async (log) => {
  if (!envReady) return notReady;
  return command('npm run test:e2e', { ...api, env: { DATABASE_URL } })(log);
});

section('Infraestructura AWS (sin cuenta)');
await step(
  'Compose de EC2 (docker compose config)',
  command('docker compose -f infra/ec2/docker-compose.yml config --quiet', {
    env: {
      POSTGRES_PASSWORD: 'verify-password',
      JWT_SECRET: 'verify-secret',
      SEED_ADMIN_PASSWORD: 'verify-admin',
      SEED_USER_PASSWORD: 'verify-user',
      METRICS_FUNCTION_NAME: 'verify-metrics',
      AWS_REGION: 'us-east-1',
    },
  }),
);
await step('Sintaxis de los scripts bash', async (log) => {
  if (!bash) return skip('necesita bash (en Windows, Git Bash)');
  const scripts = ['smoke.sh', 'deploy.sh', 'teardown.sh', 'aws-common.sh'];
  return command(scripts.map((script) => `${bash} -n scripts/${script}`).join(' && '))(log);
});
await step('Plantilla SAM (sam validate --lint)', async (log) => {
  if (!(await available('sam --version'))) return skip('AWS SAM CLI no instalado');
  return command('sam validate --lint -t infra/template.yaml --region us-east-1', {
    env: { SAM_CLI_TELEMETRY: '0' },
  })(log);
});

finish();
