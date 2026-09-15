// Prueba de la interfaz en un navegador real (Chrome, Edge o Chromium en modo headless) contra la
// app levantada. Recorre lo que pide el enunciado: acceso, roles, tablero (crear, editar, Guardar,
// arrastrar, recargar, eliminar), dashboard y administración de usuarios.
//
//   docker compose up -d --build
//   cd tests/ui && npm ci && node ui-check.mjs
//
// Variables: BASE_URL (http://localhost:8080), ADMIN_EMAIL, ADMIN_PASSWORD, BROWSER_PATH (ruta del
// navegador si no se detecta) y SCREENSHOT_PATH (captura si falla).
// Código de salida: 0 todo OK · 1 algún fallo · 2 no hay navegador disponible.
//
// Deja en la base de datos un usuario de prueba inactivo (los usuarios no se borran); la nota que
// crea la elimina.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@demo.test';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin123!';
const SCREENSHOT_PATH = process.env.SCREENSHOT_PATH ?? 'ui-check-error.png';
const stamp = Date.now();
const NOTE_TITLE = `ui-check-${stamp}`;
const USER = { name: `UI Check ${stamp}`, email: `ui-check-${stamp}@demo.test`, password: 'UiCheck123!' };

function findBrowser() {
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;
  const { ProgramFiles, LOCALAPPDATA } = process.env;
  const candidates = {
    win32: [
      process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'),
      ProgramFiles && join(ProgramFiles, 'Microsoft/Edge/Application/msedge.exe'),
      ProgramFiles && join(ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
      LOCALAPPDATA && join(LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
      '/snap/bin/chromium',
    ],
  }[process.platform] ?? [];
  return candidates.filter(Boolean).find((path) => existsSync(path));
}

const browserPath = findBrowser();
if (!browserPath) {
  console.log('No se encontró Chrome, Edge ni Chromium. Define BROWSER_PATH con la ruta del navegador.');
  process.exit(2);
}

let failures = 0;
function check(name, passed, detail = '') {
  console.log(`  ${passed ? 'ok   ' : 'FALLO'}  ${name}${detail ? ` · ${detail}` : ''}`);
  if (!passed) failures++;
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const path = (page) => page.evaluate(() => location.pathname);
const bodyHas = (page, text, timeout = 8000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text).then(
    () => true,
    () => false,
  );

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await page.locator('::-p-aria([name="Correo electrónico"][role="textbox"])').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.locator('button[type=submit]').click();
}
const navLinks = (page) => page.$$eval('.nav a', (links) => links.map((a) => a.textContent.trim()));

/** Estado de la nota con ese título (tras recargar ya no existe el atributo de prueba). */
function noteState(page, title) {
  return page.evaluate((t) => {
    const card = [...document.querySelectorAll('.note')].find((n) => n.querySelector('.note__title').value === t);
    if (!card) return null;
    return {
      left: card.style.left,
      top: card.style.top,
      body: card.querySelector('.note__body').value,
      status: card.querySelector('.note__status').value,
      state: card.querySelector('.note__state').textContent,
    };
  }, title);
}

/** Arrastra la nota desde su cabecera y devuelve el código HTTP del guardado de posición. */
async function drag(page, selector, dx, dy) {
  const box = await (await page.$(`${selector} .note__handle`)).boundingBox();
  const x = box.x + 20;
  const y = box.y + box.height / 2;
  const saved = page.waitForResponse(
    (r) => r.url().includes('/position') && r.request().method() === 'PATCH',
    { timeout: 8000 },
  );
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  await page.mouse.up();
  return (await saved).status();
}

const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
  args: process.platform === 'linux' ? ['--no-sandbox'] : [],
});

