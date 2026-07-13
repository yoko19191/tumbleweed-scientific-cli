import { Command } from "commander";
import { uploadFile } from "../client.js";
import { outputJson, outputSuccess } from "../output.js";

export function registerUploadCommand(program: Command): void {
  program
    .command("upload")
    .description("Upload an input file via presigned URL")
    .argument("<file>", "Local file path to upload")
    .requiredOption("--model <id>", "Model ID")
    .requiredOption("--input-name <name>", "Input name as defined in model spec")
    .option("--job-id <id>", "Associate upload with a specific job ID")
    .action(
      async (
        file: string,
        opts: { model: string; inputName: string; jobId?: string },
      ) => {
        const result = await uploadFile({
          modelId: opts.model,
          inputName: opts.inputName,
          filePath: file,
          jobId: opts.jobId,
        });

        outputSuccess(`Uploaded → ${result.objectKey}`);
        outputJson(result);
      },
    );
}
