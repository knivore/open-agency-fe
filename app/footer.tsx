import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="mt-auto flex w-full flex-col items-center border-t border-(--agency-shell-border) bg-(--agency-footer-bg) px-4 py-4 text-sm text-(--agency-footer-text) shadow-sm md:px-6">
      <p className="text-center">
        <span className="inline-flex items-center gap-1">
          Use
          <Image src="/images/open-agency.svg" alt="Open Agency logo" width={20} height={20} className="h-5 w-auto" />
          <b className="agency-gradient-text font-source-sans font-bold">Open Agency</b>
        </span>{' '}
        only for information up to <b className="font-bold">Restricted / Sensitive Normal</b>.
        <br />
        By using Open Agency, you acknowledge that automated decision-making processes (
        <span className="italic">agentic workflow</span>) may have limitations, and you retain
        responsibility for reviewing and validating any outputs or actions taken.
      </p>

      <div className="mt-2 flex flex-col items-center gap-1 text-center opacity-75 sm:flex-row sm:gap-2">
        <p>
          © {new Date().getFullYear()} <b>Open Agency</b>
        </p>
        <p>All rights reserved.</p>
      </div>
    </footer>
  );
}
