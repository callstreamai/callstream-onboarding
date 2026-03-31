declare module "xml2js" {
  export function parseStringPromise(
    str: string,
    options?: Record<string, unknown>
  ): Promise<Record<string, unknown>>;
}
