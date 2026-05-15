export interface CodeGeneratorPort {
  generate(exists: (code: string) => Promise<boolean>): Promise<string>;
}
