// Punto de entrada de la tienda: revisa la versión de Node y arranca el servidor.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\n  Esta tienda necesita Node.js 22.13 o superior (tenés la ${process.versions.node}).\n  Descargá la versión LTS desde https://nodejs.org y volvé a intentar.\n`);
  process.exit(1);
}

await import('./src/server.js');
