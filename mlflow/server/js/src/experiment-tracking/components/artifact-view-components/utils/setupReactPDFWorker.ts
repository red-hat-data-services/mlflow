// eslint-disable-next-line import/no-namespace
import type * as pdfjs from 'pdfjs-dist';

// Use a looser type to accommodate different pdfjs-dist versions (react-pdf bundled vs direct)
export function setupReactPDFWorker(pdfjsInstance: typeof pdfjs | { GlobalWorkerOptions: { workerSrc: string } }) {
  pdfjsInstance.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
}