try {
  const admin = await browser.newPage();
  admin.on('dialog', (dialog) => dialog.accept());
  console.log(`Interfaz contra ${BASE} (${browserPath})`);

  // --- Acceso
  await admin.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle0' });
  check('sin sesión, /dashboard redirige a /login', (await path(admin)) === '/login');
  await login(admin, ADMIN_EMAIL, ADMIN_PASSWORD);
  await admin.waitForSelector('.topbar');
  const adminLinks = await navLinks(admin);
  check('admin ve Tablero, Dashboard y Usuarios', adminLinks.join() === 'Tablero,Dashboard,Usuarios', adminLinks.join(', '));
  check('tras iniciar sesión vuelve a la ruta pedida', (await path(admin)) === '/dashboard', await path(admin));

  // --- Tablero: crear, editar y Guardar
  await admin.locator('.nav a::-p-text(Tablero)').click();
  await admin.waitForSelector('.board__canvas');
  const before = (await admin.$$('.note')).length;
  await admin.locator('::-p-text(+ Nueva nota)').click();
  await admin.waitForFunction((n) => document.querySelectorAll('.note').length === n + 1, {}, before);
  await admin.waitForFunction(() => document.activeElement?.classList.contains('note__title'));
  await admin.evaluate(() => document.activeElement.closest('.note').setAttribute('data-test', 'ui-check'));
  check('+ Nueva nota crea una nota con el foco en el título', true);

  const NOTE = '[data-test="ui-check"]';
  await admin.locator(`${NOTE} .note__title`).fill(NOTE_TITLE);
  await admin.locator(`${NOTE} .note__body`).fill('texto guardado');
  await (await admin.$(`${NOTE} .note__status`)).select('in_progress');
  check('editar sobre la nota muestra «Cambios sin guardar»', (await noteState(admin, NOTE_TITLE)).state === 'Cambios sin guardar');
  await admin.locator(`${NOTE} button[type=submit]`).click();
  await admin.waitForFunction((s) => document.querySelector(`${s} .note__state`).textContent === 'Guardado', {}, NOTE);
  check('Guardar confirma el contenido', true);

  // --- Arrastrar y soltar
  const initial = await noteState(admin, NOTE_TITLE);
  const firstSave = await drag(admin, NOTE, 260, 180);
  const moved = await noteState(admin, NOTE_TITLE);
  check('al soltar se guarda la posición', firstSave === 200 && moved.left !== initial.left, `${initial.left},${initial.top} → ${moved.left},${moved.top}`);

  await admin.locator(`${NOTE} .note__body`).fill('borrador sin guardar');
  const secondSave = await drag(admin, NOTE, 60, 40);
  const draft = await noteState(admin, NOTE_TITLE);
  check('mover no pierde el borrador sin guardar', secondSave === 200 && draft.body === 'borrador sin guardar' && draft.state === 'Cambios sin guardar');

  await admin.reload({ waitUntil: 'networkidle0' });
  await admin.waitForSelector('.board__canvas');
  const reloaded = await noteState(admin, NOTE_TITLE);
  check('al recargar se conservan título, estado y posición', reloaded?.status === 'in_progress' && reloaded.left === draft.left && reloaded.top === draft.top, reloaded ? `${reloaded.left},${reloaded.top}` : 'no encontrada');
  check('al recargar se descarta lo no guardado', reloaded?.body === 'texto guardado');

  // --- Dashboard
  await admin.locator('.nav a::-p-text(Dashboard)').click();
  check('dashboard muestra total y distribución por estado', await bodyHas(admin, 'Distribución por estado'));
  const lambdaTotal = await admin.evaluate(() => fetch('/api/metrics').then((r) => r.json()).then((m) => m.total));
  const shownTotal = await admin.evaluate(() => {
    const label = [...document.querySelectorAll('.metric__label')].find((l) => l.textContent === 'Total de notas');
    return Number(label?.parentElement.textContent.match(/\d+/)?.[0]);
  });
  check('el total mostrado es el que calcula la Lambda', shownTotal === lambdaTotal, `${shownTotal} = ${lambdaTotal}`);
  check('indica que las cifras vienen de AWS Lambda', await bodyHas(admin, 'Lambda', 2000));

  // --- Eliminar
  await admin.locator('.nav a::-p-text(Tablero)').click();
  await admin.waitForSelector('.board__canvas');
  await admin.evaluate(
    (t) => [...document.querySelectorAll('.note')].find((n) => n.querySelector('.note__title').value === t).querySelector('.note__delete').click(),
    NOTE_TITLE,
  );
  await admin.waitForFunction((t) => ![...document.querySelectorAll('.note__title')].some((input) => input.value === t), { timeout: 8000 }, NOTE_TITLE);
  await admin.reload({ waitUntil: 'networkidle0' });
  await admin.waitForSelector('.board__canvas');
  check('eliminar con confirmación y no reaparece al recargar', (await noteState(admin, NOTE_TITLE)) === null);

  // --- Usuarios: crear
  await admin.locator('.nav a::-p-text(Usuarios)').click();
  await admin.locator('::-p-text(Nuevo usuario)').click();
  await admin.locator('dialog input[name="name"]').fill(USER.name);
  await admin.locator('dialog input[name="email"]').fill(USER.email);
  await (await admin.waitForSelector('dialog select[name="role"]')).select('user');
  await admin.locator('dialog input[name="password"]').fill(USER.password);
  await admin.locator('::-p-text(Crear usuario)').click();
  check('admin crea un usuario con rol Usuario', await bodyHas(admin, USER.email));

  // --- El usuario creado entra en otra sesión del navegador
  const context = await browser.createBrowserContext();
  const user = await context.newPage();
  user.on('dialog', (dialog) => dialog.accept());
  await login(user, USER.email, USER.password);
  await user.waitForSelector('.topbar');
  check('el usuario creado inicia sesión con su contraseña inicial', (await path(user)) !== '/login');
  const userLinks = await navLinks(user);
  check('rol Usuario no ve Usuarios en el menú', userLinks.join() === 'Tablero,Dashboard', userLinks.join(', '));
  await user.goto(`${BASE}/admin/usuarios`, { waitUntil: 'networkidle0' });
  await sleep(500);
  check('rol Usuario no puede abrir /admin/usuarios', (await path(user)) !== '/admin/usuarios', await path(user));
  const forbidden = await user.evaluate(() => fetch('/api/users').then((r) => r.status));
  check('rol Usuario recibe 403 en /api/users', forbidden === 403, String(forbidden));

  // --- Desactivar con la sesión abierta
  const clickRowButton = (email, text) =>
    admin.evaluate(
      (e, t) => {
        const row = [...document.querySelectorAll('tr')].find((r) => r.textContent.includes(e));
        [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === t).click();
      },
      email,
      text,
    );
  const waitRowStatus = (email, status) =>
    admin.waitForFunction(
      (e, s) => [...document.querySelectorAll('tr')].find((r) => r.textContent.includes(e))?.textContent.includes(s),
      { timeout: 8000 },
      email,
      status,
    );

  await clickRowButton(USER.email, 'Desactivar');
  await waitRowStatus(USER.email, 'Inactivo');
  check('admin desactiva al usuario', true);
  await user.locator('.nav a::-p-text(Dashboard)').click();
  check('el usuario desactivado es expulsado en su siguiente acción', await bodyHas(user, 'Sesión finalizada o usuario inactivo'), await path(user));
  await login(user, USER.email, USER.password);
  check('un usuario inactivo no puede iniciar sesión', await bodyHas(user, 'Tu usuario está inactivo'));

  // --- Reactivar
  await clickRowButton(USER.email, 'Reactivar');
  await waitRowStatus(USER.email, 'Activo');
  await login(user, USER.email, USER.password);
  await user.waitForSelector('.topbar', { timeout: 8000 }).catch(() => null);
  check('el usuario reactivado vuelve a entrar', (await path(user)) !== '/login');

  // --- Último administrador: solo si el de la demo es el único activo (nunca deja la BD sin admin)
  const activeAdmins = await admin.evaluate(() =>
    fetch('/api/users').then((r) => r.json()).then((users) => users.filter((u) => u.role === 'admin' && u.active).length),
  );
  if (activeAdmins === 1) {
    await clickRowButton(ADMIN_EMAIL, 'Desactivar');
    check('no se puede desactivar al último administrador activo', await bodyHas(admin, 'al menos un administrador activo'));
    const stillActive = await admin.evaluate(
      (e) => fetch('/api/users').then((r) => r.json()).then((users) => users.find((u) => u.email === e).active),
      ADMIN_EMAIL,
    );
    check('el administrador sigue activo', stillActive === true);
  } else {
    console.log(`  (omitido)  último administrador: hay ${activeAdmins} administradores activos en esta BD`);
  }

  // --- Salir
  await clickRowButton(USER.email, 'Desactivar');
  await admin.locator('::-p-text(Salir)').click();
  await admin.waitForFunction(() => location.pathname === '/login', { timeout: 8000 });
  await admin.goBack({ waitUntil: 'networkidle0' });
  await sleep(500);
  check('tras Salir, volver atrás no muestra el área autenticada', (await path(admin)) === '/login', await path(admin));
} catch (error) {
  failures++;
  console.log(`  FALLO  excepción: ${error.message}`);
  const pages = await browser.pages();
  await pages.at(-1)?.screenshot({ path: SCREENSHOT_PATH }).catch(() => {});
  console.log(`         captura: ${SCREENSHOT_PATH}`);
} finally {
  await browser.close();
}

console.log(failures > 0 ? `Interfaz: ${failures} fallo(s)` : 'Interfaz OK');
process.exit(failures > 0 ? 1 : 0);
