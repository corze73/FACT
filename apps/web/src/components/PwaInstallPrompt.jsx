import { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';

const DISMISS_KEY = 'fact-install-prompt-dismissed';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIosDevice = () => /iPad|iPhone|iPod/.test(window.navigator.userAgent);

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || window.sessionStorage.getItem(DISMISS_KEY) === '1') return undefined;

    if (isIosDevice()) {
      setShowIosHelp(true);
      setVisible(true);
    }

    const handleInstallAvailable = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      setVisible(true);
    };

    const handleInstalled = () => setVisible(false);
    window.addEventListener('beforeinstallprompt', handleInstallAvailable);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const dismiss = () => {
    window.sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setVisible(false);
    setInstallEvent(null);
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Install FACT"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
        aria-label="Dismiss install suggestion"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="pr-10">
        <p className="font-bold">Add FACT to your Home Screen</p>
        {showIosHelp ? (
          <p className="mt-1 text-sm leading-6 text-slate-600">
            In Safari, tap <Share2 className="mx-1 inline h-4 w-4" aria-label="Share" /> Share, then choose
            <strong> Add to Home Screen</strong>.
          </p>
        ) : (
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Install FACT for quick access from your phone without visiting an app store.
          </p>
        )}
      </div>

      {installEvent && (
        <button
          type="button"
          onClick={install}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1e3478] px-4 py-2 font-semibold text-white hover:bg-[#17295f]"
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          Install FACT
        </button>
      )}
    </aside>
  );
}
