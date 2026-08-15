import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Error 404</p>
      <h1 className="mt-2 text-4xl font-bold text-slate-900">We couldn’t find that page</h1>
      <p className="mt-4 max-w-xl text-lg text-slate-600">
        The address may be incorrect or the page may have moved. You can return home or contact FACT support.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          to={createPageUrl('Landing')}
          className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800"
        >
          Return home
        </Link>
        <Link
          to={createPageUrl('Help')}
          className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50"
        >
          Get help
        </Link>
      </div>
    </section>
  );
}
