export interface WorkflowErrorPresentation {
  title: string;
  summary: string;
  guidance: string;
  technicalDetails: string;
}

export function workflowErrorPresentation(
  message: string,
  fallbackTitle: string
): WorkflowErrorPresentation {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('shell command') && normalizedMessage.includes('allow_shell')) {
    return {
      title: 'Shell command tools are disabled',
      summary:
        'This workflow includes a command tool that the backend will not run until shell access is explicitly enabled.',
      guidance:
        'Review the tool security settings, enable shell access only when intended, then retry saving.',
      technicalDetails: message,
    };
  }

  if (
    normalizedMessage.includes('shell command') &&
    normalizedMessage.includes('sandbox_required')
  ) {
    return {
      title: 'Shell command sandbox is required',
      summary:
        'This workflow includes a command tool that must run inside the configured sandbox boundary.',
      guidance:
        'Keep sandboxing enabled for the command tool, then retry saving. Open Agency will not run unsandboxed workflow commands.',
      technicalDetails: message,
    };
  }

  if (normalizedMessage.includes('validation')) {
    return {
      title: 'Workflow settings need attention',
      summary:
        'The backend found a workflow setting that must be corrected before this can continue.',
      guidance: 'Review the highlighted workflow settings, make the correction, then try again.',
      technicalDetails: message,
    };
  }

  return {
    title: fallbackTitle,
    summary: 'The operation could not be completed with the current workflow configuration.',
    guidance: 'Try again. If the problem continues, expand the technical details for diagnosis.',
    technicalDetails: message,
  };
}
