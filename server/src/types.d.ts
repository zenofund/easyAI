
declare module 'pdf-parse-new' {
  function PDF(dataBuffer: Buffer, options?: any): Promise<{
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }>;
  export = PDF;
}

declare module 'pdf-img-convert' {
  export function convert(
    pdf: string | Uint8Array | Buffer,
    options?: {
      width?: number;
      height?: number;
      page_numbers?: number[];
      base64?: boolean;
      scale?: number;
    }
  ): Promise<string[] | Uint8Array[]>;
}
