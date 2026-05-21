'use client';

import { Button } from '../library/shadcn/button';
import { FaRegCopy } from 'react-icons/fa';
import { toast } from 'sonner';

interface CopyToClipboardButtonProps {
  text: string;
}

export default function CopyToClipboardButton({ text }: CopyToClipboardButtonProps) {
  const handleCopyClick = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!', { position: 'top-right' });
    } catch (error) {
      console.error('Unable to copy to clipboard.', error);
      toast.error('Copy to clipboard failed!', { position: 'top-right' });
    }
  };

  return (
    <Button onClick={handleCopyClick} variant="outline" className="mb-2 h-7 px-2 py-2">
      <FaRegCopy />
    </Button>
  );
}
