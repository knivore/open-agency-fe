import { useCallback, useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { sendWorkflowHumanReply } from '@/app/api/utils/workflows';
import { Modal } from '../modal/Modal';
import { Button } from '../library/shadcn/button';
import { Label } from '../library/shadcn/label';
import { Textarea } from '../library/shadcn/textarea';
import { Input } from '../library/shadcn/input';

const TIMEOUT_DURATION = 55000;

const HITL = ({ processId }: { processId: string }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [agentQuery, setAgentQuery] = useState('');
  const [humanResponse, setHumanResponse] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(TIMEOUT_DURATION);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const originalTitleRef = useRef<string>(document.title);

  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimeout = useCallback(() => {
    clearTimeouts();

    // Set initial time
    setTimeRemaining(TIMEOUT_DURATION);

    // Start countdown interval
    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1000));
    }, 1000);

    // Set timeout to close modal
    timeoutRef.current = setTimeout(() => {
      setIsModalOpen(false);
      setAgentQuery('');
      setHumanResponse('');
      clearTimeouts();
    }, TIMEOUT_DURATION);
  }, [clearTimeouts]);

  const handleNotifications = () => {
    // Store original title
    originalTitleRef.current = document.title;

    // Change document title
    document.title = 'agency needs your attention!';

    // Set timeout to revert title
    setTimeout(() => {
      document.title = originalTitleRef.current;
    }, 3000);

    if (Notification.permission === 'granted') {
      try {
        new Notification('agency', {
          body: 'agency needs your attention. Click here to respond.',
          icon: '/favicon.ico', // Optional: Add your favicon path
          requireInteraction: true, // Makes notification persist until user interacts
        });
      } catch (error) {
        console.error('Error creating notification:', error);
      }
    }
  };

  // * Listens for agent's question via SSE
  useEffect(() => {
    // Request notification permission on component mount
    const requestNotificationPermission = async () => {
      if (Notification.permission !== 'granted') {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'denied') {
            console.warn('Browser notifications were denied for HITL prompts.');
          }
        } catch (error) {
          console.error('Error requesting notification permission:', error);
        }
      }
    };

    requestNotificationPermission();

    const setupEventSource = (processId: string) => {
      if (!processId || eventSourceRef.current) return;

      try {
        const eventSource = new EventSource(`/api/workflows/process/${processId}/hitl`);
        eventSourceRef.current = eventSource;

        // Handle messages
        eventSource.onmessage = (event) => {
          try {
            const messageText = event.data;

            setIsModalOpen(true);
            setAgentQuery(messageText); // Set agent's message to input
            startTimeout(); // Start timeout when receiving a new message
            handleNotifications();
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        };

        // Handle specific events
        eventSource.addEventListener('error', (error) => {
          console.error('SSE error:', error);
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          setTimeout(() => setupEventSource(processId), 5000);
        });

        eventSource.addEventListener('close', () => {
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        });
      } catch (error) {
        console.error('Error setting up EventSource:', error);
      }
    };

    if (processId) {
      setupEventSource(processId);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      clearTimeouts();
      // Restore original title if component unmounts
      document.title = originalTitleRef.current;
    };
  }, [clearTimeouts, processId, startTimeout]);

  const sendHumanInput = async () => {
    if (!processId) return;

    clearTimeouts();

    await sendWorkflowHumanReply(humanResponse, processId).then(() => {
      setIsModalOpen(false);
      setAgentQuery('');
      setHumanResponse('');
    });
  };

  const formatTimeRemaining = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={() => {
        clearTimeouts();
        setIsModalOpen(false);
      }}
    >
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-(--agency-shell-text)">
            Agent question
          </h2>
          <HelpCircle
            className="size-4 text-(--agency-shell-muted)"
            aria-label="The agent needs more information before it can continue the workflow."
          />
        </div>
        <div className="mt-2 text-sm text-(--agency-shell-muted)">
          Time remaining: {formatTimeRemaining(timeRemaining)}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Textarea
            id="agent-query"
            value={agentQuery}
            className="min-h-25 resize-none bg-muted"
            readOnly
            disabled
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="human-response">Your response</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="human-response"
              value={humanResponse}
              onChange={(e) => setHumanResponse(e.target.value)}
              placeholder="Enter your response here..."
              className="flex-1"
            />
            <Button onClick={sendHumanInput} className="whitespace-nowrap">
              Submit response
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default HITL;
