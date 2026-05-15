import { generateUniqueCode } from "@/modules/links/domain/code-generation";
import type { CodeGeneratorPort } from "../../application/code-generator.port";

export class CodeGeneratorImpl implements CodeGeneratorPort {
  async generate(exists: (code: string) => Promise<boolean>): Promise<string> {
    return generateUniqueCode({ exists });
  }
}
