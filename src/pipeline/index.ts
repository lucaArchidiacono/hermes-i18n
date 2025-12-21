import type { PipelineContext, PipelineStep } from "./types.js";
import { logger } from "../utils/logger.js";

/**
 * Pipeline runner - executes steps sequentially
 */
export class Pipeline {
  private steps: PipelineStep[] = [];

  /**
   * Add a step to the pipeline
   */
  addStep(step: PipelineStep): Pipeline {
    this.steps.push(step);
    return this;
  }

  /**
   * Execute all steps in order
   */
  async execute(context: PipelineContext): Promise<PipelineContext> {
    let currentContext = context;

    for (const step of this.steps) {
      logger.start(`Running step: ${step.name}`);

      try {
        currentContext = await step.execute(currentContext);
        logger.success(`Completed: ${step.name}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Step "${step.name}" failed: ${message}`);

        currentContext.errors.push({
          step: step.name,
          message,
        });

        // Re-throw to stop pipeline on critical errors
        throw error;
      }
    }

    return currentContext;
  }
}

/**
 * Create a new pipeline instance
 */
export function createPipeline(): Pipeline {
  return new Pipeline();
}
