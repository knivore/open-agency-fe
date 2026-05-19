import { useEffect, useRef, useState } from 'react';
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

  const clearTimeouts = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTimeout = () => {
    clearTimeouts();

    // Set initial time
    setTimeRemaining(TIMEOUT_DURATION);

    // Start countdown interval
    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1000));
    }, 1000);

    // Set timeout to close modal
    timeoutRef.current = setTimeout(() => {
      setIsModalOpen(false);
      setAgentQuery('');
      setHumanResponse('');
      clearTimeouts();
    }, TIMEOUT_DURATION);
  };

  const handleNotifications = () => {
    // Store original title
    originalTitleRef.current = document.title;

    // Change document title
    document.title = 'agency needs your attention!';

    // Set timeout to revert title
    setTimeout(() => {
      document.title = originalTitleRef.current;
    }, 3000);

    // Check if window is hidden and notifications are permitted
    // const isHidden = document.visibilityState === 'hidden';
    // console.log('Document visibility state:', document.visibilityState);
    // console.log('Notification permission:', Notification.permission);

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
          console.log('Notification permission status:', permission);
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
            console.log('Received SSE message:', event.data);
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
  }, [processId]);

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
    <Modal isOpen={isModalOpen} onClose={() => {
      clearTimeouts();
      setIsModalOpen(false);
    }}>
      <div className="mb-6">
        <div className="flex items-center">
          <h2 className="text-2xl font-semibold text-gray-900">Agent Question</h2>
          <div className="relative group ml-2 flex items-center">
            <HelpCircle className="w-5 h-5 text-gray-500 cursor-pointer" />
            <div
              className="absolute transform -translate-x-1/4 bottom-full mb-2 hidden w-max bg-gray-800 text-white text-xs rounded-md p-2 shadow-lg group-hover:block">
              Agent's question for you as they require more information to further the workflow.
            </div>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Time remaining: {formatTimeRemaining(timeRemaining)}
        </div>
      </div>

      <div className="flex flex-col space-y-4">
        <div className="space-y-2">
          <Textarea
            id="agent-query"
            value={agentQuery}
            className="min-h-[100px] resize-none bg-muted"
            readOnly
            disabled
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="human-response">Your Response</Label>
          <div className="flex gap-2">
            <Input
              id="human-response"
              value={humanResponse}
              onChange={(e) => setHumanResponse(e.target.value)}
              placeholder="Enter your response here..."
              className="flex-1"
            />
            <Button
              onClick={sendHumanInput}
              className="whitespace-nowrap"
            >
              Submit Response
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default HITL;
