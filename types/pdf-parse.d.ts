declare module 'pdf-parse/lib/pdf-parse.js' {
  function pdf(buffer: Buffer): Promise<{
    text: string;
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
  }>;
  export = pdf;
} 