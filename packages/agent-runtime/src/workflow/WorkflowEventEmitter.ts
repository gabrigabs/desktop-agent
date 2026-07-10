import type { AgentEvent, ApprovalRequest, WorkflowRun, WorkflowStep } from "@desktop-agent/shared";

export class WorkflowEventEmitter {
  constructor(
    private emit: (event: AgentEvent) => void,
    private requestId: string,
  ) {}

  runStarted(run: WorkflowRun): void {
    this.emit({
      type: "workflow.started",
      requestId: this.requestId,
      runId: run.id,
      mode: run.mode,
      prompt: run.prompt,
    });
  }

  runStatusChanged(run: WorkflowRun): void {
    this.emit({
      type: "workflow.status",
      requestId: this.requestId,
      runId: run.id,
      status: run.status,
    });
  }

  stepCreated(step: WorkflowStep): void {
    this.emit({
      type: "workflow.step",
      requestId: this.requestId,
      runId: step.runId,
      step,
    });
  }

  stepUpdated(step: WorkflowStep): void {
    this.emit({
      type: "workflow.step",
      requestId: this.requestId,
      runId: step.runId,
      step,
    });
  }

  approvalRequired(step: WorkflowStep, runId: string, approval: ApprovalRequest): void {
    this.emit({
      type: "workflow.approval_required",
      requestId: this.requestId,
      runId,
      stepId: step.id,
      stepTitle: step.title,
      approval,
    });
  }

  runCompleted(run: WorkflowRun): void {
    this.emit({
      type: "workflow.completed",
      requestId: this.requestId,
      runId: run.id,
      status: run.status,
      result: run.result,
    });
  }

  agentStarted(): void {
    this.emit({ type: "agent.started", requestId: this.requestId });
  }

  agentCompleted(): void {
    this.emit({ type: "agent.completed", requestId: this.requestId });
  }

  chunk(chunk: string): void {
    this.emit({ type: "agent.chunk", requestId: this.requestId, chunk });
  }

  thought(thought: string): void {
    this.emit({ type: "agent.thought", requestId: this.requestId, thought });
  }

  toolStarted(toolName: string, input: unknown): void {
    this.emit({
      type: "tool.started",
      requestId: this.requestId,
      toolName,
      input,
    });
  }

  toolFinished(toolName: string, output: unknown): void {
    this.emit({
      type: "tool.finished",
      requestId: this.requestId,
      toolName,
      output,
    });
  }

  error(message: string): void {
    this.emit({ type: "error", requestId: this.requestId, message });
  }
}
