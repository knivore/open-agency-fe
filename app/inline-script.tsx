type InlineScriptProps = {
  html: string;
};

export function InlineScript({ html }: InlineScriptProps) {
  return (
    <script
      // Next.js 16 warns when client rendering produces executable <script> tags.
      // Keep the bootstrap script executable in the server HTML, then make the
      // client render inert so hydration preserves the DOM without re-running it.
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
