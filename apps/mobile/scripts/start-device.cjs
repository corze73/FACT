const os = require('node:os');
const { spawn } = require('node:child_process');

const args = process.argv.slice(2);
const shouldPrintHost = args.includes('--print-host');
const shouldDryRun = args.includes('--dry-run');
const forwardedArgs = args.filter((arg) => arg !== '--print-host' && arg !== '--dry-run');

function isPrivateIPv4(address) {
  return /^10\./.test(address)
    || /^192\.168\./.test(address)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(address);
}

function isUsableMetroHost(address) {
  return !/^127\./.test(address)
    && !/^169\.254\./.test(address)
    && !/^192\.0\.0\./.test(address)
    && !/^198\.51\.100\./.test(address)
    && !/^203\.0\.113\./.test(address);
}

function listExternalIPv4Addresses(interfaceNames) {
  return interfaceNames.flatMap((name) => {
    const entries = os.networkInterfaces()[name] || [];
    return entries
      .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
      .map((entry) => ({ name, address: entry.address }));
  });
}

function detectMetroHost() {
  const interfaces = os.networkInterfaces();
  const preferredNames = ['en0', 'en1', 'bridge100'];
  const fallbackNames = Object.keys(interfaces).filter((name) => !preferredNames.includes(name));
  const candidates = listExternalIPv4Addresses([...preferredNames, ...fallbackNames])
    .filter((candidate) => isUsableMetroHost(candidate.address));

  return candidates.find((candidate) => isPrivateIPv4(candidate.address))?.address
    || candidates[0]?.address
    || null;
}

const metroHost = detectMetroHost();
const useTunnel = !metroHost;

if (shouldPrintHost) {
  console.log(metroHost || 'tunnel');
  process.exit(0);
}

const expoArgs = useTunnel
  ? ['expo', 'start', '--tunnel', ...forwardedArgs]
  : ['expo', 'start', '--host', 'lan', ...forwardedArgs];
const env = useTunnel
  ? { ...process.env }
  : {
      ...process.env,
      REACT_NATIVE_PACKAGER_HOSTNAME: metroHost,
    };

if (shouldDryRun) {
  console.log(useTunnel ? 'No usable LAN IPv4 detected; falling back to Expo tunnel.' : `REACT_NATIVE_PACKAGER_HOSTNAME=${metroHost}`);
  console.log(`npx ${expoArgs.join(' ')}`);
  process.exit(0);
}

const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', expoArgs, {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
