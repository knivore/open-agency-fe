export default function Footer() {
  return (
    <footer className="mt-auto flex w-full flex-col items-center border-t border-primary-100 bg-white px-4 py-4 text-sm text-gray-600 shadow-sm shadow-primary/5 dark:border-border dark:bg-card dark:text-muted-foreground md:px-6">
      <p className="text-center">
        <span className="inline-flex items-center gap-1">
          Use
          <img src="/images/agency.svg" alt="Agency Logo" className="h-5 w-auto" />
          <b className="agency-gradient-text font-source-sans font-bold">Agency</b>
        </span>{' '}
        only for information up to <b className="font-bold">Restricted / Sensitive Normal</b>.
        <br />
        By using agency, you acknowledge that automated decision-making processes (
        <span className="italic">agentic workflow</span>) may have limitations, and you retain
        responsibility for reviewing and validating any outputs or actions taken.
      </p>

      <div className="mt-2 flex flex-col sm:flex-row items-center gap-1 sm:gap-2 opacity-75 text-center">
        <p>
          © {new Date().getFullYear()} <b>agency</b>
        </p>
        <p>All rights reserved.</p>
      </div>
    </footer>
  );
}
